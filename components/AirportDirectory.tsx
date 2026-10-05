'use client';

import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { AirlineRegion } from '@/lib/strapi';
import {
  DIRECTORY_REGIONS,
  airportSortKey,
  foldText,
  letterOf,
  type DirectoryAirport,
} from '@/lib/airport-directory';
import { CheckIcon } from '@/components/FeaturedAirlineGuides';
import styles from './AirportDirectory.module.css';

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];
const OTHER_REGION = 'Other';
type GroupBy = 'az' | 'region';
type Group = { key: string; id: string; title: string; airports: DirectoryAirport[] };

function slugify(s: string): string {
  return s.replace(/\s+/g, '-').toLowerCase();
}

function letterId(l: string): string {
  return `letter-${l === '#' ? 'num' : l.toLowerCase()}`;
}

/**
 * The searchable airport list on /airports. Every airport card is in the
 * server HTML (no useSearchParams, so the page never bails out to client-only
 * rendering and crawlers get every /airports/<slug> link); filtering happens in
 * place once hydrated. Text-only cards: no airport images.
 */
export default function AirportDirectory({ airports }: { airports: DirectoryAirport[] }) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<AirlineRegion | typeof OTHER_REGION | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [reviewedOnly, setReviewedOnly] = useState(false);
  const [routesOnly, setRoutesOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('az');
  // Filtering re-renders up to 3,600 cards: let typing and chip clicks paint
  // first and the list catch up.
  const deferredQuery = useDeferredValue(query);
  const fRegion = useDeferredValue(region);
  const fCountry = useDeferredValue(country);
  const fReviewed = useDeferredValue(reviewedOnly);
  const fRoutes = useDeferredValue(routesOnly);

  const indexed = useMemo(
    () =>
      airports.map((a) => ({
        airport: a,
        letter: letterOf(airportSortKey(a)),
        country: a.country ? foldText(a.country) : '',
        hay: foldText([a.iata, a.icao, a.name, a.city, a.country].filter(Boolean).join(' ')),
      })),
    [airports],
  );

  // Country pages link here as /airports?country=<name>. Read it after
  // hydration rather than through useSearchParams, which would make the whole
  // directory client-rendered. An exact country match becomes a country
  // filter; anything else becomes the search text.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('country')?.trim();
    if (!param) return;
    const folded = foldText(param);
    const match = indexed.find((x) => x.country === folded)?.airport.country;
    if (match) setCountry(match);
    else setQuery(param);
  }, [indexed]);

  const regionCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of airports) {
      const r = a.region ?? OTHER_REGION;
      m.set(r, (m.get(r) ?? 0) + 1);
    }
    return m;
  }, [airports]);
  const reviewedTotal = useMemo(() => airports.filter((a) => a.reviewed).length, [airports]);
  const routesTotal = useMemo(() => airports.filter((a) => a.routes).length, [airports]);

  const q = foldText(deferredQuery.trim());
  const countryKey = fCountry ? foldText(fCountry) : '';
  const filtered = useMemo(
    () =>
      indexed.filter(({ airport: a, hay, country: c }) => {
        if (fReviewed && !a.reviewed) return false;
        if (fRoutes && !a.routes) return false;
        if (fRegion && (a.region ?? OTHER_REGION) !== fRegion) return false;
        if (countryKey && c !== countryKey) return false;
        return !q || hay.includes(q);
      }),
    [indexed, fReviewed, fRoutes, fRegion, countryKey, q],
  );

  const groups: Group[] = useMemo(() => {
    const map = new Map<string, DirectoryAirport[]>();
    for (const f of filtered) {
      const k = groupBy === 'az' ? f.letter : f.airport.region ?? OTHER_REGION;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(f.airport);
    }
    if (groupBy === 'az') {
      return LETTERS.filter((l) => map.has(l)).map((l) => ({ key: l, id: letterId(l), title: l, airports: map.get(l)! }));
    }
    return [...DIRECTORY_REGIONS, OTHER_REGION]
      .filter((r) => map.has(r))
      .map((r) => ({ key: r, id: `region-${slugify(r)}`, title: r, airports: map.get(r)! }));
  }, [filtered, groupBy]);

  const hasFilters = Boolean(query.trim()) || region !== null || country !== null || reviewedOnly || routesOnly;
  const clearAll = () => {
    setQuery('');
    setRegion(null);
    setCountry(null);
    setReviewedOnly(false);
    setRoutesOnly(false);
  };

  const groupKeys = new Set(groups.map((g) => g.key));
  const jumpItems =
    groupBy === 'az'
      ? LETTERS.map((l) => ({ key: l, label: l, href: `#${letterId(l)}` }))
      : [...DIRECTORY_REGIONS, OTHER_REGION]
          .filter((r) => regionCounts.has(r))
          .map((r) => ({ key: r, label: r, href: `#region-${slugify(r)}` }));

  const countText = (
    <>
      <strong className="font-semibold text-forest-950">{filtered.length.toLocaleString()}</strong> of{' '}
      {airports.length.toLocaleString()} airports
    </>
  );

  return (
    <section className="mt-14" aria-labelledby="airport-directory-heading" data-testid="airport-directory">
      <h2 id="airport-directory-heading" className="scroll-mt-24 text-2xl font-bold leading-tight sm:text-3xl">
        Browse all airports
      </h2>
      <p className="mt-2 text-sm text-forest-900/70 sm:text-base">
        Search by airport name, IATA or ICAO code, city or country.
      </p>

      {/* Search + filters */}
      <div className="mt-5 rounded-[0.3rem] border border-forest-900/10 bg-paper p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="airport-search" className="sr-only">
              Search airports
            </label>
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-forest-900/45">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              id="airport-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Airport, code (LHR), city or country"
              autoComplete="off"
              spellCheck={false}
              className="h-12 w-full rounded-[0.3rem] border border-forest-900/20 bg-white pl-11 pr-11 text-base text-ink shadow-xs placeholder:text-forest-900/45 focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/25 [&::-webkit-search-cancel-button]:hidden"
              data-testid="airport-search"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-forest-900/50 hover:text-forest-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-forest-900/55" id="airport-group-by-label">
              Group by
            </span>
            <div
              role="radiogroup"
              aria-labelledby="airport-group-by-label"
              className="inline-flex rounded-[0.3rem] border border-forest-900/20 bg-white p-0.5"
            >
              {(
                [
                  ['az', 'A–Z'],
                  ['region', 'Region'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={groupBy === value}
                  onClick={() => setGroupBy(value)}
                  className={`h-10 rounded-[0.2rem] px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-emphasis ${
                    groupBy === value ? 'bg-forest-950 text-white' : 'text-forest-900/75 hover:bg-forest-900/5'
                  }`}
                  data-testid={`airport-group-${value}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3 border-t border-forest-900/10 pt-4">
          <ChipRow label="Region">
            <Chip active={region === null} onClick={() => setRegion(null)}>
              All
            </Chip>
            {[...DIRECTORY_REGIONS, OTHER_REGION]
              .filter((r) => regionCounts.has(r))
              .map((r) => (
                <Chip
                  key={r}
                  active={region === r}
                  onClick={() => setRegion(region === r ? null : (r as AirlineRegion | typeof OTHER_REGION))}
                  testId={`airport-region-filter-${slugify(r)}`}
                >
                  {r}
                  <span className={region === r ? 'text-white/70' : 'text-forest-900/50'}>
                    {regionCounts.get(r)!.toLocaleString()}
                  </span>
                </Chip>
              ))}
          </ChipRow>
          <ChipRow label="Show">
            <Chip
              active={!reviewedOnly && !routesOnly}
              onClick={() => {
                setReviewedOnly(false);
                setRoutesOnly(false);
              }}
            >
              All
            </Chip>
            {reviewedTotal > 0 && (
              <Chip active={reviewedOnly} onClick={() => setReviewedOnly((v) => !v)} testId="airport-reviewed-filter">
                <CheckIcon className="h-3.5 w-3.5" />
                Reviewed guides
                <span className={reviewedOnly ? 'text-white/70' : 'text-forest-900/50'}>{reviewedTotal}</span>
              </Chip>
            )}
            {routesTotal > 0 && (
              <Chip active={routesOnly} onClick={() => setRoutesOnly((v) => !v)} testId="airport-routes-filter">
                With route records
                <span className={routesOnly ? 'text-white/70' : 'text-forest-900/50'}>{routesTotal.toLocaleString()}</span>
              </Chip>
            )}
            {country && (
              <>
                <span className="mx-1 h-5 w-px flex-none bg-forest-900/15" aria-hidden />
                <Chip active onClick={() => setCountry(null)} testId="airport-country-filter">
                  Country: {country}
                  <span aria-hidden className="text-white/70">
                    ×
                  </span>
                  <span className="sr-only">(remove)</span>
                </Chip>
              </>
            )}
          </ChipRow>
        </div>
      </div>

      {/* Sticky jump navigation + result count. top = height of the fixed site header. */}
      <div className="sticky top-[75px] z-30 -mx-4 mt-6 border-y border-forest-900/10 bg-white/95 px-4 backdrop-blur sm:mx-0 sm:rounded-[0.3rem] sm:border sm:px-2">
        <div className="flex items-center gap-3 py-1.5">
          <nav aria-label={groupBy === 'az' ? 'Jump to letter' : 'Jump to region'} className="min-w-0 flex-1">
            <ul className="no-scrollbar flex gap-0.5 overflow-x-auto">
              {jumpItems.map((item) => {
                const enabled = groupKeys.has(item.key);
                const size = groupBy === 'az' ? 'w-8' : 'px-2.5';
                return (
                  <li key={item.key} className="flex-none">
                    {enabled ? (
                      <a
                        href={item.href}
                        className={`flex h-8 items-center justify-center whitespace-nowrap rounded-[0.2rem] text-sm font-semibold text-forest-950 transition hover:bg-primary-hover hover:text-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis ${size}`}
                        data-testid={groupBy === 'az' ? `airport-letter-${item.key}` : `airport-jump-region-${slugify(item.key)}`}
                      >
                        {item.label}
                      </a>
                    ) : (
                      <span
                        className={`flex h-8 items-center justify-center whitespace-nowrap text-sm font-semibold text-forest-900/25 ${size}`}
                        aria-hidden
                      >
                        {item.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
          <p
            className="hidden flex-none pr-2 text-sm text-forest-900/65 md:block"
            aria-live="polite"
            data-testid="airport-result-count"
          >
            {countText}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-forest-900/70">
        <p className="md:hidden" aria-live="polite">
          Showing {countText}
        </p>
        {hasFilters && filtered.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto font-semibold text-primary-emphasis underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
          >
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div
          className="mt-6 rounded-[0.3rem] border border-dashed border-forest-900/20 px-6 py-12 text-center"
          data-testid="airports-empty"
        >
          <p className="text-base font-semibold text-forest-950">
            No airports match {q ? `“${deferredQuery.trim()}”` : 'these filters'}
            {fCountry ? ` in ${fCountry}` : ''}.
          </p>
          <p className="mt-1 text-sm text-forest-900/65">
            Try the three-letter IATA code, the city name, or fewer filters.
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-5 rounded-[0.3rem] bg-forest-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        groups.map((g) => (
          <section
            key={g.key}
            id={g.id}
            className="scroll-mt-[140px] pt-6"
            aria-labelledby={`${g.id}-heading`}
            data-testid={g.id}
          >
            <header className="flex items-baseline justify-between gap-4 border-b border-forest-900/10 pb-2">
              <h3 id={`${g.id}-heading`} className="text-2xl font-bold leading-none">
                {g.title}
              </h3>
              <span className="text-sm text-forest-900/55">
                {g.airports.length.toLocaleString()} airport{g.airports.length === 1 ? '' : 's'}
              </span>
            </header>
            <ul className={styles.cardGrid}>
              {g.airports.map((a) => (
                <li key={a.iata} className="min-w-0">
                  <AirportCard airport={a} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <span className="w-14 flex-none text-xs font-bold uppercase tracking-widest text-forest-900/55">{label}</span>
      <div className="no-scrollbar -my-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 sm:flex-wrap sm:overflow-visible">
        {children}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-9 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-emphasis ${
        active
          ? 'border-forest-950 bg-forest-950 text-white'
          : 'border-forest-900/20 bg-white text-forest-900/85 hover:border-forest-900/40 hover:bg-forest-900/[0.04]'
      }`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

// Kept to six DOM nodes (seven with the reviewed badge): the directory renders
// 3,600 of them. Memoised: a keystroke re-filters the list, but cards that stay visible keep
// the same props and are not re-rendered. A plain <a>, not next/link: 3,600
// Link components (each with its own viewport prefetch observer) made
// hydration several times slower on phones.
const AirportCard = memo(function AirportCard({ airport: a }: { airport: DirectoryAirport }) {
  return (
    <a href={`/airports/${a.slug}`} className={styles.card} data-testid={`airport-card-${a.iata}`}>
      <span className={styles.city}>{a.city || a.name}</span>
      <span className={styles.code} title="IATA code">
        {a.iata}
      </span>
      {a.city && <span className={styles.name}>{a.name}</span>}
      <span className={styles.meta}>
        {[a.country, a.routes ? `${a.routes} route record${a.routes === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}
        {a.reviewed && (
          <span className={styles.reviewed}>
            <CheckIcon className="h-3 w-3" />
            Reviewed guide
          </span>
        )}
      </span>
    </a>
  );
});
