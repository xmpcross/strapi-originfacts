/**
 * How much page an airline earns, and whether it is indexed at all.
 *
 * This replaces `airlineIsSubstantive()`, which gated on the presence of the
 * CMS `about` field. That test stopped discriminating the moment the enrichment
 * pass wrote an `about` onto 1,019 of the 1,096 airlines: every page satisfied
 * the gate at once and the directory began admitting itself to the sitemap —
 * GDS vendors and carriers that have not flown in years included. A gate that
 * generated text can open is not a gate.
 *
 * Tiering keys off data the page can point at instead:
 *   - route-network facts derived from TravelPayouts (data/route-facts/all.json)
 *   - the ingested review store (content/airline-reviews/)
 *   - routes tracked in Strapi, which the page renders as real route cards
 *
 * None of those can be satisfied by writing prose, which is the property the
 * old gate lost.
 *
 * Tier 3 pages stay live and stay linked — /airlines lists every carrier — they
 * just carry `noindex, follow` and stay out of the sitemap.
 */
import type { StrapiAirline } from '@/lib/strapi';
import { getRouteFacts } from '@/lib/route-facts';
import { hasAirlineReviews } from '@/lib/airline-reviews';

/** 1 = full treatment, 2 = data modules only, 3 = directory row only. */
export type AirlineTier = 1 | 2 | 3;

/** Destinations a carrier must serve to earn the full Tier 1 treatment. */
export const TIER1_MIN_DESTINATIONS = 80;

/**
 * A smaller network still earns Tier 1 when the carrier also has ingested
 * reviews — that pairing gives the page first-party material no template can
 * produce.
 */
export const TIER1_REVIEWED_MIN_DESTINATIONS = 40;

/** Below this a carrier has too little network to describe. Tunable knob. */
export const TIER2_MIN_DESTINATIONS = 5;

/**
 * Airline guides that have passed the sourced-content publication gate.
 *
 * The directory-wide AIRLINES_INDEXABLE switch remains off while the rebuild
 * continues. This allowlist lets reviewed guides use the Tier 1 template,
 * become indexable, and enter the sitemap without exposing hundreds of thin
 * directory entries at the same time.
 *
 * The list had drifted to all 436 carriers in the facts store, which made the
 * gate a no-op: every airline was published, so AIRLINES_INDEXABLE=false held
 * nothing back and the whole directory entered the sitemap. Measured against
 * the live site, sibling airline pages shared 70.6% of their six-grams and one
 * 1,619-word page differed from another carrier's by twelve word types — the
 * scaled-content shape AdSense rejected the site for.
 *
 * The bar to be on this list: at least one fact field carrying
 * `verified_by: manual_official_source` or `manual_review`. That is 8 carriers.
 * The remaining 428 keep Tier 3 — live, linked from /airlines, `noindex,
 * follow`, out of the sitemap — until a carrier is actually verified.
 *
 * Ingested reviews deliberately do NOT qualify a carrier: REVIEWS_MODULE_ENABLED
 * is false, so that store renders nothing (see components/airline-tier1).
 */
export const PUBLISHED_AIRLINE_GUIDES = new Set([
  'aeroflot',
  'alaska-airlines',
  'emirates',
  'jetblue',
  'qantas',
  'qatar-airways',
  'ryanair',
  'singapore-airlines',
]);

export function airlineGuideIsPublished(slug: string): boolean {
  return PUBLISHED_AIRLINE_GUIDES.has(slug);
}

export type AirlineTierInput = Pick<StrapiAirline, 'slug' | 'iataCode'>;

/**
 * `hasTrackedRoutes` is supplied by the caller, matching the old gate: the page
 * passes `routes.length > 0`, the sitemap passes route-coverage set membership
 * (see fetchRouteCoverage).
 */
export function airlineTier(a: AirlineTierInput, hasTrackedRoutes: boolean): AirlineTier {
  const destinations = getRouteFacts(a.iataCode)?.destinationCount ?? 0;

  if (destinations >= TIER1_MIN_DESTINATIONS) return 1;
  if (destinations >= TIER1_REVIEWED_MIN_DESTINATIONS && hasAirlineReviews(a.slug)) return 1;
  if (destinations >= TIER2_MIN_DESTINATIONS || hasTrackedRoutes) return 2;
  return 3;
}

/**
 * Indexable, and eligible for the sitemap.
 *
 * Reviews alone deliberately do NOT lift a carrier out of Tier 3. 75 carriers
 * have ingested reviews but no route data at all, and reviews outlive
 * operations — several of those look like airlines that stopped flying after
 * the reviews were written. They stay out of the index until an operating
 * status is recorded against them rather than inferred here.
 */
export function airlineIsIndexable(a: AirlineTierInput, hasTrackedRoutes: boolean): boolean {
  return airlineTier(a, hasTrackedRoutes) < 3;
}
