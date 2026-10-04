/**
 * Slugs in the Strapi airline collection that are not airlines.
 *
 * Kept free of Node imports: lib/strapi.ts applies this list and is bundled
 * into client components (for mediaUrl), so anything it imports must be
 * browser-safe. The rest of the operating-status logic — which reads a JSON
 * snapshot from disk — lives in lib/airline-status.ts.
 */

/**
 * Organisations that hold an IATA two-letter designator but do not operate
 * flights. Each was published as an airline page. Reviewed by hand against
 * the Strapi directory on 2026-09-10; the slug is the Strapi slug.
 */
export const NON_AIRLINE_SLUGS: ReadonlySet<string> = new Set([
  // Railways and ground transport
  'accesrail',
  'alsa-grupo-slu',
  'amtrak',
  'deutsche-bahn-ag',
  'eurostar',
  'iryo',
  'sapsan',
  'sncf',
  'trenitalia',
  // Ferry operators
  'chu-kong-passenger-transport-co-ltd',
  'shun-tak-china-travel-ship',
  // GDS, ticketing and airline IT vendors
  'amadeus-it-group-sa',
  'electronic-data-systems-corporation',
  'galileo-international',
  'hahn-air-technologies',
  'infini-travel-information-inc',
  'ita-software-inc',
  'jsc-sirena-travel',
  'jsc-transport-automated-informationsystems-tais',
  'lufthansa-systems',
  'navitaire',
  'radixx-solutions-international-inc',
  'sabre-inc',
  'tik-systems',
  'travel-technology-interactive-sa',
  'travelsky-technology-limited',
  'videcom-international-limited',
  'world-ticket-ltd',
  'worldspan',
  // Telecoms, data and trade bodies
  'arincaeronautical-radio-inc',
  'air-transport-association-of-americadba-airlines-for-america',
  'iata-clearing-houseinternational-air-transport-association',
  'sita-airlines-worldwidetelecommunications-and-information-sv',
  'ubm-aviation-oag',
  // Military
  'air-mobility-command',
  'department-of-national-defence',
  'french-armed-forces',
  // A power utility
  'hydro-quebec',
]);

export function isNonAirline(slug: string): boolean {
  return NON_AIRLINE_SLUGS.has(slug);
}
