/**
 * Editable copy for the section / listing hubs.
 *
 * One entry per hub route. `name` and `description` feed both the App Router
 * `metadata` export and the CollectionPage JSON-LD; `intro` is the long visible
 * paragraph rendered under the <h1> (via ExpandableDescription, which keeps the
 * collapsed remainder in the DOM for crawlers).
 *
 * Keep each `intro` unique — duplicated boilerplate across hubs is precisely the
 * thin-content pattern these pages are meant to avoid. Editors can change copy
 * here without touching the route components.
 */
export type HubSlug =
  | 'destinations'
  | 'airports'
  | 'airlines'
  | 'flight-routes'
  | 'countries';

export type HubIntro = {
  /** Breadcrumb + CollectionPage name. */
  name: string;
  /** Meta description. Kept under 155 chars so it doesn't truncate in SERPs. */
  description: string;
  /** Long-form visible intro paragraph. */
  intro: string;
};

export const HUB_PATHS: Record<HubSlug, string> = {
  destinations: '/destinations',
  airports: '/airports',
  airlines: '/airlines',
  'flight-routes': '/flight-routes',
  countries: '/countries',
};

export const HUB_INTROS: Record<HubSlug, HubIntro> = {
  destinations: {
    name: 'Destinations',
    description:
      "Every place we've written about — continents, countries, and cities worth your time. Search, filter, and browse.",
    intro:
      "Originfacts indexes global destination guides by linking local cultural histories directly with active airport infrastructure, carrier options, and seasonal fare trends. Our comprehensive directory allows travelers to evaluate cities, countries, and regional hubs using empirical flight data, ensuring you choose optimal travel windows and efficient route combinations before booking your itinerary.",
  },
  airports: {
    name: 'Airports',
    description:
      'A searchable directory of commercial airports worldwide — IATA codes, cities, hubs, and route information.',
    intro:
      "Commercial airports define global travel efficiency through strategic hub locations, runway capacities, and multi-carrier connections. Our searchable directory provides verified IATA codes, ICAO identifiers, geographic coordinates, and regional airline networks across thousands of airfields, helping travelers decode layovers, organize self-connect itineraries, and compare metro airport alternatives before purchasing tickets.",
  },
  airlines: {
    name: 'Airlines',
    description:
      'A searchable directory of airlines worldwide — IATA codes, hubs, and details for scheduled, low-cost, and regional carriers.',
    intro:
      "Airline operations and fare inclusions vary significantly across flag carriers, low-cost operators, and regional flight providers. This directory indexes active global airlines with validated IATA/ICAO codes, registration countries, and hub airports, enabling travelers to verify baggage allowances, onboard services, and fleet types prior to booking flight reservations.",
  },
  'flight-routes': {
    name: 'Flight Routes',
    description:
      'Every route we track — searchable by origin, destination, IATA code, or country. Carriers, flight time, and booking.',
    intro:
      "Direct flight routes determine travel duration, connection efficiency, and ticket pricing between global city pairs. Our flight route index analyzes operating carriers, block flight times, non-stop options, and distance metrics, empowering travelers to identify competitive airline routes and select seamless flight schedules across international and domestic networks.",
  },
  countries: {
    name: 'Countries',
    description:
      'Browse countries with commercial air service — ISO codes, airport counts, cities, and regional groupings.',
    intro:
      "Country-level travel planning relies on understanding international entry gateways, domestic airport distribution, and registered regional carriers. This comprehensive directory organizes global nations by ISO codes, active commercial airports, primary flight routes, and local travel guides, helping travelers plan multi-destination trips and assess country-wide transportation networks efficiently.",
  },
};
