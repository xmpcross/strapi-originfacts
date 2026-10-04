#!/usr/bin/env node
/**
 * Stage 0 — reachability sweep.
 *
 *   npm run reach
 *
 * Answers one question before any extraction is designed on top of it: of the
 * Tier 1 carriers, how many can we fetch at all?
 *
 * It asks each carrier's host for `robots.txt` and nothing else. robots.txt is
 * the politest possible probe — it is the file a site publishes specifically to
 * be read by automated clients, it is small, and reading it is what any
 * well-behaved crawler does first anyway.
 *
 * The failure LAYER is the point, not pass/fail. An HTTP/2 reset before any
 * response is a different problem from a 403: one may be an IP-range or TLS
 * fingerprint issue that configuration could address, the other is a deliberate
 * refusal of this client. Reporting them as one number would hide the
 * distinction that decides whether manual capture is the path.
 *
 * Two instruments, reported side by side, because they measure different things:
 *
 *   http_robots      plain HTTP client against /robots.txt
 *   browser_content  real browser against an actual content page
 *
 * The fetcher uses the second. Measuring with the first alone would have set
 * the project's go/no-go on the wrong instrument — carriers routinely serve
 * robots.txt from different infrastructure than content, and a headless browser
 * clears walls an HTTP client cannot.
 *
 * `probe_method` is recorded per carrier so a future re-run can tell "we tried
 * harder" apart from "the carrier changed".
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import { USER_AGENT } from './browser.js';

/** Where the probe failed, from lowest layer to highest. */
type Layer =
  | 'ok'
  | 'dns'
  | 'tls'
  | 'connection_refused'
  | 'http2_reset'
  | 'timeout'
  | 'http_403'
  | 'http_error'
  | 'challenge'
  | 'unknown';

type ProbeMethod = 'http_robots' | 'browser_robots' | 'browser_content';

type Probe = { probe_method: ProbeMethod; layer: Layer; status: number | null; detail?: string };

type Verdict = 'reachable' | 'browser_only' | 'blocked' | 'unreachable';

type Result = {
  carrier_key: string;
  name: string;
  domain: string;
  content_url: string;
  /** Plain HTTP against robots.txt. */
  http_robots: Probe;
  /** Real browser against robots.txt — only when the HTTP probe failed. */
  browser_robots?: Probe;
  /** Real browser against a content page. Always run: it is what the fetcher does. */
  browser_content: Probe;
  /** Verdict on the robots probes alone — the cheap instrument. */
  robots_verdict: Verdict;
  /** Verdict on the content probe — the instrument that matches the fetcher. */
  content_verdict: Verdict;
};

type DomainRow = {
  carrier_key: string;
  name: string;
  iata?: string;
  domain: string;
  content_url: string;
  domain_source?: string;
};

const TIMEOUT_MS = 20_000;
/** Different hosts, so this is courtesy rather than rate limiting. */
const BETWEEN_HOSTS_MS = 1_000;

const CHALLENGE = /challenge-platform|cf_chl_|just a moment|attention required|datadome|_incapsula|px-captcha|access denied/i;

/** Map a thrown network error onto the layer it failed at. */
function layerFromError(message: string): Layer {
  const m = message.toLowerCase();
  if (/enotfound|eai_again|getaddrinfo|name_not_resolved/.test(m)) return 'dns';
  if (/cert|tls|ssl|handshake|self.signed/.test(m)) return 'tls';
  if (/econnrefused|connection_refused/.test(m)) return 'connection_refused';
  if (/http2|nghttp2|stream.*(closed|error)|protocol_error/.test(m)) return 'http2_reset';
  if (/timeout|timed out|aborted/.test(m)) return 'timeout';
  if (/econnreset|socket hang up|connection_reset/.test(m)) return 'http2_reset';
  return 'unknown';
}

async function probeHttp(domain: string): Promise<Probe> {
  const probe_method: ProbeMethod = 'http_robots';
  try {
    const res = await fetch(`https://${domain}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    });
    const body = await res.text().catch(() => '');
    if (CHALLENGE.test(body)) return { probe_method, layer: 'challenge', status: res.status };
    if (res.status === 403) return { probe_method, layer: 'http_403', status: 403 };
    if (res.status >= 400) return { probe_method, layer: 'http_error', status: res.status };
    return { probe_method, layer: 'ok', status: res.status, detail: `${body.length} bytes` };
  } catch (err) {
    const message = err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message) : String(err);
    return { probe_method, layer: layerFromError(message), status: null, detail: message.split('\n')[0].slice(0, 90) };
  }
}

async function probeBrowser(browser: Browser, url: string, probe_method: ProbeMethod): Promise<Probe> {
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  // Images and media are not evidence of reachability and cost the host to serve.
  await context.route('**/*', (route) =>
    ['image', 'media', 'font'].includes(route.request().resourceType()) ? route.abort() : route.continue(),
  );
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    const text = await page.evaluate(() => document.body?.innerText ?? '');
    const status = res?.status() ?? null;
    if (CHALLENGE.test(text)) return { probe_method, layer: 'challenge', status };
    if (status === 403) return { probe_method, layer: 'http_403', status };
    if (status !== null && status >= 400) return { probe_method, layer: 'http_error', status };
    return { probe_method, layer: 'ok', status, detail: `${text.length} chars` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { probe_method, layer: layerFromError(message), status: null, detail: message.split('\n')[0].slice(0, 90) };
  } finally {
    await context.close().catch(() => undefined);
  }
}

function verdictFor(primary: Probe, fallback?: Probe): Verdict {
  if (primary.layer === 'ok') return 'reachable';
  if (fallback?.layer === 'ok') return 'browser_only';
  // A refusal we can name is "blocked"; a layer failure with no response at all
  // is "unreachable" — the second may be network, the first is a decision.
  const named = (p?: Probe) => p?.layer === 'http_403' || p?.layer === 'challenge';
  return named(primary) || named(fallback) ? 'blocked' : 'unreachable';
}

function pad(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n);
}

function tally(results: Result[], pick: (r: Result) => Verdict): Record<Verdict, number> {
  const out: Record<Verdict, number> = { reachable: 0, browser_only: 0, blocked: 0, unreachable: 0 };
  for (const r of results) out[pick(r)]++;
  return out;
}

async function main(): Promise<void> {
  const file = path.resolve(import.meta.dirname, '..', 'reach', 'domains.json');
  const rows = JSON.parse(await fs.readFile(file, 'utf8')) as DomainRow[];

  console.log(`Reachability sweep — ${rows.length} carriers, two instruments, one at a time.`);
  console.log('  http_robots      plain HTTP client against /robots.txt');
  console.log('  browser_content  real browser against a content page — what the fetcher does\n');

  const browser = await chromium.launch({ headless: true });
  const results: Result[] = [];

  try {
    for (const row of rows) {
      process.stdout.write(`  ${pad(row.carrier_key, 26)}`);

      const http_robots = await probeHttp(row.domain);
      const browser_robots =
        http_robots.layer === 'ok' ? undefined : await probeBrowser(browser, `https://${row.domain}/robots.txt`, 'browser_robots');
      await new Promise((r) => setTimeout(r, BETWEEN_HOSTS_MS));
      const browser_content = await probeBrowser(browser, row.content_url, 'browser_content');

      const result: Result = {
        carrier_key: row.carrier_key,
        name: row.name,
        domain: row.domain,
        content_url: row.content_url,
        http_robots,
        browser_robots,
        browser_content,
        robots_verdict: verdictFor(http_robots, browser_robots),
        content_verdict: verdictFor(browser_content),
      };
      results.push(result);
      console.log(`robots:${pad(result.robots_verdict, 14)}content:${pad(result.content_verdict, 14)}${browser_content.layer}`);
      await new Promise((r) => setTimeout(r, BETWEEN_HOSTS_MS));
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  const out = path.resolve(import.meta.dirname, '..', '..', 'data', 'captures', 'reachability.json');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(
    out,
    `${JSON.stringify(
      {
        probed_from: 'origin box — OVH AS16276, Sydney AU',
        probed_at: `${new Date().toISOString().slice(0, 19)}Z`,
        domain_source: 'duffel_coc',
        results,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const robots = tally(results, (r) => r.robots_verdict);
  const content = tally(results, (r) => r.content_verdict);
  const fetchable = (t: Record<Verdict, number>) => t.reachable + t.browser_only;

  console.log(`\n${'─'.repeat(74)}`);
  console.log(`${pad('', 16)}${pad('robots.txt', 14)}${pad('content page', 14)}`);
  for (const k of ['reachable', 'browser_only', 'blocked', 'unreachable'] as Verdict[]) {
    console.log(`${pad(k, 16)}${pad(String(robots[k]), 14)}${pad(String(content[k]), 14)}`);
  }
  console.log(
    `${pad('FETCHABLE', 16)}${pad(`${fetchable(robots)}/${results.length}`, 14)}${pad(`${fetchable(content)}/${results.length}`, 14)}`,
  );

  const moved = results.filter((r) => r.robots_verdict !== r.content_verdict);
  if (moved.length) {
    console.log(`\n${moved.length} carrier(s) where the two instruments disagree:`);
    for (const r of moved) {
      console.log(`  ${pad(r.carrier_key, 26)}robots:${pad(r.robots_verdict, 14)}content:${r.content_verdict}`);
    }
  }

  const layers = new Map<string, number>();
  for (const r of results) {
    if (r.content_verdict === 'reachable') continue;
    layers.set(r.browser_content.layer, (layers.get(r.browser_content.layer) ?? 0) + 1);
  }
  if (layers.size) {
    console.log('\nContent-page failure layers:');
    for (const [k, v] of [...layers.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${pad(k, 24)}${v}`);
  }

  console.log(`\nFull results: ${out}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
