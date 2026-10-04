/**
 * robots.txt: fetched once per host, cached for the run, and obeyed.
 *
 * Fetched with plain `fetch` rather than through Playwright — robots.txt is
 * text, and asking for it should not cost the host a browser page load.
 *
 * Failure handling follows RFC 9309 for 4xx (unavailable means allow), but
 * deliberately fails CLOSED on 5xx and network errors: "we could not ask
 * permission" must not resolve to "go ahead". Those record
 * `robots_unavailable`, which is kept distinct from `robots_denied` so an
 * operator can tell a site that refused us from a site we could not reach.
 */
import { createRequire } from 'node:module';
import { USER_AGENT } from './browser.js';

/**
 * robots-parser ships CommonJS, and its typings open with a bare
 * `declare module 'robots-parser';` shorthand, which resolves to `any` under
 * NodeNext and takes the call signature with it. Loading it through
 * createRequire and declaring the surface we actually use keeps this file
 * type-checked rather than silently untyped.
 */
type Robot = {
  isAllowed(url: string, ua?: string): boolean | undefined;
  getCrawlDelay(ua?: string): number | undefined;
};

const require = createRequire(import.meta.url);
const robotsParser = require('robots-parser') as (url: string, robotsTxt: string) => Robot;

export type RobotsVerdict = 'allowed' | 'denied' | 'unavailable';

const cache = new Map<string, Robot | 'unavailable'>();

const ROBOTS_TIMEOUT_MS = 10_000;

async function loadRobots(origin: string): Promise<Robot | 'unavailable'> {
  const cached = cache.get(origin);
  if (cached) return cached;

  const robotsUrl = `${origin}/robots.txt`;
  let result: Robot | 'unavailable';

  try {
    const res = await fetch(robotsUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(ROBOTS_TIMEOUT_MS),
      redirect: 'follow',
    });

    if (res.status >= 500) {
      // Server-side failure: fail closed.
      result = 'unavailable';
    } else if (res.status >= 400) {
      // No robots.txt published. RFC 9309: treat as full allow.
      result = robotsParser(robotsUrl, '');
    } else {
      result = robotsParser(robotsUrl, await res.text());
    }
  } catch {
    // Timeout, DNS failure, TLS failure — fail closed.
    result = 'unavailable';
  }

  cache.set(origin, result);
  return result;
}

export async function checkRobots(url: string): Promise<RobotsVerdict> {
  const origin = new URL(url).origin;
  const robots = await loadRobots(origin);
  if (robots === 'unavailable') return 'unavailable';

  // robots-parser returns undefined when no rule matches the path, which means
  // nothing disallowed it.
  return robots.isAllowed(url, USER_AGENT) === false ? 'denied' : 'allowed';
}

/** Crawl-delay for the host, in ms, when robots.txt asks for one. */
export async function robotsCrawlDelayMs(url: string): Promise<number> {
  const robots = await loadRobots(new URL(url).origin);
  if (robots === 'unavailable') return 0;
  const seconds = robots.getCrawlDelay(USER_AGENT);
  return typeof seconds === 'number' && Number.isFinite(seconds) ? seconds * 1000 : 0;
}
