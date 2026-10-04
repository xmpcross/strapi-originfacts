'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { mediaUrl, type StrapiAirport, type AirlineRegion } from '@/lib/strapi';
import { airportPath } from '@/lib/airport-slugs';

const REGION_ORDER: AirlineRegion[] = ['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'];
const FEATURED_RESULTS_LIMIT = 3;

const REGION_NOTES: Record<AirlineRegion, string> = {
  Africa: 'Long-haul gateways and intercontinental transfer points across North, East and Southern Africa.',
  Asia: 'High-volume Asian, Gulf and Southeast Asian hubs with major domestic and international networks.',
  Europe: 'Alliance hubs, capital-city gateways and low-cost transfer markets across the continent.',
  'North America': 'Large hub-and-spoke airports plus major coastal gateways for domestic and international trips.',
  Oceania: 'Australia, New Zealand and Pacific gateways where distance makes airport choice especially important.',
  'South America': 'Capital-city and cross-border hubs connecting domestic networks with long-haul routes.',
};

function flagEmoji(code?: string): string {
  if (!code || code.length !== 2) return '✈️';
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default function HubAirportsDirectory({
  airports,
  allAirports = airports,
}: {
  airports: StrapiAirport[];
  allAirports?: Pick<StrapiAirport, 'iata' | 'city' | 'name'>[];
}) {
  const [query, setQuery] = useState('');
  const [activeRegion, setActiveRegion] = useState<AirlineRegion | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return airports.filter((a) => {
      if (activeRegion && a.region !== activeRegion) return false;
      if (!q) return true;
      const hay = [a.name, a.iata, a.icao, a.city, a.country].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [airports, query, activeRegion]);

  const byRegion = useMemo(() => {
    const map = new Map<AirlineRegion, StrapiAirport[]>();
    for (const a of filtered) {
      const r = (a.region || 'Asia') as AirlineRegion;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(a);
    }
    return map;
  }, [filtered]);

  const regionCounts = useMemo(() => {
    const map = new Map<AirlineRegion, number>();
    for (const a of airports) {
      const r = (a.region || 'Asia') as AirlineRegion;
      map.set(r, (map.get(r) || 0) + 1);
    }
    return map;
  }, [airports]);

  const orderedRegions = REGION_ORDER.filter((r) => byRegion.has(r));
  const selectedLabel = activeRegion || 'All regions';
  const featuredResults = filtered.slice(0, FEATURED_RESULTS_LIMIT);

  return (
    <div className="mt-12">
      <div className="rounded-2xl border border-forest-900/10 bg-forest-900/[0.02] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block flex-1">
            <span className="sr-only">Search hub airports</span>
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-forest-900/40">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by airport, city, country, IATA or ICAO..."
              className="w-full rounded-xl border border-forest-900/15 bg-white py-3 pl-11 pr-10 font-sans text-base text-ink shadow-xs placeholder:text-forest-900/40 focus:border-forest-900 focus:outline-none focus:ring-2 focus:ring-forest-800/20"
              data-testid="hub-search"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-forest-900/40 hover:text-forest-900"
              >
                x
              </button>
            )}
          </label>

          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-forest-900/70">
            <span className="rounded-lg border border-forest-900/10 bg-white px-3 py-2 shadow-2xs">
              Showing <strong className="text-forest-900">{filtered.length}</strong> of {airports.length} hubs
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-forest-900/10 pt-4">
          <span className="mr-1 text-xs font-bold uppercase tracking-widest text-forest-900/50">Region:</span>
          <FilterChip label="All regions" count={airports.length} active={activeRegion === null} onClick={() => setActiveRegion(null)} />
          {REGION_ORDER.map((r) => (
            <FilterChip
              key={r}
              label={r}
              count={regionCounts.get(r) || 0}
              active={activeRegion === r}
              onClick={() => setActiveRegion(activeRegion === r ? null : r)}
            />
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-[180px,1fr]">
        <nav className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            <p className="mb-3 text-xs uppercase tracking-widest text-forest-900/50">Jump to</p>
            {orderedRegions.map((r) => (
              <a
                key={r}
                href={`#region-${r.replace(/\s+/g, '-').toLowerCase()}`}
                className="block rounded-[0.3rem] px-3 py-2 text-sm text-forest-900/80 transition hover:bg-forest-900/5 hover:text-forest-900"
              >
                {r}
                <span className="ml-2 text-xs text-forest-900/40">{byRegion.get(r)?.length ?? 0}</span>
              </a>
            ))}
          </div>
        </nav>

        <div className="min-w-0">
          <section className="overflow-hidden rounded-2xl border border-forest-900/10 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]" aria-labelledby="hub-results-title">
            <div className="grid gap-6 bg-gradient-to-br from-[#f7fbff] via-white to-[#fff9eb] p-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:p-8">
              <div>
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-forest-900/45">
                  {selectedLabel}
                </p>
                <h2 id="hub-results-title" className="mt-2 font-urbanist text-3xl font-bold leading-tight text-forest-950">
                  Hub airport results
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-forest-900/68">
                  Browse the major airport hubs by region, then open the airport guide for route context, airlines,
                  nearby alternatives and planning details. Use the filters above when you already know the city,
                  country, IATA code or continent.
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-2 rounded-[0.3rem] border border-forest-900/10 bg-white/80 p-3 lg:grid-cols-1">
                <ResultMetric label="shown" value={filtered.length.toLocaleString()} />
                <ResultMetric label="regions" value={orderedRegions.length.toString()} />
                <ResultMetric label="countries" value={new Set(filtered.map((a) => a.country).filter(Boolean)).size.toString()} />
              </dl>
            </div>

            {featuredResults.length > 0 && (
              <div className="border-t border-forest-900/10 px-6 py-5 lg:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-forest-900/45">
                      First matches
                    </p>
                    <h3 className="mt-1 font-urbanist text-xl font-bold text-forest-950">Which primary airport gateways should you review?</h3>
                  </div>
                  <span className="rounded-full bg-forest-900/[0.06] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-forest-900/55">
                    {filtered.length} total
                  </span>
                </div>
                <ul className="mt-4 grid gap-4 md:grid-cols-3">
                  {featuredResults.map((a, index) => (
                    <li key={a.id}>
                      <FeaturedHubCard airport={a} allAirports={allAirports} rank={index + 1} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-[0.3rem] border border-dashed border-forest-900/15 bg-white p-12 text-center">
          <p className="font-light text-forest-900/60">No hubs match your filter.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-14">
          {orderedRegions.map((r) => {
            const list = byRegion.get(r)!;
            return (
              <section
                key={r}
                id={`region-${r.replace(/\s+/g, '-').toLowerCase()}`}
                className="rounded-2xl border border-forest-900/10 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-6"
              >
                <header className="flex flex-wrap items-start justify-between gap-4 border-b border-forest-900/10 pb-4">
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-forest-900/42">
                      Regional hub group
                    </p>
                    <h3 className="editorial-h mt-1 text-2xl font-bold text-forest-900">{r}</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-forest-900/62">{REGION_NOTES[r]}</p>
                  </div>
                  <div className="rounded-[0.3rem] bg-forest-900 px-3 py-2 text-right text-sand-100">
                    <div className="font-urbanist text-xl font-bold leading-none">{list.length}</div>
                    <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-sand-100/65">
                      {list.length === 1 ? 'hub' : 'hubs'}
                    </div>
                  </div>
                </header>
                <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {list.map((a) => (
                    <li key={a.id}>
                      <HubCard airport={a} allAirports={allAirports} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.3rem] bg-forest-900/[0.04] p-3">
      <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-forest-900/48">{label}</dt>
      <dd className="mt-1 font-urbanist text-2xl font-bold leading-none text-forest-950">{value}</dd>
    </div>
  );
}

function FeaturedHubCard({
  airport,
  allAirports,
  rank,
}: {
  airport: StrapiAirport;
  allAirports: Pick<StrapiAirport, 'iata' | 'city' | 'name'>[];
  rank: number;
}) {
  const img = mediaUrl(airport.heroImage ?? null);
  return (
    <Link
      href={airportPath(airport, allAirports)}
      className="group relative block min-h-[220px] overflow-hidden rounded-[0.3rem] bg-forest-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
      data-testid={`featured-hub-card-${airport.iata}`}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={airport.name}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-500 group-hover:scale-[1.03]"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/60 to-forest-950/20" />
      <div className="relative flex min-h-[220px] flex-col justify-between p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-white">
            0{rank}
          </span>
          <span className="rounded-full bg-white px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-forest-950">
            {airport.iata}
          </span>
        </div>
        <div>
          <h4 className="font-urbanist text-xl font-bold leading-tight text-white">{airport.city || airport.name}</h4>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/80">{airport.name}</p>
          <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">
            {[airport.country, airport.region].filter(Boolean).join(' / ')}
          </p>
        </div>
      </div>
    </Link>
  );
}

function HubCard({
  airport,
  allAirports,
}: {
  airport: StrapiAirport;
  allAirports: Pick<StrapiAirport, 'iata' | 'city' | 'name'>[];
}) {
  const img = mediaUrl(airport.heroImage ?? null);
  return (
    <Link
      href={airportPath(airport, allAirports)}
      className="group flex h-full flex-col overflow-hidden rounded-[0.3rem] border border-forest-900/10 bg-white transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
      data-testid={`hub-card-${airport.iata}`}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={airport.name}
          loading="lazy"
          decoding="async"
          className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex h-44 w-full items-center justify-center bg-forest-900/10 font-mono text-xl font-bold text-forest-900/40">
          {airport.iata}
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-forest-900/60">
            <span className="font-mono font-bold text-forest-900">{airport.iata}</span>
            {airport.icao && <span className="font-mono opacity-70">{airport.icao}</span>}
          </div>
          <span className="text-base" aria-hidden>{flagEmoji(airport.countryCode)}</span>
        </div>
        <div className="font-urbanist mt-1 text-base font-bold leading-snug text-forest-900 transition group-hover:text-forest-700">
          {airport.name}
        </div>
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between gap-3 border-t border-forest-900/10 pt-3 text-xs text-forest-900/62">
            <span>{airport.city || airport.country}</span>
            <span className="font-mono uppercase tracking-[0.12em]">{airport.region}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium uppercase tracking-wider transition ' +
        (active
          ? 'border-forest-900 bg-forest-900 text-sand-100'
          : 'border-forest-900/20 text-forest-900/80 hover:border-forest-900/40 hover:bg-forest-900/5')
      }
    >
      <span>{label}</span>
      <span className={active ? 'font-mono text-sand-100/60' : 'font-mono text-forest-900/42'}>{count}</span>
    </button>
  );
}
