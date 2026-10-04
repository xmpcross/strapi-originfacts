import 'server-only';
import { unstable_cache } from 'next/cache';

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

const resolveBaseOffers = unstable_cache(
  async (): Promise<TakeadsOffer[]> => {
    const publicKey = process.env.TAKEADS_PUBLIC_KEY;
    if (!publicKey) return [];

    try {
      const response = await fetch(API_URL, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${publicKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          iris: OFFER_DEFINITIONS.map((offer) => offer.url),
          withImages: true,
        }),
      });

      if (!response.ok) {
        console.warn(`Takeads resolve failed with HTTP ${response.status}`);
        return [];
      }

      const payload = (await response.json()) as ResolveResponse;
      const resolved = new Map((payload.data ?? []).map((item) => [item.iri, item]));

      return OFFER_DEFINITIONS.flatMap((offer) => {
        const match = resolved.get(offer.url);
        if (!match?.trackingLink) return [];
        return [{ ...offer, href: match.trackingLink, imageUrl: match.imageUrl ?? null }];
      });
    } catch (error) {
      console.warn('Takeads resolve request failed', error instanceof Error ? error.message : error);
      return [];
    }
  },
  ['takeads-originfacts-travel-offers-v1'],
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

function addTrackingParameters(href: string, subId: string): string {
  try {
    const url = new URL(href);
    url.searchParams.set('model', 'CPC');
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
      href: addTrackingParameters(offer.href, `originfacts_article_${articleSlug}_${offer.key}`),
    }));
}
