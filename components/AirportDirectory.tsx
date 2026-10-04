'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { mediaUrl, type StrapiAirport, type AirlineRegion } from '@/lib/strapi';
import { HUB_AIRPORT_SET } from '@/lib/hub-airports';
import { airportPath } from '@/lib/airport-slugs';

const REGION_ORDER: AirlineRegion[] = ['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'];
const TOP_HUBS_PREVIEW = 12;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const PER_REGION_LIMIT = 12;

const REGION_INTROS: Record<AirlineRegion, string> = {
  Africa:
    'African airport traffic concentrates around large regional gateways such as Addis Ababa, Johannesburg, Cairo, Casablanca and Nairobi. Many routes still connect through a handful of hubs, so checking terminal, transit and visa rules matters on multi-country itineraries.',
  Asia:
    'Asia has some of the world\'s busiest airport systems, from Gulf long-haul hubs to dense domestic networks in China, India, Japan and Southeast Asia. Airport choice can change the trip sharply because several cities split traffic across two or more major fields.',
  Europe:
    'European airports sit inside a mature short-haul network with strong rail competition, low-cost secondary airports and large alliance hubs. City airports can differ widely on transfer time, public transport, security process and whether a cheaper flight lands far from the centre.',
  'North America':
    'North American airports are shaped by hub-and-spoke networks, large domestic terminals and heavy road access demand. For travellers, the useful questions are often terminal location, transit time between concourses, rental-car access and whether an alternate airport better fits the city.',
  Oceania:
    'Oceania airport planning is defined by distance: major gateways handle long-haul international links, while regional airports keep domestic and island routes moving. Weather, curfews and terminal separation can have a larger effect than the airport size alone suggests.',
  'South America':
    'South American air travel clusters around capital-city airports and a few major cross-border hubs such as Sao Paulo, Santiago, Lima, Bogota and Buenos Aires. Some metro areas use separate domestic and international airports, so the city name alone is not enough when planning connections.',
};

function flagEmoji(code?: string): string {
  if (!code || code.length !== 2) return '✈️';
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default function AirportDirectory({ airports }: { airports: StrapiAirport[] }) {
  const searchParams = useSearchParams();
  const initialCountry = searchParams.get('country')?.trim() ?? '';
  const [query, setQuery] = useState(initialCountry);
  const [activeRegion, setActiveRegion] = useState<AirlineRegion | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [onlyHubs, setOnlyHubs] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState<Set<AirlineRegion>>(new Set());

  const toggleRegion = (r: AirlineRegion) =>
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return airports.filter((a) => {
      if (activeRegion && a.region !== activeRegion) return false;
      if (onlyHubs && (!a.iata || !HUB_AIRPORT_SET.has(a.iata.toUpperCase()))) return false;
      if (activeLetter && firstLetterBucket(a.city || a.name) !== activeLetter) return false;
      if (!q) return true;
      const hay = [a.name, a.iata, a.icao, a.city, a.country]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [airports, query, activeRegion, activeLetter, onlyHubs]);

  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    for (const a of airports) set.add(firstLetterBucket(a.city || a.name));
    return set;
  }, [airports]);

  const byRegion = useMemo(() => {
    const map = new Map<AirlineRegion, StrapiAirport[]>();
    for (const a of filtered) {
      const r = (a.region || 'Asia') as AirlineRegion;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(a);
    }
    return map;
  }, [filtered]);

  const countryCount = useMemo(
    () => new Set(airports.map((a) => a.country).filter(Boolean)).size,
    [airports],
  );
  const regionCount = useMemo(
    () => new Set(airports.map((a) => a.region).filter(Boolean)).size,
    [airports],
  );

  const orderedRegions = REGION_ORDER.filter((r) => byRegion.has(r));

  const hubs = useMemo(
    () => airports.filter((a) => a.iata && HUB_AIRPORT_SET.has(a.iata.toUpperCase())),
    [airports],
  );
  const hubsPreview = useMemo(() => hubs.slice(0, TOP_HUBS_PREVIEW), [hubs]);

  return (
    <div className="mt-12">
      <div className="grid gap-5 sm:grid-cols-3">
        <SummaryCard
          label="Airports Indexed"
          value={airports.length.toLocaleString()}
          blurb="Major hubs, alternate city gateways, island airports and regional fields in one searchable directory."
          icon={<RunwayIcon />}
        />
        <SummaryCard
          label="Countries Covered"
          value={countryCount.toLocaleString()}
          blurb="Airport markets grouped by country, city and region so travellers can compare nearby gateways."
          icon={<GlobeIcon />}
        />
        <SummaryCard
          label="Global Regions"
          value={regionCount.toString()}
          blurb="Six continental groupings with different hub patterns, transfer styles and access trade-offs."
          icon={<CompassIcon />}
        />
      </div>

      {hubs.length > 0 && (
        <section className="mt-12" data-testid="airport-hubs-callout">
          <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-forest-900/50">Featured hub guides</p>
              <h2 className="editorial-h mt-2 text-2xl font-bold text-forest-900">Which top international airports can you explore?</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-forest-900/65">
                Start with high-traffic airports where terminal layout, ground transport and connection planning can make
                the biggest difference to the trip.
              </p>
            </div>
            <Link
              href="/airports/hubs"
              className="hidden text-sm font-medium text-forest-700 hover:underline sm:inline"
            >
              View all {hubs.length} hubs →
            </Link>
          </header>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {hubsPreview.map((a) => (
              <li key={a.id}>
                <HubChip airport={a} allAirports={airports} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 rounded-2xl border border-forest-900/10 bg-forest-900/[0.02] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-forest-900/40">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by airport name, IATA code (e.g. LHR), city, or country..."
              className="w-full rounded-xl border border-forest-900/15 bg-white py-3 pl-11 pr-10 font-sans text-base text-ink shadow-xs placeholder:text-forest-900/40 focus:border-forest-900 focus:outline-none focus:ring-2 focus:ring-forest-800/20"
              data-testid="airport-search"
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
          </div>

          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-forest-900/70">
            <span className="rounded-lg border border-forest-900/10 bg-white px-3 py-2 shadow-2xs">
              Showing <strong className="text-forest-900">{filtered.length}</strong> of {airports.length} airports
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-forest-900/10 pt-4">
          <span className="mr-1 text-xs font-bold uppercase tracking-widest text-forest-900/50">Filter:</span>
          <FilterChip label="Top hubs only" active={onlyHubs} onClick={() => setOnlyHubs(!onlyHubs)} />
          <FilterChip label="All regions" active={activeRegion === null} onClick={() => setActiveRegion(null)} />
          {REGION_ORDER.map((r) => (
            <FilterChip
              key={r}
              label={r}
              active={activeRegion === r}
              onClick={() => setActiveRegion(activeRegion === r ? null : r)}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-forest-900/10 pt-3">
          <span className="mr-2 text-xs font-bold uppercase tracking-widest text-forest-900/50">Alphabet:</span>
          <LetterChip label="All" active={activeLetter === null} onClick={() => setActiveLetter(null)} />
          {LETTERS.map((L) => (
            <LetterChip
              key={L}
              label={L}
              active={activeLetter === L}
              disabled={!availableLetters.has(L)}
              onClick={() => setActiveLetter(activeLetter === L ? null : L)}
            />
          ))}
          {availableLetters.has('#') && (
            <LetterChip label="#" active={activeLetter === '#'} onClick={() => setActiveLetter(activeLetter === '#' ? null : '#')} />
          )}
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
          {filtered.length === 0 ? (
            <p className="mt-10 text-center text-forest-900/60" data-testid="airports-empty">
              No airports match that search. Try clearing a filter.
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
                  data-testid={`airport-region-${r.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <header className="flex items-baseline justify-between border-b border-forest-900/10 pb-3">
                    <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">{r}</h2>
                    <span className="text-sm font-light text-forest-900/50">
                      {regionList.length} airport{regionList.length === 1 ? '' : 's'}
                      {overflow > 0 && !isExpanded && (
                        <span className="ml-2 text-forest-900/40">· showing {PER_REGION_LIMIT}</span>
                      )}
                    </span>
                  </header>
                  {REGION_INTROS[r] && (
                    <p className="mt-4 w-full text-sm leading-relaxed text-forest-900/70" data-testid={`airport-region-intro-${r.replace(/\s+/g, '-').toLowerCase()}`}>
                      {REGION_INTROS[r]}
                    </p>
                  )}
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {displayed.map((a) => <AirportCard key={a.id} airport={a} />)}
                  </div>
                  {overflow > 0 && (
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => toggleRegion(r)}
                        aria-expanded={isExpanded}
                        className="text-sm font-medium text-forest-700 underline hover:no-underline"
                        data-testid={`airport-region-toggle-${r.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        {isExpanded ? 'Show less ↑' : `View all ${regionList.length} airports in ${r} →`}
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

function firstLetterBucket(name: string): string {
  const first = (name ?? '').trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
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
      data-testid={`airports-summary-${label.toLowerCase()}`}
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

function RunwayIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 26 L 24 6 L 28 8 L 22 22 L 38 24 L 42 26 L 24 30 L 18 42 L 14 40 L 18 26 L 6 26 Z" />
      <line x1="14" y1="44" x2="34" y2="44" />
    </svg>
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

function LetterChip({
  label,
  active,
  disabled = false,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={
        'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-[0.3rem] border px-2 font-mono text-xs font-bold tracking-wider transition ' +
        (active
          ? 'border-forest-900 bg-forest-900 text-sand-100'
          : disabled
            ? 'cursor-not-allowed border-forest-900/10 text-forest-900/20'
            : 'border-forest-900/20 text-forest-900/80 hover:border-forest-900/40 hover:bg-forest-900/5')
      }
      data-testid={`airport-letter-${label}`}
    >
      {label}
    </button>
  );
}

function AirportCard({ airport }: { airport: StrapiAirport }) {
  const img = mediaUrl(airport.heroImage ?? null);
  const isHub = airport.iata ? HUB_AIRPORT_SET.has(airport.iata.toUpperCase()) : false;
  return (
    <Link
      href={airportPath(airport)}
      className="group relative flex min-h-[142px] overflow-hidden rounded-[0.3rem] border border-forest-900/10 bg-[#f7f8fa] transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm"
      data-testid={`airport-card-${airport.iata}`}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={airport.name}
          loading="lazy"
          decoding="async"
          className="h-auto w-24 shrink-0 object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex w-24 shrink-0 items-center justify-center bg-forest-900 font-mono text-sm font-bold text-sand-100">
          {airport.iata}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate font-urbanist text-base font-bold text-forest-900 group-hover:text-forest-700">
              {airport.city || airport.name}
            </div>
            {airport.iata && (
              <span className="flex-none rounded-[0.3rem] bg-forest-900 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-sand-100">
                {airport.iata}
              </span>
            )}
          </div>
          <div className="mt-1 line-clamp-2 text-xs leading-snug text-forest-900/60">{airport.name}</div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-forest-900/60">
          <span aria-hidden>{flagEmoji(airport.countryCode)}</span>
          <span className="truncate">{airport.country ?? 'Airport guide'}</span>
          {isHub && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Hub guide
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function HubChip({ airport, allAirports }: { airport: StrapiAirport; allAirports?: StrapiAirport[] }) {
  const img = mediaUrl(airport.heroImage ?? null);
  return (
    <Link
      href={airportPath(airport, allAirports)}
      className="group flex h-full overflow-hidden rounded-lg border border-forest-900/10 bg-[#f7f8fa] transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm"
      data-testid={`hub-chip-${airport.iata}`}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={airport.name}
          loading="lazy"
          decoding="async"
          className="h-20 w-24 shrink-0 object-cover transition duration-500 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex h-20 w-24 shrink-0 items-center justify-center bg-forest-900 font-mono text-sm font-bold text-sand-100">
          {airport.iata}
        </div>
      )}
      <div className="flex flex-1 flex-col justify-center p-3">
        <div className="font-urbanist text-sm font-bold leading-tight text-forest-900 transition group-hover:text-forest-700">
          {airport.city || airport.name}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-forest-900/60">
          <span aria-hidden>{flagEmoji(airport.countryCode)}</span>
          <span className="truncate">{airport.country ?? '?'}</span>
        </div>
      </div>
    </Link>
  );
}
