'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_CURRENCY, isCurrency, toCurrency, type Currency } from '@/lib/currency';

const COOKIE = 'of_currency';
const EVENT = 'of-currency-change';

function readCookie(): Currency | null {
  const m = document.cookie.match(/(?:^|;\s*)of_currency=([A-Za-z]{3})/);
  return m && isCurrency(m[1]) ? toCurrency(m[1]) : null;
}

/** Remember the visitor's choice for a year and tell every section on the page. */
export function setCurrency(currency: Currency) {
  document.cookie = `${COOKIE}=${currency}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: currency }));
}

let suggested: Promise<Currency> | null = null;

/** First visit: a default from the visitor's country (looked up once per page load). */
function suggestCurrency(): Promise<Currency> {
  suggested ??= fetch('/api/visitor-currency', { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { currency?: string } | null) => toCurrency(data?.currency))
    .catch(() => DEFAULT_CURRENCY);
  return suggested;
}

/**
 * The display currency. `ready` turns true once the choice (cookie, or the
 * country default on a first visit) is known: sections wait for it before
 * fetching prices, so they never load twice. The first render uses the default
 * on server and client alike, so hydration matches.
 */
export function useCurrency(): { currency: Currency; ready: boolean } {
  const [state, setState] = useState<{ currency: Currency; ready: boolean }>({ currency: DEFAULT_CURRENCY, ready: false });

  useEffect(() => {
    let active = true;
    const stored = readCookie();
    if (stored) {
      setState({ currency: stored, ready: true });
    } else {
      suggestCurrency().then((currency) => {
        if (!active) return;
        document.cookie = `${COOKIE}=${currency}; path=/; max-age=31536000; samesite=lax`;
        setState({ currency, ready: true });
      });
    }
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (isCurrency(next)) setState({ currency: toCurrency(next), ready: true });
    };
    window.addEventListener(EVENT, onChange);
    return () => {
      active = false;
      window.removeEventListener(EVENT, onChange);
    };
  }, []);

  return state;
}
