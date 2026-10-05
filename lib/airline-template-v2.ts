/**
 * Which airline pages render the v2 reference template
 * (components/airline-v2/AirlineGuideV2.tsx).
 *
 * The redesign ships one carrier at a time. Every slug not listed here keeps
 * the existing AirlineTier1 template with exactly the props it had before, so
 * rolling the redesign back is deleting a slug from this set.
 *
 * Adding a carrier: add its slug, then check the page at desktop and phone
 * widths — especially how its pending, disputed and partly verified sections
 * read — before merging. The v2 template only applies to pages that already
 * take the Tier 1/2 branch in app/airlines/[slug]/page.tsx; listing a Tier 3
 * slug here does nothing. Indexing and the sitemap are still governed by
 * PUBLISHED_AIRLINE_GUIDES in lib/airline-tier.ts, not by this list.
 */
export const AIRLINE_TEMPLATE_V2_SLUGS: ReadonlySet<string> = new Set(['qantas']);

export function airlineUsesTemplateV2(slug: string): boolean {
  return AIRLINE_TEMPLATE_V2_SLUGS.has(slug);
}
