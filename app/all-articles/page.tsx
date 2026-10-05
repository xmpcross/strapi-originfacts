import Link from 'next/link';
import type { Metadata } from 'next';
import { listArticleIndexWithDestinations, listArticles, mediaUrl, type StrapiArticle } from '@/lib/strapi';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { categoryStats } from '@/components/category-v2/view';
import ArticleIndexBrowser from '@/components/article-index/ArticleIndexBrowser';
import { toIndexCard } from '@/components/article-index/view';
import { parseFilters } from '@/components/article-index/filters';

export const revalidate = 60;

const PAGE_SIZE = 12;
const DESCRIPTION =
  "Browse every Originfacts story, including travel guides, flight advice, hotel picks, airline explainers and destination planning notes.";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<SearchParams> };

function pageFrom(sp: SearchParams): number {
  const raw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  return Math.max(1, Number(raw) || 1);
}

/**
 * Metadata, canonical and JSON-LD depend on ?page= only. Filter parameters
 * (?category=, ?destination=, ?q=, …) are a client view of the same archive:
 * their canonical is the unfiltered page, so they never compete with it.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = pageFrom(await searchParams);
  return {
    title: page > 1 ? `Travel Articles & Tips — page ${page}` : 'Travel Articles & Tips',
    description: page > 1 ? `${DESCRIPTION} (Page ${page})` : DESCRIPTION,
    alternates: { canonical: page > 1 ? `/all-articles?page=${page}` : '/all-articles' },
  };
}

export default async function ArticlesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = pageFrom(sp);
  const filters = parseFilters(sp);

  const [{ data, meta }, index] = await Promise.all([
    listArticles({ page, pageSize: PAGE_SIZE }),
    listArticleIndexWithDestinations().catch((err): StrapiArticle[] => {
      console.error('[all-articles] article index unavailable, filters disabled:', err);
      return [];
    }),
  ]);
  const total = meta.pagination.total;
  const totalPages = meta.pagination.pageCount;

  const pageCards = data.map(toIndexCard);
  const indexCards = index.map(toIndexCard);
  const stats = categoryStats(total, indexCards);

  const categories = new Map<string, { slug: string; name: string; count: number }>();
  for (const c of indexCards) {
    if (!c.category) continue;
    const entry = categories.get(c.category.slug) ?? { ...c.category, count: 0 };
    entry.count += 1;
    categories.set(c.category.slug, entry);
  }
  const categoryLinks = [...categories.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const collectionJsonLd = collectionPageJsonLd({
    name: 'All stories',
    description: DESCRIPTION,
    url: page > 1 ? `/all-articles?page=${page}` : '/all-articles',
    itemListName: 'Articles',
    items: data.map((a, i) => ({
      name: a.title,
      url: `/articles/${a.slug}`,
      image: mediaUrl(a.coverImage ?? null),
      position: (page - 1) * PAGE_SIZE + i + 1,
    })),
  });

  return (
    <div className="overflow-x-clip" data-testid="articles-page" data-template="article-index">
      <JsonLd data={breadcrumbJsonLd([{ name: 'All stories', url: '/all-articles' }])} />
      <JsonLd data={collectionJsonLd} />

      {/* ---------------- Hero ---------------- */}
      <header className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16" data-testid="articles-header">
        <p className="eyebrow-tag">Archive</p>
        <h1 className="mt-5 max-w-4xl text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-7xl">
          Every story we&rsquo;ve written
        </h1>
        {page > 1 && (
          <p className="mt-3 text-lg font-semibold text-forest-900/55">
            Page {page} of {totalPages}
          </p>
        )}
        <p className="mt-6 max-w-2xl text-xl font-semibold leading-snug text-forest-900 sm:text-2xl">
          Travel guides, flight advice, hotel round-ups, airline explainers and destination planning notes, newest first.
        </p>
        {total > 0 && (
          <p className="mt-5 text-sm text-forest-900/65">
            {total} {total === 1 ? 'article' : 'articles'}. Filter by category, destination or date.{' '}
            <Link href="/methodology" className="font-semibold text-forest-950 underline-offset-2 hover:underline">
              How we research and write →
            </Link>
          </p>
        )}

        {categoryLinks.length > 0 && (
          <nav
            className="no-scrollbar mt-10 flex gap-x-7 overflow-x-auto border-y border-forest-900/15 py-4 text-[13px] font-bold uppercase tracking-widest text-forest-950 sm:flex-wrap sm:overflow-visible"
            aria-label="Categories"
            data-testid="articles-category-nav"
          >
            {categoryLinks.map((c) => (
              <Link key={c.slug} href={`/category/${c.slug}`} className="flex-none transition hover:text-primary-emphasis">
                {c.name} <span className="font-semibold text-forest-900/45">{c.count}</span>
              </Link>
            ))}
          </nav>
        )}
      </header>

      {/* ---------------- Numbers ---------------- */}
      {stats.length > 1 && (
        <section aria-label="The archive in numbers" className="border-y border-forest-900/15 bg-paper" data-testid="articles-stats">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex min-w-0 flex-col-reverse border-l-2 border-primary-emphasis pl-4">
                <dt className="mt-2 text-xs font-bold uppercase tracking-widest text-forest-900/60">{s.label}</dt>
                <dd className="text-3xl font-bold leading-none text-forest-950 sm:text-4xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* ---------------- Archive ---------------- */}
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 sm:pt-14" aria-labelledby="articles-archive" data-testid="articles-archive">
        <h2 id="articles-archive" className="sr-only">
          All articles
        </h2>
        <ArticleIndexBrowser
          total={total}
          pageCards={pageCards}
          indexCards={indexCards}
          page={page}
          pageCount={totalPages}
          pageSize={PAGE_SIZE}
          initialFilters={filters}
          nowIso={new Date().toISOString()}
        />
      </section>
    </div>
  );
}
