/**
 * Everything the Methodology page counts or quotes, read from the same data the
 * rest of the site renders. Nothing here is typed in: if a number or example on
 * /methodology changes, it is because the fact store or the CMS changed.
 *
 *   - articles          Strapi, the same total the About and FAQ pages show
 *   - directory size    the /airlines population (app/airlines/page.tsx, app/faq/page.tsx)
 *   - fact counts       content/airline-facts via lib/airline-facts.ts, limited to
 *                       carriers that have a live page (in Strapi, not a non-airline)
 *   - examples          real fields from those files, so the explainer shows
 *                       exactly what a reader meets on an airline page
 */
import fs from 'node:fs';
import path from 'node:path';
import { listAirlines, listArticles, type StrapiAirline } from '@/lib/strapi';
import { getAirlineFacts, resolveModule, type FactField } from '@/lib/airline-facts';
import { PUBLISHED_AIRLINE_GUIDES, airlineGuideIsPublished, airlineTier } from '@/lib/airline-tier';
import { isCargoOnlyAirline, isNonAirline } from '@/lib/airline-exclusions';
import { getRouteFacts } from '@/lib/route-facts';
import { dateRange, fieldLabel, sourceHost } from '@/components/airline-v2/facts-view';

export type VerifiedExample = {
  airline: string;
  slug: string;
  label: string;
  value: string;
  date: string;
  host: string;
  sourceUrl: string;
};

export type PendingExample = { airline: string; slug: string; section: string; stillToCheck: string[] };

export type DisputedExample = { airline: string; slug: string; label: string; readings: string[] };

export type MethodologyData = {
  articles: number;
  /** Carriers listed in the /airlines directory. */
  directoryAirlines: number;
  /** Carriers with a reviewed, indexable policy guide (the FAQ's "verified policy guide"). */
  verifiedGuides: number;
  /** Fact-store fields, across carriers with a live page. */
  facts: { official: number; pending: number; disputed: number; carriersWithVerified: number };
  examples: { verified: VerifiedExample | null; pending: PendingExample | null; disputed: DisputedExample | null };
};

const FACTS_DIR = path.join(process.cwd(), 'content', 'airline-facts');

function factSlugs(): string[] {
  try {
    return fs
      .readdirSync(FACTS_DIR)
      .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
      .map((f) => f.slice(0, -'.json'.length))
      .sort();
  } catch {
    return [];
  }
}

const isOfficial = (f: FactField) => f.status === 'official' && Boolean(f.source_url) && Boolean(f.verified_at);

export async function loadMethodologyData(): Promise<MethodologyData> {
  const [articles, allAirlines] = await Promise.all([
    listArticles({ pageSize: 1 })
      .then((r) => r.meta?.pagination?.total ?? 0)
      .catch(() => 0),
    listAirlines().catch(() => [] as StrapiAirline[]),
  ]);

  // Same filter as the /airlines directory and the FAQ, so all three quote one number.
  const listed = allAirlines.filter((a) => {
    if (isCargoOnlyAirline(a)) return false;
    const dests = getRouteFacts(a.iataCode)?.destinationCount ?? 0;
    return airlineGuideIsPublished(a.slug) || airlineTier(a, dests > 0) <= 2;
  });

  const nameBySlug = new Map(allAirlines.map((a) => [a.slug, a.name]));
  const facts = { official: 0, pending: 0, disputed: 0, carriersWithVerified: 0 };
  let disputed: DisputedExample | null = null;

  // Only carriers whose page exists: a fact file for a slug Strapi does not
  // serve (or a non-airline, which 404s) is never seen by a reader.
  for (const slug of factSlugs()) {
    if (isNonAirline(slug) || !nameBySlug.has(slug)) continue;
    const file = getAirlineFacts(slug);
    if (!file) continue;
    let carrierHasVerified = false;
    for (const m of file.modules) {
      for (const [key, f] of Object.entries(m.fields ?? {})) {
        if (isOfficial(f)) {
          facts.official += 1;
          carrierHasVerified = true;
        } else if (f.status === 'disputed') {
          facts.disputed += 1;
          if (!disputed && (f.conflicting_values?.length ?? 0) >= 2) {
            disputed = {
              airline: nameBySlug.get(slug) ?? slug,
              slug,
              label: fieldLabel(key),
              readings: f.conflicting_values!.slice(0, 2),
            };
          }
        } else if (f.status === 'pending') {
          facts.pending += 1;
        }
      }
    }
    if (carrierHasVerified) facts.carriersWithVerified += 1;
  }

  // Verified and pending examples come from the reviewed guides, in the order
  // the set lists them, so the example is a page we stand behind.
  let verified: VerifiedExample | null = null;
  let pending: PendingExample | null = null;
  for (const slug of PUBLISHED_AIRLINE_GUIDES) {
    if (!nameBySlug.has(slug)) continue;
    const file = getAirlineFacts(slug);
    if (!file) continue;
    for (const raw of file.modules) {
      const m = resolveModule(raw);
      if (!verified && m.isPublished) {
        // A short, plain figure read off the carrier's own domain makes the
        // clearest example — not a URL, and not a value sourced elsewhere.
        const site = sourceHost(file.official_website).split('.').slice(-2).join('.');
        const field = m.published.find(
          (p) =>
            isOfficial(p.field) &&
            (p.field.value ?? '').length <= 60 &&
            !/^https?:|@/.test(p.field.value ?? '') &&
            sourceHost(p.field.source_url ?? '').endsWith(site),
        );
        if (field) {
          verified = {
            airline: nameBySlug.get(slug) ?? slug,
            slug,
            label: fieldLabel(field.key),
            value: field.field.value ?? '',
            date: dateRange([field.field.verified_at]) ?? '',
            host: sourceHost(field.field.source_url ?? ''),
            sourceUrl: field.field.source_url ?? '',
          };
        }
      }
      if (!pending && !m.isPublished && m.disputes.length === 0) {
        const keys = m.blockers.filter((b) => b.status === 'pending').map((b) => fieldLabel(b.key));
        if (keys.length) pending = { airline: nameBySlug.get(slug) ?? slug, slug, section: m.title, stillToCheck: keys.slice(0, 3) };
      }
    }
    if (verified && pending) break;
  }

  return {
    articles,
    directoryAirlines: listed.length,
    verifiedGuides: listed.filter((a) => airlineGuideIsPublished(a.slug)).length,
    facts,
    examples: { verified, pending, disputed },
  };
}
