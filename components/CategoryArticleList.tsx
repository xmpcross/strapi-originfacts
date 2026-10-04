'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mediaUrl, type StrapiArticle } from '@/lib/strapi';
import BlogSidebar from './BlogSidebar';

function dateParts(iso?: string) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return {
      day: format(d, 'dd'),
      monthYear: `${format(d, 'MMM').toUpperCase()} — ${format(d, 'yyyy')}`,
    };
  } catch {
    return null;
  }
}

function Row({ article }: { article: StrapiArticle }) {
  const img = mediaUrl(article.coverImage ?? null);
  const eyebrow = (article.category?.name ?? '').toUpperCase();
  const dp = dateParts(article.publishedAt);

  return (
    <article
      className="grid grid-cols-[80px_minmax(0,1fr)_140px] items-start gap-5 border-b border-forest-900/10 py-7 sm:grid-cols-[96px_minmax(0,1fr)_160px] sm:gap-6"
      data-testid={`category-row-${article.slug}`}
    >
      <div className="border-l-2 border-primary-emphasis/40 pl-3 sm:pl-4">
        <div className="text-3xl font-bold leading-none text-primary-emphasis sm:text-4xl">
          {dp?.day ?? '--'}
        </div>
        <div className="mt-2 text-[10px] font-semibold tracking-widest text-forest-900/60">
          {dp?.monthYear ?? ''}
        </div>
      </div>

      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-widest text-forest-900/55">
            {eyebrow}
          </p>
        )}
        <h3 className="mt-2">
          <Link
            href={`/articles/${article.slug}`}
            className="editorial-h text-lg font-bold leading-snug text-forest-900 transition hover:text-primary-emphasis sm:text-xl"
          >
            {article.title}
          </Link>
        </h3>
        {article.excerpt && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink/70">
            {article.excerpt}
          </p>
        )}
        <Link
          href={`/articles/${article.slug}`}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-forest-900/15 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-forest-900 transition hover:border-primary-emphasis hover:text-primary-emphasis"
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

      <Link
        href={`/articles/${article.slug}`}
        className="block overflow-hidden rounded bg-forest-900/5"
        aria-hidden
        tabIndex={-1}
      >
        <div className="aspect-square w-full">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={article.coverImage?.alternativeText || article.title}
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 hover:scale-105"
            />
          ) : (
            <div className="size-full bg-gradient-to-br from-forest-100 to-forest-200" />
          )}
        </div>
      </Link>
    </article>
  );
}

export default function CategoryArticleList({
  initialArticles,
  categorySlug,
  initialPage,
  pageSize,
  hasMore: initialHasMore,
  popularPosts = [],
  recentPosts = [],
  categoryTiles = [],
}: {
  initialArticles: StrapiArticle[];
  categorySlug: string;
  initialPage: number;
  pageSize: number;
  hasMore: boolean;
  popularPosts?: StrapiArticle[];
  recentPosts?: StrapiArticle[];
  categoryTiles?: {
    slug: string;
    name: string;
    count: number;
    image: string | null;
  }[];
}) {
  const [articles, setArticles] = useState<StrapiArticle[]>(initialArticles);
  const [page, setPage] = useState<number>(initialPage);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const next = page + 1;
      const res = await fetch(
        `/api/category-articles?slug=${encodeURIComponent(categorySlug)}&page=${next}&pageSize=${pageSize}`,
      );
      if (!res.ok) {
        setHasMore(false);
        return;
      }
      const json = (await res.json()) as {
        data: StrapiArticle[];
        pagination: { page: number; pageCount: number };
      };
      setArticles((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        return [...prev, ...json.data.filter((a) => !seen.has(a.id))];
      });
      setPage(next);
      setHasMore(json.pagination.page < json.pagination.pageCount);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [categorySlug, hasMore, loading, page, pageSize]);

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (articles.length === 0) return null;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_280px] lg:gap-14">
      <div>
        <div className="border-t border-forest-900/10">
          {articles.map((a) => (
            <Row key={a.id} article={a} />
          ))}
        </div>
        {hasMore && (
          <div
            ref={sentinelRef}
            className="flex items-center justify-center py-10 text-[11px] font-semibold uppercase tracking-widest text-forest-900/50"
            data-testid="category-load-more-sentinel"
            aria-live="polite"
          >
            {loading ? 'Loading more stories…' : 'Scroll for more'}
          </div>
        )}
      </div>
      <BlogSidebar
        popularPosts={popularPosts}
        recentPosts={recentPosts}
        categoryTiles={categoryTiles}
        backToTopHref={`/category/${categorySlug}`}
      />
    </div>
  );
}
