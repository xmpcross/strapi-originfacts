/**
 * Which /category/[slug] pages render the v2 editorial template
 * (components/category-v2/CategoryPageV2.tsx).
 *
 * v2 is the default for every category except `destinations`. It shipped on
 * Hotels first and replaced the original feed layout once that page was
 * signed off. The original layout in app/category/[slug]/page.tsx stays in
 * place for rollback and for `destinations`.
 *
 * `destinations` is not supported: its listing is built from destination
 * relations, not the category, and the v2 index would count the wrong
 * articles. The route enforces that exclusion as well.
 *
 * Every v2 category needs a standfirst in CATEGORY_V2_STANDFIRSTS while the
 * Strapi categories carry no description (none do as of 5 Oct 2026); without
 * one the hero shows no standfirst.
 *
 * Rolling back: add a slug to CATEGORY_TEMPLATE_V2_EXCLUDED to send one
 * category back to the original layout, or set CATEGORY_TEMPLATE_V2_DEFAULT
 * to false to revert all of them. Nothing else changes: the URL, ?page=
 * pagination, page size, metadata, canonical and JSON-LD are produced by the
 * route for both templates and are identical either way.
 */
export const CATEGORY_TEMPLATE_V2_DEFAULT = true;

/** Categories that keep the original layout. `destinations` cannot use v2 (see above). */
export const CATEGORY_TEMPLATE_V2_EXCLUDED: ReadonlySet<string> = new Set<string>(['destinations']);

export function categoryUsesTemplateV2(slug: string): boolean {
  return CATEGORY_TEMPLATE_V2_DEFAULT && !CATEGORY_TEMPLATE_V2_EXCLUDED.has(slug.toLowerCase());
}

/**
 * Hero standfirst for v2 pages whose Strapi category has no description. The
 * old fallback (SECTIONS[].description in lib/sections.ts) is deliberately not
 * used: its Hotels copy claims first-hand stays ("hotels we actually slept
 * in"), which the methodology page does not support. Describe only what the
 * category's articles cover.
 */
export const CATEGORY_V2_STANDFIRSTS: Readonly<Record<string, string>> = {
  hotels:
    'Where-to-stay guides and hotel round-ups, organised by destination: airport hotels, budget stays, boutique and family picks, plus advice on booking for less.',
  flights:
    'Guides to booking flights for less: when to book, which airlines fly a route, stopover and layover options, airline comparisons and airport guides, with a focus on Australia and Southeast Asia.',
  'travel-tips':
    'Practical trip planning: packing lists, how many days to spend in a city, entry requirements and where to check them, getting from the airport into town, and when to visit.',
  'car-rentals':
    'Renting a car abroad: airport versus city pickup, when to book, how to avoid hidden fees, and self-drive routes and day trips, with guides for Australia, Japan and Thailand.',
};

/** Destination chips are shown only for destinations with at least this many articles. */
export const CATEGORY_V2_MIN_CHIP_COUNT = 2;
export const CATEGORY_V2_MAX_CHIPS = 12;
