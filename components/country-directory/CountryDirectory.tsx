'use client';

import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { AirlineRegion } from '@/lib/strapi';
import {
  COUNTRIES_BROWSE_LIMIT,
  DIRECTORY_REGIONS,
  foldText,
  fromRow,
  letterOf,
  type CountryRow,
} from '@/lib/country-directory';
import CountryCard from './CountryCard';
import styles from './CountryDirectory.module.css';

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];
const OTHER_REGION = 'Other';
type RegionKey = AirlineRegion | typeof OTHER_REGION;

function slugify(s: string): string {
  return s.replace(/\s+/g, '-').toLowerCase();
}

const Card = memo(CountryCard);

/**
 * "Browse all countries" on /countries. Gets every country as a compact row
 * (code, name, region, guide slug, counts — no prose, no images), renders
 * COUNTRIES_BROWSE_LIMIT cards at a time A–Z, and runs search, region and
 * letter filters over the full list. The server HTML holds the first batch,
 * which is what the page's ItemList describes.
 */
export default function CountryDirectory({ rows }: { rows: CountryRow[] }) {
  const countries = useMemo(() => rows.map(fromRow), [rows]);

  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<RegionKey | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const [routesOnly, setRoutesOnly] = useState(false);
  const [articlesOnly, setArticlesOnly] = useState(false);
  const [shown, setShown] = useState(COUNTRIES_BROWSE_LIMIT);
  const deferredQuery = useDeferredValue(query);
  const listTop = useRef<HTMLDivElement>(null);

  const indexed = useMemo(
    () =>
      countries.map((c) => ({
        country: c,
        letter: letterOf(c.name),
        hay: foldText([c.name, c.code, c.airlineQuery].filter(Boolean).join(' ')),
      })),
    [countries],
  );

  const q = foldText(deferredQuery.trim());
  useEffect(() => {
    setShown(COUNTRIES_BROWSE_LIMIT);
  }, [q, region, letter, routesOnly, articlesOnly]);

  const regionCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of countries) {
      const r = c.region ?? OTHER_REGION;
      m.set(r, (m.get(r) ?? 0) + 1);
    }
    return m;
  }, [countries]);
  const routesTotal = useMemo(() => countries.filter((c) => c.routes).length, [countries]);
  const articlesTotal = useMemo(() => countries.filter((c) => c.articles).length, [countries]);

  // An exact two-letter code ("JP") also matches by code alone, so "in" finds
  // India without every name containing "in" crowding it out.
  const exactCode = /^[a-z]{2}$/.test(q) ? q.toUpperCase() : null;
  const matched = useMemo(
    () =>
      indexed.filter(({ country: c, hay }) => {
        if (routesOnly && !c.routes) return false;
        if (articlesOnly && !c.articles) return false;
        if (region && (c.region ?? OTHER_REGION) !== region) return false;
        return !q || hay.includes(q);
      }),
    [indexed, routesOnly, articlesOnly, region, q],
  );
  const lettersWithMatches = useMemo(() => new Set(matched.map((m) => m.letter)), [matched]);

  const results = useMemo(() => {
    const list = (letter ? matched.filter((m) => m.letter === letter) : matched).map((m) => m.country);
    if (!exactCode) return list;
    // Put the exact ISO-code match first.
    const i = list.findIndex((c) => c.code === exactCode);
    return i > 0 ? [list[i], ...list.slice(0, i), ...list.slice(i + 1)] : list;
  }, [matched, letter, exactCode]);

  const visible = results.slice(0, shown);
  const remaining = results.length - visible.length;

  const hasFilters = Boolean(query.trim()) || region !== null || letter !== null || routesOnly || articlesOnly;
  const clearAll = () => {
    setQuery('');
    setRegion(null);
    setLetter(null);
    setRoutesOnly(false);
    setArticlesOnly(false);
  };

  const pickLetter = (l: string) => {
    setLetter((cur) => (cur === l ? null : l));
    listTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const countText = (
    <>
      Showing <strong className="font-semibold text-forest-950">{visible.length.toLocaleString()}</strong> of{' '}
      {results.length === countries.length ? (
        <>{countries.length.toLocaleString()} countries</>
      ) : (
        <>
          {results.length.toLocaleString()} matching countr{results.length === 1 ? 'y' : 'ies'}
        </>
      )}
    </>
  );

  return (
    <section className="mt-14" aria-labelledby="country-directory-heading" data-testid="country-directory">
      <h2 id="country-directory-heading" className="scroll-mt-24 text-2xl font-bold leading-tight sm:text-3xl">
        Browse all countries
      </h2>
      <p className="mt-2 text-sm text-forest-900/70 sm:text-base">
        Search all {countries.length.toLocaleString()} countries by name or two-letter ISO code.
      </p>

      <div className="mt-5 rounded-[0.3rem] border border-forest-900/10 bg-paper p-4 sm:p-5">
        <div className="relative min-w-0">
          <label htmlFor="country-search" className="sr-only">
            Search countries
          </label>
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-forest-900/45">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            id="country-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Country or ISO code (JP)"
            autoComplete="off"
            spellCheck={false}
            className="h-12 w-full rounded-[0.3rem] border border-forest-900/20 bg-white pl-11 pr-11 text-base text-ink shadow-xs placeholder:text-forest-900/45 focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/25 [&::-webkit-search-cancel-button]:hidden"
            data-testid="country-search"
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
                  testId={`country-region-filter-${slugify(r)}`}
                >
                  {r}
                  <span className={region === r ? 'text-white/70' : 'text-forest-900/50'}>{regionCounts.get(r)}</span>
                </Chip>
              ))}
          </ChipRow>
          <ChipRow label="Show">
            <Chip
              active={!routesOnly && !articlesOnly}
              onClick={() => {
                setRoutesOnly(false);
                setArticlesOnly(false);
              }}
            >
              All
            </Chip>
            {routesTotal > 0 && (
              <Chip active={routesOnly} onClick={() => setRoutesOnly((v) => !v)} testId="country-routes-filter">
                With route records
                <span className={routesOnly ? 'text-white/70' : 'text-forest-900/50'}>{routesTotal}</span>
              </Chip>
            )}
            {articlesTotal > 0 && (
              <Chip active={articlesOnly} onClick={() => setArticlesOnly((v) => !v)} testId="country-articles-filter">
                With articles
                <span className={articlesOnly ? 'text-white/70' : 'text-forest-900/50'}>{articlesTotal}</span>
              </Chip>
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
          <div role="group" aria-label="Filter by first letter of the country" className="min-w-0 flex-1">
            <ul className="no-scrollbar flex gap-0.5 overflow-x-auto">
              {LETTERS.map((l) => {
                const enabled = lettersWithMatches.has(l);
                const active = letter === l;
                if (l === '#' && !enabled && !active) return null;
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
                      data-testid={`country-letter-${l}`}
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
            data-testid="country-result-count"
          >
            {countText}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-forest-900/70">
        <p data-testid="country-order-note">
          <span className="md:hidden" aria-live="polite">
            {countText}.{' '}
          </span>
          {letter ? `Countries starting with ${letter === '#' ? 'a number or symbol' : letter}, A–Z.` : 'A–Z by name.'}
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
          data-testid="countries-empty"
        >
          <p className="text-base font-semibold text-forest-950">
            No countries match {q ? `“${deferredQuery.trim()}”` : 'these filters'}
            {letter ? ` starting with ${letter}` : ''}.
          </p>
          <p className="mt-1 text-sm text-forest-900/65">Try the two-letter ISO code, another spelling, or fewer filters.</p>
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
          <ul className={styles.cardGrid} data-testid="country-results">
            {visible.map((c) => (
              <li key={c.code} className="min-w-0">
                <Card country={c} />
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setShown((n) => n + COUNTRIES_BROWSE_LIMIT)}
                className="rounded-[0.3rem] border border-forest-900/20 bg-white px-5 py-2.5 text-sm font-semibold text-forest-950 transition hover:border-primary-emphasis/50 hover:text-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
                data-testid="country-show-more"
              >
                Show {Math.min(COUNTRIES_BROWSE_LIMIT, remaining)} more
              </button>
              <p className="text-xs text-forest-900/55">{remaining} not shown yet</p>
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
