'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { mediaUrl, type AirlineRegion, type AirlineType } from '@/lib/strapi';
import { DIRECTORY_REGIONS, NARROW_LOGO_SLUGS, type DirectoryAirline } from '@/lib/airline-directory';

// Short, factual intros shown above each region's airline list when the
// directory is grouped by region.
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

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];
const OTHER_REGION = 'Other';
type GroupBy = 'az' | 'region';

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function letterOf(name: string): string {
  const first = fold(name.trim()).charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

function slugify(s: string): string {
  return s.replace(/\s+/g, '-').toLowerCase();
}

function letterId(l: string): string {
  return `letter-${l === '#' ? 'num' : l.toLowerCase()}`;
}

type Group = { key: string; id: string; title: string; airlines: DirectoryAirline[] };

/**
 * The searchable airline directory on /airlines. Renders every listed airline
 * on the server (no useSearchParams, so the page never bails out to
 * client-only rendering and crawlers get every /airlines/<slug> link), then
 * filters in place once hydrated.
 */
export default function AirlineDirectory({
  airlines,
  popularSlugs = [],
  ceasedSlugs = [],
}: {
  airlines: DirectoryAirline[];
  /** Airlines shown as quick-access tiles while nothing is searched or filtered. */
  popularSlugs?: string[];
  /** Carriers that have stopped flying, shown with a "Ceased operations" label. */
  ceasedSlugs?: string[];
}) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<AirlineRegion | ''>('');
  const [country, setCountry] = useState('');
  const [type, setType] = useState<AirlineType | ''>('');
  const [groupBy, setGroupBy] = useState<GroupBy>('az');

  const countryOptions = useMemo(
    () =>
      Array.from(new Set(airlines.map((a) => a.country).filter((c): c is string => Boolean(c)))).sort((x, y) =>
        x.localeCompare(y, 'en', { sensitivity: 'base' }),
      ),
    [airlines],
  );

  // Country pages link here as /airlines?country=<name>. Read it after
  // hydration rather than through useSearchParams, which would make the whole
  // directory client-rendered.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('country')?.trim();
    if (!wanted) return;
    const match = countryOptions.find((c) => c.toLowerCase() === wanted.toLowerCase());
    if (match) setCountry(match);
    else setQuery(wanted);
  }, [countryOptions]);

  const ceasedSet = useMemo(() => new Set(ceasedSlugs), [ceasedSlugs]);

  const indexed = useMemo(
    () =>
      airlines
        .map((a) => ({
          airline: a,
          letter: letterOf(a.name),
          hay: fold([a.name, a.iataCode, a.country, a.city].filter(Boolean).join(' ')),
        }))
        .sort((x, y) => x.airline.name.localeCompare(y.airline.name, 'en', { sensitivity: 'base' })),
    [airlines],
  );

  const typeOptions = useMemo(() => {
    const seen = new Set<AirlineType>();
    for (const a of airlines) if (a.type) seen.add(a.type);
    return Array.from(seen).sort();
  }, [airlines]);

  const regionCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of airlines) {
      const r = a.region ?? OTHER_REGION;
      m.set(r, (m.get(r) ?? 0) + 1);
    }
    return m;
  }, [airlines]);

  const popular = useMemo(() => {
    const bySlug = new Map(airlines.map((a) => [a.slug, a]));
    return popularSlugs.map((s) => bySlug.get(s)).filter((a): a is DirectoryAirline => Boolean(a));
  }, [airlines, popularSlugs]);

  const q = fold(query.trim());
  const filtered = useMemo(
    () =>
      indexed.filter(({ airline: a, hay }) => {
        if (region && a.region !== region) return false;
        if (country && a.country !== country) return false;
        if (type && a.type !== type) return false;
        return !q || hay.includes(q);
      }),
    [indexed, region, country, type, q],
  );

  const groups: Group[] = useMemo(() => {
    const map = new Map<string, DirectoryAirline[]>();
    for (const f of filtered) {
      const k = groupBy === 'az' ? f.letter : f.airline.region ?? OTHER_REGION;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(f.airline);
    }
    if (groupBy === 'az') {
      return LETTERS.filter((l) => map.has(l)).map((l) => ({ key: l, id: letterId(l), title: l, airlines: map.get(l)! }));
    }
    return [...DIRECTORY_REGIONS, OTHER_REGION]
      .filter((r) => map.has(r))
      .map((r) => ({ key: r, id: `region-${slugify(r)}`, title: r, airlines: map.get(r)! }));
  }, [filtered, groupBy]);

  const hasFilters = Boolean(q) || Boolean(region) || Boolean(country) || Boolean(type);
  const clearAll = () => {
    setQuery('');
    setRegion('');
    setCountry('');
    setType('');
  };

  const groupKeys = new Set(groups.map((g) => g.key));
  const jumpItems =
    groupBy === 'az'
      ? LETTERS.map((l) => ({ key: l, label: l, href: `#${letterId(l)}` }))
      : [...DIRECTORY_REGIONS, OTHER_REGION]
          .filter((r) => regionCounts.has(r))
          .map((r) => ({ key: r, label: r, href: `#region-${slugify(r)}` }));

  return (
    <section aria-label="Airline directory" data-testid="airline-directory">
      {/* Search + filters */}
      <div className="rounded-[0.3rem] border border-forest-900/10 bg-paper p-3 sm:p-4">
        <div className="relative">
          <label htmlFor="airline-search" className="sr-only">
            Search airlines
          </label>
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-forest-900/45">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            id="airline-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Airline, IATA code, country or city"
            autoComplete="off"
            spellCheck={false}
            className="h-14 w-full rounded-[0.3rem] border border-forest-900/20 bg-white pl-12 pr-12 text-base text-ink shadow-xs placeholder:text-forest-900/45 focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/25 [&::-webkit-search-cancel-button]:hidden"
            data-testid="airline-search"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-forest-900/50 hover:text-forest-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:gap-3">
          <Select label="Region" value={region} onChange={(v) => setRegion(v as AirlineRegion | '')} testId="airline-region-filter">
            <option value="">All regions</option>
            {DIRECTORY_REGIONS.filter((r) => regionCounts.has(r)).map((r) => (
              <option key={r} value={r}>
                {r} ({regionCounts.get(r)})
              </option>
            ))}
          </Select>
          <Select label="Country" value={country} onChange={setCountry} testId="airline-country-filter">
            <option value="">All countries</option>
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select label="Type" value={type} onChange={(v) => setType(v as AirlineType | '')} testId="airline-type-filter">
            <option value="">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <div
            role="radiogroup"
            aria-label="Group by"
            className="col-span-2 inline-flex h-11 items-center rounded-[0.3rem] border border-forest-900/20 bg-white p-0.5 sm:col-span-1"
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
                className={`h-full flex-1 rounded-[0.2rem] px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-emphasis ${
                  groupBy === value ? 'bg-forest-950 text-white' : 'text-forest-900/75 hover:bg-forest-900/5'
                }`}
                data-testid={`airline-group-${value}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-forest-900/70">
          <p aria-live="polite" data-testid="airline-result-count">
            <strong className="font-semibold text-forest-950">{filtered.length.toLocaleString()}</strong> of{' '}
            {airlines.length.toLocaleString()} airlines
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="font-semibold text-primary-emphasis underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Quick access, only while the full list is showing */}
      {!hasFilters && popular.length > 0 && (
        <div className="mt-8" data-testid="airline-popular">
          <h2 className="text-xs font-bold uppercase tracking-widest text-forest-900/55">Popular airlines</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
            {popular.map((a) => (
              <li key={a.slug}>
                <AirlineCard airline={a} hasCeased={ceasedSet.has(a.slug)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sticky jump navigation. top = height of the fixed site header. */}
      <div className="sticky top-[75px] z-30 -mx-4 mt-8 border-y border-forest-900/10 bg-white/95 px-4 backdrop-blur sm:mx-0 sm:rounded-[0.3rem] sm:border sm:px-2">
        <nav aria-label={groupBy === 'az' ? 'Jump to letter' : 'Jump to region'} className="py-1.5">
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
                      data-testid={groupBy === 'az' ? `letter-${item.key}` : `jump-region-${slugify(item.key)}`}
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
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-[0.3rem] border border-dashed border-forest-900/20 px-6 py-12 text-center" data-testid="airlines-empty">
          <p className="text-base font-semibold text-forest-950">
            No airlines match {q ? `“${query.trim()}”` : 'these filters'}.
          </p>
          <p className="mt-1 text-sm text-forest-900/65">Try the airline&rsquo;s IATA code, its country, or fewer filters.</p>
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
            className="scroll-mt-[140px] pt-8"
            aria-labelledby={`${g.id}-heading`}
            data-testid={g.id}
          >
            <header className="flex items-baseline justify-between gap-4 border-b border-forest-900/10 pb-2">
              <h3 id={`${g.id}-heading`} className="text-2xl font-bold leading-none">
                {g.title}
              </h3>
              <span className="text-sm text-forest-900/55">
                {g.airlines.length} airline{g.airlines.length === 1 ? '' : 's'}
              </span>
            </header>
            {groupBy === 'region' && REGION_INTROS[g.key as AirlineRegion] && (
              <p
                className="mt-3 max-w-4xl text-sm leading-relaxed text-forest-900/70"
                data-testid={`airline-region-intro-${slugify(g.key)}`}
              >
                {REGION_INTROS[g.key as AirlineRegion]}
              </p>
            )}
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-6">
              {g.airlines.map((a) => (
                <li key={a.slug}>
                  <AirlineCard airline={a} hasCeased={ceasedSet.has(a.slug)} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-11 w-full rounded-[0.3rem] border bg-white px-3 text-sm font-medium focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/25 ${
          value ? 'border-forest-950 text-forest-950' : 'border-forest-900/20 text-forest-900/80'
        }`}
        data-testid={testId}
      >
        {children}
      </select>
    </label>
  );
}

function AirlineCard({ airline, hasCeased }: { airline: DirectoryAirline; hasCeased: boolean }) {
  const logo = airline.logo ? mediaUrl({ url: airline.logo }) : null;
  const meta = [airline.country, airline.iataCode].filter(Boolean).join(' · ');

  return (
    <Link
      href={`/airlines/${airline.slug}`}
      className="group flex h-full flex-col rounded-[0.3rem] border border-forest-900/10 bg-white p-3 transition hover:border-primary-emphasis/50 hover:shadow-[0_6px_16px_-6px_rgba(15,39,102,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
      data-testid={`airline-card-${airline.slug}`}
    >
      <span className="flex h-16 w-full items-center justify-start">
        {logo ? (
          // Logos are trimmed to the artwork: full width, height follows the aspect ratio.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className={`h-auto max-h-full w-full object-contain ${NARROW_LOGO_SLUGS.has(airline.slug) ? 'max-w-[70%]' : 'max-w-[80%]'}`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-900/5 text-xs font-bold text-forest-900/55"
            aria-hidden
          >
            {(airline.iataCode || airline.name).slice(0, 3).toUpperCase()}
          </span>
        )}
      </span>
      <span className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-forest-950 group-hover:text-primary-emphasis">
        {airline.name}
      </span>
      {meta && <span className="mt-0.5 truncate text-xs text-forest-900/60">{meta}</span>}
      {hasCeased && (
        <span
          className="mt-2 inline-flex w-fit items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-inset ring-amber-600/25"
          data-testid={`airline-ceased-${airline.slug}`}
        >
          Ceased operations
        </span>
      )}
    </Link>
  );
}
