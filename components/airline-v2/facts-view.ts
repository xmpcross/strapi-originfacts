/**
 * Presentation helpers for the v2 airline template.
 *
 * Nothing here decides what publishes — that stays in lib/airline-facts.ts
 * (resolveModule) and the derived-module builders in AirlineTier1. These
 * functions only arrange already-resolved, `official` fields for display:
 * labels for field keys, grouping cabin-suffixed fields into a table, picking
 * the at-a-glance values, and formatting provenance.
 */
import type { AirlineFactsFile, FactField, ResolvedField, ResolvedModule } from '@/lib/airline-facts';
import { resolveModule } from '@/lib/airline-facts';
import { formatDate } from '@/components/airline-tier1/AirlineTier1';

/** A fact-file module, resolved, plus its raw field map for key lookups. */
export type ModuleEntry = { resolved: ResolvedModule; fields: Record<string, FactField> };

export function loadModules(facts: AirlineFactsFile | null): Map<string, ModuleEntry> {
  return new Map(
    (facts?.modules ?? []).map((m) => [m.id, { resolved: resolveModule(m), fields: m.fields ?? {} }]),
  );
}

/**
 * An `official` field from a module that published. A field can be official
 * inside a module that is still blocked by another required field; the module
 * contract says that module does not render, so neither does the field.
 */
export function publishedField(modules: Map<string, ModuleEntry>, moduleId: string, key: string): FactField | null {
  const entry = modules.get(moduleId);
  if (!entry?.resolved.isPublished) return null;
  const field = entry.fields[key];
  return field?.status === 'official' && field.value ? field : null;
}

/* ------------------------------------------------------------------ *
 * Labels
 * ------------------------------------------------------------------ */

const LABELS: Record<string, string> = {
  carryon_bag_dimensions: 'Cabin bag size',
  dimensions_combined: 'Cabin bag size',
  carryon_weight: 'Cabin bag weight',
  carryon_allowance: 'Carry-on allowance',
  personal_item: 'Personal item',
  allowance_by_cabin: 'Allowance by cabin',
  allowance: 'Allowance',
  size_weight: 'Size and weight limits',
  checked_bag_fees: 'Checked bag fees',
  premium_cabin_allowance: 'Premium cabin allowance',
  free_first_bag_routes: 'Routes with a free first bag',
  infant_allowance: 'Infant allowance',
  us_canada_pieces: 'Flights to and from the USA or Canada',
  excess_baggage: 'Excess baggage',
  max_piece: 'Maximum weight per bag',
  weight_economy: 'Economy carry-on weight',
  weight_business: 'Business carry-on weight',
  weight_business_first: 'Business & First carry-on weight',
  piece_weight_economy: 'Economy checked allowance',
  piece_weight_premium_economy: 'Premium Economy checked allowance',
  piece_weight_business: 'Business checked allowance',
  piece_weight_first: 'First checked allowance',
  fare_name: 'Lowest fare',
  seat_selection_included: 'Seat selection',
  change_cancellation_policy: 'Changes and cancellations',
  duty_of_care_policy: 'Care during delays',
  refund_rebooking_policy: 'Refund or rebooking',
  rebooking_refund: 'Rebooking and refunds',
  overnight_care: 'Overnight care',
  online_checkin_opens: 'Online check-in opens',
  online_checkin: 'Online check-in',
  domestic_cutoff_minutes: 'Domestic check-in closes',
  domestic_cutoff: 'Domestic check-in closes',
  international_cutoff_minutes: 'International check-in closes',
  international_cutoff: 'International check-in closes',
  airport_cutoff: 'Airport check-in closes',
  boarding_close: 'Boarding closes',
  counter_checkin_malaysia: 'Counter check-in in Malaysia',
  delay_refund_threshold: 'When a refund applies',
  customer_service: 'Customer service',
  domestic_allowance: 'Domestic allowance',
  domestic_max_piece: 'Domestic maximum per bag',
  domestic_flexichange_bags: 'Domestic flexichange bags',
  standard_fare_checked_bag: 'Checked bag on Economy Standard',
  cash_compensation: 'Cash compensation for delays',
  compensation_law: 'Compensation under law',
  cancellation_refund: 'Refund after a cancellation',
  us_refund_timing: 'U.S. refund timing',
  japan_domestic_phone: 'Japan domestic phone',
  korean_air_integration: 'Korean Air integration',
  phone_home_market: 'Customer service phone',
  phone_us: 'US phone',
  phone_international: 'International phone',
  email: 'Customer relations email',
  contact_help_centre: 'Help centre',
  conditions_of_carriage_url: 'Conditions of carriage',
  registered_address: 'Registered address',
  official_website_url: 'Official website',
  cancellations_refunds: 'Cancellations and refunds',
};

/** "free_first_bag_routes" → "Free first bag routes"; carry-on / check-in spelled out. */
export function fieldLabel(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const words = key
    .replace(/carryon/g, 'carry-on')
    .replace(/checkin/g, 'check-in')
    .split('_')
    .filter(Boolean)
    .join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* ------------------------------------------------------------------ *
 * Cabin tables
 *
 * Fact files name per-cabin values with a cabin suffix — weight_economy,
 * piece_weight_business, weight_business_first. Two or more fields sharing a
 * prefix read better as a table than as separate cards. The cabin name comes
 * from the key the researcher chose, never from parsing the value.
 * ------------------------------------------------------------------ */

const CABINS: { suffix: string; label: string }[] = [
  { suffix: 'premium_economy', label: 'Premium Economy' },
  { suffix: 'business_first', label: 'Business & First' },
  { suffix: 'economy', label: 'Economy' },
  { suffix: 'business', label: 'Business' },
  { suffix: 'first', label: 'First' },
];
const CABIN_ORDER = ['Economy', 'Premium Economy', 'Business', 'Business & First', 'First'];

const PREFIX_LABELS: Record<string, string> = {
  weight: 'Carry-on weight',
  piece_weight: 'Checked allowance',
};

export type CabinTable = {
  caption: string;
  column: string;
  rows: { cabin: string; key: string; field: FactField }[];
};

export function splitCabinFields(fields: ResolvedField[]): { tables: CabinTable[]; rest: ResolvedField[] } {
  const groups = new Map<string, CabinTable['rows']>();
  for (const f of fields) {
    const cabin = CABINS.find((c) => f.key.endsWith(`_${c.suffix}`));
    if (!cabin) continue;
    const prefix = f.key.slice(0, -(cabin.suffix.length + 1));
    if (!prefix) continue;
    const rows = groups.get(prefix) ?? [];
    rows.push({ cabin: cabin.label, key: f.key, field: f.field });
    groups.set(prefix, rows);
  }
  const tables: CabinTable[] = [];
  const used = new Set<string>();
  for (const [prefix, rows] of groups) {
    if (rows.length < 2) continue;
    rows.sort((a, b) => CABIN_ORDER.indexOf(a.cabin) - CABIN_ORDER.indexOf(b.cabin));
    const column = PREFIX_LABELS[prefix] ?? fieldLabel(prefix);
    tables.push({ caption: `${column} by cabin`, column, rows });
    rows.forEach((r) => used.add(r.key));
  }
  return { tables, rest: fields.filter((f) => !used.has(f.key)) };
}

/* ------------------------------------------------------------------ *
 * At a glance
 * ------------------------------------------------------------------ */

type GlanceEntry = { keys: string[]; qualifier?: string };

export type GlanceTile = {
  id: string;
  title: string;
  /** Section the tile summarises — the "full rules" link target. */
  section: string;
  /** Tried in order; the first alternative that yields any value wins. */
  alternatives: GlanceEntry[][];
};

export const GLANCE_TILES: GlanceTile[] = [
  {
    id: 'carryon-size',
    title: 'Cabin bag size',
    section: 'carryon',
    alternatives: [[{ keys: ['carryon_bag_dimensions', 'dimensions_combined'] }]],
  },
  {
    id: 'carryon-weight',
    title: 'Cabin bag weight',
    section: 'carryon',
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
    section: 'baggage',
    alternatives: [
      [{ keys: ['piece_weight_economy'], qualifier: 'Economy' }],
      [{ keys: ['allowance_by_cabin', 'allowance', 'free_allowance', 'included'] }],
    ],
  },
  {
    id: 'online-checkin',
    title: 'Online check-in',
    section: 'checkin',
    alternatives: [[{ keys: ['online_checkin_opens', 'online_checkin', 'online_checkin_window'] }]],
  },
  {
    id: 'checkin-closes',
    title: 'Airport check-in closes',
    section: 'checkin',
    alternatives: [
      [
        { keys: ['domestic_cutoff_minutes', 'domestic_cutoff'], qualifier: 'Domestic' },
        { keys: ['international_cutoff_minutes', 'international_cutoff'], qualifier: 'International' },
      ],
      [{ keys: ['airport_cutoff', 'checkin_close', 'counter_close'] }],
    ],
  },
  {
    id: 'phone',
    title: 'Customer service',
    section: 'contact',
    alternatives: [[{ keys: ['phone_home_market', 'phone_international', 'customer_service'] }]],
  },
];

/**
 * A summary tile cannot hold a paragraph without becoming the section. Past
 * this length the tile points to the section instead — it never truncates a
 * fact, because a clipped rule reads as a different rule.
 */
const GLANCE_MAX_CHARS = 140;

export type GlanceValue = { qualifier?: string; key: string; field: FactField };

export function glanceValues(modules: Map<string, ModuleEntry>, tile: GlanceTile): GlanceValue[] {
  const moduleId = tile.section;
  for (const alt of tile.alternatives) {
    const hits: GlanceValue[] = [];
    for (const entry of alt) {
      for (const key of entry.keys) {
        const field = publishedField(modules, moduleId, key);
        if (field && (field.value ?? '').length <= GLANCE_MAX_CHARS) {
          hits.push({ qualifier: entry.qualifier, key, field });
          break;
        }
      }
    }
    if (hits.length) return hits;
  }
  return [];
}

/**
 * Whether the at-a-glance grid has anything to summarise: true when at least
 * one tile has an official value. When none does, every tile would only say
 * "not yet verified", which the section cards below already say, so the page
 * leaves the grid out.
 */
export function glanceHasValues(modules: Map<string, ModuleEntry>): boolean {
  return GLANCE_TILES.some((tile) => glanceValues(modules, tile).length > 0);
}

/**
 * Why a tile has no value to show, in the reader's terms:
 *   disputed — a candidate field is recorded as disputed (both readings are in the section);
 *   in-section — the module published, but not as a short figure this tile can hold;
 *   pending — nothing verified yet.
 */
export function glanceGap(modules: Map<string, ModuleEntry>, tile: GlanceTile): 'disputed' | 'in-section' | 'pending' {
  const entry = modules.get(tile.section);
  const keys = tile.alternatives.flat().flatMap((e) => e.keys);
  if (keys.some((k) => entry?.fields[k]?.status === 'disputed')) return 'disputed';
  if (entry?.resolved.isPublished) return 'in-section';
  return 'pending';
}

/* ------------------------------------------------------------------ *
 * Provenance formatting
 * ------------------------------------------------------------------ */

export function sourceHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** "https://www.qantas.com/au/en/baggage/carry-on-baggage.html" → "qantas.com/au/en/baggage/carry-on-baggage". */
export function sourcePath(url: string): string {
  try {
    const u = new URL(url);
    const p = u.pathname.replace(/\.(html?|jsp|aspx?)$/i, '').replace(/\/$/, '');
    return `${u.host.replace(/^www\./, '')}${p}`;
  } catch {
    return url;
  }
}

/** "4 Sep 2026", or "12 Aug 2026 – 4 Sep 2026" when the dates differ. */
export function dateRange(dates: (string | undefined)[]): string | null {
  const sorted = dates.filter((d): d is string => Boolean(d)).sort();
  if (!sorted.length) return null;
  const first = formatDate(sorted[0]);
  const last = formatDate(sorted[sorted.length - 1]);
  return first === last ? first : `${first} – ${last}`;
}

/** Every official field a published module shows, table cells included. */
export function shownFields(m: ResolvedModule): FactField[] {
  const cells = (m.table?.rows ?? []).flatMap((r) => r.cells).filter((c): c is FactField => Boolean(c));
  return [...m.published.map((f) => f.field), ...cells];
}

/**
 * When every fact in a section came from one page on one date, the section
 * cites it once. Otherwise each fact cites its own — so a value from a
 * different page never hides behind its neighbour's citation.
 */
export function sharedSource(fields: FactField[]): { url: string; verified_at: string } | null {
  if (!fields.length) return null;
  const [first] = fields;
  if (!first.source_url || !first.verified_at) return null;
  const same = fields.every((f) => f.source_url === first.source_url && f.verified_at === first.verified_at);
  return same ? { url: first.source_url, verified_at: first.verified_at } : null;
}

/** Single phone number, nothing else in the string — safe to turn into a tel: link. */
export function telHref(value: string): string | null {
  return /^\+?[\d][\d\s().-]{5,}$/.test(value.trim()) ? `tel:${value.replace(/[^+\d]/g, '')}` : null;
}

/* ------------------------------------------------------------------ *
 * FAQ built from published facts
 * ------------------------------------------------------------------ */

const FACT_FAQS: { module: string; keys: string[]; q: (name: string) => string }[] = [
  { module: 'carryon', keys: ['carryon_bag_dimensions'], q: (n) => `What size cabin bag can I take on ${n}?` },
  { module: 'carryon', keys: ['weight_economy', 'carryon_weight'], q: (n) => `How heavy can my ${n} carry-on bag be?` },
  { module: 'baggage', keys: ['piece_weight_economy'], q: (n) => `What is the ${n} Economy checked baggage allowance?` },
  { module: 'checkin', keys: ['online_checkin_opens', 'online_checkin'], q: (n) => `When can I check in online with ${n}?` },
  {
    module: 'checkin',
    keys: ['domestic_cutoff_minutes', 'domestic_cutoff'],
    q: (n) => `When does ${n} check-in close for domestic flights?`,
  },
  {
    module: 'checkin',
    keys: ['international_cutoff_minutes', 'international_cutoff'],
    q: (n) => `When does ${n} check-in close for international flights?`,
  },
  { module: 'contact', keys: ['phone_home_market'], q: (n) => `What is the ${n} customer service phone number?` },
];

/**
 * Questions answered verbatim from published, official fields — the answer is
 * the field value with its source and date, so the FAQ (and its FAQPage
 * markup) can never say more than the section it summarises.
 */
export function factFaqs(name: string, modules: Map<string, ModuleEntry>): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  for (const spec of FACT_FAQS) {
    for (const key of spec.keys) {
      const field = publishedField(modules, spec.module, key);
      if (!field?.value || !field.source_url || !field.verified_at) continue;
      const value = field.value.trim().replace(/\.$/, '');
      out.push({
        q: spec.q(name),
        a: `According to ${name}’s own website (${sourceHost(field.source_url)}, checked ${formatDate(field.verified_at)}): ${value}.`,
      });
      break;
    }
  }
  return out;
}
