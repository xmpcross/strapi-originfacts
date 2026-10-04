'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { mediaUrl, type StrapiAirport, type StrapiAirline } from '@/lib/strapi';
import { airportPath } from '@/lib/airport-slugs';

const AIRPORTS_PAGE_SIZE = 12;
const AIRLINES_PAGE_SIZE = 12;

const POPULAR_AIRPORT_PRIORITY = new Map(
  [
    'ATL', 'DXB', 'DFW', 'LHR', 'HND', 'DEN', 'IST', 'ORD', 'DEL', 'LAX', 'CAN', 'PVG',
    'CDG', 'AMS', 'FRA', 'SIN', 'ICN', 'BKK', 'DOH', 'MAD', 'JFK', 'SFO', 'MIA', 'SEA',
    'SYD', 'MEL', 'BNE', 'PER', 'ADL', 'OOL', 'CNS', 'CBR', 'DRW', 'HBA', 'TSV', 'AVV',
  ].map((code, index) => [code, index + 1]),
);

const POPULAR_AIRLINE_PRIORITY = new Map(
  [
    'AA', 'DL', 'UA', 'WN', 'EK', 'QR', 'TK', 'SQ', 'CX', 'BA', 'LH', 'AF', 'KL', 'QF',
    'JQ', 'VA', 'ZL', 'QQ', 'FC', 'TL', 'FP',
  ].map((code, index) => [code, index + 1]),
);

const POPULAR_AIRLINE_NAME_PRIORITY = new Map(
  [
    'Qantas',
    'Jetstar',
    'Virgin Australia',
    'Rex Airlines',
    'Alliance Airlines',
    'Airnorth',
    'FlyPelican',
  ].map((name, index) => [name.toLowerCase(), index + 1]),
);

export default function CountryDetailSections({
  countryName,
  airports,
  airlines,
}: {
  countryName: string;
  airports: StrapiAirport[];
  airlines: StrapiAirline[];
}) {
  const [airportQuery, setAirportQuery] = useState('');
  const [airlineQuery, setAirlineQuery] = useState('');

  const filteredAirports = useMemo(() => {
    const q = airportQuery.trim().toLowerCase();
    const matches = q
      ? airports.filter((a) =>
          [a.iata, a.icao, a.name, a.city].some((v) => v && v.toLowerCase().includes(q)),
        )
      : airports;
    return sortAirportsByPopularity(matches);
  }, [airports, airportQuery]);

  const filteredAirlines = useMemo(() => {
    const q = airlineQuery.trim().toLowerCase();
    const matches = q
      ? airlines.filter((al) =>
          [al.name, al.iataCode, al.icaoCode, al.city, al.type, al.legalName].some(
            (v) => v && v.toLowerCase().includes(q),
          ),
        )
      : airlines;
    return sortAirlinesByPopularity(matches);
  }, [airlines, airlineQuery]);

  return (
    <>
      {/* Airports */}
      <section
        className="mx-auto mt-16 max-w-7xl overflow-hidden rounded-[0.3rem] border border-forest-900/10 bg-gradient-to-br from-white via-[#f7fbff] to-[#fff8e6] px-6 py-8 sm:px-8"
        data-testid="country-airports"
      >
        <header className="grid gap-6 border-b border-forest-900/10 pb-6 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-end">
          <div>
            <p className="section-eyebrow">
              <span className="inline-block h-px w-8 bg-primary-emphasis" />
              Airport directory
            </p>
            <h2 className="editorial-h mt-3 text-2xl font-bold text-2xl">
              Which major airports serve {countryName}?
            </h2>
            <p className="mt-3 max-w-4xl text-sm font-light leading-7 text-forest-900/70">
              Compare the airport records linked to {countryName}. Use the list to jump from a city or IATA code to the
              airport page with routes, nearby airports and planning details.
            </p>
          </div>
          <div className="border-l-2 border-primary-emphasis pl-5">
            <div className="font-urbanist text-4xl font-bold leading-none text-forest-900">
              {airportQuery.trim() ? filteredAirports.length : airports.length}
            </div>
            <div className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-forest-900/55">
              {airportQuery.trim() ? `of ${airports.length}` : `airport${airports.length === 1 ? '' : 's'}`}
            </div>
          </div>
        </header>

        {airports.length > 0 && (
          <SearchBox
            value={airportQuery}
            onChange={setAirportQuery}
            placeholder="Filter by IATA, city or name…"
            data-testid="country-airports-search"
          />
        )}

        {airports.length === 0 ? (
          <p className="mt-10 text-forest-900/60">No airports indexed for {countryName} yet.</p>
        ) : filteredAirports.length === 0 ? (
          <p className="mt-10 text-forest-900/60">
            No airports match “{airportQuery}”.
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[0.3rem] border border-forest-900/10 bg-white/80">
            <div className="hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,0.7fr)_40px] gap-4 border-b border-forest-900/10 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-forest-900/45 md:grid">
              <span>Code</span>
              <span>Airport</span>
              <span>City</span>
              <span className="sr-only">Open</span>
            </div>
            {filteredAirports.slice(0, AIRPORTS_PAGE_SIZE).map((a) => (
              <AirportCard key={a.id} airport={a} allAirports={airports} />
            ))}
          </div>
        )}
        {filteredAirports.length > AIRPORTS_PAGE_SIZE && (
          <div className="mt-6">
            <Link
              href={`/airports?country=${encodeURIComponent(countryName)}`}
              className="text-sm font-medium text-forest-700 hover:underline"
              data-testid="country-airports-view-all"
            >
              View all airports →
            </Link>
          </div>
        )}
      </section>

      {/* Airlines */}
      <section
        className="mx-auto mt-16 max-w-7xl overflow-hidden rounded-[0.3rem] border border-forest-900/10 bg-white px-6 py-8 sm:px-8"
        data-testid="country-airlines"
      >
        <header className="grid gap-6 border-b border-forest-900/10 pb-6 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-end">
          <div>
            <p className="section-eyebrow">
              <span className="inline-block h-px w-8 bg-forest-800/60" />
              Airline directory
            </p>
            <h2 className="editorial-h mt-3 text-2xl font-bold text-2xl">
              Which airlines are headquartered in {countryName}?
            </h2>
            <p className="mt-3 max-w-4xl text-sm font-light leading-7 text-forest-900/70">
              Browse the airline brands connected to {countryName}. Each logo opens the carrier guide with route,
              baggage and policy context where available.
            </p>
          </div>
          <div className="border-l-2 border-forest-900/20 pl-5">
            <div className="font-urbanist text-4xl font-bold leading-none text-forest-900">
              {airlineQuery.trim() ? filteredAirlines.length : airlines.length}
            </div>
            <div className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-forest-900/55">
              {airlineQuery.trim() ? `of ${airlines.length}` : `airline${airlines.length === 1 ? '' : 's'}`}
            </div>
          </div>
        </header>

        {airlines.length > 0 && (
          <SearchBox
            value={airlineQuery}
            onChange={setAirlineQuery}
            placeholder="Filter by name, IATA or city…"
            data-testid="country-airlines-search"
          />
        )}

        {airlines.length === 0 ? (
          <p className="mt-10 text-forest-900/60">No airlines tagged to {countryName} yet.</p>
        ) : filteredAirlines.length === 0 ? (
          <p className="mt-10 text-forest-900/60">
            No airlines match “{airlineQuery}”.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredAirlines.slice(0, AIRLINES_PAGE_SIZE).map((al) => {
              const logo = mediaUrl(al.logo ?? null);
              return (
                <Link
                  key={al.id}
                  href={`/airlines/${al.slug}`}
                  className="group flex min-h-[118px] items-center justify-between gap-4 rounded-[0.3rem] border border-forest-900/10 bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:border-primary-emphasis/40 hover:shadow-sm"
                  aria-label={`Open ${al.name} airline guide`}
                  title={al.name}
                >
                  <div className="flex h-[100px] w-[140px] shrink-0 items-center justify-start self-stretch">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logo}
                        alt={al.name}
                        className="block h-[100px] w-full object-contain object-left"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-[100px] w-full items-center justify-start font-urbanist text-2xl font-bold uppercase tracking-wider text-forest-900/60">
                        {(al.iataCode || al.name).slice(0, 3).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="ml-auto min-w-0 flex-1 text-right">
                    <h3 className="font-urbanist text-base font-bold leading-tight text-forest-950 transition group-hover:text-primary-emphasis">
                      {al.name}
                    </h3>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {filteredAirlines.length > AIRLINES_PAGE_SIZE && (
          <div className="mt-6">
            <Link
              href={`/airlines?country=${encodeURIComponent(countryName)}`}
              className="text-sm font-medium text-forest-700 hover:underline"
              data-testid="country-airlines-view-all"
            >
              View all airlines →
            </Link>
          </div>
        )}
      </section>
    </>
  );
}

function sortAirportsByPopularity(airports: StrapiAirport[]) {
  return [...airports].sort((a, b) => {
    const aRank = POPULAR_AIRPORT_PRIORITY.get(a.iata?.toUpperCase()) ?? Number.MAX_SAFE_INTEGER;
    const bRank = POPULAR_AIRPORT_PRIORITY.get(b.iata?.toUpperCase()) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return (a.city || a.name || a.iata).localeCompare(b.city || b.name || b.iata);
  });
}

function sortAirlinesByPopularity(airlines: StrapiAirline[]) {
  return [...airlines].sort((a, b) => {
    const aRank = airlinePriority(a);
    const bRank = airlinePriority(b);
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name);
  });
}

function airlinePriority(airline: StrapiAirline) {
  const codeRank = airline.iataCode
    ? POPULAR_AIRLINE_PRIORITY.get(airline.iataCode.toUpperCase())
    : undefined;
  const nameRank = POPULAR_AIRLINE_NAME_PRIORITY.get(airline.name.toLowerCase());
  return codeRank ?? nameRank ?? Number.MAX_SAFE_INTEGER;
}

function SearchBox({
  value,
  onChange,
  placeholder,
  'data-testid': testId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  'data-testid'?: string;
}) {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-md border border-forest-900/15 bg-paper px-3 py-2 focus-within:border-forest-900/40">
      <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-forest-900/50" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className="w-full bg-transparent text-sm text-forest-900 placeholder:text-forest-900/40 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear filter"
          className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-forest-900/50 transition hover:bg-forest-900/10 hover:text-forest-900"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

function AirportCard({ airport, allAirports }: { airport: StrapiAirport; allAirports?: StrapiAirport[] }) {
  return (
    <Link
      href={airportPath(airport, allAirports)}
      className="group grid gap-3 border-b border-forest-900/10 px-4 py-4 transition last:border-b-0 hover:bg-primary-hover/60 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,0.7fr)_40px] md:items-center"
    >
      <div className="flex items-center gap-2">
        <span className="rounded bg-forest-900 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-sand-100">
          {airport.iata}
        </span>
        {airport.icao && (
          <span className="hidden font-mono text-[11px] font-bold tracking-wider text-forest-900/45 md:inline">
            {airport.icao}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <h3 className="truncate font-urbanist text-base font-bold leading-snug text-forest-900 group-hover:text-forest-700">
          {airport.name}
        </h3>
        <p className="mt-1 truncate text-xs text-forest-900/50 md:hidden">
          {[airport.city, airport.icao].filter(Boolean).join(' · ')}
        </p>
      </div>
      <p className="hidden truncate text-sm text-forest-900/60 md:block">
        {airport.city || 'Airport guide'}
      </p>
      <div className="hidden justify-end md:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-forest-900/10 bg-white text-sm font-bold text-forest-900 transition group-hover:border-primary-emphasis group-hover:bg-primary-emphasis group-hover:text-white" aria-hidden>
          →
        </span>
      </div>
    </Link>
  );
}
