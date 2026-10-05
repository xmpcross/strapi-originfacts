/**
 * Data helpers for the v2 route page (components/route-v2/RouteGuideV2.tsx).
 *
 * Nothing here invents a value. Each helper rearranges what a source already
 * holds and says what that source is:
 *   - airline highlights come only from `official` fields of published modules
 *     in content/airline-facts (via the airline v2 glance rules), with the page
 *     each was read from and the date it was checked;
 *   - the time difference comes from the two airports' IANA time zones;
 *   - the distance is the route record's, checked against the great-circle
 *     distance between the two airports' coordinates;
 *   - the FAQ for routes without a sourced guide restates only the figures the
 *     page shows;
 *   - airport facts (size class, runways, opened, operator, passengers) and
 *     the destination's monthly climate come from the free, open snapshots in
 *     data/airport-enrichment (OurAirports, Wikidata, NASA POWER) via
 *     lib/airport-enrichment.ts, each with its source and retrieval date.
 *
 * Server-only: reads the fact files from disk.
 */
import { getAirlineFacts, resolveModule, type FactField } from '@/lib/airline-facts';
import { formatUtcOffset, greatCircleKm, utcOffsetMinutes } from '@/lib/route-geo';
import type { Faq } from '@/lib/entity-seo';
import type { RouteGuide } from '@/lib/route-guide';
import {
  ENRICHMENT_SOURCES,
  MONTH_SHORT,
  airportTypeLabel,
  climatePeriod,
  formatOpened,
  formatPassengers,
  getAirportEnrichment,
  metres,
} from '@/lib/airport-enrichment';

/* ------------------------------------------------------------------ *
 * Airline highlights
 * ------------------------------------------------------------------ */

export type HighlightValue = { qualifier?: string; value: string; sourceUrl: string; verifiedAt: string };
export type AirlineHighlight = { id: string; title: string; values: HighlightValue[] };

type HighlightEntry = { keys: string[]; qualifier?: string };

/**
 * The airline v2 glance tiles a traveller on this route needs before flying —
 * same modules, keys, qualifiers and fallbacks as GLANCE_TILES in
 * components/airline-v2/facts-view.ts. Kept here rather than imported because
 * facts-view pulls the Tier 1 component and its CSS module into every route
 * page's bundle. Keep the two in step.
 */
const HIGHLIGHT_TILES: { id: string; title: string; module: string; alternatives: HighlightEntry[][] }[] = [
  { id: 'carryon-size', title: 'Cabin bag size', module: 'carryon', alternatives: [[{ keys: ['carryon_bag_dimensions', 'dimensions_combined'] }]] },
  {
    id: 'carryon-weight',
    title: 'Cabin bag weight',
    module: 'carryon',
    alternatives: [
      [
        { keys: ['weight_economy'], qualifier: 'Economy' },
        { keys: ['weight_business_first'], qualifier: 'Business & First' },
        { keys: ['weight_business'], qualifier: 'Business' },
      ],
      [{ keys: ['carryon_weight'] }],
    ],
  },
  {
    id: 'checked',
    title: 'Checked bag',
    module: 'baggage',
    alternatives: [
      [{ keys: ['piece_weight_economy'], qualifier: 'Economy' }],
      [{ keys: ['allowance_by_cabin', 'allowance', 'free_allowance', 'included'] }],
    ],
  },
  {
    id: 'online-checkin',
    title: 'Online check-in',
    module: 'checkin',
    alternatives: [[{ keys: ['online_checkin_opens', 'online_checkin', 'online_checkin_window'] }]],
  },
];

/** Same cap as the airline glance: a longer rule belongs on the airline page, never truncated. */
const HIGHLIGHT_MAX_CHARS = 140;

/**
 * Check-in fields some fact files split by market (Qatar Airways: flights to or
 * from the US, and all other flights). Only the one that applies to the route
 * is shown, under the label that says which it is.
 */
const MARKET_CHECKIN = {
  us: { key: 'us_online_checkin', qualifier: 'Flights to or from the US' },
  other: { key: 'other_online_checkin', qualifier: 'Flights not to or from the US' },
} as const;

/**
 * Per tile, the official values from the airline's fact file — or an empty
 * `values` list, which the page renders as "not yet verified". A field counts
 * only when its module published (every required field official) and the
 * field itself is official with a source page and date. `usRoute` picks the
 * market-specific check-in rule where a fact file splits it.
 */
export function airlineHighlights(slug: string, opts: { usRoute?: boolean } = {}): AirlineHighlight[] {
  const facts = getAirlineFacts(slug);
  const modules = new Map((facts?.modules ?? []).map((m) => [m.id, { published: resolveModule(m).isPublished, fields: m.fields ?? {} }]));
  const field = (moduleId: string, key: string): FactField | null => {
    const m = modules.get(moduleId);
    const f = m?.published ? m.fields[key] : undefined;
    return f?.status === 'official' && f.value && f.source_url && f.verified_at && f.value.length <= HIGHLIGHT_MAX_CHARS ? f : null;
  };
  return HIGHLIGHT_TILES.map((tile) => {
    let hits: { qualifier?: string; f: FactField }[] = [];
    for (const alt of tile.alternatives) {
      hits = [];
      for (const entry of alt) {
        for (const key of entry.keys) {
          const f = field(tile.module, key);
          if (f) {
            hits.push({ qualifier: entry.qualifier, f });
            break;
          }
        }
      }
      if (hits.length) break;
    }
    if (tile.id === 'online-checkin' && hits.length === 0) {
      const market = MARKET_CHECKIN[opts.usRoute ? 'us' : 'other'];
      const f = field(tile.module, market.key);
      if (f) hits.push({ qualifier: market.qualifier, f });
    }
    return {
      id: tile.id,
      title: tile.title,
      values: hits.map(({ qualifier, f }) => ({
        qualifier,
        value: f.value as string,
        sourceUrl: f.source_url as string,
        verifiedAt: f.verified_at as string,
      })),
    };
  });
}

/* ------------------------------------------------------------------ *
 * Time zones and distance
 * ------------------------------------------------------------------ */

export type ZoneInfo = { zone: string; offsetMinutes: number; label: string };

export function zoneInfo(timeZone?: string | null, at: Date = new Date()): ZoneInfo | null {
  const offset = utcOffsetMinutes(timeZone, at);
  if (!timeZone || offset === null) return null;
  return { zone: timeZone, offsetMinutes: offset, label: formatUtcOffset(offset) };
}

export type TimeDifference = { minutes: number; text: string };

/** "None", "+1h", "−5h 30m" — destination relative to origin. */
export function timeDifference(from: ZoneInfo | null, to: ZoneInfo | null): TimeDifference | null {
  if (!from || !to) return null;
  const minutes = to.offsetMinutes - from.offsetMinutes;
  if (minutes === 0) return { minutes, text: 'None' };
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return { minutes, text: `${minutes > 0 ? '+' : '−'}${h}h${m ? ` ${m}m` : ''}` };
}

type Coords = { latitude?: number | null; longitude?: number | null };

/**
 * Great-circle km between the two airports when both have coordinates, and
 * whether the route record's distance agrees with it (within 3%).
 */
export function distanceCheck(recordKm: number | null | undefined, a: Coords, b: Coords): { computedKm: number | null; agrees: boolean } {
  if (typeof a.latitude !== 'number' || typeof a.longitude !== 'number' || typeof b.latitude !== 'number' || typeof b.longitude !== 'number') {
    return { computedKm: null, agrees: false };
  }
  const computedKm = Math.round(greatCircleKm(a.latitude, a.longitude, b.latitude, b.longitude));
  const agrees = typeof recordKm === 'number' && recordKm > 0 && Math.abs(computedKm - recordKm) / recordKm <= 0.03;
  return { computedKm, agrees };
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/* ------------------------------------------------------------------ *
 * FAQ for routes without a sourced guide
 * ------------------------------------------------------------------ */

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Questions answered only from the figures the v2 page shows for a route with
 * no content/route-guides file: the credible carriers in the route record, the
 * record's distance and flight-time estimate, and the computed time difference.
 * A question whose figure is missing is left out rather than answered vaguely.
 */
export function routeV2Faqs(x: {
  fromName: string;
  toName: string;
  originIata: string;
  destinationIata: string;
  originAirport: string;
  destinationAirport: string;
  carriers: string[];
  distanceKm: number | null;
  distanceIsGreatCircle: boolean;
  estimateMinutes: number | null;
  from: ZoneInfo | null;
  to: ZoneInfo | null;
}): Faq[] {
  const faqs: Faq[] = [];
  const route = `${x.fromName} (${x.originIata}) to ${x.toName} (${x.destinationIata})`;
  if (x.carriers.length > 0) {
    faqs.push({
      q: `Which airlines fly from ${x.fromName} to ${x.toName}?`,
      a: `Originfacts’ route record for ${x.originIata}–${x.destinationIata} lists ${joinNames(x.carriers)}. It is not a full schedule; check current flights with the airline before booking.`,
    });
  }
  if (x.distanceKm) {
    faqs.push({
      q: `How far is ${x.fromName} from ${x.toName} by air?`,
      a: `About ${Math.round(x.distanceKm).toLocaleString('en-US')} km${x.distanceIsGreatCircle ? `, the great-circle distance between ${x.originAirport} and ${x.destinationAirport}` : ` between ${x.originAirport} and ${x.destinationAirport}, per the Originfacts route record`}.`,
    });
  }
  if (x.estimateMinutes) {
    faqs.push({
      q: `How long is the flight from ${route}?`,
      a: `The Originfacts route record estimates about ${formatMinutes(x.estimateMinutes)} nonstop. It is an estimate, not a timetable: the airline’s schedule gives the actual flight time.`,
    });
  }
  const diff = timeDifference(x.from, x.to);
  if (diff && x.from && x.to) {
    faqs.push({
      q: `Is there a time difference between ${x.fromName} and ${x.toName}?`,
      a:
        diff.minutes === 0
          ? `No. Both airports are on ${x.from.label} today (time zones ${x.from.zone} and ${x.to.zone}).`
          : `${x.toName} is ${diff.text.replace(/^[+−]/, '')} ${diff.minutes > 0 ? 'ahead of' : 'behind'} ${x.fromName} today (${x.to.label} in ${x.to.zone} vs ${x.from.label} in ${x.from.zone}).`,
    });
  }
  return faqs;
}

/* ------------------------------------------------------------------ *
 * Citation numbering
 * ------------------------------------------------------------------ */

/**
 * Sources numbered in the order the v2 page first cites them: intro, the
 * airline list, the airports section, getting there, the other guide sections
 * in file order, then the FAQ. Same idea as citationOrder() in
 * lib/route-guide.ts, which follows the original template's order.
 */
export function routeV2CitationOrder(guide: RouteGuide): Map<string, number> {
  const order = new Map<string, number>();
  const visit = (ids: string[]) => ids.forEach((id) => order.has(id) || order.set(id, order.size + 1));
  const section = (id: string) => guide.sections.find((s) => s.id === id);
  visit(guide.intro.sources);
  guide.operating_airlines.forEach((a) => visit(a.sources));
  for (const id of ['airports', 'getting-there']) section(id)?.paragraphs.forEach((p) => visit(p.sources));
  guide.sections
    .filter((s) => s.id !== 'airports' && s.id !== 'getting-there')
    .forEach((s) => s.paragraphs.forEach((p) => visit(p.sources)));
  guide.faqs.forEach((f) => visit(f.sources));
  return order;
}

/* ------------------------------------------------------------------ *
 * Airport enrichment: key facts and destination climate
 * ------------------------------------------------------------------ */

export type RouteAirportFacts = {
  /** OurAirports' own size class ("Large airport"), not an official category. */
  typeLabel: string | null;
  runwayCount: number;
  longestRunway: { ident: string | null; metres: number; ft: number; surface: string | null } | null;
  /** Wikidata date of official opening (P1619), or inception (P571) labelled as such. */
  opened: { text: string; official: boolean } | null;
  operators: string[];
  passengers: { text: string; year: number; refUrl: string | null } | null;
  /** Wikidata item, for the source link. */
  qid: string | null;
  /** Retrieval dates of the snapshots the values came from (YYYY-MM-DD). */
  ourairportsRetrieved: string | null;
  wikidataRetrieved: string | null;
};

/** Key facts for one end of the route, or null when neither snapshot has the airport. */
export function routeAirportFacts(iata: string): RouteAirportFacts | null {
  const e = getAirportEnrichment(iata);
  const runways = e.oa?.runways ?? [];
  const r = runways[0]; // the snapshot lists open runways longest first
  const facts: RouteAirportFacts = {
    typeLabel: airportTypeLabel(e.oa?.type),
    runwayCount: runways.length,
    longestRunway: r ? { ident: r.ident, metres: metres(r.lengthFt), ft: r.lengthFt, surface: r.surface } : null,
    opened: e.wd?.opened ? { text: formatOpened(e.wd.opened), official: e.wd.opened.prop === 'P1619' } : null,
    operators: (e.wd?.operators ?? []).map((o) => o.label).filter(Boolean),
    passengers: e.wd?.patronage
      ? { text: formatPassengers(e.wd.patronage.value), year: e.wd.patronage.year, refUrl: e.wd.patronage.refUrl }
      : null,
    qid: e.wd?.qid ?? null,
    ourairportsRetrieved: e.oa ? ENRICHMENT_SOURCES.ourairports?.retrieved ?? null : null,
    wikidataRetrieved: e.wd ? ENRICHMENT_SOURCES.wikidata?.retrieved ?? null : null,
  };
  const any = facts.typeLabel || facts.runwayCount || facts.opened || facts.operators.length || facts.passengers;
  return any ? facts : null;
}

export type RouteClimate = {
  /** "2016–2025" */
  period: string;
  lat: number;
  lon: number;
  retrieved: string | null;
  months: { month: string; hi: number; lo: number; mm: number | null }[];
  /** Index (0–11) of the month to call out: the current month when the page was rendered. */
  current: number;
};

/** The destination's NASA POWER monthly normals (modelled), or null when the snapshot lacks the airport. */
export function routeClimate(iata: string, at: Date = new Date()): RouteClimate | null {
  const c = getAirportEnrichment(iata).climate;
  if (!c || c.months.length !== 12) return null;
  return {
    period: climatePeriod(c),
    lat: c.lat,
    lon: c.lon,
    retrieved: ENRICHMENT_SOURCES.climate?.retrieved ?? null,
    months: c.months.map(([hi, lo, mm], i) => ({ month: MONTH_SHORT[i], hi, lo, mm })),
    current: at.getUTCMonth(),
  };
}

/**
 * FAQ answer for the cheapest month in the fare data. It names the month and
 * flight but no price: the page prints prices in the visitor's header currency
 * on the client, and the FAQ (and its FAQPage JSON-LD) is static HTML.
 */
export function cheapestMonthAnswer(x: { monthLabel: string; fetched: string; flight: string }): string {
  return `In fares found in recent Aviasales searches (fetched ${x.fetched}), the lowest one-way nonstop fare was in ${x.monthLabel}, on ${x.flight}. The table of lowest fares by month shows that fare in the currency chosen in the site header. Cached search fares change often; check the live price before booking.`;
}
