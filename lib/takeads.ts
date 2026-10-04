import 'server-only';
import { unstable_cache } from 'next/cache';
import { getYourGuideLink, isTakeadsMerchant, partnerLink } from '@/lib/partner-links';

/*
 * Takeads Monetize API. The publisher key is TAKEADS_PUBLIC_KEY in the
 * project's .env.local (Takeads dashboard → API / Monetize API → public key);
 * without it every Takeads link falls back to the plain merchant URL.
 */
const API_URL = 'https://api.takeads.com/v1/product/monetize-api/v2/resolve';

export type TakeadsOfferKey =
  | 'qatar-airways'
  | 'kiwi'
  | 'airasia'
  | 'trip-com'
  | 'agoda'
  | 'getyourguide'
  | 'klook'
  | 'gettransfer';

type OfferDefinition = {
  key: TakeadsOfferKey;
  name: string;
  url: string;
  title: string;
  description: string;
  cta: string;
};

export type TakeadsOffer = OfferDefinition & {
  href: string;
  imageUrl: string | null;
};

const OFFER_DEFINITIONS: OfferDefinition[] = [
  {
    key: 'qatar-airways',
    name: 'Qatar Airways',
    url: 'https://www.qatarairways.com/',
    title: 'Search Qatar Airways fares',
    description: 'Check current fares and destinations directly with the airline.',
    cta: 'Check fares',
  },
  {
    key: 'kiwi',
    name: 'Kiwi.com',
    url: 'https://www.kiwi.com/',
    title: 'Compare more flight options',
    description: 'Explore routes and compare alternative flight combinations.',
    cta: 'Compare flights',
  },
  {
    key: 'airasia',
    name: 'AirAsia',
    url: 'https://www.airasia.com/',
    title: 'Browse AirAsia flights',
    description: 'See available low-cost routes and current flight offers.',
    cta: 'View flights',
  },
  {
    key: 'trip-com',
    name: 'Trip.com',
    url: 'https://www.trip.com/',
    title: 'Compare travel deals',
    description: 'Search flights, stays and other options for your next trip.',
    cta: 'Explore deals',
  },
  {
    key: 'agoda',
    name: 'Agoda',
    url: 'https://www.agoda.com/',
    title: 'Find a place to stay',
    description: 'Compare hotels and accommodation for your destination.',
    cta: 'Search stays',
  },
  {
    key: 'getyourguide',
    name: 'GetYourGuide',
    url: 'https://www.getyourguide.com/',
    title: 'Discover things to do',
    description: 'Browse tours, attractions and local experiences.',
    cta: 'Find activities',
  },
  {
    key: 'klook',
    name: 'Klook',
    url: 'https://www.klook.com/',
    title: 'Book local experiences',
    description: 'Explore attractions, activities and transport options.',
    cta: 'Browse experiences',
  },
  {
    key: 'gettransfer',
    name: 'GetTransfer',
    url: 'https://gettransfer.com/',
    title: 'Arrange an airport transfer',
    description: 'Compare private transfer options before you arrive.',
    cta: 'Check transfers',
  },
];

type ResolveResponse = {
  data?: Array<{ iri: string; trackingLink: string; imageUrl?: string | null }>;
};

/** Ask Takeads for tracking links. Returns an empty map on any failure. */
async function resolveIris(
  iris: string[],
  withImages = false,
): Promise<Map<string, { trackingLink: string; imageUrl?: string | null }>> {
  const publicKey = process.env.TAKEADS_PUBLIC_KEY;
  if (!publicKey || iris.length === 0) return new Map();

  try {
    const response = await fetch(API_URL, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${publicKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ iris, withImages }),
    });

    if (!response.ok) {
      console.warn(`Takeads resolve failed with HTTP ${response.status}`);
      return new Map();
    }

    const payload = (await response.json()) as ResolveResponse;
    return new Map(
      (payload.data ?? []).filter((item) => item.trackingLink).map((item) => [item.iri, item]),
    );
  } catch (error) {
    console.warn('Takeads resolve request failed', error instanceof Error ? error.message : error);
    return new Map();
  }
}

/**
 * Tracking link for one merchant URL (used by the /go redirect), cached for a
 * day per URL. Null when the URL is not a Takeads merchant or Takeads has no
 * link for it.
 */
const cachedTrackingLink = unstable_cache(
  async (url: string): Promise<string> => {
    const resolved = await resolveIris([url]);
    const link = resolved.get(url)?.trackingLink;
    // Throw instead of returning null: unstable_cache keeps a returned value for
    // a day but does not keep a thrown error, so one failed lookup (API blip,
    // restart) cannot leave a merchant untracked until tomorrow.
    if (!link) throw new Error('Takeads returned no tracking link');
    return link;
  },
  ['takeads-resolve-link-v2'],
  { revalidate: 86_400, tags: ['takeads'] },
);

export async function resolveTakeadsLink(url: string): Promise<string | null> {
  if (!isTakeadsMerchant(url)) return null;
  try {
    return await cachedTrackingLink(url);
  } catch {
    return null;
  }
}

/**
 * The link to put in a server-rendered page: the Takeads tracking link itself
 * (https://tatrck.com/h/…?url=…&model=cpc&s=<subId>), resolved on the server.
 * Falls back to the /go redirect if Takeads cannot be reached, so the link is
 * never dead. Client components cannot call this (it needs the API key); they
 * use partnerLink() / /go.
 */
export async function takeadsHref(url: string, subId: string): Promise<string> {
  const tracking = await resolveTakeadsLink(url);
  return tracking ? addTrackingParameters(tracking, subId) : partnerLink(url, subId);
}

const resolveBaseOffers = unstable_cache(
  async (): Promise<TakeadsOffer[]> => {
    const takeadsOffers = OFFER_DEFINITIONS.filter((offer) => isTakeadsMerchant(offer.url));
    const resolved = await resolveIris(takeadsOffers.map((offer) => offer.url), true);

    return OFFER_DEFINITIONS.flatMap((offer) => {
      // GetYourGuide is a direct partnership, not Takeads.
      if (offer.key === 'getyourguide') {
        return [{ ...offer, href: getYourGuideLink(offer.url), imageUrl: null }];
      }
      const match = resolved.get(offer.url);
      if (!match?.trackingLink) return [];
      return [{ ...offer, href: match.trackingLink, imageUrl: match.imageUrl ?? null }];
    });
  },
  ['takeads-originfacts-travel-offers-v2'],
  { revalidate: 86_400, tags: ['takeads'] },
);

const FLIGHT_KEYS: TakeadsOfferKey[] = ['qatar-airways', 'kiwi', 'airasia', 'trip-com'];
const STAY_KEYS: TakeadsOfferKey[] = ['agoda', 'trip-com', 'getyourguide', 'gettransfer'];
const EXPERIENCE_KEYS: TakeadsOfferKey[] = ['getyourguide', 'klook', 'agoda', 'gettransfer'];
const DEFAULT_KEYS: TakeadsOfferKey[] = ['trip-com', 'agoda', 'getyourguide', 'gettransfer'];

function contextualKeys(context: string): TakeadsOfferKey[] {
  const value = context.toLowerCase();
  if (/flight|airline|airport|fare|route|aviation/.test(value)) return FLIGHT_KEYS;
  if (/hotel|resort|accommodation|stay|hostel/.test(value)) return STAY_KEYS;
  if (/tour|activity|attraction|things to do|experience|destination|city|country/.test(value)) {
    return EXPERIENCE_KEYS;
  }
  return DEFAULT_KEYS;
}

export function addTrackingParameters(href: string, subId: string): string {
  try {
    const url = new URL(href);
    // Lowercase, as in the tracking links the Takeads dashboard issues
    // (https://tatrck.com/h/0Hu30_OZ0V7N?model=cpc for Booking.com).
    url.searchParams.set('model', 'cpc');
    url.searchParams.set('s', subId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200));
    return url.toString();
  } catch {
    return href;
  }
}

export async function getContextualTakeadsOffers({
  articleSlug,
  context,
  limit = 4,
}: {
  articleSlug: string;
  context: string;
  limit?: number;
}): Promise<TakeadsOffer[]> {
  const offers = await resolveBaseOffers();
  const byKey = new Map(offers.map((offer) => [offer.key, offer]));

  return contextualKeys(context)
    .map((key) => byKey.get(key))
    .filter((offer): offer is TakeadsOffer => Boolean(offer))
    .slice(0, limit)
    .map((offer) => ({
      ...offer,
      href:
        offer.key === 'getyourguide'
          ? offer.href
          : addTrackingParameters(offer.href, `originfacts_article_${articleSlug}_${offer.key}`),
    }));
}
