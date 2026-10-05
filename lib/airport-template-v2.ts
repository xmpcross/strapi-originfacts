/**
 * Which airport pages render the v2 template
 * (components/airport-v2/AirportGuideV2.tsx).
 *
 * v2 is the default for every airport page. It shipped on Perth first (#127)
 * and replaced the older layout everywhere once that page was signed off. The
 * older layout in app/airports/[iata]/page.tsx stays in place for rollback.
 *
 * Keys are the canonical airport slug — the last segment of the page's
 * canonical URL (`/airports/perth` → 'perth'), as returned by airportSlug().
 * Codes such as 'per' redirect to that slug before the template is chosen, so
 * list the slug, not the IATA code.
 *
 * v2 prints only what the airport record, the enrichment datasets, the route records and
 * the official links file hold, so a thin-data airport renders "not yet
 * verified" states rather than prose.
 *
 * Rolling back: add a slug to AIRPORT_TEMPLATE_V2_EXCLUDED to send one airport
 * back to the older layout, or set AIRPORT_TEMPLATE_V2_DEFAULT to false to
 * revert every airport at once. Nothing else changes — metadata, robots,
 * canonical and the sitemap are decided by the page route and
 * lib/entity-seo.ts, not by this file.
 */
export const AIRPORT_TEMPLATE_V2_DEFAULT = true;

export const AIRPORT_TEMPLATE_V2_EXCLUDED: ReadonlySet<string> = new Set<string>([]);

export function airportUsesTemplateV2(slug: string): boolean {
  return AIRPORT_TEMPLATE_V2_DEFAULT && !AIRPORT_TEMPLATE_V2_EXCLUDED.has(slug.toLowerCase());
}
