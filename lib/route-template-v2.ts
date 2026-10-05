/**
 * Which flight-route pages render the v2 template
 * (components/route-v2/RouteGuideV2.tsx).
 *
 * v2 is the default for every route page. It shipped on Bahrain–Doha first
 * (#169) and replaced the older layout everywhere once that page was signed
 * off. The older layout in app/flight-routes/[slug]/page.tsx stays in place
 * for rollback.
 *
 * v2 is a sibling of the airline and airport v2 pages: header with the two
 * airports and their codes, an "at a glance" strip, a sticky "On this page"
 * nav with a status dot per section, section cards that name their source, an
 * FAQ built only from facts the page shows, and a collapsible sources block.
 *
 * Keys are route slugs as they appear in the URL (`/flight-routes/bah-to-doh`
 * → 'bah-to-doh').
 *
 * v2 prints only what the route record, the airport records and their
 * enrichment files (data/airport-enrichment: OurAirports, Wikidata, NASA
 * POWER), the credible-carrier rule (lib/route-carriers.ts),
 * content/airline-facts official fields, the route's sourced guide
 * (content/route-guides, when there is one) and the live Travelpayouts fare
 * data hold. A route without a guide or fare data renders "not yet verified"
 * states rather than prose.
 *
 * Rolling back: add a slug to ROUTE_TEMPLATE_V2_EXCLUDED to send one route
 * back to the older layout, or set ROUTE_TEMPLATE_V2_DEFAULT to false to
 * revert every route at once. Nothing else changes — metadata, robots,
 * canonical, the sitemap and the WebPage/Breadcrumb JSON-LD are produced by
 * the page route for both templates. The FAQ (and its FAQPage JSON-LD)
 * follows the template, built from the same list either renders.
 */
export const ROUTE_TEMPLATE_V2_DEFAULT = true;

export const ROUTE_TEMPLATE_V2_EXCLUDED: ReadonlySet<string> = new Set<string>([]);

export function routeUsesTemplateV2(slug: string): boolean {
  return ROUTE_TEMPLATE_V2_DEFAULT && !ROUTE_TEMPLATE_V2_EXCLUDED.has(slug.toLowerCase());
}
