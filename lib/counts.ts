/**
 * The single source of truth for every count the site displays.
 *
 * Every stat block, section header, FAQ answer, and piece of prose that
 * asserts "how many X" must read from here (or, for per-entity claims, from
 * countRecords() with an explicit filter). Never derive a dataset-size claim
 * from a capped list fetch or from the rendered sample — that is exactly how
 * "Originfacts lists 9 other airports in Australia" (the visible cards)
 * shipped while the dataset held 130.
 *
 * Cached for an hour via unstable_cache, so routing every display through
 * this module adds no per-request cost.
 */
import { unstable_cache } from 'next/cache';
import { listAirports, listCountries, countRecords } from './strapi';

/** The canonical continental groupings. Region values outside this list are
 *  data errors (e.g. the legacy "Asia-Pacific" on a few airline records —
 *  see docs/data/integrity-report.md) and are never counted. */
export const REGIONS = ['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'] as const;

export type SiteCounts = {
  /** Airports with an IATA code — the same set the sitemap and detail pages use. */
  airports: number;
  airlines: number;
  countries: number;
  destinations: number;
  routes: number;
  /** Distinct VALID regions present in the countries dataset (expected: 6). */
  regions: number;
  countriesByRegion: Record<string, number>;
  airportsByCountryCode: Record<string, number>;
};

async function computeSiteCounts(): Promise<SiteCounts> {
  const [airports, countries, airlines, destinations, routes] = await Promise.all([
    listAirports().catch(() => []),
    listCountries().catch(() => []),
    countRecords('airlines').catch(() => 0),
    countRecords('destinations').catch(() => 0),
    countRecords('routes').catch(() => 0),
  ]);

  const airportsByCountryCode: Record<string, number> = {};
  let airportCount = 0;
  for (const a of airports) {
    if (!a.iata) continue;
    airportCount++;
    const cc = (a.countryCode || '').toUpperCase();
    if (cc) airportsByCountryCode[cc] = (airportsByCountryCode[cc] || 0) + 1;
  }

  const countriesByRegion: Record<string, number> = {};
  for (const c of countries) {
    if (c.region && (REGIONS as readonly string[]).includes(c.region)) {
      countriesByRegion[c.region] = (countriesByRegion[c.region] || 0) + 1;
    }
  }

  return {
    airports: airportCount,
    airlines,
    countries: countries.length,
    destinations,
    routes,
    regions: Object.keys(countriesByRegion).length,
    countriesByRegion,
    airportsByCountryCode,
  };
}

export const getSiteCounts = unstable_cache(computeSiteCounts, ['site-counts'], { revalidate: 3600 });

/** Tracked routes departing an airport — equals its destination count, since
 *  route records are unique origin→destination pairs. */
export const countRoutesFromAirport = (iata: string) =>
  countRecords('routes', { origin: { iata: { $eqi: iata } } });

/** Tracked routes served by a carrier. */
export const countRoutesByCarrier = (slug: string) =>
  countRecords('routes', { carriers: { slug: { $eq: slug } } });

export { spelledCount } from './format';
