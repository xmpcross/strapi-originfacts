/**
 * The homepage's fact ledger: a handful of checked figures from the published
 * airline guides, each shown with the page it was read from and the date.
 *
 * Nothing here decides what is true. A figure is eligible only if
 * publishedField() returns it — an `official` field inside a module that
 * publishes on the airline's own page — so the homepage can never show a value
 * the guide itself would not.
 */
import { getAirlineFacts } from '@/lib/airline-facts';
import { PUBLISHED_AIRLINE_GUIDES } from '@/lib/airline-tier';
import { loadModules, publishedField } from '@/components/airline-v2/facts-view';

export type LedgerFact = {
  slug: string;
  /** What the figure is, in reader terms ("Economy cabin bag"). */
  label: string;
  value: string;
  sourceHost: string;
  sourceUrl: string;
  verifiedAt: string;
};

/** One kind of fact per row, so the ledger shows range rather than five baggage limits. */
const KINDS: { label: string; module: string; keys: string[] }[] = [
  { label: 'Economy cabin bag', module: 'carryon', keys: ['weight_economy', 'carryon_weight'] },
  { label: 'Online check-in opens', module: 'checkin', keys: ['online_checkin_opens', 'online_checkin'] },
  { label: 'Economy checked bag', module: 'baggage', keys: ['piece_weight_economy'] },
  { label: 'Boarding gate closes', module: 'checkin', keys: ['boarding_close'] },
  { label: 'Cheapest fare', module: 'fares', keys: ['fare_name'] },
  { label: 'International check-in closes', module: 'checkin', keys: ['international_cutoff_minutes', 'international_cutoff'] },
];

/** Carriers tried first; the rest of the published list follows in its own order. */
const ORDER = ['qantas', 'singapore-airlines', 'emirates', 'american-airlines', 'air-canada', 'qatar-airways', 'alaska-airlines'];

const MAX_VALUE = 72;

export function ledgerFacts(limit = 5): LedgerFact[] {
  const slugs = [...ORDER.filter((s) => PUBLISHED_AIRLINE_GUIDES.has(s)), ...[...PUBLISHED_AIRLINE_GUIDES].filter((s) => !ORDER.includes(s))];
  const used = new Set<string>();
  const out: LedgerFact[] = [];
  for (const slug of slugs) {
    if (out.length >= limit) break;
    const modules = loadModules(getAirlineFacts(slug));
    for (const kind of KINDS) {
      if (used.has(kind.label)) continue;
      const field = kind.keys.map((k) => publishedField(modules, kind.module, k)).find(Boolean);
      const value = field ? String(field.value) : '';
      if (!field?.source_url || !field.verified_at || !value || value.length > MAX_VALUE) continue;
      let sourceHost: string;
      try {
        sourceHost = new URL(field.source_url).hostname.replace(/^www\./, '');
      } catch {
        continue;
      }
      out.push({ slug, label: kind.label, value, sourceHost, sourceUrl: field.source_url, verifiedAt: field.verified_at });
      used.add(kind.label);
      break;
    }
  }
  return out;
}
