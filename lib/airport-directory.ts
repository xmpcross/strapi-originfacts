import type { AirlineRegion, StrapiAirport, StrapiCountry } from '@/lib/strapi';
import { DIRECTORY_REGIONS } from '@/lib/airline-directory';

/**
 * The slim record the /airports directory sends to the browser. Every field is
 * serialised once per listed airport (3,600+), so keep it lean: no images, no
 * coordinates, no prose.
 */
export type DirectoryAirport = {
  iata: string;
  icao?: string;
  name: string;
  city?: string;
  /** Country name as the country collection spells it (falls back to the record). */
  country?: string;
  region?: AirlineRegion;
  /** Path segment after /airports/ — the canonical slug from airportSlug(). */
  slug: string;
  /** A reviewed guide (PUBLISHED_AIRPORT_IATAS). */
  reviewed?: boolean;
  /** Route records in the CMS with this airport as origin. */
  routes?: number;
};

export { DIRECTORY_REGIONS };

/**
 * Region and country name for an airport, from the country collection, matched
 * on the ISO country code.
 *
 * Unlike the airline records (about one in ten disagreed with its own country),
 * the airport records are internally consistent per country; the only
 * disagreement with the country collection is Turkey, Georgia, Armenia and
 * Azerbaijan (63 airports), which the airport records file under Europe and
 * the country collection — and therefore the /airlines directory and the
 * country pages — under Asia. Deriving from the country keeps /airports and
 * /airlines grouping the same country the same way. The record's own region is
 * the fallback when the country code is unknown.
 */
export function airportCountryIndex(countries: Pick<StrapiCountry, 'code' | 'name' | 'region'>[]) {
  const byCode = new Map<string, Pick<StrapiCountry, 'name' | 'region'>>();
  for (const c of countries) if (c.code) byCode.set(c.code.toUpperCase(), c);

  return (airport: Pick<StrapiAirport, 'countryCode' | 'country' | 'region'>) => {
    const hit = airport.countryCode ? byCode.get(airport.countryCode.toUpperCase()) : undefined;
    const countryRegion =
      hit?.region && DIRECTORY_REGIONS.includes(hit.region as AirlineRegion) ? (hit.region as AirlineRegion) : undefined;
    const ownRegion = airport.region && DIRECTORY_REGIONS.includes(airport.region) ? airport.region : undefined;
    return {
      country: hit?.name || airport.country || undefined,
      region: countryRegion ?? ownRegion,
    };
  };
}

/** Lower-case and strip diacritics, so "sao paulo" finds "São Paulo". */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Display key used to sort and letter-group cards: the city, else the airport name. */
export function airportSortKey(a: Pick<DirectoryAirport, 'city' | 'name'>): string {
  return (a.city || a.name || '').trim();
}

export function compareAirports(a: DirectoryAirport, b: DirectoryAirport): number {
  return (
    airportSortKey(a).localeCompare(airportSortKey(b), 'en', { sensitivity: 'base' }) ||
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) ||
    a.iata.localeCompare(b.iata)
  );
}

export function letterOf(s: string): string {
  const first = foldText(s.trim()).charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}
