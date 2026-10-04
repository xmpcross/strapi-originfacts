import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { listArticles, mediaUrl, type StrapiArticle } from '@/lib/strapi';
import SearchInputForm from '@/components/SearchInputForm';
import type { Metadata } from 'next';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/SeoBlocks';

export const revalidate = 60;

const PAGE_SIZE = 12;

const POPULAR_SEARCHES = ['Travel', 'Flights', 'Hotels', 'Bangkok', 'Japan', 'Budget'];

const FILTER_LABELS: Record<string, string> = {
  'all-content': 'All Content',
  posts: 'Posts',
  pages: 'Pages',
  products: 'Products',
  categories: 'Categories',
  tags: 'Tags',
  authors: 'Authors',
};

type Props = {
  searchParams: Promise<{ q?: string; page?: string; type?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  return {
    title: q ? `Search · ${q}` : 'Search',
    description: q
      ? `Search results on Originfacts for "${q}"`
      : 'Search Originfacts — travel guides, flight tips, hotel reviews and more.',
    alternates: { canonical: '/search' },
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const type = (sp.type ?? 'all-content').trim();
  const filterLabel = FILTER_LABELS[type] ?? 'All Content';
  const page = Math.max(1, Number(sp.page) || 1);

  let articles: StrapiArticle[] = [];
  let total = 0;
  let pageCount = 0;
  if (q) {
    const res = await listArticles({ q, page, pageSize: PAGE_SIZE }).catch(() => ({
      data: [] as StrapiArticle[],
      meta: { pagination: { page: 1, pageSize: PAGE_SIZE, pageCount: 0, total: 0 } },
    }));
    articles = res.data;
    total = res.meta?.pagination?.total ?? 0;
    pageCount = Math.max(0, res.meta?.pagination?.pageCount ?? 0);
  }

  const breadcrumbs = breadcrumbJsonLd([{ name: 'Search', url: '/search' }]);

  return (
    <div data-testid="search-page">
      <JsonLd data={breadcrumbs} />
      <div className="mx-auto max-w-7xl px-6 py-16">
        <header data-testid="search-header">
          <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-12">
            <div className="min-w-0">
              <h1 className="font-urbanist text-3xl font-bold leading-tight tracking-tight text-forest-950 sm:text-4xl">
                {q ? (
                  <>
                    Search results for <span>&ldquo;{q}&rdquo;</span> in {filterLabel}
                  </>
                ) : (
                  <>Search Originfacts</>
                )}
              </h1>

              <div className="mt-8">
                <SearchInputForm initialQuery={q} initialType={type} />
              </div>

              <div
                className="mt-6 flex flex-wrap items-center gap-2"
                data-testid="search-popular"
              >
                <span className="mr-2 font-urbanist text-[12px] font-bold uppercase tracking-widest text-forest-950">
                  Popular Searches:
                </span>
                {POPULAR_SEARCHES.map((term) => (
                  <Link
                    key={term}
                    href={`/search?q=${encodeURIComponent(term)}`}
                    className={`inline-flex items-center rounded-full border px-4 py-1.5 font-urbanist text-[12px] font-bold uppercase tracking-widest transition ${
                      q.toLowerCase() === term.toLowerCase()
                        ? 'border-primary-emphasis bg-primary-emphasis text-white'
                        : 'border-forest-900/15 bg-white text-forest-900 hover:border-primary-emphasis hover:text-primary-emphasis'
                    }`}
                  >
                    {term}
                  </Link>
                ))}
              </div>
            </div>

            {q && (
              <div
                className="flex h-32 w-32 flex-col items-center justify-center rounded-[0.3rem] bg-[#f1f5f9] text-forest-950"
                data-testid="search-match-count"
              >
                <span className="font-urbanist text-4xl font-bold leading-none">{total}</span>
                <span className="mt-2 font-urbanist text-[11px] font-bold uppercase tracking-widest text-forest-900/70">
                  {total === 1 ? 'Match' : 'Matches'}
                </span>
              </div>
            )}
          </div>
        </header>

        {!q ? (
          <p
            className="mt-20 text-forest-900/55"
            data-testid="search-empty-initial"
          >
            Enter a keyword above to start your search.
          </p>
        ) : articles.length === 0 ? (
          <p
            className="mt-20 text-forest-900/55"
            data-testid="search-empty-results"
          >
            No results for &lsquo;{q}&rsquo;. Try a different keyword.
          </p>
        ) : (
          <>
            <ul
              className="mt-12 divide-y divide-forest-900/10"
              data-testid="search-results"
            >
              {articles.map((a) => (
                <li key={a.id} className="py-8 first:pt-0 last:pb-0">
                  <SearchResultRow article={a} />
                </li>
              ))}
            </ul>

            {pageCount > 1 && <Pagination current={page} total={pageCount} q={q} type={type} />}
          </>
        )}
      </div>
    </div>
  );
}

function SearchResultRow({ article }: { article: StrapiArticle }) {
  const img = mediaUrl(article.coverImage ?? null);
  const category = article.category?.name;
  const relative = article.publishedAt
    ? formatDistanceToNowStrict(new Date(article.publishedAt), { addSuffix: true })
    : null;
  return (
    <article
      className="grid grid-cols-[140px_minmax(0,1fr)] gap-6 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-8"
      data-testid={`search-card-${article.slug}`}
    >
      <Link
        href={`/articles/${article.slug}`}
        className="group block overflow-hidden rounded-[0.3rem] bg-forest-900/5"
        aria-label={article.title}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={article.coverImage?.alternativeText || article.title}
            className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="aspect-square w-full bg-gradient-to-br from-primary-hover to-primary-pressed" />
        )}
      </Link>

      <div className="min-w-0">
        <div className="font-urbanist text-[11px] font-bold uppercase tracking-wider">
          {category && (
            <span className="text-primary-emphasis">{category}</span>
          )}
          {category && relative && (
            <span aria-hidden className="mx-2 text-forest-900/40">✱</span>
          )}
          {relative && <span className="text-forest-900/55">{relative}</span>}
        </div>
        <Link href={`/articles/${article.slug}`}>
          <h3 className="mt-2 font-urbanist text-[clamp(1.1rem,0.8vw+0.85rem,1.45rem)] font-bold leading-snug text-forest-950 transition hover:text-primary-emphasis">
            {article.title}
          </h3>
        </Link>
        {article.excerpt && (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-forest-900/65 sm:text-base">
            {article.excerpt}
          </p>
        )}
        <div className="mt-4">
          <span className="inline-flex items-center rounded-[0.3rem] bg-[#f1f5f9] px-3 py-1 font-urbanist text-[11px] font-bold uppercase tracking-widest text-forest-900/70">
            Post
          </span>
        </div>
      </div>
    </article>
  );
}

function Pagination({
  current,
  total,
  q,
  type,
}: {
  current: number;
  total: number;
  q: string;
  type: string;
}) {
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <nav
      aria-label="Search pagination"
      className="mt-12 flex items-center gap-2"
      data-testid="search-pagination"
    >
      {pages.map((p) => {
        const active = p === current;
        const params = new URLSearchParams({ q });
        if (type && type !== 'all-content') params.set('type', type);
        if (p > 1) params.set('page', String(p));
        const href = `/search?${params.toString()}`;
        return (
          <Link
            key={p}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-[0.3rem] border px-3 font-urbanist text-sm font-bold transition ${
              active
                ? 'border-primary-emphasis bg-primary-emphasis text-white'
                : 'border-forest-900/15 bg-white text-forest-900 hover:border-primary-emphasis hover:text-primary-emphasis'
            }`}
          >
            {p}
          </Link>
        );
      })}
    </nav>
  );
}
