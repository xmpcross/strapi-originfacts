/**
 * Outbound partner links. Safe to import from client components: nothing here
 * touches an API key.
 *
 * Takeads merchants (Booking.com, CheapOair, Kiwi.com, Qatar Airways, Agoda,
 * Trip.com, …) link through our own /go route, which asks the Takeads Monetize
 * API for the tracking link server-side (lib/takeads.ts, TAKEADS_PUBLIC_KEY) and
 * redirects. Pages never hard-code tatrck.com links: those carry a per-merchant
 * hash and, without a `url=` destination, redirect to an empty Location.
 *
 * GetYourGuide is a direct partnership (partner_id below), not Takeads.
 */

/** Merchant domains /go will resolve through Takeads. Anything else is refused. */
export const TAKEADS_MERCHANT_DOMAINS = [
  'booking.com',
  'cheapoair.com',
  'kiwi.com',
  'qatarairways.com',
  'agoda.com',
  'trip.com',
  'airasia.com',
  'klook.com',
  'gettransfer.com',
] as const;

export function isTakeadsMerchant(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return TAKEADS_MERCHANT_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** Link to a Takeads merchant page via /go. `subId` shows up in Takeads reports. */
export function partnerLink(url: string, subId?: string): string {
  const params = new URLSearchParams({ url });
  if (subId) params.set('s', subId);
  return `/go?${params.toString()}`;
}

/** Booking.com search for a place or hotel name, via Takeads. */
export function bookingSearchLink(query: string, subId?: string): string {
  return partnerLink(`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(query)}`, subId);
}

export const GETYOURGUIDE_PARTNER_ID = 'H8Y3KHZ';

/** GetYourGuide link with our direct partner id. Accepts a full URL or a search query. */
export function getYourGuideLink(urlOrQuery: string = ''): string {
  const url = /^https?:\/\//.test(urlOrQuery)
    ? new URL(urlOrQuery)
    : new URL(urlOrQuery ? `https://www.getyourguide.com/s/?q=${encodeURIComponent(urlOrQuery)}` : 'https://www.getyourguide.com/');
  url.searchParams.set('partner_id', GETYOURGUIDE_PARTNER_ID);
  return url.toString();
}
