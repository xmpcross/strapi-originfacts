/**
 * Carrier reference links, snapshotted from Duffel's airlines endpoint into
 * data/airline-refs/duffel.json by ops/fetch-duffel-airlines.mjs.
 *
 * The field that matters is `conditionsOfCarriageUrl` — a link to the document
 * the carrier is actually bound by, which is the primary source behind any
 * baggage, fare or check-in figure on a Tier 1 page. Duffel publishes it as
 * plain reference data: no offer request, no booking, no per-request call.
 *
 * Read from disk once per process, matching lib/route-facts.ts, so the
 * dataset is not inlined into every build chunk.
 */
import fs from 'node:fs';
import path from 'node:path';

export type AirlineRef = {
  name: string;
  conditionsOfCarriageUrl?: string;
  logoSymbolUrl?: string;
};

type RefFile = { source: string; retrieved: string; airlines: Record<string, AirlineRef> };

let FILE: RefFile = { source: '', retrieved: '', airlines: {} };
try {
  const p = path.join(process.cwd(), 'data', 'airline-refs', 'duffel.json');
  FILE = JSON.parse(fs.readFileSync(p, 'utf8')) as RefFile;
} catch {
  /* Snapshot absent — callers get null and the modules that need it stay unpublished. */
}

export function getAirlineRef(iata?: string | null): AirlineRef | null {
  if (!iata) return null;
  return FILE.airlines[iata.toUpperCase()] ?? null;
}

/** Provenance for anything sourced from the snapshot. */
export const AIRLINE_REF_SOURCE = { label: () => FILE.source, retrieved: () => FILE.retrieved };
