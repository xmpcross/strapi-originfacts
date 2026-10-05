// Client-safe filter logic for /all-articles: no CMS client imports, so the
// browser component and the server route share one implementation (and the
// server can render a filtered URL exactly as the client would).

import { normaliseForSearch, type CategoryCard } from '@/components/category-v2/search';

/** A category-v2 card plus the fields the archive filters on. */
export type IndexCard = CategoryCard & {
  category: { slug: string; name: string } | null;
  author: { slug: string; name: string } | null;
};

export const DATE_RANGES = [
  { value: '30d', label: 'Last 30 days', maxDays: 30 },
  { value: '90d', label: 'Last 90 days', maxDays: 90 },
  { value: '12m', label: 'Last 12 months', maxDays: 365 },
  { value: 'older', label: 'Over a year ago', maxDays: null },
] as const;

export type DateRange = (typeof DATE_RANGES)[number]['value'];
export type SortOrder = 'newest' | 'oldest';

export type ArticleFilters = {
  q: string;
  categories: string[];
  destinations: string[];
  authors: string[];
  date: DateRange | null;
  sort: SortOrder;
};

export type FacetGroup = 'categories' | 'destinations' | 'authors' | 'date';
export type FacetOption = { slug: string; name: string; count: number };

export const EMPTY_FILTERS: ArticleFilters = {
  q: '',
  categories: [],
  destinations: [],
  authors: [],
  date: null,
  sort: 'newest',
};

/**
 * URL parameter for each filter. Multi-select values are comma-separated.
 * The in-page text filter is `?s=`, not `?q=`: `?q=` keeps its original
 * meaning on /all-articles, a redirect to the full-text /search (see
 * legacySearchRedirect), which the homepage SearchAction targets.
 */
export const FILTER_PARAMS = {
  q: 's',
  categories: 'category',
  destinations: 'destination',
  authors: 'author',
  date: 'published',
  sort: 'sort',
} as const;

const DAY_MS = 86_400_000;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function readAll(src: ParamSource, key: string): string[] {
  if (src instanceof URLSearchParams) return src.getAll(key);
  const v = src[key];
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function readSlugs(src: ParamSource, key: string): string[] {
  const out: string[] = [];
  for (const raw of readAll(src, key)) {
    for (const part of raw.split(',')) {
      const slug = part.trim().toLowerCase();
      if (SLUG_RE.test(slug) && !out.includes(slug)) out.push(slug);
    }
  }
  return out;
}

/** Filters from a query string or Next.js searchParams. Unknown values are dropped. */
export function parseFilters(src: ParamSource): ArticleFilters {
  const q = (readAll(src, FILTER_PARAMS.q)[0] ?? '').trim().slice(0, 100);
  const dateRaw = readAll(src, FILTER_PARAMS.date)[0];
  const date = DATE_RANGES.find((r) => r.value === dateRaw)?.value ?? null;
  const sort: SortOrder = readAll(src, FILTER_PARAMS.sort)[0] === 'oldest' ? 'oldest' : 'newest';
  return {
    q,
    categories: readSlugs(src, FILTER_PARAMS.categories),
    destinations: readSlugs(src, FILTER_PARAMS.destinations),
    authors: readSlugs(src, FILTER_PARAMS.authors),
    date,
    sort,
  };
}

/** True when any filter (including oldest-first) differs from the plain archive. */
export function isFiltering(f: ArticleFilters): boolean {
  return (
    f.q.trim() !== '' ||
    f.categories.length > 0 ||
    f.destinations.length > 0 ||
    f.authors.length > 0 ||
    f.date !== null ||
    f.sort !== 'newest'
  );
}

/**
 * The /all-articles URL for a filter state. A filtered view drops ?page=
 * (filters work on the whole archive); the plain archive keeps the server's
 * ?page= so pagination URLs stay exactly as they were.
 */
export function filtersToHref(f: ArticleFilters, page = 1, path = '/all-articles'): string {
  const p = new URLSearchParams();
  if (isFiltering(f)) {
    if (f.q.trim()) p.set(FILTER_PARAMS.q, f.q.trim());
    if (f.categories.length) p.set(FILTER_PARAMS.categories, f.categories.join(','));
    if (f.destinations.length) p.set(FILTER_PARAMS.destinations, f.destinations.join(','));
    if (f.authors.length) p.set(FILTER_PARAMS.authors, f.authors.join(','));
    if (f.date) p.set(FILTER_PARAMS.date, f.date);
    if (f.sort !== 'newest') p.set(FILTER_PARAMS.sort, f.sort);
  } else if (page > 1) {
    p.set('page', String(page));
  }
  const qs = p.toString().replace(/%2C/g, ',');
  return qs ? `${path}?${qs}` : path;
}

/**
 * /all-articles?q=… has always redirected to the full-text /search, carrying
 * ?page= when it is above 1. Returns that target, or null when there is no q.
 */
export function legacySearchRedirect(src: Record<string, string | string[] | undefined>): string | null {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = (first(src.q) || '').trim();
  if (!q) return null;
  const page = Math.max(1, Number(first(src.page)) || 1);
  const params = new URLSearchParams({ q });
  if (page > 1) params.set('page', String(page));
  return `/search?${params.toString()}`;
}

/** Full-text /search for the in-page filter text (or /search itself when empty). */
export function fullTextSearchHref(text: string): string {
  const q = text.trim();
  return q ? `/search?${new URLSearchParams({ q }).toString()}` : '/search';
}

function ageDays(card: IndexCard, now: number): number | null {
  if (!card.dateIso) return null;
  const t = Date.parse(card.dateIso);
  return Number.isNaN(t) ? null : (now - t) / DAY_MS;
}

export function matchesDate(card: IndexCard, range: DateRange | null, now: number): boolean {
  if (!range) return true;
  const age = ageDays(card, now);
  if (age === null) return false;
  const def = DATE_RANGES.find((r) => r.value === range)!;
  return def.maxDays === null ? age > 365 : age <= def.maxDays;
}

/** Every search term must appear in the title, excerpt, category or a destination name. */
export function matchesText(card: IndexCard, query: string): boolean {
  const q = normaliseForSearch(query);
  if (!q) return true;
  const hay = normaliseForSearch(
    [card.title, card.excerpt ?? '', card.category?.name ?? '', ...card.destinations.map((d) => d.name)].join(' '),
  );
  return q.split(/\s+/).every((term) => hay.includes(term));
}

function matches(card: IndexCard, f: ArticleFilters, now: number, skip?: FacetGroup): boolean {
  if (!matchesText(card, f.q)) return false;
  if (skip !== 'categories' && f.categories.length && !(card.category && f.categories.includes(card.category.slug))) return false;
  if (skip !== 'destinations' && f.destinations.length && !card.destinations.some((d) => f.destinations.includes(d.slug)))
    return false;
  if (skip !== 'authors' && f.authors.length && !(card.author && f.authors.includes(card.author.slug))) return false;
  if (skip !== 'date' && !matchesDate(card, f.date, now)) return false;
  return true;
}

function byDate(a: IndexCard, b: IndexCard): number {
  return (b.dateIso ?? '').localeCompare(a.dateIso ?? '');
}

/**
 * The cards matching every filter, sorted. Within a group the values are ORed
 * (Hotels or Flights); across groups they are ANDed (Hotels in Japan).
 */
export function applyFilters(cards: IndexCard[], f: ArticleFilters, now: number): IndexCard[] {
  const out = cards.filter((c) => matches(c, f, now));
  out.sort(byDate);
  if (f.sort === 'oldest') out.reverse();
  return out;
}

function tally(
  cards: IndexCard[],
  pick: (c: IndexCard) => { slug: string; name: string }[],
): Map<string, FacetOption> {
  const m = new Map<string, FacetOption>();
  for (const c of cards) {
    const seen = new Set<string>();
    for (const v of pick(c)) {
      if (!v.slug || seen.has(v.slug)) continue;
      seen.add(v.slug);
      const o = m.get(v.slug) ?? { slug: v.slug, name: v.name, count: 0 };
      o.count += 1;
      m.set(v.slug, o);
    }
  }
  return m;
}

const PICKERS: Record<Exclude<FacetGroup, 'date'>, (c: IndexCard) => { slug: string; name: string }[]> = {
  categories: (c) => (c.category ? [c.category] : []),
  destinations: (c) => c.destinations,
  authors: (c) => (c.author ? [c.author] : []),
};

/**
 * Options for a group, most articles first. Each count is the number of
 * articles that option would show given the *other* groups' filters, so a
 * count never promises more than clicking it delivers. Every value present in
 * the archive is listed (a zero count shows as 0), plus any selected value.
 */
export function facetOptions(
  cards: IndexCard[],
  f: ArticleFilters,
  now: number,
  group: Exclude<FacetGroup, 'date'>,
): FacetOption[] {
  const all = tally(cards, PICKERS[group]);
  const scoped = tally(
    cards.filter((c) => matches(c, f, now, group)),
    PICKERS[group],
  );
  const options = [...all.values()].map((o) => ({ ...o, count: scoped.get(o.slug)?.count ?? 0 }));
  for (const slug of f[group]) {
    if (!all.has(slug)) options.push({ slug, name: slug, count: 0 });
  }
  const archiveCount = (slug: string) => all.get(slug)?.count ?? 0;
  return options.sort(
    (a, b) => b.count - a.count || archiveCount(b.slug) - archiveCount(a.slug) || a.name.localeCompare(b.name),
  );
}

/** Counts per date range, given every other filter. */
export function dateFacet(cards: IndexCard[], f: ArticleFilters, now: number): Record<DateRange, number> {
  const scoped = cards.filter((c) => matches(c, f, now, 'date'));
  const out = {} as Record<DateRange, number>;
  for (const r of DATE_RANGES) out[r.value] = scoped.filter((c) => matchesDate(c, r.value, now)).length;
  return out;
}

/** Number of distinct non-empty values a group has across the archive. */
export function distinctCount(cards: IndexCard[], group: Exclude<FacetGroup, 'date'>): number {
  return tally(cards, PICKERS[group]).size;
}

/** One removable pill per active filter value, in sidebar order. */
export type ActivePill = { key: string; label: string; remove: (f: ArticleFilters) => ArticleFilters };

export function activePills(f: ArticleFilters, names: Record<string, string>): ActivePill[] {
  const pills: ActivePill[] = [];
  if (f.q.trim()) pills.push({ key: 'q', label: `“${f.q.trim()}”`, remove: (x) => ({ ...x, q: '' }) });
  for (const group of ['categories', 'destinations', 'authors'] as const) {
    for (const slug of f[group]) {
      pills.push({
        key: `${group}:${slug}`,
        label: names[`${group}:${slug}`] ?? slug,
        remove: (x) => ({ ...x, [group]: x[group].filter((s) => s !== slug) }),
      });
    }
  }
  if (f.date) {
    const label = DATE_RANGES.find((r) => r.value === f.date)!.label;
    pills.push({ key: 'date', label, remove: (x) => ({ ...x, date: null }) });
  }
  if (f.sort === 'oldest') pills.push({ key: 'sort', label: 'Oldest first', remove: (x) => ({ ...x, sort: 'newest' }) });
  return pills;
}
