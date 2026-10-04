/**
 * Shared shapes for the archival fetcher (stage 1).
 *
 * Stage 1 fetches and archives raw HTML. It does not parse, extract, or write
 * anything into content/airline-facts/ — extraction is stage 2, run against the
 * archive so carrier sites are hit once and iterated on many times.
 */

/** Outcome of a single page capture. Every attempted page gets exactly one. */
export type CaptureStatus =
  /** Fetched, and the extracted text is long enough to be plausible content. */
  | 'ok'
  /** robots.txt for this host explicitly disallows the path. Not fetched. */
  | 'robots_denied'
  /** robots.txt could not be read (5xx/timeout). Failed closed — not fetched. */
  | 'robots_unavailable'
  /** 403, a CAPTCHA, or a bot-detection interstitial. See `block_signal`. */
  | 'blocked'
  /** A locale-shaped segment of the URL changed between request and response. */
  | 'redirected_locale'
  /** Under the text threshold — a consent shell or an empty page, not content. */
  | 'too_short'
  /**
   * HTTP 200, but not the document that was asked for. Carriers routinely
   * answer an unknown path with a catch-all redirect to a hub page or a
   * homepage rather than a 404, so "it returned 200" is not evidence the page
   * exists. Named separately for the same reason robots_unavailable is not
   * blocked: "we got something that is not it" and "we got nothing" call for
   * different fixes.
   */
  | 'soft_404'
  /** Network failure, or a non-200 that is not a block, after retries. */
  | 'error';

/**
 * Why a capture was classified `blocked`.
 *
 * `blocked` covers both "this carrier walls off bots" and "this URL is
 * forbidden", which need completely different responses from a human. Recording
 * the signal keeps them apart in the summary.
 */
export type BlockSignal =
  | 'cloudflare_challenge'
  | 'datadome'
  | 'perimeterx'
  | 'akamai'
  | 'imperva'
  | 'captcha_present'
  | 'interstitial_title'
  | 'http_403';

/**
 * What happened at the cookie banner.
 *
 * `reject_unavailable` is deliberate and load-bearing: where a CMP offers only
 * "Accept all", the fetcher does NOT click it. The page then usually records
 * `too_short` and is handed to a person. Accepting tracking on the site's behalf
 * to get a capture is not a trade this pipeline makes.
 */
export type ConsentAction = 'none_found' | 'rejected' | 'reject_unavailable' | 'dismiss_failed';

/**
 * One page entry. `locale` overrides the carrier's when a page genuinely serves
 * a different market — Qantas publishes its conditions of carriage on a /gb/en/
 * path while the rest of the carrier is en-au, and recording that honestly beats
 * forcing agreement.
 */
export type CarrierPage = {
  url: string;
  locale?: string;
  note?: string;
  /**
   * Set when several page_keys deliberately share one document — Air New
   * Zealand covers checked, carry-on and excess on a single page with the
   * sub-topics as anchors. Pre-flight still flags the collapse: a declared
   * shared source and a catch-all redirect are indistinguishable from the
   * outside, and each is worth confirming rather than assuming.
   */
  shared_source?: string;
};

/** One carrier in carriers.json. */
export type Carrier = {
  carrier_key: string;
  name?: string;
  iata?: string;
  /**
   * The market this capture is meant to represent, asserted by the operator.
   * The fetcher does not validate it against the page — it records what the
   * page actually said (`html_lang`, `detected_currencies`) and whether a
   * locale-shaped URL segment changed, and leaves interpretation to stage 2.
   */
  locale: string;
  band?: string;
  region?: string;
  help_root?: string;
  /** Accepts the object form, or a bare URL string for older files. */
  pages: Record<string, CarrierPage | string>;
};

/** Normalise either page form to the object form. */
export function pageEntry(v: CarrierPage | string | undefined | null): CarrierPage | null {
  if (!v) return null;
  if (typeof v === 'string') return v.trim() ? { url: v.trim() } : null;
  return v.url && v.url.trim() ? { ...v, url: v.url.trim() } : null;
}

export type CaptureMeta = {
  carrier_key: string;
  page_key: string;
  url: string;
  locale: string;
  /** UTC, second precision. */
  fetched_at: string;
  http_status: number | null;
  final_url: string | null;
  /** sha256 over the extracted text, so markup churn does not produce diffs. */
  content_hash: string | null;
  text_length: number;
  capture_status: CaptureStatus;

  block_signal?: BlockSignal;
  consent_action: ConsentAction;
  /** The <html lang> attribute, as found. Observation only. */
  html_lang: string | null;
  /** Currency codes and symbols seen in the text. Observation only. */
  detected_currencies: string[];
  /** True when final_url differs from url at all, locale-shaped or not. */
  redirected: boolean;
  /**
   * Set when this run failed but an earlier `ok` body was left in place. The
   * HTML beside this meta is from that earlier capture, not from `fetched_at`.
   */
  body_retained_from?: string;
  /** Attempts made, including the first. */
  attempts: number;
  error?: string;
};
