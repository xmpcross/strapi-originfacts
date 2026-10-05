/**
 * FAQ for the v2 airport page. Every answer restates a value the page itself
 * shows — the airport record, the airport-info contact fields, the official
 * link and the route records — and names where it came from. No rule-of-thumb
 * fillers (arrival times, "refreshed regularly", a flight search the page does
 * not have): if a field is missing its question is skipped.
 *
 * The page renders this list and marks up the same list as FAQPage.
 */
import { routeCoverage } from '@/lib/airport-v2';

export type AirportV2FaqInput = {
  name: string;
  iata: string;
  icao?: string | null;
  city?: string | null;
  country?: string | null;
  timezone?: string | null;
  coordinates?: string | null;
  address?: string | null;
  phone?: string | null;
  officialSite?: string | null;
  /** Carrier names on the routes shown, in display order — ceased carriers already removed. */
  airlines: string[];
  /** Carriers on the route records that Wikidata records as ceased (left out of `airlines`). */
  ceasedAirlines?: string[];
  /** All route records from this airport, and how many of them the page shows. */
  routeCount?: { tracked: number; shown: number };
  /** Destination names on the routes shown, in display order. */
  destinations: string[];
  countryCount: number;
  /** Formatted date of the newest route record shown, e.g. "21 May 2026". */
  routeVintage?: string | null;
};

export type Faq = { q: string; a: string };

export function airportGuideV2Faqs(x: AirportV2FaqInput): Faq[] {
  const faqs: Faq[] = [];
  const place = [x.city, x.country].filter(Boolean).join(', ');
  const routesFrom = `Originfacts’ route records${x.routeVintage ? ` (last updated ${x.routeVintage})` : ''}`;

  if (place) {
    faqs.push({
      q: `Where is ${x.name}?`,
      a: `${x.name} serves ${place}.${x.coordinates ? ` Its coordinates in the Originfacts airport record are ${x.coordinates}.` : ''}`,
    });
  }

  faqs.push({
    q: `What are the airport codes for ${x.name}?`,
    a: `The IATA code is ${x.iata}${x.icao ? ` and the ICAO code is ${x.icao}` : ''}.`,
  });

  if (x.timezone) {
    faqs.push({ q: `What time zone is ${x.iata} in?`, a: `${x.name} is in the ${x.timezone} time zone.` });
  }

  const contact: string[] = [];
  if (x.address) contact.push(`the address as ${x.address}`);
  if (x.phone) contact.push(`the phone number as ${x.phone}`);
  if (contact.length || x.officialSite) {
    faqs.push({
      q: `How do I contact ${x.name}?`,
      a: [
        contact.length ? `The airport-info dataset lists ${contact.join(' and ')}.` : '',
        x.officialSite ? `The airport’s official website is ${displayUrl(x.officialSite)}.` : '',
        'For questions about a booking, contact the operating airline.',
      ]
        .filter(Boolean)
        .join(' '),
    });
  }

  const officialRef = x.officialSite ? `the airport’s official website (${displayUrl(x.officialSite)})` : 'the airport';
  const ceasedNote = x.ceasedAirlines?.length
    ? ` ${listProse(x.ceasedAirlines)} ${x.ceasedAirlines.length === 1 ? 'is' : 'are'} left out: Wikidata records ${
        x.ceasedAirlines.length === 1 ? 'it' : 'them'
      } as having ceased operations.`
    : '';

  if (x.airlines.length) {
    faqs.push({
      q: `Which airlines are listed on routes from ${x.iata}?`,
      a: `${routesFrom} list ${listProse(x.airlines)} on routes from ${x.iata}.${ceasedNote} This is not a complete list of airlines at ${x.name}; check current schedules with the airline.`,
    });
  }

  if (x.destinations.length) {
    const n = x.destinations.length;
    const shown = x.routeCount?.shown ?? n;
    const cov = routeCoverage({ name: x.name, code: x.iata, tracked: x.routeCount?.tracked ?? shown, shown });
    const dest = `${n} ${n === 1 ? 'destination' : 'destinations'}${x.countryCount > 1 ? ` in ${x.countryCount} countries` : ''}`;
    const lead = cov.sparse
      ? `${routesFrom} include only ${cov.tracked === 1 ? 'one route' : `${cov.tracked} routes`} from ${x.iata} so far, to ${listProse(x.destinations)}. That is a small sample, not ${x.name}’s full network.`
      : cov.shownNote
        ? `${routesFrom} include ${cov.tracked} routes from ${x.iata} so far; the ${shown} shown on this page go to ${dest}: ${listProse(x.destinations)}. These are the routes Originfacts tracks, not ${x.name}’s full network.`
        : `${routesFrom} include ${cov.tracked} routes from ${x.iata} so far, to ${dest}: ${listProse(x.destinations)}. These are the routes Originfacts tracks, not ${x.name}’s full network.`;
    faqs.push({
      q: `Where can you fly from ${x.iata}?`,
      a: `${lead} For the full list of destinations, check ${officialRef} or the airlines.`,
    });
  }

  return faqs;
}

function listProse(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}
