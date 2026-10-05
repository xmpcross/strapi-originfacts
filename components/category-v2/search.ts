// Client-safe: no CMS client imports, so CategoryBrowser can use it.

/**
 * Plain, serialisable view of an article for the v2 category template. Only
 * fields the CMS already holds; dates are formatted on the server so the
 * client never re-formats them in another time zone.
 */
export type CategoryCard = {
  slug: string;
  title: string;
  excerpt: string | null;
  date: string | null;
  dateIso: string | null;
  readingMinutes: number | null;
  image: string | null;
  imageAlt: string;
  destinations: { slug: string; name: string }[];
};

export type DestinationChip = { slug: string; name: string; count: number };

export type CategoryStat = { value: string; label: string };

/** Case- and accent-insensitive match on title and destination names. */
export function normaliseForSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesQuery(card: CategoryCard, query: string): boolean {
  const q = normaliseForSearch(query);
  if (!q) return true;
  const hay = normaliseForSearch([card.title, ...card.destinations.map((d) => d.name)].join(' '));
  return q.split(/\s+/).every((term) => hay.includes(term));
}
