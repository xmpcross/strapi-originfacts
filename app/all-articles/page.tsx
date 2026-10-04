import { redirect } from 'next/navigation';
import { listArticles, mediaUrl } from '@/lib/strapi';
import ArticleCard from '@/components/ArticleCard';
import Link from 'next/link';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';

export const revalidate = 60;

const PAGE_SIZE = 12;
const DESCRIPTION =
  "Browse every Originfacts story, including travel guides, flight advice, hotel picks, airline explainers and destination planning notes.";

type Props = { searchParams: Promise<{ page?: string; q?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  return {
    title: page > 1 ? `All stories — page ${page}` : 'All stories',
    description: page > 1 ? `${DESCRIPTION} (Page ${page})` : DESCRIPTION,
    alternates: { canonical: page > 1 ? `/all-articles?page=${page}` : '/all-articles' },
  };
}

export default async function ArticlesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q || '').trim();

  // Search rendering lives on /search — redirect there when a query is present
  // so both URLs share the same layout/UX.
  if (q) {
    const params = new URLSearchParams({ q });
    if (page > 1) params.set('page', String(page));
    redirect(`/search?${params.toString()}`);
  }

  const { data, meta } = await listArticles({ page, pageSize: PAGE_SIZE });
  const totalPages = meta.pagination.pageCount;

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
    <div className="mx-auto max-w-7xl px-6 py-16" data-testid="articles-page">
      <JsonLd data={breadcrumbJsonLd([{ name: 'All stories', url: '/all-articles' }])} />
      <JsonLd data={collectionJsonLd} />

      <header className="max-w-3xl">
        <p className="chip">Archive</p>
        <h1 className="editorial-h mt-5 text-3xl font-bold text-forest-900">
          Every story we&rsquo;ve written
        </h1>
      </header>

      <form
        action="/search"
        method="get"
        className="mt-8 flex max-w-3xl items-center gap-3 rounded-xl border border-primary-emphasis/20 bg-white px-4 py-3 shadow-sm"
        data-testid="articles-search"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0 text-primary-emphasis"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          name="q"
          placeholder="Search stories, places, flights, hotels..."
          className="min-w-0 flex-1 bg-transparent text-base text-forest-900 outline-none placeholder:text-forest-900/45"
          data-testid="articles-search-input"
        />
        <button
          type="submit"
          className="rounded-[0.3rem] bg-primary-emphasis px-4 py-2 font-urbanist text-xs font-bold uppercase tracking-wider text-white transition hover:bg-primary-emphasis-hover"
        >
          Search
        </button>
      </form>

      {data.length === 0 ? (
        <p className="mt-20 text-center text-forest-900/60">No articles published yet.</p>
      ) : (
        <div className="mt-14 grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          {data.map((a) => <ArticleCard key={a.id} article={a} size="md" />)}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="mt-16 flex justify-center gap-3" data-testid="pagination">
          {Array.from({ length: totalPages }).map((_, i) => {
            const n = i + 1;
            const active = n === page;
            return (
              <Link
                key={n}
                href={`/all-articles?page=${n}`}
                className={`rounded-full border px-4 py-2 text-sm ${active ? 'border-forest-900 bg-forest-900 text-sand-100' : 'border-forest-900/20 text-forest-900 hover:bg-forest-900/5'}`}
                data-testid={`page-${n}`}
              >
                {n}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
