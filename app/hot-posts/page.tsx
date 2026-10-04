import Link from 'next/link';
import { format } from 'date-fns';
import {
  listHotArticles,
  listSidebarArticles,
  listSidebarCategoryTiles,
  mediaUrl,
  type StrapiArticle,
} from '@/lib/strapi';
import { SECTIONS } from '@/lib/sections';
import BlogSidebar from '@/components/BlogSidebar';
import type { Metadata } from 'next';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/SeoBlocks';

export const revalidate = 60;

const PAGE_SIZE = 12;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export const metadata: Metadata = {
  title: 'Trending',
  description: 'The most-read travel stories on Originfacts right now — ranked by depth and engagement.',
  alternates: { canonical: '/hot-posts' },
};

export default async function HotPostsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const [hotRes, sidebar, categoryTiles] = await Promise.all([
    listHotArticles({ page, pageSize: PAGE_SIZE }).catch(() => ({
      data: [] as StrapiArticle[],
      meta: { pagination: { page: 1, pageSize: PAGE_SIZE, pageCount: 0, total: 0 } },
    })),
    listSidebarArticles(5).catch(() => ({ recent: [], popular: [] })),
    listSidebarCategoryTiles(
      SECTIONS.filter((s) => s.slug !== 'destinations').map((s) => s.slug),
    ).catch(() => []),
  ]);

  const articles = hotRes.data;
  const pageCount = Math.max(1, hotRes.meta?.pagination?.pageCount ?? 1);
  const startIndex = (page - 1) * PAGE_SIZE;

  const breadcrumbs = breadcrumbJsonLd([{ name: 'Trending', url: '/hot-posts' }]);

  return (
    <div data-testid="hot-posts-page">
      <JsonLd data={breadcrumbs} />
      <div className="mx-auto max-w-7xl px-6 py-16">
        <header data-testid="hot-posts-header">
          <h1 className="font-urbanist text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">
            Trending
          </h1>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-14">
          <BlogSidebar
            popularPosts={sidebar.popular}
            recentPosts={sidebar.recent}
            categoryTiles={categoryTiles}
          />

          <main className="min-w-0">
            {articles.length === 0 ? (
              <p className="py-20 text-center text-forest-900/60" data-testid="hot-posts-empty">
                No posts to rank yet. Check back soon.
              </p>
            ) : (
              <>
                <ul
                  className="grid items-start gap-x-8 gap-y-12 sm:grid-cols-2"
                  data-testid="hot-posts-grid"
                >
                  {articles.map((a, i) => (
                    <li key={a.id}>
                      <HotPostCard
                        article={a}
                        rank={startIndex + i + 1}
                        imageAspect={i % 2 === 0 ? 'aspect-[16/10]' : 'aspect-[40/27]'}
                      />
                    </li>
                  ))}
                </ul>

                {pageCount > 1 && <Pagination current={page} total={pageCount} />}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function HotPostCard({
  article,
  rank,
  imageAspect = 'aspect-[16/10]',
}: {
  article: StrapiArticle;
  rank: number;
  imageAspect?: string;
}) {
  const img = mediaUrl(article.coverImage ?? null);
  const category = article.category?.name;
  const dateStr = article.publishedAt
    ? format(new Date(article.publishedAt), 'd MMM yyyy')
    : '';
  const rankStr = String(rank).padStart(2, '0');

  return (
    <article
      className="group relative flex flex-col gap-4"
      data-testid={`hot-post-card-${article.slug}`}
    >
      <Link
        href={`/articles/${article.slug}`}
        className="relative block overflow-hidden rounded-[0.3rem] bg-forest-900/5"
        aria-label={article.title}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={article.coverImage?.alternativeText || article.title}
            className={`${imageAspect} w-full object-cover transition duration-500 group-hover:scale-[1.02]`}
            loading="lazy"
          />
        ) : (
          <div className={`${imageAspect} w-full bg-gradient-to-br from-primary-hover to-primary-pressed`} />
        )}
        <span
          aria-hidden
          className="absolute -bottom-2 -left-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-forest-950 font-urbanist text-xl font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,0.25)] sm:-bottom-3 sm:-left-3 sm:h-16 sm:w-16 sm:text-2xl"
        >
          {rankStr}
        </span>
      </Link>
      <div>
        <div className="flex items-center gap-3 font-urbanist text-[11px] font-bold uppercase tracking-wider">
          {category && (
            <Link
              href={`/category/${article.category?.slug ?? ''}`}
              className="rounded-full bg-primary-emphasis px-3 py-1 text-white transition hover:bg-primary-emphasisHover"
            >
              {category}
            </Link>
          )}
          {dateStr && <span className="text-forest-900/55">{dateStr}</span>}
        </div>
        <Link href={`/articles/${article.slug}`}>
          <h2 className="mt-3 font-urbanist text-[clamp(1.05rem,0.6vw+0.9rem,1.25rem)] font-bold leading-snug text-forest-950 transition group-hover:text-primary-emphasis">
            {article.title}
          </h2>
        </Link>
        {article.excerpt && (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/70">
            {article.excerpt}
          </p>
        )}
        <Link
          href={`/articles/${article.slug}`}
          className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold uppercase tracking-wider text-primary-emphasis underline underline-offset-2 hover:no-underline"
        >
          Read More
          <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}

function Pagination({ current, total }: { current: number; total: number }) {
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <nav
      aria-label="Hot Posts pagination"
      className="mt-12 flex items-center justify-center gap-2"
      data-testid="hot-posts-pagination"
    >
      {pages.map((p) => {
        const active = p === current;
        const href = p === 1 ? '/hot-posts' : `/hot-posts?page=${p}`;
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
