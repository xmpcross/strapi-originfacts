/**
 * Researched, sourced editorial content for a flight-route page, one file per
 * route in content/route-guides/<slug>.json. A route with a guide file gets
 * the fuller template (app/flight-routes/[slug]/page.tsx); every other route
 * keeps the original one until it has a guide of its own.
 *
 * Same rules as content/airline-facts (see its CLAUDE.md): every published
 * statement cites at least one source the reader can open, each source has a
 * verified_at date, and anything that could not be confirmed is left out of
 * the file rather than written as a guess. The loader enforces the citation
 * part — a paragraph or FAQ whose sources are missing from the file is dropped.
 *
 * Server-only: reads from disk.
 */
import fs from 'node:fs';
import path from 'node:path';

export type GuideSource = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  /** Date shown on the source page, as precise as the page gives it. */
  published: string | null;
  verified_at: string;
};

export type GuideParagraph = { text: string; sources: string[] };
export type GuideSection = { id: string; heading: string; paragraphs: GuideParagraph[] };
export type GuideFaq = { q: string; a: string; sources: string[] };

export type RouteGuide = {
  slug: string;
  verified_at: string;
  /** Lead paragraph shown under the H1 in place of the generic route text. */
  intro: GuideParagraph;
  /** IATA codes of airlines a source confirms fly the route nonstop with their own aircraft. */
  operating_airlines: { iata: string; sources: string[] }[];
  sections: GuideSection[];
  faqs: GuideFaq[];
  sources: GuideSource[];
};

const DIR = path.join(process.cwd(), 'content', 'route-guides');
const cache = new Map<string, RouteGuide | null>();

function cited(sourceIds: Set<string>, ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => sourceIds.has(id));
}

function load(slug: string): RouteGuide | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  let raw: RouteGuide;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(DIR, `${slug}.json`), 'utf8')) as RouteGuide;
  } catch {
    return null;
  }
  const ids = new Set(raw.sources.filter((s) => s.url && s.verified_at).map((s) => s.id));
  if (!cited(ids, raw.intro?.sources ?? [])) return null;
  return {
    ...raw,
    operating_airlines: raw.operating_airlines.filter((a) => cited(ids, a.sources)),
    sections: raw.sections
      .map((s) => ({ ...s, paragraphs: s.paragraphs.filter((p) => cited(ids, p.sources)) }))
      .filter((s) => s.paragraphs.length > 0),
    faqs: raw.faqs.filter((f) => cited(ids, f.sources)),
    sources: raw.sources.filter((s) => ids.has(s.id)),
  };
}

export function getRouteGuide(slug: string): RouteGuide | null {
  if (!cache.has(slug)) cache.set(slug, load(slug));
  return cache.get(slug) ?? null;
}

/** Sources in the order they are first cited on the page, numbered from 1. */
export function citationOrder(guide: RouteGuide): Map<string, number> {
  const order = new Map<string, number>();
  const visit = (ids: string[]) => ids.forEach((id) => order.has(id) || order.set(id, order.size + 1));
  visit(guide.intro.sources);
  guide.sections.forEach((s) => s.paragraphs.forEach((p) => visit(p.sources)));
  guide.operating_airlines.forEach((a) => visit(a.sources));
  guide.faqs.forEach((f) => visit(f.sources));
  return order;
}
