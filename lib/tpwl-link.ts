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
/**
 * TPWL search segment for a route, e.g. "PER1211KUL19111". Without `dates` it
 * uses sample dates (30 days out, a week long).
 */
export function tpwlSegment(
  origin: string,
  destination: string,
  dates?: { departISO?: string; returnISO?: string },
): string {
  const iso = /^\d{4}-\d{2}-\d{2}/;
  if (dates?.departISO && iso.test(dates.departISO)) {
    const back = dates.returnISO && iso.test(dates.returnISO) ? isoToDDMM(dates.returnISO) : '';
    return `${origin.toUpperCase()}${isoToDDMM(dates.departISO)}${destination.toUpperCase()}${back}1`;
  }

  const depart = new Date();
  depart.setHours(0, 0, 0, 0);
  depart.setDate(depart.getDate() + 30);
  const ret = new Date(depart);
  ret.setDate(depart.getDate() + 7);

  return `${origin.toUpperCase()}${toDDMM(depart)}${destination.toUpperCase()}${toDDMM(ret)}1`;
}

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
  return `/flight-search?flightSearch=${tpwlSegment(origin, destination, dates)}`;
}

/**
 * Plain link to the partner-hosted white-label search (flights.originfacts.com,
 * run by Travelpayouts) with our affiliate marker. Offered next to the consent
 * placeholder of the embedded search tools: it is an ordinary link, so it works
 * without loading any widget on this site. `segment` pre-fills a search.
 */
export function tpwlPartnerUrl(segment?: string): string {
  const host = process.env.NEXT_PUBLIC_TP_WL_HOST?.trim() || 'flights.originfacts.com';
  const marker = process.env.NEXT_PUBLIC_TP_MARKER?.trim() || '314807';
  const params = new URLSearchParams();
  if (segment && /^[A-Za-z0-9]{6,40}$/.test(segment)) params.set('flightSearch', segment.toUpperCase());
  params.set('marker', marker);
  return `https://${host}/?${params.toString()}`;
}
