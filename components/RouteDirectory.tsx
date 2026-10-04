'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StrapiRoute, AirlineRegion } from '@/lib/strapi';

const REGION_ORDER: AirlineRegion[] = ['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'];
const POPULAR_LIMIT = 20;
const POPULAR_SLIDE_MS = 2200;
const PER_REGION_LIMIT = 12;

export default function RouteDirectory({ routes }: { routes: StrapiRoute[] }) {
  const [query, setQuery] = useState('');
  const [activeRegion, setActiveRegion] = useState<AirlineRegion | null>(null);
  const [expandedRegions, setExpandedRegions] = useState<Set<AirlineRegion>>(new Set());

  const toggleRegion = (r: AirlineRegion) =>
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r); else next.add(r);
      return next;
    });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return routes.filter((r) => {
      if (!r.origin || !r.destination) return false;
      if (activeRegion && r.origin.region !== activeRegion) return false;
      if (!q) return true;
      const hay = [
        r.origin.iata,
        r.origin.city,
        r.origin.country,
        r.origin.name,
        r.destination.iata,
        r.destination.city,
        r.destination.country,
        r.destination.name,
        r.slug,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [routes, query, activeRegion]);

  const byRegion = useMemo(() => {
    const map = new Map<AirlineRegion, StrapiRoute[]>();
    for (const r of filtered) {
      const region = (r.origin?.region || 'Asia') as AirlineRegion;
      if (!map.has(region)) map.set(region, []);
      map.get(region)!.push(r);
    }
    return map;
  }, [filtered]);

  const originCount = useMemo(
    () => new Set(routes.map((r) => r.origin?.iata).filter(Boolean)).size,
    [routes],
  );
  const destinationCount = useMemo(
    () => new Set(routes.map((r) => r.destination?.iata).filter(Boolean)).size,
    [routes],
  );

  const orderedRegions = REGION_ORDER.filter((r) => byRegion.has(r));

  return (
    <div className="mt-10">
      {/* Summary cards — matches /countries layout: content left, icon right */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Routes"
          value={routes.length.toLocaleString()}
          blurb="Every city-pair in the index — the bones of how the world actually flies, scheduled and operating."
          icon={<RouteIcon />}
        />
        <SummaryCard
          label="Origins"
          value={originCount.toLocaleString()}
          blurb="Unique departure airports across the network — major hubs and second-tier city fields alike."
          icon={<DepartureIcon />}
        />
        <SummaryCard
          label="Destinations"
          value={destinationCount.toLocaleString()}
          blurb="Unique arrival airports the routes feed into — global gateways, holiday islands, regional capitals."
          icon={<ArrivalIcon />}
        />
      </div>

      {/* Search */}
      <div className="mt-8">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by city, IATA (e.g. LHR), country, or route…"
          className="w-full rounded-[0.3rem] border border-forest-900/15 bg-paper px-4 py-3 font-sans text-base text-ink placeholder:text-forest-900/40 focus:border-terracotta-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20"
          data-testid="route-search"
        />
      </div>

      {/* Region filter (by origin region) */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-forest-900/50">Departing from:</span>
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

      {/* Popular flight routes (auto-sliding strip) */}
      <PopularRoutesStrip routes={routes} />

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
            <p className="mt-10 text-center text-forest-900/60" data-testid="routes-empty">
              No routes match that search. Try clearing a filter.
            </p>
          ) : (
            orderedRegions.map((r) => {
              const regionList = byRegion.get(r)!;
              const isExpanded = expandedRegions.has(r);
              const displayed = isExpanded ? regionList : regionList.slice(0, PER_REGION_LIMIT);
              const overflow = regionList.length - PER_REGION_LIMIT;
              return (
                <section
                  key={r}
                  id={`region-${r.replace(/\s+/g, '-').toLowerCase()}`}
                  className="mb-16 scroll-mt-24"
                >
                  <header className="flex items-baseline justify-between border-b border-forest-900/10 pb-3">
                    <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">{r}</h2>
                    <span className="text-sm font-light text-forest-900/50">
                      {regionList.length} route{regionList.length === 1 ? '' : 's'}
                      {overflow > 0 && !isExpanded && (
                        <span className="ml-2 text-forest-900/40">· showing {PER_REGION_LIMIT}</span>
                      )}
                    </span>
                  </header>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {displayed.map((rt) => <RouteCard key={rt.id} route={rt} />)}
                  </div>
                  {overflow > 0 && (
                    <div className="mt-6 flex justify-center">
                      <button
                        type="button"
                        onClick={() => toggleRegion(r)}
                        aria-expanded={isExpanded}
                        className="inline-flex items-center gap-2 rounded-full border border-forest-900/20 px-5 py-2 font-urbanist text-sm font-bold text-forest-900 transition hover:border-forest-900 hover:bg-forest-900 hover:text-sand-100"
                        data-testid={`region-toggle-${r.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        {isExpanded
                          ? `Show less`
                          : `View all ${regionList.length} routes in ${r}`}
                        <span aria-hidden>{isExpanded ? '↑' : '→'}</span>
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
      data-testid={`routes-summary-${label.toLowerCase()}`}
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

function RouteIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="38" r="3" />
      <circle cx="38" cy="10" r="3" />
      <path d="M12 36 C 18 28, 22 22, 28 18 C 32 15, 35 13, 36 12" />
      <path d="M14 34 L 18 30" />
      <path d="M22 26 L 26 22" />
    </svg>
  );
}

function DepartureIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 32 L 24 12 L 28 14 L 22 26 L 38 28 L 42 30 L 24 34 L 18 44 L 14 42 L 18 30 L 4 32 Z" />
      <line x1="6" y1="46" x2="42" y2="46" />
    </svg>
  );
}

function ArrivalIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M44 14 L 24 36 L 20 34 L 24 22 L 10 18 L 6 16 L 22 14 L 28 4 L 32 6 L 28 16 L 44 14 Z" />
      <line x1="6" y1="46" x2="42" y2="46" />
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

function RouteCard({ route }: { route: StrapiRoute }) {
  const o = route.origin!;
  const d = route.destination!;
  return (
    <Link
      href={`/flight-routes/${route.slug}`}
      className="group flex flex-col gap-2 rounded-[0.3rem] border border-forest-900/10 bg-[#f7f8fa] px-4 py-3 transition hover:-translate-y-0.5 hover:border-forest-900/30"
      data-testid={`route-card-${route.slug}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex-none rounded-[0.3rem] bg-forest-900 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-sand-100">
          {o.iata}
        </span>
        <span className="text-forest-900/40">→</span>
        <span className="flex-none rounded-[0.3rem] bg-forest-700 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-sand-100">
          {d.iata}
        </span>
      </div>
      <div className="min-w-0">
        <div className="truncate font-urbanist text-sm font-bold text-forest-900 group-hover:text-forest-700">
          {o.city || o.name} → {d.city || d.name}
        </div>
        <div className="mt-1 truncate text-xs text-forest-900/60">
          {o.country && d.country
            ? `${o.country} · ${d.country}`
            : (o.country || d.country || '')}
          {route.carriers && route.carriers.length > 0 && (
            <span className="ml-2 text-forest-900/40">
              · {route.carriers.length} carrier{route.carriers.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function PopularRoutesStrip({ routes }: { routes: StrapiRoute[] }) {
  // Sort by Strapi's `popularity` field (higher = more popular). Fall back
  // to the input order for routes without a popularity value. Drop routes
  // missing either endpoint.
  const popular = useMemo(() => {
    return routes
      .filter((r) => r.origin?.iata && r.destination?.iata)
      .slice()
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, POPULAR_LIMIT);
  }, [routes]);

  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  const step = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const firstItem = track.firstElementChild as HTMLElement | null;
    if (!firstItem) return;
    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
    const stride = firstItem.offsetWidth + gap;
    const maxScroll = track.scrollWidth - track.clientWidth;
    let next = track.scrollLeft + stride;
    if (next >= maxScroll - 2) next = 0;
    track.scrollTo({ left: next, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (paused || popular.length <= 1) return;
    const id = window.setInterval(step, POPULAR_SLIDE_MS);
    return () => window.clearInterval(id);
  }, [paused, popular.length, step]);

  if (popular.length === 0) return null;

  return (
    <section className="mt-12" data-testid="popular-routes">
      <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">Which popular flight routes can you explore?</h2>
      <div
        ref={trackRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className="mt-5 flex snap-x snap-mandatory gap-[10px] overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {popular.map((r) => (
          <PopularRouteCard key={r.id} route={r} />
        ))}
      </div>
    </section>
  );
}

function PopularRouteCard({ route }: { route: StrapiRoute }) {
  const o = route.origin!;
  const d = route.destination!;
  return (
    <Link
      href={`/flight-routes/${route.slug}`}
      className="snap-start group flex h-[78px] w-[240px] shrink-0 flex-col justify-center gap-1.5 rounded-[4px] border border-forest-900/10 bg-[#f7f8fa] px-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:border-forest-900/25 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
      data-testid={`popular-route-${route.slug}`}
    >
      <div className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-wider">
        <span className="flex-none rounded-[0.3rem] bg-forest-900 px-2 py-0.5 text-sand-100">{o.iata}</span>
        <span className="text-forest-900/40">→</span>
        <span className="flex-none rounded-[0.3rem] bg-forest-700 px-2 py-0.5 text-sand-100">{d.iata}</span>
      </div>
      <p className="truncate font-urbanist text-sm font-bold leading-tight text-forest-950 group-hover:text-primary-emphasis">
        {o.city || o.name} → {d.city || d.name}
      </p>
    </Link>
  );
}
