import type { AirlineRegion, AirlineType, StrapiAirline, StrapiCountry } from '@/lib/strapi';

/**
 * The slim record the /airlines directory sends to the browser. Keep it lean:
 * every field here is serialised once per listed airline.
 */
export type DirectoryAirline = {
  name: string;
  slug: string;
  iataCode?: string;
  country?: string;
  city?: string;
  region?: AirlineRegion;
  type?: AirlineType;
  /** Strapi media path (resolve with mediaUrl). */
  logo?: string;
};

export const DIRECTORY_REGIONS: AirlineRegion[] = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'Oceania',
  'South America',
];

// Airline records spell some countries differently from the country
// collection. Only names that exist in the country collection are mapped.
const COUNTRY_ALIASES: Record<string, string> = {
  "People's Republic of China": 'China',
  'Hong Kong SAR of China': 'Hong Kong',
  'Republic of Korea': 'South Korea',
  'The Bahamas': 'Bahamas',
  'Democratic Republic of the Congo': 'DR Congo',
  Reunion: 'Réunion',
  'Czech Republic': 'Czechia',
  Macao: 'Macau',
  Burma: 'Myanmar',
  'Moldova (Republic of Moldova)': 'Moldova',
};

/**
 * Country name → region, from the country collection. The airline records'
 * own `region` field is unreliable (about one in ten disagrees with the
 * airline's country — Scoot filed under North America, Sun Country under
 * Europe), so the directory groups by the country's region and only falls
 * back to the airline's field when the country is unknown.
 */
export function countryRegionIndex(countries: Pick<StrapiCountry, 'name' | 'region'>[]) {
  const index = new Map<string, AirlineRegion>();
  for (const c of countries) {
    if (c.name && c.region && DIRECTORY_REGIONS.includes(c.region as AirlineRegion)) {
      index.set(c.name.toLowerCase(), c.region as AirlineRegion);
    }
  }
  return (airline: Pick<StrapiAirline, 'country' | 'region'>): AirlineRegion | undefined => {
    const raw = airline.country?.trim();
    if (raw) {
      const name = COUNTRY_ALIASES[raw] ?? raw;
      const hit = index.get(name.toLowerCase());
      if (hit) return hit;
    }
    return airline.region && DIRECTORY_REGIONS.includes(airline.region) ? airline.region : undefined;
  };
}
