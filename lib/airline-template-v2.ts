/**
 * Which airline pages render the v2 reference template
 * (components/airline-v2/AirlineGuideV2.tsx).
 *
 * v2 is the default for every airline page, Tier 1 to Tier 3. It shipped on
 * Qantas first (#121) and replaced the older templates everywhere once that
 * page was signed off.
 *
 * Rolling back: add a slug to AIRLINE_TEMPLATE_V2_EXCLUDED to send one carrier
 * back to the template it had before (AirlineTier1 for Tier 1/2, the legacy
 * layout for Tier 3), or set AIRLINE_TEMPLATE_V2_DEFAULT to false to revert
 * every page at once. Those templates are kept in place for exactly that.
 *
 * Indexing and the sitemap are governed by PUBLISHED_AIRLINE_GUIDES and the
 * tier rules in lib/airline-tier.ts, not by this file.
 */
export const AIRLINE_TEMPLATE_V2_DEFAULT = true;

export const AIRLINE_TEMPLATE_V2_EXCLUDED: ReadonlySet<string> = new Set<string>([]);

export function airlineUsesTemplateV2(slug: string): boolean {
  return AIRLINE_TEMPLATE_V2_DEFAULT && !AIRLINE_TEMPLATE_V2_EXCLUDED.has(slug);
}
