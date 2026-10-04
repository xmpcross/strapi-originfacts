import type { StrapiAirline, StrapiAirport, StrapiRoute } from '@/lib/strapi';

const norm = (v?: string | null) => (v ?? '').trim().toLowerCase();

/**
 * Carriers that can plausibly operate a route. On a domestic route (both ends
 * in the same country) a foreign carrier cannot fly it — those joins come from
 * codeshares or recycled IATA codes (e.g. Air Djibouti and Silk Avia hold the
 * old Virgin Blue "DJ" and US Airways "US" codes and were listed on
 * Sydney–Melbourne). Same rule as docs/data/integrity-report.md. A carrier
 * with no country on record is kept.
 */
export function operableCarriers(
  route: Pick<StrapiRoute, 'carriers'> & {
    origin?: Pick<StrapiAirport, 'country' | 'countryCode'> | null;
    destination?: Pick<StrapiAirport, 'country' | 'countryCode'> | null;
  },
): StrapiAirline[] {
  const carriers = route.carriers ?? [];
  const o = route.origin;
  const d = route.destination;
  if (!o || !d) return carriers;
  const domestic =
    (o.countryCode && d.countryCode && norm(o.countryCode) === norm(d.countryCode)) ||
    (o.country && d.country && norm(o.country) === norm(d.country));
  if (!domestic || !o.country) return carriers;
  return carriers.filter((c) => !c.country || norm(c.country) === norm(o.country));
}
