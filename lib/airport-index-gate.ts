/**
 * Which airport pages are indexable and listed in the sitemap.
 *
 * The 3,602 airport records are mostly bare: a name, codes, runways and a
 * shared template. Those pages stay `noindex, follow` and out of the sitemap
 * (a 5 Oct 2026 sample of 29 had a median of 83 words of their own, against 238
 * on the indexed pages, and none had route or fare data). A page is indexable
 * when the site can point at data of its own:
 *
 *   - it already qualified: tracked routes, or the reviewed Top 100 list
 *     (airportIsSubstantive in lib/entity-seo.ts); or
 *   - it has a sourced guide in content/airport-guides/<iata>.json; or
 *   - Travelpayouts fare data lists at least MIN_FARE_DESTINATIONS nonstop
 *     destinations from it (data/airport-enrichment/fares.json).
 *
 * Retired airports (THIN_AIRPORT_IATAS) are never indexable, whatever data
 * they have. Adding a guide for any airport therefore indexes it automatically.
 *
 * Server-only: reads data files from disk.
 */
import { getAirportEnrichment } from '@/lib/airport-enrichment';
import { getAirportGuide } from '@/lib/airport-guide';
import { THIN_AIRPORT_IATAS, airportIsSubstantive } from '@/lib/entity-seo';
import type { StrapiAirport } from '@/lib/strapi';

/** Nonstop destinations in the fare data needed to count as real data. */
export const MIN_FARE_DESTINATIONS = 5;

export function airportHasRealData(iata: string | null | undefined): boolean {
  if (!iata) return false;
  if (getAirportGuide(iata)) return true;
  const fares = getAirportEnrichment(iata).fares;
  return (fares?.destinations?.length ?? 0) >= MIN_FARE_DESTINATIONS;
}

export function airportIsIndexable(a: StrapiAirport, hasRoutes: boolean): boolean {
  if (!a.iata) return false;
  if (THIN_AIRPORT_IATAS.has(a.iata.toUpperCase())) return false;
  return airportIsSubstantive(a, hasRoutes) || airportHasRealData(a.iata);
}
