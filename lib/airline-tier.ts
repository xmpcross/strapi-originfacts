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
import { airlineHasCeased } from '@/lib/airline-status';
import { isNonPassengerAirline } from '@/lib/airline-exclusions';

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
 * The bar to be on this list: at least PUBLISHED_AIRLINE_MIN_MANUAL_FACTS fact
 * fields carrying `verified_by: manual_official_source` or `manual_review`, a
 * facts file, and no sourced cessation. tests/airline-published.test.ts fails
 * if a listed carrier does not meet it, so the list cannot silently drift to
 * the whole store again (the ops/autogen-*.mjs scripts rewrite this Set).
 * Every other carrier keeps Tier 3 — live, linked from /airlines, `noindex,
 * follow`, out of the sitemap — until it is actually verified.
 *
 * Batches: the first 8 carriers (from the original bar of one manual field);
 * batch 1, 5 Oct 2026: 8 more with 10+ manual facts, each with its facts
 * re-read against the carrier's own pages (figures all found; see the PR).
 *
 * Ingested reviews deliberately do NOT qualify a carrier: REVIEWS_MODULE_ENABLED
 * is false, so that store renders nothing (see components/airline-tier1).
 */
/** Manually verified facts a carrier needs before it can be listed below. */
export const PUBLISHED_AIRLINE_MIN_MANUAL_FACTS = 8;

export const PUBLISHED_AIRLINE_GUIDES = new Set([
  'aeroflot',
  'alaska-airlines',
  'emirates',
  'jetblue',
  'qantas',
  'qatar-airways',
  'ryanair',
  'singapore-airlines',
  // Batch 1 (5 Oct 2026)
  'air-canada',
  'air-corsica',
  'airnorth',
  'american-airlines',
  'frontier-airlines',
  'rex-regional-express',
  'srilankan-airlines',
  'westjet',
  // Batch 2 (6 Oct 2026)
  'all-nippon-airways',
  'british-airways',
  'cathay-pacific',
  'delta-air-lines',
  'japan-airlines',
  'klm-royal-dutch-airlines',
  'lufthansa',
  'united-airlines',
  // Batch 3 (6 Oct 2026)
  'air-france',
  'air-new-zealand',
  'etihad-airways',
  'eva-air',
  'finnair',
  'iberia',
  'korean-air',
  'latam-airlines',
  'turkish-airlines',
  'virgin-atlantic',
  // Batch 4 (6 Oct 2026)
  'air-india',
  'austrian-airlines',
  'oman-air',
  'royal-jordanian',
  'sas-scandinavian',
  'saudia',
  'swiss',
  'tap-air-portugal',
  'thai-airways',
  'vietnam-airlines',
  // Batch 5 (6 Oct 2026)
  'aeromexico',
  'air-europa',
  'airbaltic',
  'asiana-airlines',
  'copa-airlines',
  'egyptair',
  'ethiopian-airlines',
  'hawaiian-airlines',
  'icelandair',
  'lot-polish',
  // Batch 6 (6 Oct 2026)
  'aerolineas-argentinas',
  'air-astana',
  'air-mauritius',
  'breeze-airways',
  'fiji-airways',
  'flydubai',
  'hainan-airlines',
  'kuwait-airways',
  'royal-air-maroc',
  'volaris',
  // Batch 7 (6 Oct 2026)
  'air-india-express',
  'air-niugini',
  'air-seychelles',
  'air-tahiti-nui',
  'cayman-airways',
  'china-eastern',
  'china-southern-airlines',
  'indigo',
  'jetstar',
  'starlux-airlines',
  // Batch 8 (6 Oct 2026)
  'allegiant-air',
  'bamboo-airways',
  'condor',
  'sky-airline',
  'sunexpress',
  'transavia',
  'tway-air',
  'viva-aerobus',
  'vueling',
  'wizz-air',
  // Batch 9 (6 Oct 2026)
  'aegean-airlines',
  'aer-lingus',
  'air-arabia',
  'air-austral',
  'air-busan',
  'air-china',
  'air-cote-divoire',
  'air-greenland',
  'air-transat',
  'scoot',
  // Batch 10 (6 Oct 2026)
  'air-do',
  'air-macau',
  'air-serbia',
  'airasia',
  'batik-air',
  'cebu-pacific',
  'garuda-indonesia',
  'jeju-air',
  'philippine-airlines',
  'xiamen-airlines',
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
 *
 * A carrier with a sourced cessation date (lib/airline-status.ts) is never
 * indexable, whatever its tier: route data outlives an airline too, and a
 * "book Jet Airways" page in the index is exactly what the audit flagged.
 */
export function airlineIsIndexable(a: AirlineTierInput, hasTrackedRoutes: boolean): boolean {
  if (airlineHasCeased(a.slug)) return false;
  if (isNonPassengerAirline(a)) return false;
  return airlineTier(a, hasTrackedRoutes) < 3;
}
