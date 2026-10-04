/**
 * Deciding what a capture actually is.
 *
 * The distinction that matters most here is a bot wall versus a real refusal.
 * Both end as `blocked`, but only one is worth a manual capture, so the signal
 * that fired is recorded alongside.
 *
 * Body content is inspected BEFORE the status code, because a Cloudflare
 * challenge is routinely served as HTTP 200 — reading the status first would
 * classify an interstitial as a successful capture.
 */
import type { BlockSignal, CaptureStatus } from './types.js';

/** Minimum plausible article length. Below this it is a shell, not content. */
export const MIN_TEXT_LENGTH = 2_000;

const VENDOR_PATTERNS: { signal: BlockSignal; test: RegExp }[] = [
  { signal: 'cloudflare_challenge', test: /challenge-platform|cf_chl_|cf-turnstile|__cf_bm|just a moment/i },
  { signal: 'datadome', test: /datadome|dd\.js|geo\.captcha-delivery\.com/i },
  { signal: 'perimeterx', test: /_px[A-Za-z]*|px-captcha|perimeterx/i },
  { signal: 'akamai', test: /_abck|akam\/\d|reference\s*#\d{2}\./i },
  { signal: 'imperva', test: /_incapsula_resource|incapsula incident id/i },
  { signal: 'captcha_present', test: /recaptcha\/api\.js|hcaptcha\.com\/1\/api\.js|g-recaptcha|h-captcha/i },
];

const INTERSTITIAL_TITLES = /^(just a moment|attention required|access denied|pardon our interruption|are you a robot)/i;

export function detectBlockSignal(html: string, title: string, httpStatus: number | null): BlockSignal | undefined {
  for (const { signal, test } of VENDOR_PATTERNS) {
    if (test.test(html)) return signal;
  }
  if (INTERSTITIAL_TITLES.test(title.trim())) return 'interstitial_title';
  // A plain 403 with none of the above is a server refusing us outright rather
  // than a bot wall — different problem, same handling.
  if (httpStatus === 403) return 'http_403';
  return undefined;
}

/**
 * Whether a locale-shaped part of the URL changed between request and response.
 *
 * Deliberately does not parse locale semantics — carriers express market in
 * incompatible ways (`/en-au/`, `/au/en/`, `?lang=en_AU`, subdomains), and the
 * asserted locale in carriers.json is the operator's statement of intent, not
 * something to match against a URL. This detects DRIFT, which is the thing that
 * silently corrupts a capture.
 */
const LOCALE_SEGMENT = /^([a-z]{2}([-_][a-z]{2})?)$/i;

export function localeSegmentsChanged(requested: string, final: string): boolean {
  const parts = (u: string) => {
    const url = new URL(u);
    return [url.hostname.split('.')[0], ...url.pathname.split('/')].filter((p) => LOCALE_SEGMENT.test(p)).map((p) => p.toLowerCase());
  };
  const a = parts(requested);
  const b = parts(final);
  return a.join('/') !== b.join('/');
}

/** ISO codes these carriers price in, plus the symbols that carry a currency. */
const CURRENCY_CODES =
  /\b(AUD|USD|EUR|GBP|SGD|NZD|JPY|CAD|CHF|AED|INR|CNY|HKD|MYR|THB|IDR|PHP|KRW|ZAR|BRL|MXN|SEK|NOK|DKK|PLN|CZK|HUF|RON|TRY|ILS|SAR|QAR)\b/g;
const CURRENCY_SYMBOLS: [string, RegExp][] = [
  ['$', /\$\s?\d/],
  ['€', /€\s?\d|\d\s?€/],
  ['£', /£\s?\d/],
  ['¥', /¥\s?\d/],
  ['₹', /₹\s?\d/],
  ['₩', /₩\s?\d/],
  ['zł', /\d\s?zł/i],
  ['kr', /\d\s?kr\b/i],
];

/**
 * Observation only — no interpretation. A page showing both AUD and USD is a
 * fact stage 2 may care about; stage 1 just records what was on the page.
 */
export function detectCurrencies(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.match(CURRENCY_CODES) ?? []) found.add(m.toUpperCase());
  for (const [symbol, test] of CURRENCY_SYMBOLS) if (test.test(text)) found.add(symbol);
  return [...found].sort();
}

export function classify(opts: {
  blockSignal?: BlockSignal;
  httpStatus: number | null;
  textLength: number;
  localeDrifted: boolean;
}): CaptureStatus {
  if (opts.blockSignal) return 'blocked';
  if (opts.httpStatus === null || opts.httpStatus >= 400) return 'error';
  // Drift is reported ahead of length: a redirected capture is the wrong page,
  // and saying "too short" about it would describe the symptom, not the cause.
  if (opts.localeDrifted) return 'redirected_locale';
  if (opts.textLength < MIN_TEXT_LENGTH) return 'too_short';
  return 'ok';
}
