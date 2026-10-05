'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type IndexPlace = { name: string; slug: string; code?: string; country?: string };
export type IndexContinent = { name: string; slug?: string; places: IndexPlace[] };

/** Lower-case and strip diacritics, so "sao paulo" finds "São Paulo". */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const anchor = (name: string) => `continent-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`;

/**
 * The full country and city index for /destinations. Rendered on the server with
 * every link (so the hub links to every guide); the filter only hides rows.
 */
export default function DestinationIndex({ cities, continents }: { cities: IndexPlace[]; continents: IndexContinent[] }) {
  const [query, setQuery] = useState('');
  const q = fold(query.trim());

  const match = (p: IndexPlace) => !q || fold([p.name, p.country ?? '', p.code ?? ''].join(' ')).includes(q);
  const shownCities = useMemo(() => cities.filter(match), [cities, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownContinents = useMemo(
    () => continents.map((c) => ({ ...c, places: c.places.filter(match) })),
    [continents, q], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const total = shownCities.length + shownContinents.reduce((n, c) => n + c.places.length, 0);

  return (
    <div>
      <div className="sticky top-[72px] z-10 -mx-4 border-b border-forest-900/10 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <label htmlFor="destination-filter" className="sr-only">
          Find a country or city
        </label>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            id="destination-filter"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a country or city — e.g. Japan, Lisbon, PE"
            autoComplete="off"
            className="w-full rounded-md border border-forest-900/20 px-4 py-2.5 text-base text-forest-950 placeholder:text-slate-400 focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/30 lg:max-w-md"
          />
          <nav aria-label="Jump to continent" className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <a href="#cities" className="font-semibold text-primary-emphasis hover:underline">
              Cities <span className="tabular-nums text-slate-400">{shownCities.length}</span>
            </a>
            {shownContinents.map((c) => (
              <a key={c.name} href={`#${anchor(c.name)}`} className="font-semibold text-primary-emphasis hover:underline">
                {c.name} <span className="tabular-nums text-slate-400">{c.places.length}</span>
              </a>
            ))}
          </nav>
        </div>
        <p className="sr-only" aria-live="polite">
          {q ? `${total} places match` : ''}
        </p>
      </div>

      {q && total === 0 && (
        <p className="py-16 text-center text-slate-600">
          Nothing matches “{query.trim()}”. Try a country name, a city, or a two-letter country code.
        </p>
      )}

      {shownCities.length > 0 && (
        <section id="cities" aria-labelledby="cities-heading" className="scroll-mt-40 pt-12">
          <h2 id="cities-heading" className="text-2xl font-extrabold tracking-[-0.025em] text-forest-950">
            Cities
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Where to stay, the airports that serve the city, and what to read before you go.
          </p>
          <PlaceGrid places={shownCities} showCountry />
        </section>
      )}

      {shownContinents
        .filter((c) => c.places.length > 0)
        .map((c) => (
          <section key={c.name} id={anchor(c.name)} aria-labelledby={`${anchor(c.name)}-heading`} className="scroll-mt-40 pt-14">
            <div className="flex items-baseline justify-between gap-6 border-b border-forest-900/10 pb-3">
              <h2 id={`${anchor(c.name)}-heading`} className="text-2xl font-extrabold tracking-[-0.025em] text-forest-950">
                {c.name}
              </h2>
              {c.slug && (
                <Link href={`/destinations/${c.slug}`} className="shrink-0 text-sm font-semibold text-primary-emphasis underline-offset-4 hover:underline">
                  {c.name} guide <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
            <PlaceGrid places={c.places} />
          </section>
        ))}
    </div>
  );
}

function PlaceGrid({ places, showCountry = false }: { places: IndexPlace[]; showCountry?: boolean }) {
  return (
    <ul className="mt-5 grid grid-cols-1 gap-x-8 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {places.map((p) => (
        <li key={p.slug}>
          <Link
            href={`/destinations/${p.slug}`}
            className="group flex items-center gap-3 rounded-sm py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-emphasis"
          >
            {p.code && !showCountry && (
              <span
                aria-hidden="true"
                className="inline-flex h-6 w-9 shrink-0 items-center justify-center rounded-[3px] bg-sand-100 text-[0.68rem] font-extrabold tracking-[0.1em] text-forest-950 ring-1 ring-inset ring-sand-400/60"
              >
                {p.code}
              </span>
            )}
            <span className="min-w-0 truncate">
              <span className="font-medium text-forest-950 group-hover:text-primary-emphasis">{p.name}</span>
              {showCountry && p.country && <span className="text-sm text-slate-500"> · {p.country}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
