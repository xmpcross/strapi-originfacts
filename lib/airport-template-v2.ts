/**
 * Which airport pages render the v2 template
 * (components/airport-v2/AirportGuideV2.tsx). Every other airport keeps the
 * existing layout in app/airports/[iata]/page.tsx, which stays in place
 * untouched for rollback.
 *
 * Keys are the canonical airport slug — the last segment of the page's
 * canonical URL (`/airports/perth` → 'perth'), as returned by airportSlug().
 * Codes such as 'per' redirect to that slug before the template is chosen, so
 * list the slug, not the IATA code.
 *
 * Rolling out: add the next slug here, then check the page — v2 prints only
 * what the airport record, airport-info, the route records and the official
 * links file hold, so a thin-data airport renders mostly "not yet verified"
 * states rather than prose.
 *
 * Rolling back: remove the slug (or empty the set). Nothing else changes —
 * metadata, robots, canonical and the sitemap are decided by the page route
 * and lib/entity-seo.ts, not by this file.
 */
export const AIRPORT_TEMPLATE_V2_SLUGS: ReadonlySet<string> = new Set<string>(['perth']);

export function airportUsesTemplateV2(slug: string): boolean {
  return AIRPORT_TEMPLATE_V2_SLUGS.has(slug.toLowerCase());
}
