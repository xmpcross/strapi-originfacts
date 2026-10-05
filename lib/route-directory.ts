import type { AirlineRegion } from '@/lib/strapi';
import { DIRECTORY_REGIONS } from '@/lib/airline-directory';
import { foldText } from '@/lib/airport-directory';

/**
 * Data model for the /flight-routes directory. Like /airports, the page sends
 * every route to the browser as a slim search index (compact tuples, no prose,
 * no images) and renders only ROUTES_BROWSE_LIMIT cards at a time.
 */

/** One end of a route, as the directory shows it. */
export type RouteEnd = {
  iata: string;
  /** City, else the airport name. */
  city: string;
  name: string;
  country?: string;
  region?: AirlineRegion;
  /** Path segment after /airports/ (airportSlug). */
  slug: string;
};

/** A carrier as listed on the page: slug, name, IATA designator. */
export type DirectoryCarrier = { slug: string; name: string; iata?: string };

export type DirectoryRoute = {
  slug: string;
  origin: RouteEnd;
  destination: RouteEnd;
  distanceKm?: number;
  /** durationMinutes from the route record — an estimate, labelled as one. */
  durationMinutes?: number;
  /** The record's popularity score (higher = more popular in our records). */
  popularity: number;
  /** Indexes into the page's carrier table. */
  carriers: number[];
};

export { DIRECTORY_REGIONS };

/** Cards shown at first, and how many more each "Show more" adds. */
export const ROUTES_BROWSE_LIMIT = 60;

/** Routes in the "most popular in our route records" grid. */
export const FEATURED_ROUTES = 8;

/** True when both ends are in the same country. */
export function isDomestic(r: Pick<DirectoryRoute, 'origin' | 'destination'>): boolean {
  const o = r.origin.country;
  const d = r.destination.country;
  return Boolean(o && d && foldText(o) === foldText(d));
}

/** "11h 30m" from minutes; whole hours drop the minute part. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

export function compareRoutesAZ(a: DirectoryRoute, b: DirectoryRoute): number {
  return (
    a.origin.city.localeCompare(b.origin.city, 'en', { sensitivity: 'base' }) ||
    a.destination.city.localeCompare(b.destination.city, 'en', { sensitivity: 'base' }) ||
    a.slug.localeCompare(b.slug)
  );
}

/** Default order: popularity score, then A–Z — the order the CMS list uses. */
export function rankRoutes(a: DirectoryRoute, b: DirectoryRoute): number {
  return b.popularity - a.popularity || compareRoutesAZ(a, b);
}

export type RouteSort = 'popular' | 'az' | 'longest' | 'shortest';

export function sortRoutes(routes: DirectoryRoute[], sort: RouteSort): DirectoryRoute[] {
  const list = routes.slice();
  if (sort === 'az') return list.sort(compareRoutesAZ);
  if (sort === 'longest' || sort === 'shortest') {
    const dir = sort === 'longest' ? -1 : 1;
    // Routes without a distance go last either way.
    return list.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return rankRoutes(a, b);
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return dir * (a.distanceKm - b.distanceKm) || rankRoutes(a, b);
    });
  }
  return list.sort(rankRoutes);
}

/** Lower-cased, accent-free text a search query is matched against. */
export function routeHaystack(r: DirectoryRoute, carriers: DirectoryCarrier[] = []): string {
  const ends = [r.origin, r.destination].flatMap((e) => [e.iata, e.city, e.name, e.country]);
  const names = r.carriers.flatMap((i) => [carriers[i]?.name, carriers[i]?.iata]);
  return foldText([...ends, ...names, r.slug].filter(Boolean).join(' '));
}

/**
 * Every whitespace-separated term must match, so "london bangkok" and
 * "lhr bkk" both find LHR → BKK. Separators such as "-", "→" and "to" are
 * dropped so "LHR-BKK" and "London to Bangkok" work too.
 */
export function matchesQuery(hay: string, query: string): boolean {
  const terms = foldText(query)
    .replace(/[→>–—-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && t !== 'to');
  return terms.every((t) => hay.includes(t));
}

/* ---- compact transport ------------------------------------------------- */

/** [iata, city, name, country, region index, slug] — empty string / -1 for missing. */
export type RouteEndRow = [string, string, string, string, number, string];
/** [slug, origin, destination, distanceKm (0 = none), durationMinutes (0 = none), popularity, carrier indexes]. */
export type RouteRow = [string, RouteEndRow, RouteEndRow, number, number, number, number[]];

function endToRow(e: RouteEnd): RouteEndRow {
  return [
    e.iata,
    e.city,
    e.name === e.city ? '' : e.name,
    e.country ?? '',
    e.region ? DIRECTORY_REGIONS.indexOf(e.region) : -1,
    e.slug,
  ];
}

function endFromRow([iata, city, name, country, region, slug]: RouteEndRow): RouteEnd {
  return {
    iata,
    city,
    name: name || city,
    ...(country ? { country } : {}),
    ...(region >= 0 ? { region: DIRECTORY_REGIONS[region] } : {}),
    slug,
  };
}

export function toRow(r: DirectoryRoute): RouteRow {
  return [
    r.slug,
    endToRow(r.origin),
    endToRow(r.destination),
    r.distanceKm ? Math.round(r.distanceKm) : 0,
    r.durationMinutes ? Math.round(r.durationMinutes) : 0,
    r.popularity,
    r.carriers,
  ];
}

export function fromRow([slug, o, d, km, min, popularity, carriers]: RouteRow): DirectoryRoute {
  return {
    slug,
    origin: endFromRow(o),
    destination: endFromRow(d),
    ...(km ? { distanceKm: km } : {}),
    ...(min ? { durationMinutes: min } : {}),
    popularity,
    carriers,
  };
}
