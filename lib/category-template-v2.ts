/**
 * Which /category/[slug] pages render the v2 editorial template
 * (components/category-v2/CategoryPageV2.tsx).
 *
 * v2 is opt-in per category. It ships on Hotels first; every other category
 * keeps the original feed layout in app/category/[slug]/page.tsx untouched.
 *
 * Rolling out: add the category slug to CATEGORY_TEMPLATE_V2_SLUGS, and add a
 * standfirst to CATEGORY_V2_STANDFIRSTS if the Strapi category has no
 * description (without either the hero shows no standfirst). `destinations`
 * is not supported: its listing is built from destination relations, not the
 * category, and the v2 index would count the wrong articles.
 *
 * Rolling back: remove the slug from the set. Nothing else changes: the URL,
 * ?page= pagination, page size, metadata, canonical and JSON-LD are produced by
 * the route for both templates and are identical either way.
 */
export const CATEGORY_TEMPLATE_V2_SLUGS: ReadonlySet<string> = new Set<string>(['hotels']);

export function categoryUsesTemplateV2(slug: string): boolean {
  return CATEGORY_TEMPLATE_V2_SLUGS.has(slug.toLowerCase());
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
};

/** Destination chips are shown only for destinations with at least this many articles. */
export const CATEGORY_V2_MIN_CHIP_COUNT = 2;
export const CATEGORY_V2_MAX_CHIPS = 12;
