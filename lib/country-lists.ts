import type { StrapiAirline, StrapiAirport } from '@/lib/strapi';

/*
 * Only the fields CountryDetailSections reads. Country pages passed the full CMS records
 * (about text, image metadata, timestamps) for every airport and airline, and
 * as a client component all of it went into the page's React payload: 1.8 MB
 * of the 1.9 MB /destinations/united-states page.
 */
export type CountryAirportItem = Pick<StrapiAirport, 'id' | 'iata' | 'icao' | 'name' | 'city'>;
export type CountryAirlineItem = Pick<
  StrapiAirline,
  'id' | 'name' | 'slug' | 'iataCode' | 'icaoCode' | 'city' | 'legalName' | 'type' | 'logo'
>;

export function toCountryAirportItems(airports: StrapiAirport[]): CountryAirportItem[] {
  return airports.map(({ id, iata, icao, name, city }) => ({ id, iata, icao, name, city }));
}

export function toCountryAirlineItems(airlines: StrapiAirline[]): CountryAirlineItem[] {
  return airlines.map(({ id, name, slug, iataCode, icaoCode, city, legalName, type, logo }) => ({
    id,
    name,
    slug,
    iataCode,
    icaoCode,
    city,
    legalName,
    type,
    logo: logo?.url ? { url: logo.url } : null,
  }));
}
