'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  POPULAR_DESTINATIONS,
  WIDE_DESTINATIONS,
  type Destination,
} from '@/lib/flights-data';
import { TPWL_HOST, tpwlSearchUrl } from '@/lib/tpwl-link';
import { useVisitorOrigin } from '@/lib/visitor-origin';
import type { PopularRoute, PopularRoutes } from '@/lib/popular-routes';
import { formatPrice } from '@/lib/currency';
import { useCurrency } from './useCurrency';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-12" → "12 Nov", read straight from the string so no time zone can shift the day. */
function shortDate(iso: string | null): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
}

function stopsLabel(transfers: number): string {
  return transfers === 0 ? 'Nonstop' : transfers === 1 ? '1 stop' : `${transfers} stops`;
}

const MIN_ROUTES = 3;

export default function PopularDestinationsBlock() {
  const origin = useVisitorOrigin();
  const { currency, ready } = useCurrency();
  // undefined = still loading, null = unavailable (show the static list below).
  const [live, setLive] = useState<PopularRoutes | null | undefined>(undefined);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLive(undefined);
    fetch(`/api/popular-routes?origin=${encodeURIComponent(origin.iata)}&currency=${currency}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<PopularRoutes>) : null))
      .then((data) => setLive(data && data.routes.length >= MIN_ROUTES ? data : null))
      .catch((error) => {
        if (error?.name !== 'AbortError') setLive(null);
      });
    return () => controller.abort();
  }, [origin.iata, currency, ready]);

  const destinations: Destination[] = POPULAR_DESTINATIONS.filter((d) => d.iata !== origin.iata).slice(0, 6);
  const cityName = live?.originCity ?? origin.name;

  return (
    <section className="mt-20" data-testid="popular-destinations">
      <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">
        Popular flight searches from {cityName}
      </h2>
      <p className="mt-2 text-[1rem] text-ink/75">
        {live ? (
          <>
            Popular routes from{' '}
            <span className="text-primary-emphasis">
              {cityName} {origin.iata}
            </span>{' '}
            with the lowest fares our search partner has found recently. Each card opens the search for those dates, so you can change the dates and passengers for your real trip.
            {live.guideSlug && (
              <>
                {' '}
                <Link href={`/destinations/${live.guideSlug}`} className="font-semibold text-primary-emphasis hover:underline">
                  Read the {cityName} city guide →
                </Link>
              </>
            )}
          </>
        ) : (
          <>
            Start with routes travellers often compare from{' '}
            <span className="text-primary-emphasis">
              {origin.name} {origin.iata}
            </span>{' '}
            and open a prefilled search with sample dates. Use the cards as a shortcut, then adjust the dates and passengers for your real trip.
          </>
        )}
      </p>
      <div className={`mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 ${live ? 'lg:grid-cols-4' : 'lg:grid-cols-5'}`}>
        {live === undefined && (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded bg-forest-900/10" aria-hidden />
            ))}
          </>
        )}
        {live && live.routes.map((route) => <RouteCard key={route.iata} route={route} originIata={origin.iata} />)}
        {live === null && destinations.map((d) => (
          <a
            key={d.iata}
            href={tpwlSearchUrl(origin.iata, d.iata)}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className={`group relative aspect-[4/3] overflow-hidden rounded bg-forest-900/10 ${
              WIDE_DESTINATIONS.has(d.iata) ? 'lg:col-span-2 lg:aspect-[8/3]' : ''
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={d.imageUrl}
              alt={d.name}
              loading="lazy"
              className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 text-white">
              <div className="min-w-0">
                <div className="truncate text-lg font-bold drop-shadow-sm">{d.name}</div>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5 shrink-0 opacity-90 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              >
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </div>
          </a>
        ))}

        <a
          href={`${TPWL_HOST}/`}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="group flex aspect-[4/3] overflow-hidden rounded border border-forest-900/15 bg-white hover:border-primary-emphasis hover:shadow-sm lg:col-span-2 lg:aspect-[8/3]"
        >
          <div className="hidden h-full w-1/2 shrink-0 items-end justify-center bg-gradient-to-br from-sand-100 via-secondary to-primary-hover sm:flex">
            <svg
              className="size-28 -translate-y-2 text-primary-emphasis"
              viewBox="0 0 64 64"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              aria-hidden
            >
              <circle cx="22" cy="18" r="5" />
              <path d="M16 32c0-4 2.7-7 6-7s6 3 6 7v22" strokeLinecap="round" />
              <path d="M14 54h16" strokeLinecap="round" />
              <circle cx="42" cy="18" r="5" />
              <path d="M36 32c0-4 2.7-7 6-7s6 3 6 7v22" strokeLinecap="round" />
              <path d="M34 54h16" strokeLinecap="round" />
              <rect x="8" y="38" width="10" height="16" rx="1.5" />
              <path d="M11 38v-3h4v3" strokeLinecap="round" />
              <rect x="46" y="38" width="10" height="16" rx="1.5" />
              <path d="M49 38v-3h4v3" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex flex-1 flex-col justify-between p-5">
            <div>
              <h3 className="text-base font-bold text-forest-900">Need a different route?</h3>
              <p className="mt-2 text-xs text-ink/75">
                Open the full flight search and compare airlines, agencies and date combinations.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-emphasis">
              Search all flights
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              >
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </span>
          </div>
        </a>
      </div>
      {live && (
        <p className="mt-3 text-xs text-ink/55" data-testid="popular-routes-note">
          Fares are the lowest recently found by our search partner for the dates shown, in the currency shown, and can change. The final price is shown when you book.
        </p>
      )}
    </section>
  );
}

function RouteCard({ route, originIata }: { route: PopularRoute; originIata: string }) {
  const depart = shortDate(route.departISO);
  const back = shortDate(route.returnISO);
  const dates = depart ? (back ? `${depart} – ${back}` : depart) : null;

  return (
    <a
      href={tpwlSearchUrl(originIata, route.iata, { departISO: route.departISO, returnISO: route.returnISO ?? undefined })}
      target="_blank"
      rel="noopener noreferrer sponsored"
      data-testid="popular-route-card"
      className="group relative aspect-[4/3] overflow-hidden rounded bg-gradient-to-br from-forest-900 via-forest-900 to-forest-700"
    >
      {route.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={route.imageUrl}
          alt={route.city}
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-lg font-bold drop-shadow-sm">{route.city}</div>
            {route.country && route.country !== route.city && (
              <div className="truncate text-xs text-white/75">{route.country}</div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">from</div>
            <div className="text-xl font-bold leading-none">{formatPrice(route.price, route.currency)}</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-white/80">
          {stopsLabel(route.transfers)}
          {dates && <> · {dates}</>}
        </div>
      </div>
    </a>
  );
}
