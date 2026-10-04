'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { AirlineRegion } from '@/lib/strapi';
import { spelledCount, capitalise } from '@/lib/format';

const REGION_ORDER: AirlineRegion[] = ['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'];
const PER_REGION_LIMIT = 12;

// Short intros shown above each region's country grid. Kept factual and
// concrete — geography, aviation context, what makes the region distinct —
// without travel-brochure language.
//
// Any count a blurb asserts is INTERPOLATED from the rows actually rendered
// below it — never hardcoded. The dataset counts countries *and territories*
// with scheduled service, which is why interpolation beats quoting sovereign-
// state totals ("fifty-four") that contradict the header count beside it.
const REGION_INTROS: Record<AirlineRegion, (count: number) => string> = {
  Africa: (n) =>
    `${cap(spelledCount(n))} countries and territories from the Sahara to the Cape, with some of the world's fastest-growing aviation networks linking ancient civilisations, savannah wildlife corridors, and a young, fast-urbanising population.`,
  Asia: (n) =>
    `From Tokyo to Istanbul, Asia spans ${n} countries and territories and roughly 60% of humanity — megacity hubs, monsoon coasts, Himalayan passes, and Pacific archipelagos all stitched together by the world's densest long-haul corridors.`,
  Europe: (n) =>
    `${cap(spelledCount(n))} countries and territories packed into a small landmass where the Schengen zone lets travellers cross between cultures in a single afternoon — Atlantic surf to Aegean islands, Lapland fjords to Lisbon.`,
  'North America': (n) =>
    `${cap(spelledCount(n))} countries and territories from Arctic tundra through Central America to the Caribbean — desert canyons, tropical beaches, and the busy air corridors that connect them, including some of the world's highest-traffic city pairs.`,
  Oceania: () =>
    'Australia, New Zealand and thousands of Pacific islands. Long-haul flights are the norm; the region\'s gateways open onto the Great Barrier Reef, Māori marae, and remote atolls few travellers ever reach.',
  'South America': (n) =>
    `${cap(spelledCount(n))} countries and territories spanning Caribbean tropics, Andean altiplano, Amazonian rainforest and Patagonian ice. Most intercontinental journeys route through São Paulo, Bogotá, or Lima before fanning out across the continent.`,
};

const cap = capitalise;

export type CountryRow = {
  code: string;
  name: string;
  region: AirlineRegion | null;
  airportCount: number;
  cityCount: number;
  /** Canonical link target (destination page when one exists) — computed
   *  server-side via countryHref(); falls back to /countries/<code>. */
  href?: string;
};

function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return '🏳️';
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default function CountriesDirectory({
  countries,
  stats,
}: {
  countries: CountryRow[];
  /** Canonical dataset counts from lib/counts.ts getSiteCounts(), passed by
   *  the server page so stat blocks agree with every other page. Falls back
   *  to deriving from the rows when absent. */
  stats?: { airports: number; regions: number };
}) {
  const [query, setQuery] = useState('');
  const [activeRegion, setActiveRegion] = useState<AirlineRegion | null>(null);
  const [expandedRegions, setExpandedRegions] = useState<Set<AirlineRegion>>(new Set());

  const toggleRegionExpanded = (r: AirlineRegion) =>
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r); else next.add(r);
      return next;
    });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return countries.filter((c) => {
      if (activeRegion && c.region !== activeRegion) return false;
      if (!q) return true;
      return (c.name + ' ' + c.code).toLowerCase().includes(q);
    });
  }, [countries, query, activeRegion]);

  const byRegion = useMemo(() => {
    const map = new Map<AirlineRegion, CountryRow[]>();
    for (const c of filtered) {
      const r = (c.region || 'Asia') as AirlineRegion;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(c);
    }
    return map;
  }, [filtered]);

  const totalAirports = stats?.airports ?? countries.reduce((sum, c) => sum + c.airportCount, 0);
  const regionCount = stats?.regions ?? new Set(countries.map((c) => c.region).filter(Boolean)).size;
  // Unfiltered per-region totals — region intros assert dataset facts, so
  // they must not shrink when a search filter narrows the visible list.
  const regionTotals = useMemo(() => {
    const m = new Map<AirlineRegion, number>();
    for (const c of countries) if (c.region) m.set(c.region, (m.get(c.region) ?? 0) + 1);
    return m;
  }, [countries]);

  const orderedRegions = REGION_ORDER.filter((r) => byRegion.has(r));

  return (
    <div className="mt-10">
      {/* Summary cards — content left, icon right */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Countries"
          value={countries.length.toLocaleString()}
          blurb="Every nation with scheduled commercial service, indexed and searchable."
          icon={<GlobeIcon />}
        />
        <SummaryCard
          label="Airports"
          value={totalAirports.toLocaleString()}
          blurb="From global hubs to single-runway regional fields, all linked to their country."
          icon={<RunwayIcon />}
        />
        <SummaryCard
          label="Regions"
          value={regionCount.toString()}
          blurb={`${cap(spelledCount(regionCount))} continental groupings, each spanning dozens of countries and time zones.`}
          icon={<CompassIcon />}
        />
      </div>

      {/* Search */}
      <div className="mt-8">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by country name or ISO code (e.g. AU, Japan)…"
          className="w-full rounded-[0.3rem] border border-forest-900/15 bg-paper px-4 py-3 font-sans text-base text-ink placeholder:text-forest-900/40 focus:border-terracotta-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20"
          data-testid="country-search"
        />
      </div>

      {/* Region filter */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-forest-900/50">Region:</span>
        <FilterChip
          label="All"
          active={activeRegion === null}
          onClick={() => setActiveRegion(null)}
        />
        {REGION_ORDER.map((r) => (
          <FilterChip
            key={r}
            label={r}
            active={activeRegion === r}
            onClick={() => setActiveRegion(activeRegion === r ? null : r)}
          />
        ))}
      </div>

      {/* Results */}
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
          {filtered.length === 0 ? (
            <p className="mt-10 text-center text-forest-900/60" data-testid="countries-empty">
              No countries match that search. Try clearing a filter.
            </p>
          ) : (
            orderedRegions.map((r) => {
              const regionList = byRegion.get(r)!;
              const isExpanded = expandedRegions.has(r);
              const displayed = isExpanded ? regionList : regionList.slice(0, PER_REGION_LIMIT);
              const overflow = regionList.length - displayed.length;
              const hasMore = regionList.length > PER_REGION_LIMIT;
              return (
                <section
                  key={r}
                  id={`region-${r.replace(/\s+/g, '-').toLowerCase()}`}
                  className="mb-16 scroll-mt-24"
                >
                  <header className="flex items-baseline justify-between border-b border-forest-900/10 pb-3">
                    <h2 className="editorial-h !text-[1.5rem] !font-bold text-forest-900">{r}</h2>
                    <span className="text-sm font-light text-forest-900/50">
                      {regionList.length} countr{regionList.length === 1 ? 'y' : 'ies'}
                      {overflow > 0 && !isExpanded && (
                        <span className="ml-2 text-forest-900/40">· showing {PER_REGION_LIMIT}</span>
                      )}
                    </span>
                  </header>
                  {REGION_INTROS[r] && (
                    <p className="mt-4 w-full text-sm text-forest-900/70" data-testid={`region-intro-${r.replace(/\s+/g, '-').toLowerCase()}`}>
                      {REGION_INTROS[r](regionTotals.get(r) ?? regionList.length)}
                    </p>
                  )}
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {displayed.map((c) => <CountryCard key={c.code} country={c} />)}
                  </div>
                  {hasMore && (
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => toggleRegionExpanded(r)}
                        className="text-sm font-medium text-forest-700 hover:underline"
                        data-testid={`countries-region-toggle-${r.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        {isExpanded
                          ? `Show fewer ${r} countries ↑`
                          : `View all ${r} (${regionList.length}) →`}
                      </button>
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  blurb,
  icon,
}: {
  label: string;
  value: string;
  blurb: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="flex items-start justify-between gap-4 rounded-[0.3rem] border border-forest-900/10 bg-forest-900/[0.02] p-5"
      data-testid={`countries-summary-${label.toLowerCase()}`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-widest text-forest-900/60">{label}</div>
        <div className="mt-2 font-urbanist text-3xl font-bold leading-none text-forest-900">{value}</div>
        <p className="mt-3 text-sm leading-snug text-forest-900/65">{blurb}</p>
      </div>
      <div
        aria-hidden
        className="flex h-12 w-12 flex-none items-center justify-center text-forest-900/55"
      >
        {icon}
      </div>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="18" />
      <ellipse cx="24" cy="24" rx="9" ry="18" />
      <line x1="6" y1="24" x2="42" y2="24" />
      <path d="M8 14 C 16 18, 32 18, 40 14" />
      <path d="M8 34 C 16 30, 32 30, 40 34" />
    </svg>
  );
}

function RunwayIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 26 L 24 6 L 28 8 L 22 22 L 38 24 L 42 26 L 24 30 L 18 42 L 14 40 L 18 26 L 6 26 Z" />
      <line x1="14" y1="44" x2="34" y2="44" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="18" />
      <polygon points="24,12 28,24 24,36 20,24" fill="currentColor" stroke="none" opacity="0.85" />
      <circle cx="24" cy="24" r="1.5" fill="currentColor" />
    </svg>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider transition ' +
        (active
          ? 'border-forest-900 bg-forest-900 text-sand-100'
          : 'border-forest-900/20 text-forest-900/80 hover:border-forest-900/40 hover:bg-forest-900/5')
      }
    >
      {label}
    </button>
  );
}

function CountryCard({ country }: { country: CountryRow }) {
  return (
    <Link
      href={country.href ?? `/countries/${country.code.toLowerCase()}`}
      className="group flex items-center gap-3 rounded-[0.3rem] border border-forest-900/10 bg-[#f7f8fa] px-4 py-3 transition hover:-translate-y-0.5 hover:border-forest-900/30"
      data-testid={`country-card-${country.code}`}
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center text-2xl" aria-hidden>
        {flagEmoji(country.code)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate font-urbanist text-base font-bold text-forest-900 group-hover:text-forest-700">
            {country.name}
          </div>
          <span className="flex-none rounded-[0.3rem] bg-forest-900 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-sand-100">
            {country.code}
          </span>
        </div>
        <div className="mt-1 truncate text-xs text-forest-900/60">
          {country.airportCount} airport{country.airportCount === 1 ? '' : 's'}
          {country.cityCount > 0 && <span className="ml-2 text-forest-900/40">· {country.cityCount} cit{country.cityCount === 1 ? 'y' : 'ies'}</span>}
        </div>
      </div>
    </Link>
  );
}
