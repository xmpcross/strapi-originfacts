import type { StrapiAirport } from '@/lib/strapi';

import multiAirportSlugs from '@/data/multi-airport-slugs.json';

const PREFERRED_AIRPORT_SLUGS: Record<string, string> = {
  EZE: 'buenos-aires',
  GIG: 'rio-de-janeiro',
  GRU: 'sao-paulo',
  LIM: 'lima',
  SCL: 'santiago',
  SYD: 'sydney',
};

const MULTI_AIRPORT_SLUGS_MAP: Record<string, string> = multiAirportSlugs as Record<string, string>;

export function preferredAirportSlug(iata: string): string | null {
  return PREFERRED_AIRPORT_SLUGS[iata.toUpperCase()] ?? null;
}

export function slugifyAirportPart(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function airportSlug(airport: Pick<StrapiAirport, 'iata' | 'city' | 'name'>, allAirports: Pick<StrapiAirport, 'iata' | 'city' | 'name'>[] = []): string {
  const iataUpper = (airport.iata || '').toUpperCase();
  const preferred = preferredAirportSlug(iataUpper);
  if (preferred) return preferred;

  if (MULTI_AIRPORT_SLUGS_MAP[iataUpper]) {
    return MULTI_AIRPORT_SLUGS_MAP[iataUpper];
  }

  const base = slugifyAirportPart(airport.city || airport.name || airport.iata);
  if (!base) return airport.iata.toLowerCase();

  const duplicateCity = allAirports.some((candidate) => {
    if (candidate.iata.toUpperCase() === iataUpper) return false;
    return slugifyAirportPart(candidate.city || candidate.name || candidate.iata) === base;
  });

  return duplicateCity ? `${base}-${airport.iata.toLowerCase()}` : base;
}

export function airportPath(airport: Pick<StrapiAirport, 'iata' | 'city' | 'name'>, allAirports: Pick<StrapiAirport, 'iata' | 'city' | 'name'>[] = []): string {
  return `/airports/${airportSlug(airport, allAirports)}`;
}
