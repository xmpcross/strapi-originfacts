'use client';

import { useMemo, useState } from 'react';
import type { AirlineRegion } from '@/lib/strapi';
import { DIRECTORY_REGIONS, foldText, type DirectoryAirport } from '@/lib/airport-directory';

const OTHER_REGION = 'Other';
type RegionKey = AirlineRegion | typeof OTHER_REGION;

function regionId(r: string): string {
  return `region-${r.replace(/\s+/g, '-').toLowerCase()}`;
}

/**
 * The /airports/top-100-airports list. Arrives already ordered (region, then
 * city A–Z); every card is in the server HTML and filtering happens in place
 * once hydrated. Text-only cards: no airport images.
 */
export default function TopAirportsList({ airports }: { airports: DirectoryAirport[] }) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<RegionKey | null>(null);

  const indexed = useMemo(
    () =>
      airports.map((a) => ({
        airport: a,
        hay: foldText([a.iata, a.icao, a.name, a.city, a.country].filter(Boolean).join(' ')),
      })),
    [airports],
  );

  const regionCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of airports) m.set(a.region ?? OTHER_REGION, (m.get(a.region ?? OTHER_REGION) ?? 0) + 1);
    return m;
  }, [airports]);
  const regions = [...DIRECTORY_REGIONS, OTHER_REGION].filter((r) => regionCounts.has(r)) as RegionKey[];

  const q = foldText(query.trim());
  const filtered = useMemo(
    () =>
      indexed
        .filter(({ airport: a, hay }) => (!region || (a.region ?? OTHER_REGION) === region) && (!q || hay.includes(q)))
        .map((x) => x.airport),
    [indexed, region, q],
  );

  const groups = regions
    .map((r) => ({ region: r, airports: filtered.filter((a) => (a.region ?? OTHER_REGION) === r) }))
    .filter((g) => g.airports.length > 0);

  const hasFilters = Boolean(query.trim()) || region !== null;
  const clearAll = () => {
    setQuery('');
    setRegion(null);
  };

  return (
    <section className="mt-12" aria-labelledby="top-airports-list-heading" data-testid="top-airports-list">
      <h2 id="top-airports-list-heading" className="scroll-mt-24 text-2xl font-bold leading-tight sm:text-3xl">
        The list, by region
      </h2>
      <p className="mt-2 text-sm text-forest-900/70 sm:text-base">
        Search within the {airports.length} by city, airport name, country or code.
      </p>

      <div className="mt-5 rounded-[0.3rem] border border-forest-900/10 bg-paper p-4 sm:p-5">
        <div className="relative min-w-0">
          <label htmlFor="top-airport-search" className="sr-only">
            Search the top 100 airports
          </label>
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-forest-900/45">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            id="top-airport-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, airport, country or code (LHR)"
            autoComplete="off"
            spellCheck={false}
            className="h-12 w-full rounded-[0.3rem] border border-forest-900/20 bg-white pl-11 pr-11 text-base text-ink shadow-xs placeholder:text-forest-900/45 focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/25 [&::-webkit-search-cancel-button]:hidden"
            data-testid="top-airport-search"
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

        <div className="mt-4 flex items-center gap-3 border-t border-forest-900/10 pt-4" role="group" aria-label="Region">
          <span className="w-14 flex-none text-xs font-bold uppercase tracking-widest text-forest-900/55">Region</span>
          <div className="no-scrollbar -my-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 sm:flex-wrap sm:overflow-visible">
            <Chip active={region === null} onClick={() => setRegion(null)}>
              All
              <span className={region === null ? 'text-white/70' : 'text-forest-900/50'}>{airports.length}</span>
            </Chip>
            {regions.map((r) => (
              <Chip
                key={r}
                active={region === r}
                onClick={() => setRegion(region === r ? null : r)}
                testId={`top-airports-region-${regionId(r)}`}
              >
                {r}
                <span className={region === r ? 'text-white/70' : 'text-forest-900/50'}>{regionCounts.get(r)}</span>
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-forest-900/70">
        <p aria-live="polite" data-testid="top-airports-result-count">
          Showing <strong className="font-semibold text-forest-950">{filtered.length}</strong> of {airports.length}{' '}
          airports
        </p>
        {hasFilters && filtered.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="font-semibold text-primary-emphasis underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
          >
            Clear filters
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div
          className="mt-6 rounded-[0.3rem] border border-dashed border-forest-900/20 px-6 py-12 text-center"
          data-testid="top-airports-empty"
        >
          <p className="text-base font-semibold text-forest-950">
            None of the {airports.length} match {q ? `“${query.trim()}”` : 'this filter'}
            {region ? ` in ${region}` : ''}.
          </p>
          <p className="mt-1 text-sm text-forest-900/65">
            The full directory lists every airport:{' '}
            <a href="/airports" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
              search all airports
            </a>
            .
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-5 rounded-[0.3rem] bg-forest-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
          >
            Clear filters
          </button>
        </div>
      ) : (
        groups.map((g) => (
          <section
            key={g.region}
            id={regionId(g.region)}
            className="scroll-mt-24 pt-8"
            aria-labelledby={`${regionId(g.region)}-heading`}
            data-testid={regionId(g.region)}
          >
            <header className="flex items-baseline justify-between gap-4 border-b-2 border-forest-950 pb-2">
              <h3 id={`${regionId(g.region)}-heading`} className="text-2xl font-bold leading-none">
                {g.region}
              </h3>
              <span className="text-sm text-forest-900/55">
                {g.airports.length} airport{g.airports.length === 1 ? '' : 's'}
              </span>
            </header>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

function AirportCard({ airport: a }: { airport: DirectoryAirport }) {
  const routes = a.routes ?? 0;
  return (
    <a
      href={`/airports/${a.slug}`}
      className="group flex h-full min-w-0 flex-col rounded-[0.3rem] border border-forest-900/10 bg-white p-4 transition hover:border-primary-emphasis/50 hover:shadow-[0_6px_16px_-6px_rgba(15,39,102,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
      data-testid={`top-airport-card-${a.iata}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-snug text-forest-950 group-hover:text-primary-emphasis">
            {a.city || a.name}
          </p>
          <p className="truncate text-sm text-forest-900/60">{a.country}</p>
        </div>
        <span
          className="flex-none rounded-[0.3rem] bg-forest-950 px-2 py-1 font-mono text-sm font-bold tracking-wider text-white"
          title="IATA code"
        >
          <span className="sr-only">IATA code </span>
          {a.iata}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-forest-900/75">{a.name}</p>
      <div className="mt-auto pt-3">
        <dl className="grid grid-cols-2 gap-2 border-t border-forest-900/10 pt-3 text-sm">
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-forest-900/50">Route records</dt>
            <dd className="mt-0.5 font-bold text-forest-950">{routes}</dd>
          </div>
          {a.icao && (
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-forest-900/50">ICAO</dt>
              <dd className="mt-0.5 font-mono font-bold text-forest-950">{a.icao}</dd>
            </div>
          )}
        </dl>
      </div>
    </a>
  );
}
