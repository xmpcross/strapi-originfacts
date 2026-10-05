'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { AirlineRegion } from '@/lib/strapi';
import { foldText } from '@/lib/airport-directory';
import {
  DIRECTORY_REGIONS,
  ROUTES_BROWSE_LIMIT,
  fromRow,
  isDomestic,
  matchesQuery,
  routeHaystack,
  sortRoutes,
  type DirectoryCarrier,
  type RouteRow,
  type RouteSort,
} from '@/lib/route-directory';
import RouteCard from './RouteCard';
import styles from './RouteDirectory.module.css';

type Scope = 'all' | 'international' | 'domestic';

const SORTS: { value: RouteSort; label: string }[] = [
  { value: 'popular', label: 'Most popular in our records' },
  { value: 'az', label: 'Departure city A–Z' },
  { value: 'longest', label: 'Longest distance' },
  { value: 'shortest', label: 'Shortest distance' },
];

function slugify(s: string): string {
  return s.replace(/\s+/g, '-').toLowerCase();
}

function countBy<T>(items: T[], key: (t: T) => string | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of items) {
    const k = key(t);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/**
 * "Browse all routes" on /flight-routes. Every route arrives as a compact row
 * (codes, cities, countries, slugs, distance, estimated time, carrier
 * indexes); only ROUTES_BROWSE_LIMIT cards render at a time and "Show more"
 * adds the next batch. Search, filters and sorting run over every route.
 *
 * Deep links, read after hydration: ?q=<text>, ?from=<origin IATA>,
 * ?airline=<airline slug>.
 */
export default function RouteDirectory({ rows, carriers }: { rows: RouteRow[]; carriers: DirectoryCarrier[] }) {
  const routes = useMemo(() => rows.map(fromRow), [rows]);

  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<AirlineRegion | null>(null);
  const [fromCountry, setFromCountry] = useState('');
  const [toCountry, setToCountry] = useState('');
  const [origin, setOrigin] = useState('');
  const [carrier, setCarrier] = useState(-1);
  const [scope, setScope] = useState<Scope>('all');
  const [sort, setSort] = useState<RouteSort>('popular');
  const [shown, setShown] = useState(ROUTES_BROWSE_LIMIT);
  const deferredQuery = useDeferredValue(query);
  const listTop = useRef<HTMLDivElement>(null);

  const indexed = useMemo(
    () => routes.map((r) => ({ route: r, hay: routeHaystack(r, carriers), domestic: isDomestic(r) })),
    [routes, carriers],
  );

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const q = p.get('q')?.trim();
    const from = p.get('from')?.trim().toUpperCase();
    const airline = p.get('airline')?.trim().toLowerCase();
    if (q) setQuery(q);
    if (from && routes.some((r) => r.origin.iata === from)) setOrigin(from);
    if (airline) {
      const i = carriers.findIndex((c) => c.slug === airline);
      if (i >= 0) setCarrier(i);
    }
  }, [routes, carriers]);

  // Facet options, with route counts over the whole directory.
  const regionCounts = useMemo(() => countBy(routes, (r) => r.origin.region), [routes]);
  const fromCountries = useMemo(() => countBy(routes, (r) => r.origin.country), [routes]);
  const toCountries = useMemo(() => countBy(routes, (r) => r.destination.country), [routes]);
  const origins = useMemo(() => {
    const m = new Map<string, { label: string; count: number }>();
    for (const r of routes) {
      const cur = m.get(r.origin.iata);
      if (cur) cur.count += 1;
      else m.set(r.origin.iata, { label: `${r.origin.city} (${r.origin.iata})`, count: 1 });
    }
    return [...m].sort((a, b) => a[1].label.localeCompare(b[1].label, 'en', { sensitivity: 'base' }));
  }, [routes]);
  const carrierCounts = useMemo(() => {
    const counts = new Array<number>(carriers.length).fill(0);
    for (const r of routes) for (const i of r.carriers) counts[i] += 1;
    return carriers
      .map((c, i) => ({ i, c, n: counts[i] }))
      .filter((x) => x.n > 0)
      .sort((a, b) => a.c.name.localeCompare(b.c.name, 'en', { sensitivity: 'base' }));
  }, [routes, carriers]);
  const domesticTotal = useMemo(() => indexed.filter((x) => x.domestic).length, [indexed]);

  const q = deferredQuery.trim();
  const qKey = foldText(q);
  useEffect(() => {
    setShown(ROUTES_BROWSE_LIMIT);
  }, [qKey, region, fromCountry, toCountry, origin, carrier, scope, sort]);

  const results = useMemo(() => {
    const matched = indexed
      .filter(({ route: r, hay, domestic }) => {
        if (region && r.origin.region !== region) return false;
        if (fromCountry && r.origin.country !== fromCountry) return false;
        if (toCountry && r.destination.country !== toCountry) return false;
        if (origin && r.origin.iata !== origin) return false;
        if (carrier >= 0 && !r.carriers.includes(carrier)) return false;
        if (scope === 'domestic' && !domestic) return false;
        if (scope === 'international' && domestic) return false;
        return !q || matchesQuery(hay, q);
      })
      .map((x) => x.route);
    return sortRoutes(matched, sort);
  }, [indexed, region, fromCountry, toCountry, origin, carrier, scope, q, sort]);

  const visible = results.slice(0, shown);
  const remaining = results.length - visible.length;

  const hasFilters =
    Boolean(query.trim()) ||
    region !== null ||
    Boolean(fromCountry || toCountry || origin) ||
    carrier >= 0 ||
    scope !== 'all';
  const clearAll = () => {
    setQuery('');
    setRegion(null);
    setFromCountry('');
    setToCountry('');
    setOrigin('');
    setCarrier(-1);
    setScope('all');
  };

  const pickRegion = (r: AirlineRegion | null) => {
    setRegion((cur) => (cur === r ? null : r));
    listTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const countText = (
    <>
      Showing <strong className="font-semibold text-forest-950">{visible.length.toLocaleString()}</strong> of{' '}
      {results.length === routes.length ? (
        <>{routes.length.toLocaleString()} routes</>
      ) : (
        <>
          {results.length.toLocaleString()} matching route{results.length === 1 ? '' : 's'}
        </>
      )}
    </>
  );

  return (
    <section className="mt-14" aria-labelledby="route-directory-heading" data-testid="route-directory">
      <h2 id="route-directory-heading" className="scroll-mt-24 text-2xl font-bold leading-tight sm:text-3xl">
        Browse all routes
      </h2>
      <p className="mt-2 text-sm text-forest-900/70 sm:text-base">
        Search all {routes.length.toLocaleString()} routes in our records by city, airport, IATA code, country or
        airline.
      </p>

      {/* Search + filters */}
      <div className="mt-5 rounded-[0.3rem] border border-forest-900/10 bg-paper p-4 sm:p-5">
        <label htmlFor="route-search" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-forest-900/55">
          Search routes
        </label>
        <div className="relative min-w-0">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-forest-900/45">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            id="route-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, airport or code — e.g. London Bangkok, LHR BKK"
            autoComplete="off"
            spellCheck={false}
            className="h-12 w-full rounded-[0.3rem] border border-forest-900/20 bg-white pl-11 pr-11 text-base text-ink shadow-xs placeholder:text-forest-900/45 focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/25 [&::-webkit-search-cancel-button]:hidden"
            data-testid="route-search"
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

        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-forest-900/10 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select id="route-from-country" label="From country" value={fromCountry} onChange={setFromCountry} testId="route-from-country">
            <option value="">All countries</option>
            {[...fromCountries].sort((a, b) => a[0].localeCompare(b[0])).map(([c, n]) => (
              <option key={c} value={c}>
                {c} ({n})
              </option>
            ))}
          </Select>
          <Select id="route-to-country" label="To country" value={toCountry} onChange={setToCountry} testId="route-to-country">
            <option value="">All countries</option>
            {[...toCountries].sort((a, b) => a[0].localeCompare(b[0])).map(([c, n]) => (
              <option key={c} value={c}>
                {c} ({n})
              </option>
            ))}
          </Select>
          <Select id="route-origin" label="Departure airport" value={origin} onChange={setOrigin} testId="route-origin">
            <option value="">All airports</option>
            {origins.map(([iata, { label, count }]) => (
              <option key={iata} value={iata}>
                {label} ({count})
              </option>
            ))}
          </Select>
          <Select
            id="route-airline"
            label="Airline"
            value={carrier >= 0 ? String(carrier) : ''}
            onChange={(v) => setCarrier(v === '' ? -1 : Number(v))}
            testId="route-airline"
          >
            <option value="">All airlines</option>
            {carrierCounts.map(({ i, c, n }) => (
              <option key={c.slug} value={i}>
                {c.name} ({n})
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-3 flex items-center gap-3" role="group" aria-label="Route type">
          <span className="w-14 flex-none text-xs font-bold uppercase tracking-widest text-forest-900/55">Type</span>
          <div className="no-scrollbar -my-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 sm:flex-wrap">
            <Chip active={scope === 'all'} onClick={() => setScope('all')}>
              All
            </Chip>
            <Chip active={scope === 'international'} onClick={() => setScope(scope === 'international' ? 'all' : 'international')} testId="route-scope-international">
              International
              <Count active={scope === 'international'}>{(routes.length - domesticTotal).toLocaleString()}</Count>
            </Chip>
            {domesticTotal > 0 && (
              <Chip active={scope === 'domestic'} onClick={() => setScope(scope === 'domestic' ? 'all' : 'domestic')} testId="route-scope-domestic">
                Domestic
                <Count active={scope === 'domestic'}>{domesticTotal.toLocaleString()}</Count>
              </Chip>
            )}
          </div>
        </div>
      </div>

      {/* Sticky region bar + live count + sort. top = height of the fixed site header. */}
      <div
        ref={listTop}
        className="sticky top-[75px] z-30 -mx-4 mt-6 scroll-mt-[75px] border-y border-forest-900/10 bg-white/95 px-4 backdrop-blur sm:mx-0 sm:rounded-[0.3rem] sm:border sm:px-2"
        data-testid="route-jump-bar"
      >
        <div className="flex items-center gap-3 py-1.5">
          <div role="group" aria-label="Departing from region" className="min-w-0 flex-1">
            <ul className="no-scrollbar flex items-center gap-1 overflow-x-auto">
              <li className="flex-none pr-1 text-xs font-bold uppercase tracking-widest text-forest-900/55">From</li>
              <li className="flex-none">
                <RegionButton active={region === null} onClick={() => pickRegion(null)}>
                  All
                </RegionButton>
              </li>
              {DIRECTORY_REGIONS.filter((r) => regionCounts.has(r)).map((r) => (
                <li key={r} className="flex-none">
                  <RegionButton active={region === r} onClick={() => pickRegion(r)} testId={`route-region-${slugify(r)}`}>
                    {r}
                    <span className={region === r ? 'text-white/70' : 'text-forest-900/45'}>{regionCounts.get(r)}</span>
                  </RegionButton>
                </li>
              ))}
            </ul>
          </div>
          <p className="hidden flex-none text-sm text-forest-900/65 lg:block" aria-live="polite" data-testid="route-result-count">
            {countText}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-forest-900/70">
        <p>
          <span className="lg:hidden" aria-live="polite">
            {countText}.{' '}
          </span>
          {hasFilters && results.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="font-semibold text-primary-emphasis underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
            >
              Clear filters
            </button>
          )}
        </p>
        <label className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-forest-900/55">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as RouteSort)}
            className="h-9 rounded-[0.3rem] border border-forest-900/20 bg-white px-2 text-sm text-forest-950 focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/25"
            data-testid="route-sort"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {results.length === 0 ? (
        <div className="mt-6 rounded-[0.3rem] border border-dashed border-forest-900/20 px-6 py-12 text-center" data-testid="routes-empty">
          <p className="text-base font-semibold text-forest-950">
            No routes in our records match {q ? `“${q}”` : 'these filters'}.
          </p>
          <p className="mt-1 text-sm text-forest-900/65">
            Try a city name or three-letter code, or fewer filters. Our records cover {routes.length.toLocaleString()} routes,
            not every route flown.
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
        <>
          <ul className={styles.cardGrid} data-testid="route-results">
            {visible.map((r) => (
              <li key={r.slug} className="min-w-0">
                <RouteCard route={r} carriers={carriers} />
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setShown((n) => n + ROUTES_BROWSE_LIMIT)}
                className="rounded-[0.3rem] border border-forest-900/20 bg-white px-5 py-2.5 text-sm font-semibold text-forest-950 transition hover:border-primary-emphasis/50 hover:text-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
                data-testid="route-show-more"
              >
                Show {Math.min(ROUTES_BROWSE_LIMIT, remaining).toLocaleString()} more
              </button>
              <p className="text-xs text-forest-900/55">{remaining.toLocaleString()} not shown yet</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  children,
  testId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-bold uppercase tracking-widest text-forest-900/55">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 w-full min-w-0 rounded-[0.3rem] border bg-white px-2.5 text-sm focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/25 ${
          value ? 'border-forest-950 font-semibold text-forest-950' : 'border-forest-900/20 text-forest-900/85'
        }`}
        data-testid={testId}
      >
        {children}
      </select>
    </div>
  );
}

function Count({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <span className={active ? 'text-white/70' : 'text-forest-900/50'}>{children}</span>;
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

function RegionButton({
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
      className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[0.2rem] px-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis ${
        active ? 'bg-forest-950 text-white' : 'text-forest-950 hover:bg-primary-hover hover:text-primary-emphasis'
      }`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}
