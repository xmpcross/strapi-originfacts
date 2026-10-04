#!/usr/bin/env node
// Canonical-link auditor.
//
// Crawls a running instance of the site (no JS execution — raw HTML only),
// collects every internal <a href>, resolves each distinct target by
// following redirects and reading the target page's <link rel="canonical">,
// and reports every link whose href differs from the target's canonical
// path. Links that point at a redirect are reported even when the final
// page has no canonical tag — internal links should not spend crawl budget
// on hops.
//
// Usage:
//   node scripts/check-canonical-links.mjs [baseUrl] [--out <file>] [--max <n>]
//
//   baseUrl  defaults to http://127.0.0.1:3000 (a local `next start`);
//            pass https://www.originfacts.com to audit production.
//   --out    write a markdown report (default: stdout only)
//   --max    page-crawl cap (default 500; entity pages beyond the cap are
//            not crawled as SOURCES but still resolved as TARGETS)
//
// Exit code is always 0 — this is a report, not a gate (CI runs it
// non-blocking). The summary line "NON-CANONICAL LINKS: n" is grep-friendly.

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith('--')) || 'http://127.0.0.1:3000').replace(/\/$/, '');
const outIdx = args.indexOf('--out');
const outFile = outIdx !== -1 ? args[outIdx + 1] : null;
const maxIdx = args.indexOf('--max');
const MAX_PAGES = maxIdx !== -1 ? Number(args[maxIdx + 1]) : 500;

const seen = new Set();
const queue = ['/'];
// href -> Set of source paths that link to it
const linkSources = new Map();

const norm = (href) => {
  try {
    const u = new URL(href, base);
    if (u.origin !== new URL(base).origin && !u.hostname.endsWith('originfacts.com')) return null;
    let p = u.pathname;
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p;
  } catch {
    return null;
  }
};

const skip = (p) =>
  !p ||
  p.startsWith('/_next') ||
  p.startsWith('/api/') ||
  /\.(png|jpg|jpeg|svg|ico|xml|txt|css|js|webmanifest)$/i.test(p);

async function fetchPage(path) {
  try {
    const res = await fetch(`${base}${path}`, { redirect: 'manual', headers: { 'User-Agent': 'originfacts-canonical-audit' } });
    return res;
  } catch {
    return null;
  }
}

console.log(`Crawling ${base} (cap ${MAX_PAGES} source pages)…`);
while (queue.length && seen.size < MAX_PAGES) {
  const path = queue.shift();
  if (seen.has(path) || skip(path)) continue;
  seen.add(path);
  const res = await fetchPage(path);
  if (!res || res.status !== 200 || !(res.headers.get('content-type') || '').includes('text/html')) continue;
  const html = await res.text();
  for (const m of html.matchAll(/<a\s[^>]*href="([^"#?]+)[^"]*"/g)) {
    const target = norm(m[1]);
    if (skip(target)) continue;
    if (!linkSources.has(target)) linkSources.set(target, new Set());
    linkSources.get(target).add(path);
    if (!seen.has(target) && seen.size + queue.length < MAX_PAGES * 3) queue.push(target);
  }
}
console.log(`Crawled ${seen.size} pages, ${linkSources.size} distinct link targets.`);

// Resolve each distinct target: follow redirects (up to 5), read canonical.
// Runs 12 targets at a time — the sitemap page alone links thousands.
async function resolveTarget([href, sources]) {
  let current = href;
  const chain = [];
  let res = null;
  for (let hop = 0; hop < 5; hop++) {
    res = await fetchPage(current);
    if (!res) return null;
    if ([301, 302, 307, 308].includes(res.status)) {
      const loc = norm(res.headers.get('location') || '');
      if (!loc) break;
      chain.push(`${res.status}→${loc}`);
      current = loc;
      continue;
    }
    break;
  }
  if (!res) return null;
  let canonical = null;
  if (res.status === 200 && (res.headers.get('content-type') || '').includes('text/html')) {
    const html = await res.text();
    const cm = html.match(/<link rel="canonical" href="([^"]+)"/);
    if (cm) canonical = norm(cm[1]);
  }
  const finalTarget = canonical || (chain.length ? current : null);
  if (finalTarget && finalTarget !== href) {
    return { href, shouldBe: finalTarget, chain, sources: [...sources].sort() };
  }
  return null;
}

const problems = [];
const entries = [...linkSources.entries()];
for (let i = 0; i < entries.length; i += 12) {
  const batch = await Promise.all(entries.slice(i, i + 12).map(resolveTarget));
  problems.push(...batch.filter(Boolean));
  if (i % 600 === 0 && i > 0) console.log(`  resolved ${i}/${entries.length} targets…`);
}

problems.sort((a, b) => b.sources.length - a.sources.length);
// A target whose canonical resolves to the site root while its own path is
// deeper is not a bad LINK — it's a page inheriting the root layout's
// `canonical: '/'` because it never sets its own. That's a canonical bug on
// the target page; the link itself points at the right URL. Bucket these
// separately so link defects stay actionable.
const linkBugs = problems.filter((p) => !(p.shouldBe === '/' && p.href !== '/' && !p.chain.length));
const inheritedCanonical = problems.filter((p) => p.shouldBe === '/' && p.href !== '/' && !p.chain.length);

const lines = [];
lines.push('# Non-canonical internal links');
lines.push('');
lines.push(`Base: \`${base}\` · crawled ${seen.size} pages · ${linkSources.size} distinct link targets · generated by \`scripts/check-canonical-links.mjs\``);
lines.push('');
if (!linkBugs.length) {
  lines.push("**No non-canonical internal links found.** Every crawled `<a href>` points at its target's canonical URL.");
} else {
  lines.push(`**${linkBugs.length} link target(s) differ from their canonical:**`);
  lines.push('');
  lines.push('| Linked href | Should be | Why | Linked from (sample) |');
  lines.push('|---|---|---|---|');
  for (const p of linkBugs) {
    const why = p.chain.length ? p.chain.join(' ') : 'canonical tag differs';
    const from = p.sources.slice(0, 4).join(', ') + (p.sources.length > 4 ? ` +${p.sources.length - 4} more` : '');
    lines.push(`| \`${p.href}\` | \`${p.shouldBe}\` | ${why} | ${from} |`);
  }
}
if (inheritedCanonical.length) {
  lines.push('');
  lines.push(`## Pages inheriting the layout's homepage canonical (${inheritedCanonical.length})`);
  lines.push('');
  lines.push("These targets declare `canonical: /` because the ROOT LAYOUT sets `canonical: '/'` and the page template never overrides it — every such page tells crawlers it is a duplicate of the homepage. The links pointing at them are fine; the fix is a self-referencing canonical (or none) on each affected TEMPLATE. Grouped by path prefix:");
  lines.push('');
  const byPrefix = {};
  for (const p of inheritedCanonical) {
    const prefix = '/' + (p.href.split('/')[1] || '');
    (byPrefix[prefix] ||= []).push(p.href);
  }
  for (const [prefix, hrefs] of Object.entries(byPrefix).sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`- \`${prefix}\` — ${hrefs.length} page(s), e.g. \`${hrefs[0]}\``);
  }
}
lines.push('');
const report = lines.join('\n');
console.log(report);
console.log(`NON-CANONICAL LINKS: ${linkBugs.length}`);
console.log(`INHERITED-HOMEPAGE-CANONICAL PAGES: ${inheritedCanonical.length}`);
if (outFile) {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, report + '\n');
  console.log(`Report written to ${outFile}`);
}
