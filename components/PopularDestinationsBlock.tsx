'use client';

import {
  POPULAR_DESTINATIONS,
  WIDE_DESTINATIONS,
  type Destination,
} from '@/lib/flights-data';
import { TPWL_HOST, tpwlSearchUrl } from '@/lib/tpwl-link';
import { useVisitorOrigin } from '@/lib/visitor-origin';

export default function PopularDestinationsBlock() {
  const origin = useVisitorOrigin();
  const destinations: Destination[] = POPULAR_DESTINATIONS.filter((d) => d.iata !== origin.iata).slice(0, 6);

  return (
    <section className="mt-20" data-testid="popular-destinations">
      <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">
        Popular flight searches from your nearest airport
      </h2>
      <p className="mt-2 text-[1rem] text-ink/75">
        Start with routes travellers often compare from{' '}
        <span className="text-primary-emphasis">
          {origin.name} {origin.iata}
        </span>{' '}
        and open a prefilled search with sample dates. Use the cards as a shortcut, then adjust the dates and passengers for your real trip.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {destinations.map((d) => (
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
    </section>
  );
}
