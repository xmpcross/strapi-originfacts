#!/usr/bin/env node
/**
 * Stage 2c — auto-promote fields whose citation can be proved.
 *
 *   npm run promote -- --carrier ryanair            # apply
 *   npm run promote -- --carrier ryanair --dry-run  # report only
 *
 * The division of labour this enforces:
 *
 *   a person decides WHAT a value means   — which field, which product, which fare
 *   a machine proves WHERE it came from   — this exact text is in that exact page
 *
 * The second half was being done by hand and it is the half a machine does
 * better. We hold the captured bytes, so "does 55x40x20cm actually appear in
 * the article at that URL" is a fact we can check, not a judgement. A person
 * eyeballing a source can misread it; a substring match cannot.
 *
 * A field is promoted only when ALL of these hold:
 *
 *   1. It has a value and a source_url, and status is still pending.
 *   2. The source_url is on the carrier's own registrable domain, taken from
 *      official_website. A figure sourced anywhere else is exactly the class of
 *      error the contact rule already blocks, and it is not safe to automate.
 *   3. Every measurement in the value appears in the captured article text for
 *      that URL. Numbers are checkable; prose is not.
 *
 * Values carrying no measurement — "None, no checked bag is included" — cannot
 * be substantiated this way and are left for a person, with the reason stated.
 * Automating a claim we cannot check is how this store gets a wrong figure with
 * a green stamp on it.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseDomain } from 'tldts';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const STORE = path.join(ROOT, 'content', 'airline-facts');
const CAPTURES = path.join(ROOT, 'data', 'captures');

/** Measurements a machine can look for verbatim. Deliberately narrow. */
const MEASUREMENT = /\b\d{1,4}(?:[.,]\d{1,2})?\s*(?:kg|kgs|lb|lbs|cm|mm|in|inches|hours?|hrs?|minutes?|mins?)\b|\b\d{1,3}\s*[x×]\s*\d{1,3}\s*[x×]\s*\d{1,3}\b/gi;

type Field = {
  value: string | null;
  status: string;
  source_url?: string;
  verified_at?: string;
  verified_by?: string;
  notes?: string;
};

type FactFile = {
  slug: string;
  official_website: string;
  modules: { id: string; title: string; required?: string[]; fields?: Record<string, Field> }[];
};

function parseArgs(argv: string[]): { carrier?: string; dryRun: boolean; recheck: boolean } {
  const out = { carrier: undefined as string | undefined, dryRun: false, recheck: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--carrier') out.carrier = argv[++i];
    else if (argv[i] === '--dry-run') out.dryRun = true;
    // Re-run the citation proof against fields that are already `official` and
    // were stamped by this tool. Reports only, never writes: a field that no
    // longer verifies needs a person to look at it, not an automatic demotion.
    //
    // This exists because the proof itself has been wrong twice. Both times the
    // fix silently changed what the tool would accept today without saying
    // anything about what it had already accepted, and the only way to find out
    // was to ask.
    else if (argv[i] === '--recheck') out.recheck = true;
  }
  return out;
}

/** Normalise for comparison: measurements are written inconsistently. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/\s*x\s*/g, 'x')
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s+(kg|lb|cm|mm|in)\b/g, '$1$2')
    .trim();
}

/** Every captured article, keyed by the URL it was fetched from. */
async function articlesByUrl(carrier: string): Promise<Map<string, { text: string; date: string }>> {
  const out = new Map<string, { text: string; date: string }>();
  const dates = (await fs.readdir(CAPTURES).catch(() => []))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

  const selectors = JSON.parse(await fs.readFile(path.join(import.meta.dirname, 'selectors.json'), 'utf8')) as Record<
    string,
    { article: string | null }
  >;
  const selector = selectors[carrier]?.article;

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  try {
    for (const date of dates) {
      const dir = path.join(CAPTURES, date, carrier);
      const files = await fs.readdir(dir).catch(() => []);
      for (const f of files.filter((x) => x.endsWith('.meta.json'))) {
        const meta = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
        const html = await fs.readFile(path.join(dir, `${meta.page_key}.html`), 'utf8').catch(() => null);
        if (!html) continue;
        const page = await ctx.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        // Prefer the article body; fall back to the whole page, because a
        // citation check should be generous about WHERE in the page the text
        // is, while being strict about whether it is there at all.
        const text = await page.evaluate((sel) => {
          const el = sel ? document.querySelector(sel) : null;
          return ((el as HTMLElement | null)?.innerText ?? document.body?.innerText ?? '').replace(/\s+/g, ' ');
        }, selector ?? null);
        await page.close();
        // Later dates overwrite earlier: the most recent capture is the one a
        // verification date should refer to.
        out.set(meta.url, { text: norm(text), date });
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
  return out;
}

type Outcome = { module: string; field: string; action: string; detail: string };

async function main(): Promise<void> {
  const { carrier, dryRun, recheck } = parseArgs(process.argv.slice(2));
  if (!carrier) {
    console.error('Usage: npm run promote -- --carrier <carrier_key> [--dry-run]');
    process.exitCode = 1;
    return;
  }

  const file = path.join(STORE, `${carrier}.json`);
  const doc = JSON.parse(await fs.readFile(file, 'utf8')) as FactFile;
  const officialDomain = parseDomain(new URL(doc.official_website).hostname).domain;
  const articles = await articlesByUrl(carrier);

  const outcomes: Outcome[] = [];
  let promoted = 0;

  for (const mod of doc.modules) {
    for (const [key, field] of Object.entries(mod.fields ?? {})) {
      const where = { module: mod.id, field: key };
      if (recheck) {
        // Every official field, not only the ones this tool stamped. The
        // hand-verified ones are the oldest in the store and were checked
        // against a page rather than against captured bytes, which is the
        // weaker of the two proofs, not the stronger.
        if (field.status !== 'official') continue;
      } else if (field.status !== 'pending') {
        continue;
      }
      if (!field.value) {
        outcomes.push({ ...where, action: 'skip', detail: 'no value yet — a person still has to decide what this field says' });
        continue;
      }
      if (!field.source_url) {
        outcomes.push({ ...where, action: 'skip', detail: 'value but no source_url' });
        continue;
      }

      let host: string | null = null;
      try {
        host = parseDomain(new URL(field.source_url).hostname).domain;
      } catch {
        /* invalid URL */
      }
      if (!host || host !== officialDomain) {
        outcomes.push({
          ...where,
          action: 'refuse',
          detail: `source is ${host ?? field.source_url}, not the carrier's own domain (${officialDomain})`,
        });
        continue;
      }

      const article = articles.get(field.source_url);
      if (!article) {
        outcomes.push({ ...where, action: 'refuse', detail: 'no capture on disk for that URL — nothing to check the value against' });
        continue;
      }

      const measurements = [...new Set((field.value.match(MEASUREMENT) ?? []).map(norm))];
      if (measurements.length === 0) {
        outcomes.push({
          ...where,
          action: 'manual',
          detail: 'no measurement in the value — a prose claim cannot be substantiated by matching, so it needs a person',
        });
        continue;
      }

      // A plain substring check confirms "68kg" against a page that only says
      // "22.68kg", which would stamp a fabricated figure as sourced. The match
      // must not begin inside a longer number.
      const presentInSource = (m: string) => {
        const escaped = m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Guard both ends of the number. The lookbehind stops "68 kg" matching the
    // tail of "22.68 kg"; the lookahead stops "EUR161" matching the head of
    // "EUR161,593". Both fragments genuinely occur in the source, which is
    // precisely why a plain substring test confirms them.
    return new RegExp(`(?<![\\d.,])${escaped}(?![\\d,]|\\.\\d)`).test(article.text);
      };
      const missing = measurements.filter((m) => !presentInSource(m));
      if (missing.length) {
        outcomes.push({ ...where, action: 'refuse', detail: `not found in the cited page: ${missing.join(', ')}` });
        continue;
      }

      if (recheck) {
        outcomes.push({ ...where, action: 'recheck-ok', detail: `still verbatim: ${measurements.join(', ')}` });
        continue;
      }
      field.status = 'official';
      field.verified_at = article.date;
      field.verified_by = 'auto';
      field.notes = `${field.notes ? `${field.notes} ` : ''}Auto-verified: ${measurements.join(', ')} found verbatim in the captured article at this URL, and the URL is on ${officialDomain}.`;
      promoted++;
      outcomes.push({ ...where, action: 'promote', detail: `${measurements.join(', ')} confirmed in source` });
    }
  }

  const width = Math.max(...outcomes.map((o) => `${o.module}/${o.field}`.length), 20);
  for (const o of outcomes) {
    console.log(`  ${o.action.toUpperCase().padEnd(11)}${`${o.module}/${o.field}`.padEnd(width + 2)}${o.detail}`);
  }

  if (recheck) {
    // Three outcomes, and conflating them would be its own kind of dishonesty.
    // A prose field has no measurement to match. A field citing a page we never
    // captured cannot be checked at all — which is not the same as failing, and
    // reporting it as a failure would train people to ignore the failures.
    const held = outcomes.filter((o) => o.action === 'recheck-ok');
    const prose = outcomes.filter((o) => o.action === 'manual');
    const uncheckable = outcomes.filter((o) => o.action === 'refuse' && o.detail.startsWith('no capture'));
    const broken = outcomes.filter(
      (o) => !['recheck-ok', 'manual'].includes(o.action) && !uncheckable.includes(o),
    );

    console.log('');
    console.log(`  ${String(held.length).padStart(3)} citation(s) still verbatim in the captured page`);
    if (prose.length) console.log(`  ${String(prose.length).padStart(3)} prose field(s) — nothing to match, a person's call`);
    if (uncheckable.length) {
      console.log(`  ${String(uncheckable.length).padStart(3)} field(s) cite a page that is not in the archive — unproven, not wrong`);
    }
    if (broken.length) console.log(`  ${String(broken.length).padStart(3)} field(s) NO LONGER HOLD`);
    console.log(broken.length ? '\nNothing was changed — look at them.' : '\nNothing was changed.');
    if (broken.length) process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log(`\nDry run — ${promoted} field(s) would be promoted. Nothing written.`);
    return;
  }
  if (promoted > 0) {
    await fs.writeFile(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    console.log(`\n${promoted} field(s) promoted in ${file}`);
  } else {
    console.log('\nNothing to promote.');
  }
  console.log('Field meaning is still a human decision. This only proves the citation.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
