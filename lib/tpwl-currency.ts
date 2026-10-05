import { CURRENCIES, isCurrency, toCurrency, type Currency } from '@/lib/currency';

/**
 * The header currency (of_currency) drives the Travelpayouts white-label flight
 * search. What the widget does, read from its SDK (tpscr.com/wl_web, Oct 2026):
 *
 * - On init, and again whenever a property of `window.TPWL_CONFIGURATION` is set
 *   (it is a Proxy that re-applies the config to every widget container), it
 *   picks its currency as: `?currency=` in the page URL, else the
 *   `tpwl_currency` cookie, else the config's `defaultCurrency` — keeping only
 *   codes in its `availableCurrencies` (ours: USD default + AUD, EUR, GBP).
 * - When its currency changes, it re-runs the open search with the new
 *   `currency_code` and rewrites `tpwl_currency` (domain .originfacts.com, so
 *   flights.originfacts.com, our partner-hosted copy, reads the same cookie).
 *
 * So the site writes `tpwl_currency` from of_currency before the SDK starts and
 * pokes TPWL_CONFIGURATION when the header changes. The cookie is a
 * Travelpayouts cookie: write it only once advertising consent allows the
 * widget to load.
 */
export const TPWL_CURRENCY_COOKIE = 'tpwl_currency';

/** Site currency → the widget's code (upper-case ISO, as it stores it). All four are offered by our white label. */
export const TPWL_CURRENCY_CODES: Record<Currency, string> = { AUD: 'AUD', USD: 'USD', GBP: 'GBP', EUR: 'EUR' };

export function tpwlCurrencyCode(currency: unknown): string {
  return TPWL_CURRENCY_CODES[toCurrency(currency)];
}

/**
 * Cookie domain the widget itself uses (last two labels, e.g. ".originfacts.com";
 * last three on deeper hosts), or null on localhost / an IP, where a host-only
 * cookie is the one that works.
 */
export function tpwlCookieDomain(hostname: string): string | null {
  if (!hostname.includes('.') || /^[\d.]+$/.test(hostname) || hostname.includes(':')) return null;
  const parts = hostname.split('.');
  return '.' + parts.slice(parts.length > 3 ? -3 : -2).join('.');
}

/** Write tpwl_currency for `currency`. Call only when advertising consent is granted. */
export function writeTpwlCurrencyCookie(currency: Currency) {
  const domain = tpwlCookieDomain(window.location.hostname);
  document.cookie = `${TPWL_CURRENCY_COOKIE}=${tpwlCurrencyCode(currency)}; path=/; max-age=31536000; samesite=lax${
    domain ? `; domain=${domain}` : ''
  }`;
}

/** The of_currency cookie, if set to one of the site currencies. */
export function readSiteCurrencyCookie(): Currency | null {
  const m = document.cookie.match(/(?:^|;\s*)of_currency=([A-Za-z]{3})/);
  return m && isCurrency(m[1]) ? toCurrency(m[1]) : null;
}

/**
 * Same as readSiteCurrencyCookie + writeTpwlCurrencyCookie, as a JS statement for
 * the inline boot script that starts the SDK before hydration (TpwlConsentedBoot).
 * The caller runs it only after its consent check.
 */
export const TPWL_CURRENCY_BOOT_JS = `try{var m=document.cookie.match(/(?:^|;\\s*)of_currency=([A-Za-z]{3})/),c=m&&m[1].toUpperCase();if(${JSON.stringify(
  CURRENCIES,
)}.indexOf(c)>=0){var h=location.hostname,d=null;if(h.indexOf('.')>=0&&!/^[\\d.]+$/.test(h)&&h.indexOf(':')<0){var p=h.split('.');d='.'+p.slice(p.length>3?-3:-2).join('.');}document.cookie='${TPWL_CURRENCY_COOKIE}='+c+'; path=/; max-age=31536000; samesite=lax'+(d?'; domain='+d:'');}}catch(e){}`;

/**
 * Add the header currency to a link into flights.originfacts.com (partner-hosted
 * white label), which reads `?currency=` before its own cookie.
 */
export function withTpwlCurrency(href: string, currency: Currency): string {
  try {
    const url = new URL(href);
    if (!url.hostname.startsWith('flights.')) return href;
    url.searchParams.set('currency', tpwlCurrencyCode(currency));
    return url.toString();
  } catch {
    return href;
  }
}
