/**
 * Researched, sourced practical content for an airport page — terminals,
 * ground transport, parking, assistance, lounges — one file per airport in
 * content/airport-guides/<iata>.json. Where a file exists, the v2 template's
 * "Terminals, transport and parking" section shows it instead of the
 * "not yet verified" placeholder; every other airport is unchanged.
 *
 * Same rules as content/route-guides (lib/route-guide.ts) and
 * content/airline-facts: every statement cites at least one source with a
 * verified_at date, and anything not confirmed is left out of the file. The
 * loader enforces the citation part — a paragraph or FAQ whose sources are
 * missing from the file is dropped, and a section left empty is dropped.
 *
 * Server-only: reads from disk.
 */
import fs from 'node:fs';
import path from 'node:path';

import type { GuideFaq, GuideSection, GuideSource } from '@/lib/route-guide';

export type AirportGuide = {
  iata: string;
  verified_at: string;
  sections: GuideSection[];
  faqs: GuideFaq[];
  sources: GuideSource[];
};

const DIR = path.join(process.cwd(), 'content', 'airport-guides');
const cache = new Map<string, AirportGuide | null>();

function cited(ids: Set<string>, refs: string[]): boolean {
  return refs.length > 0 && refs.every((id) => ids.has(id));
}

function load(iata: string): AirportGuide | null {
  if (!/^[a-z]{3}$/.test(iata)) return null;
  let raw: AirportGuide;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(DIR, `${iata}.json`), 'utf8')) as AirportGuide;
  } catch {
    return null;
  }
  const ids = new Set(raw.sources.filter((s) => s.url && s.verified_at).map((s) => s.id));
  const sections = raw.sections
    .map((s) => ({ ...s, paragraphs: s.paragraphs.filter((p) => cited(ids, p.sources)) }))
    .filter((s) => s.paragraphs.length > 0);
  if (sections.length === 0) return null;
  return {
    ...raw,
    sections,
    faqs: raw.faqs.filter((f) => cited(ids, f.sources)),
    sources: raw.sources.filter((s) => ids.has(s.id)),
  };
}

export function getAirportGuide(iata: string | null | undefined): AirportGuide | null {
  if (!iata) return null;
  const key = iata.toLowerCase();
  if (!cache.has(key)) cache.set(key, load(key));
  return cache.get(key) ?? null;
}

/** Sources numbered in the order the section first cites them. */
export function airportCitationOrder(guide: AirportGuide): Map<string, number> {
  const order = new Map<string, number>();
  const visit = (refs: string[]) => refs.forEach((id) => order.has(id) || order.set(id, order.size + 1));
  guide.sections.forEach((s) => s.paragraphs.forEach((p) => visit(p.sources)));
  guide.faqs.forEach((f) => visit(f.sources));
  return order;
}
