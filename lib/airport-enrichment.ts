/**
 * Per-airport facts from free, open datasets, snapshotted into
 * data/airport-enrichment/ by ops/build-airport-enrichment.mjs (see the README
 * there for sources, licences and how to refresh). Read from disk once per
 * process at build/revalidate time; no source is called at runtime.
 *
 * Everything here restates a value from one of those files and says which.
 * Nothing is generated: when a field is missing, the page leaves it out.
 *
 * Server-only: reads data files from disk. Do not import from client code.
 */
import fs from 'node:fs';
import path from 'node:path';

import { getAirlineRef } from '@/lib/airline-refs';
import { getCeasedAirline, isNonAirline } from '@/lib/airline-status';
import { carrierCodeMismatch, sameCarrierName } from '@/lib/route-carriers';
import type { StrapiAirline } from '@/lib/strapi';

/* ------------------------------------------------------------------ *
 * File shapes
 * ------------------------------------------------------------------ */

export type Runway = {
  ident: string | null;
  lengthFt: number;
  widthFt: number | null;
  surface: string | null;
  surfaceRaw: string | null;
  lighted: boolean;
};

export type OurAirportsEntry = {
  id: number;
  ident: string;
  icao?: string;
  iata?: string;
  joinedBy: 'icao' | 'iata+name+country';
  /** The record's ICAO when OurAirports does not know it (joined by IATA + name + country + coordinates instead). */
  supersededIcao?: string;
  name: string;
  type: string;
  lat?: number;
  lon?: number;
  elevationFt?: number;
  country?: string;
  municipality?: string;
  scheduledService: boolean;
  homeLink?: string;
  wikipediaLink?: string;
  runways?: Runway[];
  closedRunways?: number;
};

type Labelled = { qid: string; label: string };

export type WikidataEntry = {
  qid: string;
  label?: string;
  icao: string;
  enwiki?: string;
  website?: string;
  opened?: { value: string; precision: 'year' | 'month' | 'day'; prop: 'P1619' | 'P571' } | null;
  operators?: Labelled[];
  owners?: Labelled[];
  namedAfter?: Labelled[];
  placeServed?: (Labelled & { lat?: number; lon?: number })[];
  patronage?: { value: number; year: number; refUrl: string | null } | null;
  hubAirlines?: (Labelled & { iata: string | null; icao: string | null })[];
};

export type FareDestination = { code: string; name: string; cc: string | null; airlines: string[] };
export type FaresEntry = { retrieved: string; destinations: FareDestination[]; airlines: Record<string, number> };

/** [mean daily max °C, mean daily min °C, mean monthly precipitation mm] × 12. */
export type ClimateEntry = { lat: number; lon: number; period: string; months: [number, number, number | null][] };

export type ComputedEntry = {
  cityCentre?: { name: string; km: number; compass: string; source: 'osm' | 'wikidata'; ref: string };
  nearestScheduled?: { iata: string; name: string; municipality?: string; km: number }[];
};

type SourceFile<T> = {
  source: string;
  sourceUrl?: string;
  licence?: string;
  retrieved: string;
  airports: Record<string, T>;
  airlineNames?: Record<string, string>;
  countryNames?: Record<string, string>;
  period?: string;
};

function load<T>(name: string): SourceFile<T> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'airport-enrichment', name), 'utf8')) as SourceFile<T>;
  } catch {
    return null;
  }
}

const FILES = {
  oa: load<OurAirportsEntry>('ourairports.json'),
  wd: load<WikidataEntry>('wikidata.json'),
  fares: load<FaresEntry>('fares.json'),
  climate: load<ClimateEntry>('climate.json'),
  computed: load<ComputedEntry>('computed.json'),
};

export type EnrichmentSource = { name: string; url?: string; licence?: string; retrieved: string };

const src = (f: SourceFile<unknown> | null): EnrichmentSource | null =>
  f ? { name: f.source, url: f.sourceUrl, licence: f.licence, retrieved: f.retrieved } : null;

export const ENRICHMENT_SOURCES = {
  ourairports: src(FILES.oa),
  wikidata: src(FILES.wd),
  fares: src(FILES.fares),
  climate: src(FILES.climate),
  computed: src(FILES.computed),
};

export type AirportEnrichment = {
  oa: OurAirportsEntry | null;
  wd: WikidataEntry | null;
  fares: FaresEntry | null;
  climate: ClimateEntry | null;
  computed: ComputedEntry | null;
};

export function getAirportEnrichment(iata: string): AirportEnrichment {
  const k = iata.toUpperCase();
  return {
    oa: FILES.oa?.airports[k] ?? null,
    wd: FILES.wd?.airports[k] ?? null,
    fares: FILES.fares?.airports[k] ?? null,
    climate: FILES.climate?.airports[k] ?? null,
    computed: FILES.computed?.airports[k] ?? null,
  };
}

export function fareAirlineName(code: string): string | null {
  return FILES.fares?.airlineNames?.[code] ?? null;
}

export function fareCountryName(cc: string | null): string | null {
  return cc ? FILES.fares?.countryNames?.[cc] ?? cc : null;
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

const FT_TO_M = 0.3048;
const nf = (n: number) => n.toLocaleString('en-US');

/** "3,110 m (10,203 ft)" */
export function formatLength(ft: number): string {
  return `${nf(Math.round(ft * FT_TO_M))} m (${nf(ft)} ft)`;
}

export function metres(ft: number): number {
  return Math.round(ft * FT_TO_M);
}

/** "74 m (242 ft)"; negative elevations read "below sea level" at the call site. */
export function formatElevation(ft: number): string {
  return `${nf(Math.round(ft * FT_TO_M))} m (${nf(ft)} ft)`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTH_SHORT = MONTHS.map((m) => m.slice(0, 3));

/** Keeps Wikidata's precision: a year stays a year. */
export function formatOpened(o: NonNullable<WikidataEntry['opened']>): string {
  const [y, m, d] = o.value.split('-').map(Number);
  if (o.precision === 'year') return String(y);
  if (o.precision === 'month') return `${MONTHS[m - 1]} ${y}`;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** 32,294,167 → "32.3 million"; 934,337 → "934,337". */
export function formatPassengers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, '')} million`;
  return nf(n);
}

const TYPE_LABELS: Record<string, string> = {
  large_airport: 'Large airport',
  medium_airport: 'Medium airport',
  small_airport: 'Small airport',
  seaplane_base: 'Seaplane base',
  heliport: 'Heliport',
  balloonport: 'Balloon port',
};

/** OurAirports' own size class — not an official category. */
export function airportTypeLabel(type?: string | null): string | null {
  return type ? TYPE_LABELS[type] ?? null : null;
}

const COMPASS_WORDS: Record<string, string> = {
  N: 'north', NNE: 'north-northeast', NE: 'northeast', ENE: 'east-northeast', E: 'east', ESE: 'east-southeast',
  SE: 'southeast', SSE: 'south-southeast', S: 'south', SSW: 'south-southwest', SW: 'southwest', WSW: 'west-southwest',
  W: 'west', WNW: 'west-northwest', NW: 'northwest', NNW: 'north-northwest',
};

export function compassWords(abbr: string): string {
  return COMPASS_WORDS[abbr] ?? abbr;
}

export function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${nf(Math.round(km))} km`;
}

/** "atl.com" style host for a reference link. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const wikidataUrl = (qid: string) => `https://www.wikidata.org/wiki/${qid}`;

/* ------------------------------------------------------------------ *
 * Derived summaries
 * ------------------------------------------------------------------ */

export type ClimateSummary = {
  warmest: { month: string; hi: number; lo: number };
  coolest: { month: string; hi: number; lo: number };
  wettest: { month: string; mm: number } | null;
  driest: { month: string; mm: number } | null;
  annualMm: number | null;
};

export function climateSummary(c: ClimateEntry): ClimateSummary {
  const rows = c.months.map(([hi, lo, mm], i) => ({ i, hi, lo, mm }));
  const byHi = [...rows].sort((a, b) => b.hi - a.hi);
  const withMm = rows.filter((r) => typeof r.mm === 'number') as { i: number; hi: number; lo: number; mm: number }[];
  const byMm = [...withMm].sort((a, b) => b.mm - a.mm);
  const w = byHi[0];
  const k = byHi[byHi.length - 1];
  return {
    warmest: { month: MONTHS[w.i], hi: w.hi, lo: w.lo },
    coolest: { month: MONTHS[k.i], hi: k.hi, lo: k.lo },
    wettest: byMm.length ? { month: MONTHS[byMm[0].i], mm: byMm[0].mm } : null,
    driest: byMm.length ? { month: MONTHS[byMm[byMm.length - 1].i], mm: byMm[byMm.length - 1].mm } : null,
    annualMm: withMm.length === 12 ? withMm.reduce((s, r) => s + r.mm, 0) : null,
  };
}

/** Destinations grouped by country, largest group first. */
export function faresByCountry(f: FaresEntry): { cc: string | null; country: string; destinations: FareDestination[] }[] {
  const groups = new Map<string, FareDestination[]>();
  for (const d of f.destinations) {
    const k = d.cc ?? '';
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  return [...groups.entries()]
    .map(([cc, destinations]) => ({
      cc: cc || null,
      country: fareCountryName(cc || null) ?? 'Other',
      destinations: [...destinations].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.destinations.length - a.destinations.length || a.country.localeCompare(b.country));
}

/* ------------------------------------------------------------------ *
 * Airline identity
 * ------------------------------------------------------------------ */

export type SiteAirline = Pick<StrapiAirline, 'slug' | 'name'> & Partial<Pick<StrapiAirline, 'iataCode' | 'country'>>;

/**
 * The site airline a 2-letter code on an outside dataset denotes, or null.
 *
 * Never by code alone (content/airline-facts/CLAUDE.md): the CMS airline that
 * holds the code must pass the route-carrier identity check (Duffel's current
 * holder of the code is the same carrier — lib/route-carriers.ts), must not be
 * recorded as ceased or as a non-airline, and its name must match the name the
 * outside dataset gives for the code. Exactly one candidate must qualify.
 */
export function resolveAirlineCode(code: string, sourceName: string | null, airlines: SiteAirline[]): SiteAirline | null {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{2}$/.test(c) || !sourceName) return null;
  const ref = getAirlineRef(c);
  const ok = airlines.filter(
    (a) =>
      (a.iataCode ?? '').trim().toUpperCase() === c &&
      !isNonAirline(a.slug) &&
      !getCeasedAirline(a.slug) &&
      carrierCodeMismatch(a) === null &&
      sameCarrierName(sourceName, a.name) &&
      (!ref || sameCarrierName(ref.name, sourceName)),
  );
  return ok.length === 1 ? ok[0] : null;
}

export type FareAirline = { code: string; name: string; destinations: number; site: SiteAirline | null };

/** Airlines named on the fares, most destinations first, each resolved (or not) to a site airline. */
export function fareAirlines(f: FaresEntry, airlines: SiteAirline[]): FareAirline[] {
  return Object.entries(f.airlines)
    .map(([code, destinations]) => {
      const name = fareAirlineName(code);
      return { code, name: name ?? code, destinations, site: resolveAirlineCode(code, name, airlines) };
    })
    .sort((a, b) => b.destinations - a.destinations || a.name.localeCompare(b.name));
}

export type HubAirline = { qid: string; label: string; iata: string | null; site: SiteAirline | null };

/**
 * Wikidata "airline hub" (P113) carriers. Linked to a site airline only when
 * the Wikidata item's IATA code resolves through resolveAirlineCode() with the
 * Wikidata label as the name. Carriers the site records as ceased are dropped.
 */
export function hubAirlines(wd: WikidataEntry, airlines: SiteAirline[]): HubAirline[] {
  return (wd.hubAirlines ?? [])
    .map((h) => ({ qid: h.qid, label: h.label, iata: h.iata, site: h.iata ? resolveAirlineCode(h.iata, h.label, airlines) : null }))
    .filter((h) => {
      // A site airline with the same name and a sourced cessation: leave it out.
      const sameName = airlines.find((a) => a.name.toLowerCase() === h.label.toLowerCase());
      return !(sameName && getCeasedAirline(sameName.slug));
    });
}

/* ------------------------------------------------------------------ *
 * Meta description facts
 * ------------------------------------------------------------------ */

/**
 * One or two short, distinctive facts for the meta description, most
 * specific first: "2 runways, opened 1940".
 */
export function enrichmentMetaFacts(e: AirportEnrichment): string[] {
  const facts: string[] = [];
  const rw = e.oa?.runways?.length ?? 0;
  if (rw) facts.push(`${rw} ${rw === 1 ? 'runway' : 'runways'}`);
  // "opened" only for a date of official opening (P1619); inception (P571) is
  // a looser claim and stays on the page, out of the description.
  if (e.wd?.opened?.prop === 'P1619') facts.push(`opened ${formatOpened(e.wd.opened)}`);
  else if (e.wd?.patronage) facts.push(`${formatPassengers(e.wd.patronage.value)} passengers in ${e.wd.patronage.year}`);
  else if (e.fares?.destinations.length) facts.push(`nonstop fares to ${e.fares.destinations.length} places`);
  return facts.slice(0, 2);
}

/* ------------------------------------------------------------------ *
 * View model for the airport page
 * ------------------------------------------------------------------ */

export type AirportEnrichmentView = {
  typeLabel: string | null;
  elevationFt: number | null;
  runways: Runway[];
  closedRunways: number;
  opened: WikidataEntry['opened'] | null;
  operators: Labelled[];
  owners: Labelled[];
  namedAfter: Labelled[];
  patronage: WikidataEntry['patronage'] | null;
  qid: string | null;
  hubs: { qid: string; label: string; iata: string | null; href: string | null }[];
  fares: {
    retrieved: string;
    destinationCount: number;
    countryCount: number;
    groups: { country: string; destinations: { code: string; name: string; routeHref: string | null }[] }[];
    airlines: { code: string; name: string; destinations: number; href: string | null }[];
  } | null;
  climate: {
    period: string;
    lat: number;
    lon: number;
    months: { month: string; hi: number; lo: number; mm: number | null }[];
    summary: ClimateSummary;
  } | null;
  cityCentre: ComputedEntry['cityCentre'] | null;
  nearestScheduled: { iata: string; name: string; municipality?: string; km: number; href: string | null }[];
  sources: typeof ENRICHMENT_SOURCES;
};

/** "2016-01-01 to 2025-12-31" style period → "2016–2025". */
export function climatePeriod(c: ClimateEntry): string {
  const m = c.period.match(/^(\d{4})\d{4}-(\d{4})\d{4}$/);
  return m ? `${m[1]}–${m[2]}` : c.period;
}

export function buildEnrichmentView(
  e: AirportEnrichment,
  opts: {
    airlines: SiteAirline[];
    /** Route-record page for a destination code, when Originfacts has one from this airport. */
    routeHref: (code: string) => string | null;
    /** Site page for another airport, when it exists. */
    airportHref: (iata: string) => string | null;
  },
): AirportEnrichmentView {
  const fares = e.fares;
  const groups = fares ? faresByCountry(fares) : [];
  return {
    typeLabel: airportTypeLabel(e.oa?.type),
    elevationFt: typeof e.oa?.elevationFt === 'number' ? e.oa.elevationFt : null,
    runways: e.oa?.runways ?? [],
    closedRunways: e.oa?.closedRunways ?? 0,
    opened: e.wd?.opened ?? null,
    operators: e.wd?.operators ?? [],
    owners: e.wd?.owners ?? [],
    namedAfter: e.wd?.namedAfter ?? [],
    patronage: e.wd?.patronage ?? null,
    qid: e.wd?.qid ?? null,
    hubs: e.wd
      ? hubAirlines(e.wd, opts.airlines).map((h) => ({ qid: h.qid, label: h.label, iata: h.iata, href: h.site ? `/airlines/${h.site.slug}` : null }))
      : [],
    fares: fares
      ? {
          retrieved: fares.retrieved,
          destinationCount: fares.destinations.length,
          countryCount: groups.filter((g) => g.cc).length,
          groups: groups.map((g) => ({
            country: g.country,
            destinations: g.destinations.map((d) => ({ code: d.code, name: d.name, routeHref: opts.routeHref(d.code) })),
          })),
          airlines: fareAirlines(fares, opts.airlines).map((a) => ({
            code: a.code,
            name: a.site?.name ?? a.name,
            destinations: a.destinations,
            href: a.site ? `/airlines/${a.site.slug}` : null,
          })),
        }
      : null,
    climate: e.climate
      ? {
          period: climatePeriod(e.climate),
          lat: e.climate.lat,
          lon: e.climate.lon,
          months: e.climate.months.map(([hi, lo, mm], i) => ({ month: MONTH_SHORT[i], hi, lo, mm })),
          summary: climateSummary(e.climate),
        }
      : null,
    cityCentre: e.computed?.cityCentre ?? null,
    nearestScheduled: (e.computed?.nearestScheduled ?? []).map((n) => ({ ...n, href: opts.airportHref(n.iata) })),
    sources: ENRICHMENT_SOURCES,
  };
}
