'use client';

import { useEffect, useState } from 'react';
import { flightSearchUrl } from '@/lib/affiliate';
import { formatPrice } from '@/lib/currency';
import { useCurrency } from './useCurrency';
import { placeFromBrowserTimeZone } from '@/lib/timezone-geo';

// If the visitor's city cannot be worked out (unknown time zone, API down), use this airport as the seed so
// the widget still shows real deals instead of disappearing.
const FALLBACK_ORIGIN: Origin = { iata: 'LHR', city: 'London' };

type Deal = {
  origin: string;
  destination: string;
  price: number;
  currency: string;
  airline: string;
  departureAt: string;
  returnAt?: string;
};

type Origin = { iata: string; city: string | null };

const ORIGIN_CACHE_KEY = 'originfacts.flight-origin.v1';
const DEALS_CACHE_KEY = 'originfacts.flight-deals.v1';
const CACHE_TTL_MS = 60 * 60 * 1000;

function readOriginCache(): Origin | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ORIGIN_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Origin) : null;
  } catch {
    return null;
  }
}

function writeOriginCache(o: Origin) {
  try { window.sessionStorage.setItem(ORIGIN_CACHE_KEY, JSON.stringify(o)); } catch { /* off */ }
}

function readDealsCache(originIata: string, currency: string): Deal[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(`${DEALS_CACHE_KEY}.${originIata}.${currency}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fetchedAt: number; deals: Deal[] };
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed.deals;
  } catch {
    return null;
  }
}

function writeDealsCache(originIata: string, currency: string, deals: Deal[]) {
  try {
    window.sessionStorage.setItem(
      `${DEALS_CACHE_KEY}.${originIata}.${currency}`,
      JSON.stringify({ fetchedAt: Date.now(), deals }),
    );
  } catch { /* off */ }
}

async function resolveOrigin(): Promise<Origin> {
  const cached = readOriginCache();
  if (cached) return cached;
  try {
    // The browser's time zone (no network, nothing sent to a third party).
    const place = placeFromBrowserTimeZone();
    if (!place) return FALLBACK_ORIGIN;
    const origin: Origin = { iata: place.iata, city: place.city };
    writeOriginCache(origin);
    return origin;
  } catch (err) {
    console.warn('[FlightDealsWidget] geo resolution failed, using fallback', err);
    return FALLBACK_ORIGIN;
  }
}

async function fetchDeals(originIata: string, currency: string): Promise<Deal[]> {
  const cached = readDealsCache(originIata, currency);
  if (cached) return cached;
  const res = await fetch(`/api/flight-deals?origin=${originIata}&limit=4&currency=${currency.toLowerCase()}`);
  if (!res.ok) return [];
  const json = (await res.json()) as { deals?: Deal[] };
  const deals = json.deals ?? [];
  writeDealsCache(originIata, currency, deals);
  return deals;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function FlightDealsWidget() {
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const { currency, ready } = useCurrency();

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const o = await resolveOrigin();
      if (cancelled) return;
      setOrigin(o);
      try {
        const d = await fetchDeals(o.iata, currency);
        if (cancelled) return;
        setDeals(d);
      } catch (err) {
        console.warn('[FlightDealsWidget] deals fetch failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currency, ready]);

  if (loading) {
    return (
      <div
        className="rounded-[0.3rem] border border-forest-900/10 bg-white p-4 shadow-sm"
        data-testid="flight-deals-widget-loading"
        aria-hidden
      >
        <div className="h-3 w-32 animate-pulse rounded bg-forest-900/10" />
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded bg-forest-900/5" />
          ))}
        </div>
      </div>
    );
  }

  // Always render a card. If deals are empty (no TP data for this origin), fall
  // back to a generic "Search flights" CTA pointing at /flights so the
  // sidebar slot is never an empty void.
  if (!origin) return null;
  if (deals.length === 0) {
    return (
      <div
        className="rounded-[0.3rem] border border-forest-900/10 bg-white p-4 shadow-sm"
        data-testid="flight-deals-widget-empty"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-forest-900/55">
          Cheap flights
        </p>
        <p className="mt-2 text-sm font-bold text-forest-950">
          Compare every airline in one search.
        </p>
        <a
          href={flightSearchUrl({ origin: origin.iata, destination: 'BKK', subId: 'sidebar_empty_cta' })}
          target="_blank"
          rel="sponsored noopener"
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-primary-emphasis hover:underline"
        >
          Search flights
          <span aria-hidden>→</span>
        </a>
      </div>
    );
  }

  return (
    <div
      className="rounded-[0.3rem] border border-forest-900/10 bg-white p-4 shadow-sm"
      data-testid="flight-deals-widget"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-forest-900/55">
          Cheap flights from
        </p>
        <p className="text-[11px] font-bold text-forest-950">
          {origin.city ? `${origin.city} (${origin.iata})` : origin.iata}
        </p>
      </div>

      <ul className="mt-3 divide-y divide-forest-900/10">
        {deals.map((d) => {
          const href = flightSearchUrl({
            origin: d.origin,
            destination: d.destination,
            subId: `sidebar_deal_${d.destination}`,
            departDate: d.departureAt.slice(0, 10),
            returnDate: d.returnAt ? d.returnAt.slice(0, 10) : null,
          });
          return (
            <li key={`${d.destination}-${d.departureAt}`} className="py-2.5 first:pt-0 last:pb-0">
              <a
                href={href}
                target="_blank"
                rel="sponsored noopener"
                className="group flex items-center justify-between gap-3 transition"
                data-testid={`flight-deal-${d.destination}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-forest-950 group-hover:text-primary-emphasis">
                    {origin.iata} → {d.destination}
                  </p>
                  <p className="mt-0.5 text-[11px] text-forest-900/60">
                    {formatDate(d.departureAt)}
                    {d.returnAt ? ` – ${formatDate(d.returnAt)}` : ''} · {d.airline}
                  </p>
                </div>
                <p className="shrink-0 text-base font-bold text-primary-emphasis">
                  {formatPrice(d.price, d.currency)}
                </p>
              </a>
            </li>
          );
        })}
      </ul>

      <a
        href={flightSearchUrl({
          origin: origin.iata,
          destination: deals[0]?.destination || 'BKK',
          subId: 'sidebar_deal_cta',
        })}
        target="_blank"
        rel="sponsored noopener"
        className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-primary-emphasis hover:underline"
      >
        See all fares
        <span aria-hidden>→</span>
      </a>
      <p className="mt-2 text-[10px] text-forest-900/45">
        Prices are estimates from our search partner. Final fare shown on booking.
      </p>
    </div>
  );
}
