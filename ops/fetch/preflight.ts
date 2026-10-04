#!/usr/bin/env node
/**
 * Pre-flight — are these URLs real, before we spend a crawl on them?
 *
 *   npm run preflight                 every carrier
 *   npm run preflight -- --band 1a
 *
 * One lightweight request per URL instead of a browser page load, because a
 * fabricated URL costs the same to discover either way and a real crawl costs
 * the carrier far more.
 *
 * The motivating case: Air New Zealand's /checked-in-baggage,
 * /carry-on-baggage and /excess-baggage all answered 200 and all redirected to
 * the same /en-nz/travel-info/baggage. Three URLs, one page. Archived blind
 * that becomes three captures which stage 2 reads as three independent
 * sources agreeing with each other.
 *
 * Requests are round-robined across carriers rather than run carrier by
 * carrier, so consecutive requests land on different hosts and the per-host
 * interval elapses on its own, and no host sees a burst.
 *
 * TWO INSTRUMENTS, because one is not enough and this was learned the hard way
 * twice. A plain HTTP client is refused by most carrier sites: Ryanair's bag
 * policy answers 403 to `fetch` and 200 with 2,484 characters to a real
 * browser, on the same URL in the same minute. A single-instrument pre-flight
 * reported 337 of 450 URLs "non_200" and nearly condemned a file that was
 * largely fine.
 *
 * So: plain fetch first because it is cheap, then a browser only where that
 * failed, and every row records which instrument answered. `blocked_to_http`
 * is reported as a fact about the carrier's defences, not as a defect in the
 * URL.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, type BrowserContext } from 'playwright';
import { parse as parseDomain } from 'tldts';
import { USER_AGENT } from './browser.js';
import { pageEntry, type Carrier } from './types.js';

const TIMEOUT_MS = 20_000;
const BETWEEN_REQUESTS_MS = 250;
const MIN_HOST_INTERVAL_MS = 3_000;

type Finding =
  | 'non_200'
  | 'cross_domain_redirect'
  | 'collapsed_target'
  | 'unrelated_path'
  | 'homepage_or_search'
  /** Refused a plain client but served a browser. About the carrier, not the URL. */
  | 'blocked_to_http';

type Probe = { status: number | null; final: string | null; error?: string };

type Row = {
  carrier_key: string;
  band: string;
  page_key: string;
  url: string;
  http: Probe;
  /** Only run where the plain client failed. */
  browser?: Probe;
  /** Which instrument produced the answer the findings were computed from. */
  resolved_by: 'http' | 'browser' | 'neither';
  status: number | null;
  final_url: string | null;
  error?: string;
  findings: Finding[];
  /** Operator's own note, so a declared shared source is visible in the report. */
  note?: string;
};

/** Tokens that carry no meaning when comparing a requested path to its target. */
const NOISE = new Set([
  'en','us','gb','au','nz','sg','th','my','id','vn','ph','hk','jp','kr','tw','cn','ae','qa','sa','tr','in','lk',
  'de','fr','nl','ch','at','es','pt','it','se','no','fi','ie','ca','fj','www','html','htm','aspx','php','index',
  'travel','info','help','support','page','pages','content','home',
]);

function tokens(p: string): string[] {
  return p.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !NOISE.has(t));
}

const HOMEPAGE = /^\/(?:[a-z]{2}(?:[-_][a-z]{2})?\/?)?$/i;
const SEARCHY = /(?:^|\/)(?:search|find|error|404|not-?found|page-?not-?found|sitemap)\b|[?&]q=/i;

function analyse(requested: string, finalUrl: string | null, status: number | null): Finding[] {
  const findings: Finding[] = [];
  if (status === null || status !== 200) findings.push('non_200');
  if (!finalUrl) return findings;

  const a = new URL(requested);
  const b = new URL(finalUrl);

  if (parseDomain(a.hostname).domain !== parseDomain(b.hostname).domain) findings.push('cross_domain_redirect');
  if (HOMEPAGE.test(b.pathname) || SEARCHY.test(b.pathname + b.search)) findings.push('homepage_or_search');

  // "Bears no relation" means not one meaningful token survived. A partial
  // overlap is normal — /checked-in-baggage landing on /travel-info/baggage
  // keeps "baggage" and is a legitimate hub redirect, which the collapse check
  // catches instead.
  const want = tokens(a.pathname);
  const got = new Set(tokens(b.pathname));
  if (want.length > 0 && !want.some((t) => got.has(t))) findings.push('unrelated_path');

  return findings;
}

function parseArgs(argv: string[]): { band?: string; carrier?: string; input?: string; output?: string } {
  const out: { band?: string; carrier?: string; input?: string; output?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--band') out.band = argv[++i];
    else if (argv[i] === '--carrier') out.carrier = argv[++i];
    else if (argv[i] === '--input') out.input = argv[++i];
    else if (argv[i] === '--output') out.output = argv[++i];
  }
  return out;
}

const lastHostAt = new Map<string, number>();

async function probeHttp(url: string): Promise<Probe> {
  const host = new URL(url).host;
  const last = lastHostAt.get(host);
  if (last !== undefined) {
    const wait = MIN_HOST_INTERVAL_MS - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  lastHostAt.set(host, Date.now());

  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // Some servers refuse HEAD but serve GET; only escalate on that signal.
      if (method === 'HEAD' && (res.status === 405 || res.status === 501)) continue;
      return { status: res.status, final: res.url || url };
    } catch (err) {
      if (method === 'GET') {
        const m = err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message) : String(err);
        return { status: null, final: null, error: m.split('\n')[0].slice(0, 80) };
      }
    }
  }
  return { status: null, final: null, error: 'no response' };
}

async function probeBrowser(ctx: BrowserContext, url: string): Promise<Probe> {
  const page = await ctx.newPage();
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    return { status: res?.status() ?? null, final: page.url() };
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    return { status: null, final: null, error: m.split('\n')[0].slice(0, 80) };
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const file = args.input
    ? path.resolve(process.cwd(), args.input)
    : path.resolve(import.meta.dirname, 'carriers.json');
  let carriers = JSON.parse(await fs.readFile(file, 'utf8')) as Carrier[];
  if (args.band) carriers = carriers.filter((c) => c.band === args.band);
  if (args.carrier) carriers = carriers.filter((c) => c.carrier_key === args.carrier);

  // Round-robin by page index so consecutive requests hit different hosts.
  const queue: { carrier: Carrier; page_key: string; url: string; note?: string }[] = [];
  const maxPages = Math.max(...carriers.map((c) => Object.keys(c.pages).length));
  for (let i = 0; i < maxPages; i++) {
    for (const c of carriers) {
      const [key, raw] = Object.entries(c.pages)[i] ?? [];
      const entry = pageEntry(raw);
      if (!key || !entry) continue;
      queue.push({ carrier: c, page_key: key, url: entry.url, note: entry.note });
    }
  }

  console.log(`Pre-flight — ${queue.length} URLs across ${carriers.length} carriers, round-robined by host.\n`);

  const rows: Row[] = [];
  let done = 0;
  let escalated = 0;
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: USER_AGENT });
  // Images and media prove nothing about whether a page exists.
  await ctx.route('**/*', (r) =>
    ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue(),
  );

  try {
    for (const item of queue) {
      const http = await probeHttp(item.url);
      let browserProbe: Probe | undefined;
      if (http.status !== 200) {
        escalated++;
        browserProbe = await probeBrowser(ctx, item.url);
      }

      const best = browserProbe && browserProbe.status === 200 ? browserProbe : http;
      const resolvedBy: Row['resolved_by'] =
        http.status === 200 ? 'http' : browserProbe?.status === 200 ? 'browser' : 'neither';

      const findings = analyse(item.url, best.final, best.status);
      if (resolvedBy === 'browser') findings.push('blocked_to_http');

      rows.push({
        carrier_key: item.carrier.carrier_key,
        band: item.carrier.band ?? '-',
        page_key: item.page_key,
        url: item.url,
        http,
        browser: browserProbe,
        resolved_by: resolvedBy,
        status: best.status,
        final_url: best.final,
        error: best.error,
        note: item.note,
        findings,
      });
      if (++done % 50 === 0) process.stdout.write(`  ${done}/${queue.length}  (${escalated} escalated to a browser)\n`);
      await new Promise((r) => setTimeout(r, BETWEEN_REQUESTS_MS));
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  // Collapse detection is per carrier and needs the whole set, so it runs last.
  for (const c of carriers) {
    const mine = rows.filter((r) => r.carrier_key === c.carrier_key && r.final_url);
    const byTarget = new Map<string, Row[]>();
    for (const r of mine) {
      const key = r.final_url!.split('#')[0];
      byTarget.set(key, [...(byTarget.get(key) ?? []), r]);
    }
    for (const group of byTarget.values()) {
      // Flagged even where the operator declared a shared source: a deliberate
      // shared page and a catch-all redirect are indistinguishable from here,
      // and each one is worth confirming rather than assuming.
      if (group.length > 1) for (const r of group) r.findings.push('collapsed_target');
    }
  }

  const out = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.resolve(import.meta.dirname, '..', '..', 'data', 'captures', 'preflight.json');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, `${JSON.stringify({ checked_at: `${new Date().toISOString().slice(0, 19)}Z`, rows }, null, 2)}\n`, 'utf8');

  const bands = [...new Set(rows.map((r) => r.band))].sort();
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`${'band'.padEnd(8)}${'urls'.padStart(6)}${'clean'.padStart(8)}${'flagged'.padStart(9)}   findings`);
  console.log('─'.repeat(80));
  for (const band of bands) {
    const br = rows.filter((r) => r.band === band);
    // "Reachable" is the honest headline: resolved by either instrument, with
    // no structural finding. blocked_to_http alone is not a defect.
    const structural = (r: Row) => r.findings.filter((f) => f !== 'blocked_to_http');
    const ok = br.filter((r) => r.resolved_by !== 'neither' && structural(r).length === 0);
    const counts = new Map<string, number>();
    for (const r of br) for (const f of r.findings) counts.set(f, (counts.get(f) ?? 0) + 1);
    const detail = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
    console.log(
      `${band.padEnd(8)}${String(br.length).padStart(6)}${String(ok.length).padStart(8)}${String(br.length - ok.length).padStart(9)}   ${detail}`,
    );
  }
  console.log('─'.repeat(80));
  console.log(`\nFull results: ${out}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
