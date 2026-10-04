/**
 * Public landing page for the TPWL widget. Every Popular-Destinations and
 * Search-by-Destination click now routes through our own /flight-search page so
 * visitors stay on originfacts.com — that page then 307-redirects to the
 * white-label host (flights.originfacts.com) with the TravelPayouts marker
 * attached. Keeps brand + analytics + ad slots on the main domain.
 */
export const TPWL_HOST = '/flight-search';

const pad = (n: number) => String(n).padStart(2, '0');
const toDDMM = (d: Date) => `${pad(d.getDate())}${pad(d.getMonth() + 1)}`;

/** DDMM from an ISO date ("2026-11-12" → "1211"), without going through a Date (no time-zone shift). */
const isoToDDMM = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`;

/**
 * Link to the flight search for a route. Without `dates` it uses sample dates
 * (30 days out, a week long). Pass the dates a fare was found for to open the
 * search that matches that fare.
 */
export function tpwlSearchUrl(
  origin: string,
  destination: string,
  dates?: { departISO?: string; returnISO?: string },
): string {
  const iso = /^\d{4}-\d{2}-\d{2}/;
  if (dates?.departISO && iso.test(dates.departISO)) {
    const back = dates.returnISO && iso.test(dates.returnISO) ? isoToDDMM(dates.returnISO) : '';
    return `/flight-search?flightSearch=${origin.toUpperCase()}${isoToDDMM(dates.departISO)}${destination.toUpperCase()}${back}1`;
  }

  const depart = new Date();
  depart.setHours(0, 0, 0, 0);
  depart.setDate(depart.getDate() + 30);
  const ret = new Date(depart);
  ret.setDate(depart.getDate() + 7);

  const segment = `${origin.toUpperCase()}${toDDMM(depart)}${destination.toUpperCase()}${toDDMM(ret)}1`;
  return `/flight-search?flightSearch=${segment}`;
}
