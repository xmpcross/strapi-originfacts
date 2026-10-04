'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { mediaUrl, type StrapiArticle } from '@/lib/strapi';

const AUTO_ADVANCE_MS = 2200;

export default function RelatedPostsSlider({ articles }: { articles: StrapiArticle[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  const step = useCallback((direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const firstItem = track.firstElementChild as HTMLElement | null;
    if (!firstItem) return;
    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
    const stride = firstItem.offsetWidth + gap;
    const maxScroll = track.scrollWidth - track.clientWidth;
    let next = track.scrollLeft + stride * direction;
    if (direction === 1 && next >= maxScroll - 2) next = 0;
    else if (direction === -1 && next < 0) next = maxScroll;
    track.scrollTo({ left: next, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (paused || articles.length <= 1) return;
    const id = window.setInterval(() => step(1), AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [articles.length, paused, step]);

  if (articles.length === 0) return null;

  return (
    <div
      className="related-posts-slider relative"
      data-testid="related-posts-slider"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {articles.map((a) => (
          <div
            key={a.id}
            className="snap-start shrink-0 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
          >
            <RelatedCard article={a} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="Previous slide"
        data-testid="related-slider-prev"
        className="absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-forest-900 shadow-[0_1px_3px_rgba(0,0,0,0.18)] transition hover:bg-forest-900 hover:text-white sm:flex"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => step(1)}
        aria-label="Next slide"
        data-testid="related-slider-next"
        className="absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-forest-900 shadow-[0_1px_3px_rgba(0,0,0,0.18)] transition hover:bg-forest-900 hover:text-white sm:flex"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}

function RelatedCard({ article }: { article: StrapiArticle }) {
  const img = mediaUrl(article.coverImage ?? null);
  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group block"
      data-testid={`related-slide-${article.slug}`}
    >
      <div className="overflow-hidden rounded bg-forest-900/5">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={article.coverImage?.alternativeText || article.title}
            className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="aspect-[4/3] w-full bg-gradient-to-br from-primary-hover to-primary-pressed" />
        )}
      </div>
      <h3 className="mt-4 line-clamp-2 text-base font-bold leading-snug text-forest-950 transition group-hover:text-primary-emphasis sm:text-lg">
        {article.title}
      </h3>
    </Link>
  );
}
