'use client';

import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { AirlineRegion } from '@/lib/strapi';
import {
  AIRPORTS_BROWSE_LIMIT,
  DIRECTORY_REGIONS,
  airportSortKey,
  compareAirports,
  foldText,
  fromRow,
  letterOf,
  type AirportRow,
  type DirectoryAirport,
} from '@/lib/airport-directory';
import { CheckIcon } from '@/components/FeaturedAirlineGuides';
import styles from './AirportDirectory.module.css';

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];
const OTHER_REGION = 'Other';
type RegionKey = AirlineRegion | typeof OTHER_REGION;

function slugify(s: string): string {
  return s.replace(/\s+/g, '-').toLowerCase();
}

/**
 * "Browse all airports" on /airports. The page sends every airport as a slim
 * search index (compact rows: codes, names, country, region, slug, counts — no
 * images, no prose) but renders only AIRPORTS_BROWSE_LIMIT cards at a time,
 * with "Show more" adding the next batch. Search, filters, the letter bar and
 * ?country= all run over the full index, so any airport can be found.
 *
 * Rows arrive in ranked order (reviewed guides, then most route records, then
 * A–Z); picking a letter lists that letter A–Z instead. The server HTML holds
 * the first batch, which is what the page's ItemList describes.
 */
export default function AirportDirectory({ rows }: { rows: AirportRow[] }) {
  const airports = useMemo(() => rows.map(fromRow), [rows]);

  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<RegionKey | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const [reviewedOnly, setReviewedOnly] = useState(false);
  const [routesOnly, setRoutesOnly] = useState(false);
  const [shown, setShown] = useState(AIRPORTS_BROWSE_LIMIT);
  const deferredQuery = useDeferredValue(query);
  const listTop = useRef<HTMLDivElement>(null);

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

  // Any change to what is matched starts again from the first batch.
  const q = foldText(deferredQuery.trim());
  useEffect(() => {
    setShown(AIRPORTS_BROWSE_LIMIT);
  }, [q, region, country, letter, reviewedOnly, routesOnly]);

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

  const countryKey = country ? foldText(country) : '';
  // Matches before the letter filter, so the letter bar can grey out letters
  // with nothing to show.
  const matched = useMemo(
    () =>
      indexed.filter(({ airport: a, hay, country: c }) => {
        if (reviewedOnly && !a.reviewed) return false;
        if (routesOnly && !a.routes) return false;
        if (region && (a.region ?? OTHER_REGION) !== region) return false;
        if (countryKey && c !== countryKey) return false;
        return !q || hay.includes(q);
      }),
    [indexed, reviewedOnly, routesOnly, region, countryKey, q],
  );
  const lettersWithMatches = useMemo(() => new Set(matched.map((m) => m.letter)), [matched]);

  const results = useMemo(() => {
    if (!letter) return matched.map((m) => m.airport);
    return matched
      .filter((m) => m.letter === letter)
      .map((m) => m.airport)
      .sort(compareAirports);
  }, [matched, letter]);

  const visible = results.slice(0, shown);
  const remaining = results.length - visible.length;

  const hasFilters =
    Boolean(query.trim()) || region !== null || country !== null || letter !== null || reviewedOnly || routesOnly;
  const clearAll = () => {
    setQuery('');
    setRegion(null);
    setCountry(null);
    setLetter(null);
    setReviewedOnly(false);
    setRoutesOnly(false);
  };

  const pickLetter = (l: string) => {
    setLetter((cur) => (cur === l ? null : l));
    listTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const countText = (
    <>
      Showing <strong className="font-semibold text-forest-950">{visible.length.toLocaleString()}</strong> of{' '}
      {results.length === airports.length ? (
        <>{airports.length.toLocaleString()} airports</>
      ) : (
        <>
          {results.length.toLocaleString()} matching airport{results.length === 1 ? '' : 's'}
        </>
      )}
    </>
  );

  return (
    <section className="mt-14" aria-labelledby="airport-directory-heading" data-testid="airport-directory">
      <h2 id="airport-directory-heading" className="scroll-mt-24 text-2xl font-bold leading-tight sm:text-3xl">
        Browse all airports
      </h2>
      <p className="mt-2 text-sm text-forest-900/70 sm:text-base">
        Search all {airports.length.toLocaleString()} airports by name, IATA or ICAO code, city or country.
      </p>

      {/* Search + filters */}
      <div className="mt-5 rounded-[0.3rem] border border-forest-900/10 bg-paper p-4 sm:p-5">
        <div className="relative min-w-0">
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
                  onClick={() => setRegion(region === r ? null : (r as RegionKey))}
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

      {/* Sticky letter filter + result count. top = height of the fixed site header. */}
      <div
        ref={listTop}
        className="sticky top-[75px] z-30 -mx-4 mt-6 scroll-mt-[75px] border-y border-forest-900/10 bg-white/95 px-4 backdrop-blur sm:mx-0 sm:rounded-[0.3rem] sm:border sm:px-2"
      >
        <div className="flex items-center gap-3 py-1.5">
          <div role="group" aria-label="Filter by first letter of the city" className="min-w-0 flex-1">
            <ul className="no-scrollbar flex gap-0.5 overflow-x-auto">
              {LETTERS.map((l) => {
                const enabled = lettersWithMatches.has(l);
                const active = letter === l;
                return (
                  <li key={l} className="flex-none">
                    <button
                      type="button"
                      onClick={() => pickLetter(l)}
                      disabled={!enabled && !active}
                      aria-pressed={active}
                      className={`flex h-8 w-8 items-center justify-center rounded-[0.2rem] text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis ${
                        active
                          ? 'bg-forest-950 text-white'
                          : enabled
                            ? 'text-forest-950 hover:bg-primary-hover hover:text-primary-emphasis'
                            : 'text-forest-900/25'
                      }`}
                      data-testid={`airport-letter-${l}`}
                    >
                      {l}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <p
            className="hidden flex-none pr-2 text-sm text-forest-900/65 md:block"
            aria-live="polite"
            data-testid="airport-result-count"
          >
            {countText}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-forest-900/70">
        <p data-testid="airport-order-note">
          <span className="md:hidden" aria-live="polite">
            {countText}.{' '}
          </span>
          {letter
            ? `Cities starting with ${letter === '#' ? 'a number or symbol' : letter}, A–Z.`
            : 'Reviewed guides first, then most route records, then A–Z. Search or filter to find any airport.'}
        </p>
        {hasFilters && results.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="font-semibold text-primary-emphasis underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
          >
            Clear filters
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div
          className="mt-6 rounded-[0.3rem] border border-dashed border-forest-900/20 px-6 py-12 text-center"
          data-testid="airports-empty"
        >
          <p className="text-base font-semibold text-forest-950">
            No airports match {q ? `“${deferredQuery.trim()}”` : 'these filters'}
            {country ? ` in ${country}` : ''}
            {letter ? ` starting with ${letter}` : ''}.
          </p>
          <p className="mt-1 text-sm text-forest-900/65">Try the three-letter IATA code, the city name, or fewer filters.</p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-5 rounded-[0.3rem] bg-forest-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <>
          <ul className={styles.cardGrid} data-testid="airport-results">
            {visible.map((a) => (
              <li key={a.iata} className="min-w-0">
                <AirportCard airport={a} />
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setShown((n) => n + AIRPORTS_BROWSE_LIMIT)}
                className="rounded-[0.3rem] border border-forest-900/20 bg-white px-5 py-2.5 text-sm font-semibold text-forest-950 transition hover:border-primary-emphasis/50 hover:text-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
                data-testid="airport-show-more"
              >
                Show {Math.min(AIRPORTS_BROWSE_LIMIT, remaining).toLocaleString()} more
              </button>
              <p className="text-xs text-forest-900/55">{remaining.toLocaleString()} not shown yet</p>
            </div>
          )}
        </>
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
