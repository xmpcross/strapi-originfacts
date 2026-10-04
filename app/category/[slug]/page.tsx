import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  getCategory,
  listArticles,
  listDestinationArticles,
  listSidebarArticles,
  listSidebarCategoryTiles,
  mediaUrl,
  type StrapiArticle,
} from '@/lib/strapi';
import { SECTIONS, findSection } from '@/lib/sections';
import CategoryDescription from '@/components/CategoryDescription';
import BlogSidebar from '@/components/BlogSidebar';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { clampDescription } from '@/lib/seo';
import type { Metadata } from 'next';

export const revalidate = 60;

const PAGE_SIZE = 10;
const FLIGHTS_PAGE_SIZE = 11;

type FeedItem =
  | { type: 'article'; article: StrapiArticle }
  | { type: 'sponsor'; sponsor: 'qatar'; id: string };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

async function resolveCategory(slug: string) {
  const strapi = await getCategory(slug).catch(() => null);
  if (strapi) {
    return {
      name: strapi.name,
      description: strapi.description ?? findSection(slug)?.description,
      tagline: findSection(slug)?.tagline,
      children: strapi.children ?? [],
      fromStrapi: true as const,
    };
  }
  const section = findSection(slug);
  if (section) {
    return {
      name: section.title,
      description: section.description,
      tagline: section.tagline,
      children: [] as { id: number; name: string; slug: string }[],
      fromStrapi: false as const,
    };
  }
  return null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await resolveCategory(slug);
  if (!c) return { title: 'Not found' };
  // Self-referencing canonical per page. Pointing ?page=2+ back at page 1 would
  // ask Google to drop those URLs, taking the only crawl path to the older
  // articles with them.
  const page = Math.max(1, Number((await searchParams).page) || 1);
  return {
    title: page > 1 ? `${c.name} — page ${page}` : c.name,
    description: page > 1 ? `${clampDescription(c.description)} (Page ${page})` : clampDescription(c.description),
    alternates: { canonical: page > 1 ? `/category/${slug}?page=${page}` : `/category/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const category = await resolveCategory(slug);
  if (!category) notFound();
  const pageSize = slug === 'flights' ? FLIGHTS_PAGE_SIZE : PAGE_SIZE;

  const [articlesRes, sidebar, categoryTiles] = await Promise.all([
    (slug === 'destinations'
      ? listDestinationArticles({ pageSize, page })
      : listArticles({ category: slug, pageSize, page })
    ).catch(() => ({
      data: [] as StrapiArticle[],
      meta: { pagination: { page: 1, pageSize, pageCount: 0, total: 0 } },
    })),
    listSidebarArticles(5).catch(() => ({ recent: [], popular: [] })),
    listSidebarCategoryTiles(
      SECTIONS.filter((s) => s.slug !== 'destinations').map((s) => s.slug),
    ).catch(() => []),
  ]);

  const articles = articlesRes.data;
  const feedItems = slug === 'flights' ? withFlightSponsorCards(articles) : articles.map((article) => ({
    type: 'article' as const,
    article,
  }));
  const total = articlesRes.meta?.pagination?.total ?? 0;
  const pageCount = Math.max(1, articlesRes.meta?.pagination?.pageCount ?? 1);

  // This hub is genuinely server-paginated, so the ItemList describes only the
  // articles on the current page. Positions continue across pages rather than
  // restarting at 1, so page 2 reports 11-20.
  const canonicalPath = page > 1 ? `/category/${slug}?page=${page}` : `/category/${slug}`;
  const collectionJsonLd = collectionPageJsonLd({
    name: category.name,
    description: category.description ?? `Articles filed under ${category.name}.`,
    url: canonicalPath,
    itemListName: category.name,
    items: articles.map((a, i) => ({
      name: a.title,
      url: `/articles/${a.slug}`,
      image: mediaUrl(a.coverImage ?? null),
      position: (page - 1) * pageSize + i + 1,
    })),
  });

  return (
    <div data-testid={`category-page-${slug}`}>
      <JsonLd data={breadcrumbJsonLd([{ name: category.name, url: `/category/${slug}` }])} />
      <JsonLd data={collectionJsonLd} />

      <div className="mx-auto max-w-7xl px-6 py-16">
        {/* Header — large title + description on the left, articles count box on the right */}
        <header data-testid="category-header">
          <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-12">
            <div className="min-w-0">
              <h1 className="font-urbanist text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">
                {category.name}
              </h1>
              {category.description && (
                <CategoryDescription text={category.description} />
              )}
            </div>
            <div
              className="flex h-32 w-32 flex-col items-center justify-center rounded-[0.3rem] bg-[#f1f5f9] text-forest-950"
              data-testid="category-article-count"
            >
              <span className="font-urbanist text-4xl font-bold leading-none">{total}</span>
              <span className="mt-2 font-urbanist text-[11px] font-bold uppercase tracking-widest text-forest-900/70">
                {total === 1 ? 'Article' : 'Articles'}
              </span>
            </div>
          </div>

          <nav
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-forest-900/15 py-4 font-urbanist text-[14px] font-bold uppercase tracking-widest text-forest-950"
            aria-label="Categories"
            data-testid="category-subnav"
          >
            {[
              ...(category.children.length > 0
                ? category.children.map((c) => ({
                    href: `/category/${c.slug}`,
                    slug: c.slug,
                    name: c.name,
                  }))
                : SECTIONS.filter((s) => s.slug !== 'destinations').map((s) => ({
                    href: `/category/${s.slug}`,
                    slug: s.slug,
                    name: s.title,
                  }))),
              { href: '/airlines', slug: 'airlines', name: 'Airlines' },
              { href: '/airports', slug: 'airports', name: 'Airports' },
            ].map((item) => (
              <Link
                key={item.slug}
                href={item.href}
                className={`transition hover:text-primary-emphasis ${
                  item.slug === slug ? 'text-primary-emphasis' : ''
                }`}
                aria-current={item.slug === slug ? 'page' : undefined}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </header>

        {/* 2-column: article feed + sidebar */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px] lg:gap-14">
          <main className="min-w-0">
            {articles.length === 0 ? (
              <p className="py-20 text-center text-forest-900/60" data-testid="category-empty">
                No articles in this category yet. Check back soon.
              </p>
            ) : (
              <>
                <ul
                  className="grid items-start gap-[15px] sm:grid-cols-2"
                  data-testid="category-feed"
                >
                  {feedItems.map((item, i) => (
                    <li key={item.type === 'article' ? item.article.id : item.id}>
                      {item.type === 'article' ? (
                        <CategoryFeedCard
                          article={item.article}
                          imageAspect={i % 2 === 0 ? 'aspect-[16/9]' : 'aspect-[40/27]'}
                        />
                      ) : (
                        <QatarAirwaysFeedBanner slotIndex={i + 1} />
                      )}
                    </li>
                  ))}
                </ul>

                {pageCount > 1 && (
                  <Pagination current={page} total={pageCount} slug={slug} />
                )}
              </>
            )}
          </main>

          <BlogSidebar
            popularPosts={sidebar.popular}
            recentPosts={sidebar.recent}
            categoryTiles={categoryTiles}
            backToTopHref={`/category/${slug}`}
          />
        </div>
      </div>
    </div>
  );
}

function withFlightSponsorCards(articles: StrapiArticle[]): FeedItem[] {
  const feedItems: FeedItem[] = [];

  articles.forEach((article, index) => {
    const articlePosition = index + 1;
    feedItems.push({ type: 'article', article });

    if (articlePosition % 3 === 0) {
      feedItems.push({
        type: 'sponsor',
        sponsor: 'qatar',
        id: `sponsor-qatar-airways-after-post-${articlePosition}`,
      });
    }
  });

  return feedItems;
}

function QatarAirwaysFeedBanner({ slotIndex }: { slotIndex: number }) {
  return (
    <aside
      className="group mx-auto flex h-full min-h-[430px] w-full max-w-[540px] flex-col overflow-hidden rounded-[0.4rem] border border-solid border-[#e5e7eb] bg-white ring-1 ring-forest-900/5"
      data-testid={`flights-category-qatar-feed-banner-${slotIndex}`}
      aria-label="Sponsored Qatar Airways flight offer"
    >
      <a
        href="https://tatrck.com/h/0Hu30_OZ0RC7?model=cpa"
        target="_blank"
        rel="sponsored nofollow noopener noreferrer"
        className="flex h-full flex-col"
      >
        <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-[#f4e8ee] via-[#fbf7f9] to-[#ffffff]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(122,31,69,0.1),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.35),rgba(122,31,69,0.04))]" />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-5 text-forest-950">
            <span className="rounded-full bg-white px-3 py-1 font-urbanist text-[10px] font-bold uppercase tracking-[0.18em] text-[#7a1f45]">
              Sponsored
            </span>
            <span className="inline-flex h-10 w-32 items-center justify-center rounded-full bg-white px-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/ads/qatar-airways-logo.svg"
                alt="Qatar Airways"
                className="h-7 w-full object-contain"
                loading="lazy"
              />
            </span>
          </div>
          <div className="absolute bottom-5 left-5 right-5">
            <p className="font-urbanist text-[11px] font-bold uppercase tracking-[0.2em] text-[#7a1f45]/75">
              Long-haul flight options
            </p>
            <p className="mt-2 max-w-sm font-urbanist text-3xl font-bold leading-[1.02] text-forest-950">
              Compare routes through Doha
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <p className="w-fit rounded-full bg-[#7a1f45] px-3 py-1 font-urbanist text-[11px] font-bold uppercase tracking-wider text-white">
            Qatar Airways
          </p>
          <h2 className="mt-3 font-urbanist text-[clamp(1.1rem,1vw+0.85rem,1.4rem)] font-bold leading-snug text-forest-950 transition group-hover:text-[#7a1f45]">
            Search Qatar Airways fares and routes
          </h2>
          <p className="mt-5 text-sm leading-6 text-ink/70 sm:text-base">
            Compare Qatar Airways flight options for long-haul trips, premium cabins and one-stop connections through Doha.
          </p>
          <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-forest-900/15 bg-white px-4 py-2 font-urbanist text-[11px] font-bold uppercase tracking-widest text-forest-900 transition group-hover:border-[#7a1f45] group-hover:text-[#7a1f45]">
            Search Qatar Airways
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-forest-900 text-white transition group-hover:bg-[#7a1f45]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
                aria-hidden
              >
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </span>
          </span>
        </div>
      </a>
    </aside>
  );
}

function CategoryFeedCard({
  article,
  imageAspect = 'aspect-[16/9]',
}: {
  article: StrapiArticle;
  imageAspect?: string;
}) {
  const img = mediaUrl(article.coverImage ?? null);
  const category = article.category?.name;
  const dateStr = article.publishedAt
    ? format(new Date(article.publishedAt), 'd MMM yyyy')
    : '';
  return (
    <article
      className="group flex flex-col gap-5"
      data-testid={`category-feed-card-${article.slug}`}
    >
      <Link
        href={`/articles/${article.slug}`}
        className="block overflow-hidden rounded-[0.3rem] bg-forest-900/5"
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
          <h2 className="mt-3 font-urbanist text-[clamp(1.1rem,1vw+0.85rem,1.4rem)] font-bold leading-snug text-forest-950 transition group-hover:text-primary-emphasis">
            {article.title}
          </h2>
        </Link>
        {article.excerpt && (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink/70 sm:text-base">
            {article.excerpt}
          </p>
        )}
        <div className="mt-5">
          <Link
            href={`/articles/${article.slug}`}
            className="inline-flex items-center gap-2 rounded-full border border-forest-900/15 bg-white px-4 py-2 font-urbanist text-[11px] font-bold uppercase tracking-widest text-forest-900 transition hover:border-primary-emphasis hover:text-primary-emphasis"
          >
            Read More
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-forest-900 text-white transition group-hover:bg-primary-emphasis">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
                aria-hidden
              >
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}

function Pagination({
  current,
  total,
  slug,
}: {
  current: number;
  total: number;
  slug: string;
}) {
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <nav
      aria-label="Category pagination"
      className="mt-12 flex items-center justify-center gap-2"
      data-testid="category-pagination"
    >
      {pages.map((p) => {
        const active = p === current;
        const href = p === 1 ? `/category/${slug}` : `/category/${slug}?page=${p}`;
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
