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

/**
 * Cargo-only carriers: freight, express-parcel and postal operators that sell
 * no passenger seats. They are real airlines and keep their pages, but the
 * /airlines directory lists commercial passenger airlines only.
 *
 * The CMS `type` field cannot do this job — every one of the 1,096 records is
 * `Scheduled` or `Low-cost`, DHL and FedEx included — so the list is kept by
 * hand. Reviewed against the Strapi directory on 2026-10-05; the slug is the
 * Strapi slug. Mixed passenger/cargo operators (ASL Airlines France, National
 * Airlines, Air Atlanta Icelandic, North Flying) are deliberately left out.
 */
export const CARGO_AIRLINE_SLUGS: ReadonlySet<string> = new Set([
  // Express parcel and postal integrators
  'abx-air-inc',
  'air-transport-international-llc',
  'ahk-air-hong-kong-limited',
  'china-postal-airlines-ltd',
  'dhl-aero-expreso-sa',
  'dhl-air-limited',
  'dhl-aviation-eemea-bscc',
  'dhl-de-guatemala',
  'empire-airlines',
  'european-cargo-services-bv',
  'fedex',
  'sf-airlines-company-ltd',
  'ups',
  'yto-cargo-airlines',
  // Freight airlines
  'aerotranscargo',
  'air-cargo-carriers-llc',
  'air-cargo-germany',
  'air-incheon',
  'airbridgecargo',
  'amerijet-international-inc',
  'asl-airlines-ireland',
  'asl-airways',
  'atlas-air',
  'bringer-air-cargo',
  'cargojet-airways-ltd',
  'cargolux',
  'central-airlines',
  'challenge-air-cargo-ltd',
  'challenge-airlines-be',
  'challenge-airlines-il',
  'china-cargo-airlines',
  'everts-air-cargo',
  'hong-kong-air-cargo-carrier-limited',
  'kalitta-air',
  'kc-international-airlines',
  'lan-chile-cargo',
  'longtail-aviation',
  'lynden-air-cargo-llc',
  'martinair',
  'mas-de-carga-sa-de-cv-dba-masair',
  'maximus-air',
  'mng-airlines',
  'ningxia-cargo-airlines-coltd',
  'nippon-cargo-airlines',
  'northern-air-cargo',
  'polar-air-cargo-worldwide-inc',
  'quikjet-cargo-airlines-pvt-ltd',
  'raya-airways-sdn-bhddba-raya-airways',
  'silk-way-west-airlines',
  'sky-gates-airlines',
  'sky-lease-i-inc',
  'southern-air',
  'stabo-air-limited',
  'suparna-airlines',
  'swiftair',
  'tampa-cargo',
  'tashkent-air',
  'texel-air-ltd',
  'uls-airlines-cargo',
  'uni-top-airlines',
  'volga-dnepr-airlines',
]);

export function isCargoOnlyAirline(a: { slug: string; type?: string }): boolean {
  return a.type === 'Cargo' || CARGO_AIRLINE_SLUGS.has(a.slug);
}

/**
 * Passenger operators with no scheduled service of their own: ACMI (wet-lease)
 * and charter-only carriers whose seats are sold under another airline's
 * flight number, so a traveller cannot book them directly. Like cargo
 * carriers, they keep their pages but are not listed in the /airlines
 * directory. Reviewed against the Strapi directory on 2026-10-05; the slug is
 * the Strapi slug.
 */
export const NON_SCHEDULED_PASSENGER_SLUGS: ReadonlySet<string> = new Set([
  'luxwing', // Malta: ACMI and charter only
]);

export function isNonScheduledPassengerAirline(a: { slug: string }): boolean {
  return NON_SCHEDULED_PASSENGER_SLUGS.has(a.slug);
}

/**
 * True for carriers the passenger directory leaves out: cargo-only operators
 * and passenger operators with no scheduled service. Use this, not
 * isCargoOnlyAirline, wherever the /airlines count is computed, so /airlines,
 * /countries, the FAQ and the methodology page quote one number.
 */
export function isNonPassengerAirline(a: { slug: string; type?: string }): boolean {
  return isCargoOnlyAirline(a) || isNonScheduledPassengerAirline(a);
}
