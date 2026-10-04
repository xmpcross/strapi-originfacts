'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mediaUrl, type StrapiAirline, type AirlineRegion, type AirlineType } from '@/lib/strapi';
import { spelledCount, capitalise } from '@/lib/format';

const REGION_ORDER: AirlineRegion[] = ['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'];
const TYPE_OPTIONS: AirlineType[] = ['Scheduled', 'Low-cost', 'Regional', 'Charter', 'Cargo'];

// Short, factual intros shown above each region's airline list. Three sentences
// each — geography, market shape, notable carriers — kept editorial rather than
// promotional.
const REGION_INTROS: Record<AirlineRegion, string> = {
  Africa:
    'African aviation is dominated by long-established flag carriers — Ethiopian, Kenya Airways, EgyptAir, South African Airways — alongside a rising cohort of low-cost operators like FlySafair and Air Peace. Intra-continental connectivity has historically been routed via Addis Ababa, Johannesburg or Casablanca, though direct mid-haul links are slowly multiplying. Open Skies agreements under SAATM aim to liberalise the network further over the coming years.',
  Asia:
    'Asia hosts both the world\'s densest short-haul corridors and several of its most awarded long-haul carriers — Singapore Airlines, Cathay Pacific, ANA, JAL, EVA Air, Qatar Airways via the Gulf. Low-cost giants AirAsia, IndiGo, VietJet and Lion Air reshaped intra-regional travel over the last two decades. Hub competition between Singapore, Hong Kong, Doha, Dubai and Istanbul keeps long-haul fares unusually competitive.',
  Europe:
    'Europe combines legacy flag carriers (Lufthansa, Air France, British Airways, Iberia, KLM) with the world\'s most aggressive low-cost market — Ryanair and easyJet alone move a combined 300+ million passengers a year. The Schengen zone and EU open-skies rules let any EU-licensed airline fly any intra-EU route, producing dense competition on city pairs. Long-haul routes cluster around Frankfurt, Paris-CDG, Amsterdam-Schiphol, Madrid and London-Heathrow.',
  'North America':
    'North America\'s domestic market is consolidated into the Big Three (American, Delta, United) plus low-cost operators Southwest, JetBlue, Spirit and Frontier; Air Canada and WestJet anchor Canada, with Aeroméxico, Volaris and Viva leading Mexico. Hub-and-spoke routing is the dominant model, and the region has some of the world\'s busiest city pairs (LAX-JFK, ORD-LGA). Caribbean and Central American carriers operate alongside US-based brands rather than competing head-to-head.',
  Oceania:
    'Oceania\'s long distances make aviation essential rather than optional — Qantas, Virgin Australia and Jetstar handle Australian domestic, with Air New Zealand dominating across the Tasman. Regional carriers like Fiji Airways, Air Tahiti Nui and Aircalin connect the Pacific island nations to Australia, New Zealand and Asia. Ultra-long-haul Project Sunrise routes from Sydney to London and New York are reshaping what a non-stop flight can mean.',
  'South America':
    'South American aviation is led by LATAM (formed from LAN Chile and TAM merger), Avianca, Copa, Gol and Azul, with Aerolíneas Argentinas operating the largest domestic Argentine network. Bogotá, Panama City, Lima, São Paulo and Santiago are the main intercontinental gateways. Low-cost carriers JetSMART, Sky Airline and Flybondi expanded rapidly through the late 2010s, though dollarisation pressures and currency volatility shape pricing across the continent.',
};
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const PER_REGION_LIMIT = 9;
const POPULAR_LIMIT = 20;
const POPULAR_SLIDE_MS = 2200;

// Curated list of well-known international carriers, ordered by global
// recognition. Matched against airline.iataCode case-insensitively — entries
// not in the dataset are silently skipped.
const POPULAR_IATA = [
  'QF', 'JQ', 'VA', 'TR', 'AA', 'EK', 'UA', 'SQ', 'BA', 'AF',
  'LH', 'KL', 'CX', 'QR', 'EY', 'TK', 'NH', 'JL', 'AC', 'DL',
  'NZ', 'EI', 'IB', 'AY', 'OS', 'LX',
];

function firstLetterBucket(name: string): string {
  const first = (name ?? '').trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

export default function AirlineDirectory({
  airlines,
  stats,
}: {
  airlines: StrapiAirline[];
  /** Canonical dataset counts (lib/counts.ts) from the server page — keeps
   *  the Regions card at the true region count instead of counting bad data
   *  (e.g. the stray legacy "Asia-Pacific" value made this card say 7). */
  stats?: { regions: number };
}) {
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState<AirlineType | null>(null);
  const [activeRegion, setActiveRegion] = useState<AirlineRegion | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [expandedRegions, setExpandedRegions] = useState<Set<AirlineRegion>>(new Set());

  const toggleRegion = (r: AirlineRegion) =>
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r); else next.add(r);
      return next;
    });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return airlines.filter((a) => {
      if (activeType && a.type !== activeType) return false;
      if (activeRegion && a.region !== activeRegion) return false;
      if (activeLetter && firstLetterBucket(a.name) !== activeLetter) return false;
      if (!q) return true;
      const hay = [a.name, a.iataCode, a.icaoCode, a.country, a.city, a.legalName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [airlines, query, activeType, activeRegion, activeLetter]);

  // Which letters actually have airlines in the (base) dataset — used to grey out unused ones.
  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    for (const a of airlines) set.add(firstLetterBucket(a.name));
    return set;
  }, [airlines]);

  const byRegion = useMemo(() => {
    const map = new Map<AirlineRegion, StrapiAirline[]>();
    for (const a of filtered) {
      const r = (a.region || 'Asia') as AirlineRegion;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(a);
    }
    return map;
  }, [filtered]);

  const countryCount = useMemo(
    () => new Set(airlines.map((a) => a.country).filter(Boolean)).size,
    [airlines],
  );
  const regionCount = stats?.regions ?? new Set(airlines.map((a) => a.region).filter(Boolean)).size;

  const orderedRegions = REGION_ORDER.filter((r) => byRegion.has(r));

  return (
    <div className="mt-10">
      {/* Summary cards — content left, icon right (matches /countries layout) */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Airlines"
          value={airlines.length.toLocaleString()}
          blurb="Every commercial carrier with scheduled, low-cost, regional, charter, or cargo service."
          icon={<PlaneIcon />}
        />
        <SummaryCard
          label="Countries"
          value={countryCount.toLocaleString()}
          blurb="Countries of registration represented across the index — flag carriers to single-route startups."
          icon={<GlobeIcon />}
        />
        <SummaryCard
          label="Regions"
          value={regionCount.toLocaleString()}
          blurb={`${capitalise(spelledCount(regionCount))} continental groupings, each with its own dominant carriers and route geography.`}
          icon={<CompassIcon />}
        />
      </div>

      {/* Search + filters */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr,auto]">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, IATA code (e.g. SQ), country…"
          className="w-full rounded-[0.3rem] border border-forest-900/15 bg-paper px-4 py-3 font-sans text-base text-ink placeholder:text-forest-900/40 focus:border-terracotta-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20"
          data-testid="airline-search"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="All types"
            active={activeType === null}
            onClick={() => setActiveType(null)}
          />
          {TYPE_OPTIONS.map((t) => (
            <FilterChip
              key={t}
              label={t}
              active={activeType === t}
              onClick={() => setActiveType(activeType === t ? null : t)}
            />
          ))}
        </div>
      </div>

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

      {/* A-Z letter filter */}
      <div className="mt-4 flex flex-wrap items-center gap-1">
        <span className="mr-2 text-xs uppercase tracking-widest text-forest-900/50">Letter:</span>
        <LetterChip
          label="All"
          active={activeLetter === null}
          onClick={() => setActiveLetter(null)}
        />
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
          <LetterChip
            label="#"
            active={activeLetter === '#'}
            onClick={() => setActiveLetter(activeLetter === '#' ? null : '#')}
          />
        )}
      </div>

      {/* Results */}
      <div className="mt-10 grid gap-12 lg:grid-cols-[180px,1fr]">
        {/* Sticky region nav (desktop) */}
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
            <p className="mt-10 text-center text-forest-900/60" data-testid="airlines-empty">
              No airlines match that search. Try clearing a filter.
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
                  data-testid={`region-${r.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <header className="flex items-baseline justify-between border-b border-forest-900/10 pb-3">
                    <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">{r}</h2>
                    <span className="text-sm font-light text-forest-900/50">
                      {regionList.length} airline{regionList.length === 1 ? '' : 's'}
                      {overflow > 0 && !isExpanded && (
                        <span className="ml-2 text-forest-900/40">· showing {PER_REGION_LIMIT}</span>
                      )}
                    </span>
                  </header>
                  {REGION_INTROS[r] && (
                    <p className="mt-4 w-full text-sm text-forest-900/70" data-testid={`airline-region-intro-${r.replace(/\s+/g, '-').toLowerCase()}`}>
                      {REGION_INTROS[r]}
                    </p>
                  )}
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {displayed.map((a) => <AirlineCard key={a.id} airline={a} />)}
                  </div>
                  {overflow > 0 && (
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => toggleRegion(r)}
                        aria-expanded={isExpanded}
                        className="text-sm font-medium text-forest-700 underline hover:no-underline"
                        data-testid={`region-toggle-${r.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        {isExpanded
                          ? `Show less ↑`
                          : `View all ${regionList.length} airlines in ${r} →`}
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
      data-testid={`airlines-summary-${label.toLowerCase()}`}
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

function PlaneIcon() {
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
      data-testid={`letter-${label}`}
    >
      {label}
    </button>
  );
}

function AirlineCard({ airline }: { airline: StrapiAirline }) {
  const logo = mediaUrl(airline.logo ?? null);
  return (
    <Link
      href={`/airlines/${airline.slug}`}
      className="group flex items-center gap-8 rounded-[0.3rem] border border-forest-900/10 bg-[#f7f8fa] p-4 transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm"
      data-testid={`airline-card-${airline.slug}`}
    >
      <div className="flex h-[5.25rem] w-[5.25rem] flex-none items-center justify-center overflow-hidden rounded-[0.3rem]">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={airline.name} className="h-full w-full object-contain" />
        ) : (
          <span className="font-urbanist text-sm font-bold text-forest-900/60">
            {(airline.iataCode || airline.name).slice(0, 3).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate font-urbanist text-base font-bold text-forest-900 group-hover:text-forest-700">
            {airline.name}
          </div>
          {airline.iataCode && (
            <span className="flex-none rounded-[0.3rem] bg-forest-900 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-sand-100">
              {airline.iataCode}
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-xs text-forest-900/60">
          {[airline.country, airline.city].filter(Boolean).join(' · ')}
          {airline.type && <span className="ml-2 text-forest-900/40">· {airline.type}</span>}
        </div>
      </div>
    </Link>
  );
}

export function PopularAirlinesStrip({ airlines }: { airlines: StrapiAirline[] }) {
  // Build IATA → airline lookup, then walk POPULAR_IATA in order so the
  // strip mirrors the curated ranking. Drop carriers we don't have data for.
  const popular = useMemo(() => {
    const byIata = new Map<string, StrapiAirline>();
    for (const a of airlines) {
      if (a.iataCode) byIata.set(a.iataCode.toUpperCase(), a);
    }
    const out: StrapiAirline[] = [];
    for (const code of POPULAR_IATA) {
      const a = byIata.get(code);
      if (a) out.push(a);
      if (out.length >= POPULAR_LIMIT) break;
    }
    return out;
  }, [airlines]);

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
    <section className="mt-12" data-testid="popular-airlines">
      <div
        ref={trackRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className="mt-5 flex snap-x snap-mandatory gap-[10px] overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {popular.map((a) => (
          <PopularAirlineCard key={a.id} airline={a} />
        ))}
      </div>
    </section>
  );
}

function PopularAirlineCard({ airline }: { airline: StrapiAirline }) {
  const logo = mediaUrl(airline.logo ?? null);
  return (
    <Link
      href={`/airlines/${airline.slug}`}
      className="snap-start group flex h-[96px] w-[220px] shrink-0 items-center gap-3 rounded-[4px] border-0 bg-white px-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] transition hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]"
      data-testid={`popular-airline-${airline.slug}`}
    >
      <div className="flex h-[4.2rem] w-[4.2rem] flex-none items-center justify-center overflow-hidden rounded-md bg-white">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={airline.name} className="h-full w-full object-contain" />
        ) : (
          <span className="font-urbanist text-xs font-bold text-forest-900/60">
            {(airline.iataCode || airline.name).slice(0, 3).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-urbanist text-sm font-bold leading-tight text-forest-950 group-hover:text-primary-emphasis">
          {airline.name}
        </p>
      </div>
    </Link>
  );
}
