import { DEFAULT_AUTHOR_SLUG, authorPersonJsonLd, type AuthorProfile } from '@/lib/authors';
import { listArticleIndex, type StrapiArticle } from '@/lib/strapi';

/**
 * What the /authors pages show about each author, counted from the CMS rather
 * than typed: bylined articles, the categories they fall in, and the latest
 * ones. A byline follows the article's CMS author; an article with none is
 * bylined DEFAULT_AUTHOR_SLUG (same rule as lib/authors.ts and the article page).
 */
export type AuthorCategory = { slug: string; name: string; count: number };

export type AuthorStats = {
  articleCount: number;
  categories: AuthorCategory[];
  latest: StrapiArticle[];
  latestPublishedAt: string | null;
};

const EMPTY: AuthorStats = { articleCount: 0, categories: [], latest: [], latestPublishedAt: null };

/** The author slug an article is bylined to. */
export function bylineSlug(article: Pick<StrapiArticle, 'author'>): string {
  return article.author?.slug || DEFAULT_AUTHOR_SLUG;
}

/** Every visible article (newest first), or [] if the CMS is unreachable. */
export async function articleIndex(): Promise<StrapiArticle[]> {
  return listArticleIndex()
    .then((r) => r.data ?? [])
    .catch(() => [] as StrapiArticle[]);
}

export function statsFor(slug: string, articles: StrapiArticle[], latestCount = 3): AuthorStats {
  const mine = articles.filter((a) => bylineSlug(a) === slug);
  if (mine.length === 0) return EMPTY;
  const byCategory = new Map<string, AuthorCategory>();
  for (const a of mine) {
    if (!a.category?.slug) continue;
    const c = byCategory.get(a.category.slug) ?? { slug: a.category.slug, name: a.category.name, count: 0 };
    c.count += 1;
    byCategory.set(a.category.slug, c);
  }
  return {
    articleCount: mine.length,
    categories: [...byCategory.values()].sort((x, y) => y.count - x.count || x.name.localeCompare(y.name)),
    latest: mine.slice(0, latestCount),
    latestPublishedAt: mine[0]?.publishedAt ?? null,
  };
}

/**
 * Whether the author has a real photo in the CMS. Authors without one get an
 * initials avatar, never the generic placeholder image.
 */
export function hasPhoto(author: AuthorProfile): boolean {
  return Boolean(author.avatar) && !author.avatar.startsWith('/brand/authors/');
}

/** "K Spellman" -> "KS". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Person JSON-LD that only claims an image when the page actually shows one. */
export function personJsonLdAsShown(author: AuthorProfile): Record<string, unknown> {
  const ld = authorPersonJsonLd(author);
  if (!hasPhoto(author)) delete ld.image;
  return ld;
}
