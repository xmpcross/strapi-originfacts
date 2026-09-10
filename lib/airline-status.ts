/**
 * What the airline directory should and should not present as an airline.
 *
 * Two problems surfaced in the September 2026 AdSense audit:
 *
 *  1. The directory was ingested from an IATA designator list, and IATA issues
 *     two-letter codes to organisations that are not airlines — railways,
 *     ferry operators, GDS and ticketing vendors, trade bodies, air forces and,
 *     memorably, Hydro-Québec. Those rows are excluded everywhere via
 *     NON_AIRLINE_SLUGS: they vanish from listings, the sitemaps and JSON-LD,
 *     and their pages 404.
 *
 *  2. Dozens of carriers that stopped flying years ago (Air Berlin, WOW air,
 *     Jet Airways, Flybe…) were rendered as bookable, complete with a flight
 *     search widget. data/airline-status/wikidata.json (built by
 *     ops/fetch-airline-status-wikidata.mjs) records a sourced cessation date
 *     for each carrier Wikidata knows has dissolved; pages for those carriers
 *     say so, drop the booking widget and stay out of the index.
 *
 * Nothing here guesses. A carrier without a matched Wikidata record is treated
 * as operating — that is the same as before, not a new claim.
 */
import fs from 'node:fs';
import path from 'node:path';

export type CeasedAirline = {
  name: string;
  iata: string | null;
  icao: string | null;
  /** ISO date (YYYY-MM-DD). Wikidata precision is often just the year. */
  ceasedOn: string;
  /** Wikidata item URL — the citation printed on the page. */
  wikidata: string;
  wikidataLabel: string;
  match: 'designator+name' | 'name';
};

type StatusFile = {
  source: string;
  sourceUrl: string;
  retrieved: string;
  ceased: Record<string, CeasedAirline>;
};

let FILE: StatusFile = { source: '', sourceUrl: '', retrieved: '', ceased: {} };
try {
  const p = path.join(process.cwd(), 'data', 'airline-status', 'wikidata.json');
  FILE = JSON.parse(fs.readFileSync(p, 'utf8')) as StatusFile;
} catch {
  /* Snapshot absent — every carrier renders as operating, exactly as before. */
}

/**
 * Cessation dates this recent are held back until a person confirms them.
 * Wikidata edits about a carrier that has just collapsed are the ones most
 * likely to be premature or reverted, and a wrong "ceased operations" banner on
 * a major carrier would be a worse error than a missing one.
 *
 * To release one, add its slug to CONFIRMED_RECENT_CESSATIONS.
 */
export const RECENT_CESSATION_HOLD_MONTHS = 12;

export const CONFIRMED_RECENT_CESSATIONS: ReadonlySet<string> = new Set<string>([]);

function isHeld(slug: string, entry: CeasedAirline): boolean {
  if (CONFIRMED_RECENT_CESSATIONS.has(slug)) return false;
  const retrieved = FILE.retrieved ? new Date(FILE.retrieved) : new Date();
  const cutoff = new Date(retrieved);
  cutoff.setMonth(cutoff.getMonth() - RECENT_CESSATION_HOLD_MONTHS);
  return new Date(entry.ceasedOn) > cutoff;
}

export function getCeasedAirline(slug: string): CeasedAirline | null {
  const entry = FILE.ceased[slug];
  if (!entry || isHeld(slug, entry)) return null;
  return entry;
}

export function airlineHasCeased(slug: string): boolean {
  return getCeasedAirline(slug) !== null;
}

/** Slugs whose snapshot entry is being held for confirmation (for reporting). */
export function heldCessations(): { slug: string; entry: CeasedAirline }[] {
  return Object.entries(FILE.ceased)
    .filter(([slug, entry]) => isHeld(slug, entry))
    .map(([slug, entry]) => ({ slug, entry }));
}

/** Provenance for the status banner. */
export const AIRLINE_STATUS_SOURCE = {
  label: () => FILE.source,
  url: () => FILE.sourceUrl,
  retrieved: () => FILE.retrieved,
};

/**
 * "on 27 October 2017" or "in 2017" — a prepositional phrase that reads
 * correctly at either precision. Use this in prose; formatCeasedOn() alone
 * is for labels.
 */
export function ceasedOnPhrase(iso: string): string {
  const text = formatCeasedOn(iso);
  return /^\d{4}$/.test(text) ? `in ${text}` : `on ${text}`;
}

/** Human-readable form of a Wikidata date, respecting its precision. */
export function formatCeasedOn(iso: string): string {
  if (/-01-01$/.test(iso)) return iso.slice(0, 4);
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// The non-airline denylist lives in lib/airline-exclusions.ts (no fs import) so
// lib/strapi.ts — which client components import for mediaUrl() — can use it.
export { NON_AIRLINE_SLUGS, isNonAirline } from '@/lib/airline-exclusions';
