/**
 * Which flight-route pages render the v2 template
 * (components/route-v2/RouteGuideV2.tsx).
 *
 * v2 is a sibling of the airline and airport v2 pages: header with the two
 * airports and their codes, an "at a glance" strip, a sticky "On this page"
 * nav with a status dot per section, section cards that name their source, an
 * FAQ built only from facts the page shows, and a sources block. It is piloted
 * on Bahrain–Doha first; every other route keeps the existing layout in
 * app/flight-routes/[slug]/page.tsx, unchanged.
 *
 * Keys are route slugs as they appear in the URL (`/flight-routes/bah-to-doh`
 * → 'bah-to-doh').
 *
 * v2 prints only what the route record, the airport records, the credible
 * carrier rule (lib/route-carriers.ts), content/airline-facts official fields,
 * the route's sourced guide (content/route-guides, when there is one) and the
 * live Travelpayouts fare data hold. A route without a guide or fare data
 * renders "not yet verified" states rather than prose.
 *
 * Rolling out: add a slug here, check the page at 1440 px and 390 px, and ship.
 * When enough routes are signed off, switch to a default-on flag with an
 * exclusion set, as lib/airport-template-v2.ts does.
 *
 * Rolling back: remove the slug (or empty the set). Nothing else changes —
 * metadata, robots, canonical, the sitemap and the WebPage/Breadcrumb JSON-LD
 * are produced by the page route for both templates. The FAQ (and its FAQPage
 * JSON-LD) follows the template, built from the same list either renders.
 */
export const ROUTE_TEMPLATE_V2_SLUGS: ReadonlySet<string> = new Set<string>(['bah-to-doh']);

export function routeUsesTemplateV2(slug: string): boolean {
  return ROUTE_TEMPLATE_V2_SLUGS.has(slug.toLowerCase());
}
