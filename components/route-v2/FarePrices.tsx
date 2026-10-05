'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useCurrency } from '@/components/useCurrency';
import { formatPrice, type Currency } from '@/lib/currency';
import type { RouteFarePrices } from '@/lib/route-fares';

/**
 * Route fare prices in the visitor's header currency (components/useCurrency.ts,
 * cookie of_currency).
 *
 * The fare tables are server-rendered from the USD answer — flights, months,
 * dates and times are the same in every currency — and every price cell is a
 * <FarePrice>. The server HTML and the first client render show a neutral
 * placeholder, never a currency symbol. Once the currency is known, USD prices
 * come from the page itself and the others from /api/route-fares, which asks
 * Travelpayouts in that currency (cached 6 h per route and currency). A price
 * missing from that answer, or a failed request, shows "—", not a converted
 * or a wrong-currency figure.
 */

type State =
  | { status: 'pending' }
  | { status: 'ready'; currency: Currency; prices: RouteFarePrices }
  | { status: 'unavailable'; currency: Currency };

const Ctx = createContext<State>({ status: 'pending' });

const cache = new Map<string, Promise<RouteFarePrices | null>>();

function load(slug: string, currency: Currency): Promise<RouteFarePrices | null> {
  const key = `${slug}:${currency}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = fetch(`/api/route-fares?slug=${encodeURIComponent(slug)}&currency=${currency}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { prices?: RouteFarePrices | null } | null) => (j?.prices && j.prices.currency === currency ? j.prices : null))
      .catch(() => null);
    cache.set(key, hit);
  }
  return hit;
}

export function FarePriceProvider({ slug, usd, children }: { slug: string; usd: RouteFarePrices | null; children: ReactNode }) {
  const { currency, ready } = useCurrency();
  const [state, setState] = useState<State>({ status: 'pending' });

  useEffect(() => {
    if (!ready) return;
    if (currency === 'USD' && usd) {
      setState({ status: 'ready', currency, prices: usd });
      return;
    }
    let active = true;
    setState({ status: 'pending' });
    load(slug, currency).then((prices) => {
      if (!active) return;
      setState(prices ? { status: 'ready', currency, prices } : { status: 'unavailable', currency });
    });
    return () => {
      active = false;
    };
  }, [slug, usd, currency, ready]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

function Pending() {
  return (
    <span className="inline-block min-w-[3.5ch] text-forest-900/50" aria-label="Loading price">
      …
    </span>
  );
}

/** One price cell: a month's lowest fare or a flight's lowest fare seen. */
export function FarePrice({ kind, k }: { kind: 'month' | 'flight'; k: string }) {
  const s = useContext(Ctx);
  if (s.status === 'pending') return <Pending />;
  const value = s.status === 'ready' ? (kind === 'month' ? s.prices.months[k] : s.prices.flights[k]) : undefined;
  if (typeof value !== 'number') {
    return (
      <span className="text-forest-900/60" title={`No ${s.currency} price in the cached fare data`}>
        —
      </span>
    );
  }
  return <>{formatPrice(value, s.currency)}</>;
}

/** "in Australian dollars, fetched …" for the notes under the tables. */
const CURRENCY_WORDS: Record<Currency, string> = {
  AUD: 'Australian dollars',
  USD: 'US dollars',
  GBP: 'pounds sterling',
  EUR: 'euros',
};

function fmtFetched(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' });
}

export function FareCurrencyNote() {
  const s = useContext(Ctx);
  if (s.status === 'pending') return <>Prices are shown in the currency chosen in the site header.</>;
  if (s.status === 'unavailable') return <>Prices in {CURRENCY_WORDS[s.currency]} could not be loaded just now; change the currency in the site header or try again later.</>;
  return (
    <>
      Prices in {CURRENCY_WORDS[s.currency]} (the currency chosen in the site header), as Travelpayouts reports them, fetched{' '}
      {fmtFetched(s.prices.fetchedAt)}.
    </>
  );
}
