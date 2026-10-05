/**
 * Data rules for the v2 airport page (components/airport-v2/AirportGuideV2.tsx)
 * that are worth testing on their own: which carriers to list, how to frame the
 * route counts, the meta description, and which city photo (if any) to show.
 *
 * Every function here only restates values the page already has. Nothing here
 * adds a fact.
 */
import type { StrapiDestination } from '@/lib/strapi';
import { getCeasedAirline, type CeasedAirline } from '@/lib/airline-status';
import { DESCRIPTION_MAX } from '@/lib/seo';

/* ------------------------------------------------------------------ *
 * Ceased carriers
 * ------------------------------------------------------------------ */

/**
 * Splits the carriers on an airport's route records into those still flying
 * and those with a sourced cessation date (lib/airline-status.ts, Wikidata
 * snapshot — including its hold on very recent dates).
 *
 * The join is on the airline *slug* of the carrier relation on the route
 * record — the Strapi airline entity — never on an IATA code: codes are
 * recycled to new carriers (content/airline-facts/CLAUDE.md, "IATA codes are
 * not entity identifiers").
 *
 * A carrier without a matched cessation record is treated as operating, as
 * everywhere else on the site. That is the absence of a claim, not a claim.
 */
export function splitCeasedAirlines<T extends { slug: string }>(
  airlines: T[],
): { operating: T[]; ceased: (T & { ceased: CeasedAirline })[] } {
  const operating: T[] = [];
  const ceased: (T & { ceased: CeasedAirline })[] = [];
  for (const a of airlines) {
    const entry = getCeasedAirline(a.slug);
    if (entry) ceased.push({ ...a, ceased: entry });
    else operating.push(a);
  }
  return { operating, ceased };
}

/* ------------------------------------------------------------------ *
 * Route-record coverage
 * ------------------------------------------------------------------ */

/**
 * Below this many tracked routes the page uses stronger "small sample"
 * wording. The threshold is about the size of *our* sample only — it implies
 * nothing about how many routes the airport actually has. Route records are
 * partial for every airport; the wording says so at any count.
 */
export const SPARSE_ROUTE_RECORDS = 3;

export type RouteCoverage = {
  /** Routes in Originfacts' route records from this airport (all of them, not just those shown). */
  tracked: number;
  /** Routes shown on the page (the page shows at most a fixed number). */
  shown: number;
  sparse: boolean;
  /** e.g. "1 route tracked so far" */
  headline: string;
  /** e.g. "15 shown here" — null when every tracked route is shown. */
  shownNote: string | null;
  /** One sentence saying the records are partial, stronger when sparse. */
  caveat: string;
};

export function routeCoverage(x: { name: string; code: string; tracked: number; shown: number }): RouteCoverage {
  const tracked = Math.max(x.tracked, x.shown);
  const sparse = tracked <= SPARSE_ROUTE_RECORDS;
  const routes = plural(tracked, 'route');
  return {
    tracked,
    shown: x.shown,
    sparse,
    headline: `${routes} tracked so far`,
    shownNote: x.shown < tracked ? `${x.shown} shown here` : null,
    caveat: sparse
      ? `Only ${routes} from ${x.code} ${tracked === 1 ? 'is' : 'are'} in Originfacts’ route records so far — a small sample, not ${x.name}’s full network.`
      : `Originfacts’ route records cover the routes we track, not ${x.name}’s full network.`,
  };
}

/* ------------------------------------------------------------------ *
 * Meta description
 * ------------------------------------------------------------------ */

/**
 * Meta description (and WebPage JSON-LD description) for v2 airport pages.
 * Built from the same fields the v2 intro shows — codes, location and what the
 * page covers — instead of the unsourced CMS `about` text.
 */
export function airportV2MetaDescription(x: {
  name: string;
  iata: string;
  icao?: string | null;
  city?: string | null;
  country?: string | null;
  hasRoutes: boolean;
}): string {
  const codes = x.icao ? `${x.iata.toUpperCase()}/${x.icao.toUpperCase()}` : x.iata.toUpperCase();
  // "Singapore, Singapore" reads as a typo: name a city-state once.
  const place = [...new Set([x.city, x.country].filter(Boolean).map((v) => v!.trim()))].join(', ');
  const lead = `${x.name} (${codes})${place ? ` in ${place}` : ''}: `;
  // Longest first; the first that fits is used, so long airport names lose
  // the least important clause rather than being cut mid-sentence.
  const options = x.hasRoutes
    ? [
        'codes, location, contact details, airlines and routes we track, and where to check terminals.',
        'codes, location, contact details, and the airlines and routes we track.',
        'codes, location and the airlines and routes we track.',
      ]
    : ['codes, location, contact details, and where to check terminals and transport.', 'codes, location and contact details.'];
  return options.map((o) => lead + o).find((d) => d.length <= DESCRIPTION_MAX) ?? lead + options[options.length - 1];
}

/* ------------------------------------------------------------------ *
 * City photo for the page header
 * ------------------------------------------------------------------ */

/**
 * City destination hero images that were looked at and judged to be real
 * photographs of the place (5 October 2026). The CMS destination and airport
 * hero images otherwise come from one 1024×576 image-generation batch —
 * invented skylines, landmarks in the wrong city — and must not be presented
 * as a picture of a real place.
 *
 * Keyed by destination slug and pinned to the exact upload: if an editor
 * replaces the image, it is not shown until someone looks at the new one.
 * `description` is the CMS alt text for that upload; it describes the city,
 * never the airport.
 */
export const REVIEWED_CITY_PHOTOS: Readonly<Record<string, { url: string; description: string }>> = {
  'chiang-mai': {
    url: '/uploads/city_chiang_mai_hero_5dc7e08f08.webp',
    description: 'Chiang Mai old city temple and skyline at night',
  },
  phuket: {
    url: '/uploads/city_phuket_hero_193863e84e.jpg',
    description: 'Phuket coastal bay and tropical beach panorama',
  },
  pattaya: {
    url: '/uploads/city_pattaya_hero_811652d39d.jpg',
    description: 'Pattaya beach skyline on the Gulf of Thailand',
  },
};

export type AirportCityPhoto = {
  src: string;
  width: number;
  height: number;
  /** What the photo shows — the city. */
  alt: string;
  /** City name, for the caption. */
  city: string;
  /** The destination guide the photo comes from. */
  guideHref: string;
};

export function airportCityPhoto(
  destination: Pick<StrapiDestination, 'slug' | 'name' | 'heroImage'> | null | undefined,
  resolveUrl: (path: string) => string,
): AirportCityPhoto | null {
  if (!destination?.heroImage?.url) return null;
  const reviewed = REVIEWED_CITY_PHOTOS[destination.slug];
  if (!reviewed) return null;
  const path = destination.heroImage.url.replace(/^https?:\/\/[^/]+/i, '');
  if (path !== reviewed.url) return null;
  const { width, height } = destination.heroImage;
  if (!width || !height) return null;
  return {
    src: resolveUrl(destination.heroImage.url),
    width,
    height,
    alt: reviewed.description,
    city: destination.name,
    guideHref: `/destinations/${destination.slug}`,
  };
}

function plural(n: number, word: string): string {
  return `${n} ${n === 1 ? word : `${word}s`}`;
}
