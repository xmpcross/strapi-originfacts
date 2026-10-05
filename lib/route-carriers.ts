/**
 * Which carriers attached to a Strapi route are credible enough to show.
 *
 * Route `carriers` were ingested from an old TravelPayouts routes dump by
 * 2-letter IATA code, and each code was resolved to whichever Strapi airline
 * holds it today. IATA codes are recycled and shared (content/airline-facts/
 * CLAUDE.md, "IATA codes are not entity identifiers"), and the live route
 * records predate the ingest's codeshare filter, so the relation carries:
 *
 *  - previous holders' services under today's holder: DJ was Virgin Blue's
 *    code, so Air Djibouti was listed on Auckland–Sydney; US was US Airways',
 *    so Silk Avia was listed at Sydney;
 *  - marketing codeshares: Air Canada and Air France on Kigali–Entebbe.
 *
 * The rule is conservative and every drop has one named reason. Evidence:
 * data/route-facts/operators.json (built by ops/build-route-operators.mjs from
 * the same dump), data/airline-refs/duffel.json (who holds each code today)
 * and data/airline-status/wikidata.json (sourced cessations). Where evidence
 * is missing the carrier is kept, and a carrier is never dropped as a
 * codeshare from a route that starts or ends in its home country.
 *
 * Server-only: reads data files from disk. Do not import from client code.
 */
import fs from 'node:fs';
import path from 'node:path';

import { getAirlineRef } from '@/lib/airline-refs';
import { getCeasedAirline, isNonAirline } from '@/lib/airline-status';
import type { StrapiAirline, StrapiAirport } from '@/lib/strapi';

export type CarrierDropReason =
  /** Listed in NON_AIRLINE_SLUGS (railway, GDS, trade body…). */
  | 'not-an-airline'
  /** Sourced cessation (Wikidata) before the route record was created. */
  | 'ceased'
  /** Duffel lists this IATA code under a different carrier today. */
  | 'code-reassigned'
  /** The source network for this code never touches the carrier's home
   *  country and no current reference confirms the carrier holds the code:
   *  the services belong to a previous holder (DJ → Virgin Blue). */
  | 'network-elsewhere'
  /** Domestic route in another country (cabotage): codeshare or stale code. */
  | 'foreign-domestic'
  /** The source lists this code on the route only as a marketing codeshare,
   *  and neither end is in the carrier's home country. */
  | 'codeshare-only';

export const CARRIER_DROP_REASONS: Record<CarrierDropReason, string> = {
  'not-an-airline': 'not an airline (NON_AIRLINE_SLUGS)',
  ceased: 'sourced cessation date before the route record',
  'code-reassigned': 'IATA code held by a different carrier per Duffel',
  'network-elsewhere': "the code's source network never touches the carrier's home country; code not confirmed by Duffel",
  'foreign-domestic': "domestic route outside the carrier's home country",
  'codeshare-only': 'source lists the carrier only as a codeshare and neither end is in its home country',
};

type Endpoint = Pick<StrapiAirport, 'iata' | 'country' | 'countryCode'>;
export type RouteCarrier = Pick<StrapiAirline, 'slug' | 'name'> & Partial<Pick<StrapiAirline, 'iataCode' | 'country'>>;
export type RouteLike<C extends RouteCarrier = StrapiAirline> = {
  carriers?: C[] | null;
  origin?: Partial<Endpoint> | null;
  destination?: Partial<Endpoint> | null;
  createdAt?: string | null;
};

type OperatorsFile = {
  pairs: Record<string, { operating: string[]; codeshare: string[] }>;
  networks: Record<string, string[]>;
};

let OPS: OperatorsFile = { pairs: {}, networks: {} };
try {
  const p = path.join(process.cwd(), 'data', 'route-facts', 'operators.json');
  OPS = JSON.parse(fs.readFileSync(p, 'utf8')) as OperatorsFile;
} catch {
  /* Snapshot absent: only the rules that do not need it apply. */
}

/* ---------- normalisation ---------- */

const fold = (v?: string | null) =>
  (v ?? '')
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The CMS and the TravelPayouts dump spell some countries differently. */
const COUNTRY_ALIASES: Record<string, string> = {
  'people s republic of china': 'china',
  'republic of korea': 'south korea',
  'korea republic of': 'south korea',
  'hong kong sar of china': 'hong kong',
  'hong kong sar': 'hong kong',
  'macau sar of china': 'macau',
  macao: 'macau',
  'united states of america': 'united states',
  usa: 'united states',
  'russian federation': 'russia',
  turkiye: 'turkey',
  'viet nam': 'vietnam',
  czechia: 'czech republic',
};

export function normCountry(v?: string | null): string {
  const f = fold(v).replace(/^the /, '');
  return COUNTRY_ALIASES[f] ?? f;
}

const NAME_NOISE = new Set([
  'air', 'airline', 'airlines', 'airways', 'aviation', 'aero', 'international', 'intl', 'company',
  'co', 'ltd', 'limited', 'sa', 'ag', 'plc', 'inc', 'the', 'de', 'and', 'royal', 'dutch', 'lines',
  'transport', 'group', 'flight', 'flights', 'express',
]);

const nameTokens = (v?: string | null) => fold(v).split(' ').filter((t) => t && !NAME_NOISE.has(t));

/**
 * Do two airline names plausibly denote the same carrier? Loose on purpose
 * ("KLM" ~ "KLM Royal Dutch Airlines", "Egyptair" ~ "EgyptAir"): a false
 * "same" only means a carrier is kept.
 */
export function sameCarrierName(a?: string | null, b?: string | null): boolean {
  const fa = fold(a).replace(/ /g, '');
  const fb = fold(b).replace(/ /g, '');
  if (!fa || !fb) return true;
  if (fa === fb || fa.includes(fb) || fb.includes(fa)) return true;
  // Acronyms: "ANA" ~ "All Nippon Airways".
  const initials = (v?: string | null) => fold(v).split(' ').map((t) => t[0]).join('');
  if ((fa.length >= 2 && initials(b) === fa) || (fb.length >= 2 && initials(a) === fb)) return true;
  const tb = new Set(nameTokens(b));
  return nameTokens(a).some((t) => tb.has(t));
}

/**
 * Group carriers whose domestic affiliates in other countries sell and fly
 * under the group code, where the source lists the code as operating the
 * domestic pair. LATAM Perú, Ecuador, Colombia and Brasil fly as LA.
 */
const GROUP_DOMESTIC_MARKETS: Record<string, readonly string[]> = {
  LA: ['peru', 'ecuador', 'colombia', 'brazil'],
};

/* ---------- the rule ---------- */

/**
 * Is this CMS airline the entity its IATA code denotes in our code-keyed
 * sources (route records, data/route-facts)? Returns why not, or null.
 * Airline pages use it to keep a previous holder's network ("where they fly")
 * off today's holder.
 */
/**
 * Codes where Duffel's name is a legal or alternate name of the same carrier,
 * checked by hand — the name test alone would call them different entities.
 */
const DUFFEL_SAME_ENTITY: Record<string, { cms: string; duffel: string }> = {
  JL: { cms: 'Japan Airlines', duffel: 'JAL' },
  UO: { cms: 'HK Express', duffel: 'Hong Kong Express Airways' },
  JJ: { cms: 'LATAM Airlines Brasil', duffel: 'TAM Linhas Aereas S.A.' },
  KB: { cms: 'Drukair', duffel: 'Royal Bhutan Airlines' },
  S4: { cms: 'SATA', duffel: 'Azores Airlines' },
  PY: { cms: 'Surinam Airways', duffel: 'Surinaamse Luchtvaart Maatschappij' },
  FO: { cms: 'Flybondi', duffel: 'F.B. Lineas Aereas SA' },
  R3: { cms: 'Yakutia Airlines', duffel: 'Joint Stock Company Aircompany' },
  LF: { cms: 'Contour Airlines', duffel: 'Corporate Flight Management, Inc.' },
};

const sameEntity = (code: string, cmsName: string, duffelName: string) => {
  const alias = DUFFEL_SAME_ENTITY[code];
  if (alias && fold(alias.cms) === fold(cmsName) && fold(alias.duffel) === fold(duffelName)) return true;
  return sameCarrierName(duffelName, cmsName);
};

export function carrierCodeMismatch(carrier: RouteCarrier): 'code-reassigned' | 'network-elsewhere' | null {
  const code = (carrier.iataCode ?? '').trim().toUpperCase();
  if (!code) return null;
  const ref = getAirlineRef(code);
  if (ref && !sameEntity(code, carrier.name, ref.name)) return 'code-reassigned';
  const home = normCountry(carrier.country);
  const network = OPS.networks[code];
  if (!ref && home && network?.length && !network.some((c) => normCountry(c) === home)) return 'network-elsewhere';
  return null;
}

export type CarrierVerdict = { keep: true } | { keep: false; reason: CarrierDropReason };

export function judgeRouteCarrier(route: RouteLike<RouteCarrier>, carrier: RouteCarrier): CarrierVerdict {
  const drop = (reason: CarrierDropReason): CarrierVerdict => ({ keep: false, reason });
  const code = (carrier.iataCode ?? '').trim().toUpperCase();
  const home = normCountry(carrier.country);
  const o = route.origin;
  const d = route.destination;
  const oc = normCountry(o?.country);
  const dc = normCountry(d?.country);

  if (carrier.slug && isNonAirline(carrier.slug)) return drop('not-an-airline');

  const ceased = carrier.slug ? getCeasedAirline(carrier.slug) : null;
  if (ceased && (!route.createdAt || ceased.ceasedOn < route.createdAt.slice(0, 10))) return drop('ceased');

  const identity = carrierCodeMismatch(carrier);
  if (identity) return drop(identity);

  if (!home || !oc || !dc) return { keep: true };

  // Cabotage: a domestic route is flown by a carrier from that country.
  const domestic =
    o?.countryCode && d?.countryCode ? o.countryCode.toUpperCase() === d.countryCode.toUpperCase() : oc === dc;
  const pair = o?.iata && d?.iata ? OPS.pairs[`${o.iata}-${d.iata}`.toUpperCase()] : undefined;
  if (domestic && home !== oc) {
    const affiliate = GROUP_DOMESTIC_MARKETS[code]?.includes(oc) && pair?.operating.includes(code);
    if (!affiliate) return drop('foreign-domestic');
  }

  // Marketing codeshares, unless the route touches the carrier's home country
  // (Qantas's QF-coded Auckland–Sydney flights stay on the page).
  const touchesHome = oc === home || dc === home;
  if (pair && code && !touchesHome && !pair.operating.includes(code) && pair.codeshare.includes(code)) {
    return drop('codeshare-only');
  }

  return { keep: true };
}

/** Every carrier on the route with its verdict, in the route's order. */
export function assessRouteCarriers<C extends RouteCarrier>(route: RouteLike<C>): { carrier: C; verdict: CarrierVerdict }[] {
  return (route.carriers ?? [])
    .filter((c): c is C => !!c)
    .map((carrier) => ({ carrier, verdict: judgeRouteCarrier(route, carrier) }));
}

/**
 * The carriers a page may present as flying this route. Every surface that
 * lists route carriers (route cards and pages, airport airline lists, airline
 * route lists, and FAQ/JSON-LD built from them) goes through this.
 */
export function operableCarriers<C extends RouteCarrier = StrapiAirline>(route: RouteLike<C>): C[] {
  return assessRouteCarriers(route)
    .filter((x) => x.verdict.keep)
    .map((x) => x.carrier);
}

/** Is this carrier (by slug) credible on this route? For carrier-centric lists. */
export function carrierOperatesRoute(route: RouteLike<RouteCarrier>, carrierSlug: string): boolean {
  const c = (route.carriers ?? []).find((x) => x?.slug === carrierSlug);
  return !!c && judgeRouteCarrier(route, c).keep;
}
