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

export function tpwlSearchUrl(origin: string, destination: string): string {
  const depart = new Date();
  depart.setHours(0, 0, 0, 0);
  depart.setDate(depart.getDate() + 30);
  const ret = new Date(depart);
  ret.setDate(depart.getDate() + 7);

  const segment = `${origin.toUpperCase()}${toDDMM(depart)}${destination.toUpperCase()}${toDDMM(ret)}1`;
  return `/flight-search?flightSearch=${segment}`;
}
