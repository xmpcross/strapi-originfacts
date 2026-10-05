import { format } from 'date-fns';
import { mediaUrl, type StrapiArticle } from '@/lib/strapi';
import type { CategoryCard, CategoryStat, DestinationChip } from './search';
import { CATEGORY_V2_MAX_CHIPS, CATEGORY_V2_MIN_CHIP_COUNT } from '@/lib/category-template-v2';

export function toCard(a: StrapiArticle): CategoryCard {
  const published = a.publishedAt ? new Date(a.publishedAt) : null;
  const valid = published && !Number.isNaN(published.getTime()) ? published : null;
  return {
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt?.trim() || null,
    date: valid ? format(valid, 'd MMM yyyy') : null,
    dateIso: valid ? valid.toISOString() : null,
    readingMinutes: a.readingTimeMinutes && a.readingTimeMinutes > 0 ? Math.round(a.readingTimeMinutes) : null,
    image: mediaUrl(a.coverImage ?? null),
    imageAlt: a.coverImage?.alternativeText?.trim() || a.title,
    destinations: (a.destinations ?? [])
      .filter((d) => d?.slug && d?.name)
      .map((d) => ({ slug: d.slug, name: d.name })),
  };
}

/** Destinations covered by at least CATEGORY_V2_MIN_CHIP_COUNT articles, most-covered first. */
export function destinationChips(cards: CategoryCard[]): DestinationChip[] {
  const bySlug = new Map<string, DestinationChip>();
  for (const c of cards) {
    const seen = new Set<string>();
    for (const d of c.destinations) {
      if (seen.has(d.slug)) continue;
      seen.add(d.slug);
      const chip = bySlug.get(d.slug) ?? { slug: d.slug, name: d.name, count: 0 };
      chip.count += 1;
      bySlug.set(d.slug, chip);
    }
  }
  return [...bySlug.values()]
    .filter((c) => c.count >= CATEGORY_V2_MIN_CHIP_COUNT)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, CATEGORY_V2_MAX_CHIPS);
}

/**
 * The numbers band. Every value is counted from the articles: the total is
 * the CMS pagination total (the same figure the old template shows), the rest
 * come from the category index. A figure with nothing behind it is dropped.
 */
export function categoryStats(total: number, index: CategoryCard[]): CategoryStat[] {
  const stats: CategoryStat[] = [];
  if (total > 0) stats.push({ value: total.toLocaleString('en-GB'), label: total === 1 ? 'article' : 'articles' });

  const destinations = new Set(index.flatMap((c) => c.destinations.map((d) => d.slug)));
  if (destinations.size > 0) {
    stats.push({
      value: destinations.size.toLocaleString('en-GB'),
      label: destinations.size === 1 ? 'destination covered' : 'destinations covered',
    });
  }

  const minutes = index.map((c) => c.readingMinutes).filter((m): m is number => m !== null);
  if (minutes.length > 0) {
    const avg = Math.round(minutes.reduce((s, m) => s + m, 0) / minutes.length);
    stats.push({ value: `${avg} min`, label: 'average read' });
  }

  const newest = index.find((c) => c.date);
  if (newest?.date) stats.push({ value: newest.date, label: 'newest article' });
  return stats;
}
