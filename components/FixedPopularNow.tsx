'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { mediaUrl, type StrapiArticle } from '@/lib/strapi';

const COLLAPSED_COUNT = 4;

// Pages where the fixed left/right rails should be hidden. Currently destination
// detail pages (e.g. /destinations/united-kingdom) hide them to give the hero
// + facts panel + airports/airlines filters more horizontal room.
const HIDE_PATTERNS = [/^\/destinations\/[^/]+$/];

export default function FixedPopularNow({ articles }: { articles: StrapiArticle[] }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const items = expanded ? articles : articles.slice(0, COLLAPSED_COUNT);

  if (articles.length === 0) return null;
  if (pathname && HIDE_PATTERNS.some((re) => re.test(pathname))) return null;

  return (
    <aside
      className="pointer-events-none fixed left-[50px] top-[200px] z-40 hidden lg:block"
      data-testid="fixed-popular-now"
    >
      <div className="pointer-events-auto flex flex-col items-center">
        <div className="mb-2 flex w-[80px] items-start justify-center">
          <span className="text-[12px] font-bold uppercase leading-tight tracking-wider text-forest-900">
            Popular
            <br />
            Now
          </span>
          <svg
            viewBox="0 0 40 40"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-1 mt-1 h-7 w-7 text-forest-900"
            aria-hidden
          >
            <path d="M6 10 C 22 4, 32 14, 32 30" />
            <polyline points="26 26 32 30 32 22" />
          </svg>
        </div>

        <ul className="flex flex-col items-center" data-testid="fixed-popular-now-list">
          {items.map((article, i) => (
            <li key={article.id} className={i === 0 ? '' : '-mt-2'}>
              <PopularThumb article={article} rank={i + 1} />
            </li>
          ))}
        </ul>

        {articles.length > COLLAPSED_COUNT && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Show fewer' : 'Show more'}
            className="mt-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-forest-900 shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition hover:bg-forest-900 hover:text-white"
            data-testid="fixed-popular-now-toggle"
          >
            {expanded ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}

function PopularThumb({ article, rank }: { article: StrapiArticle; rank: number }) {
  const img = mediaUrl(article.coverImage ?? null);
  const rankStr = String(rank).padStart(2, '0');

  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group relative block h-[64px] w-[64px] overflow-hidden rounded-full bg-forest-900 shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
      aria-label={article.title}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={article.coverImage?.alternativeText || article.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
          loading="lazy"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-primary-hover to-primary-pressed" />
      )}
      {/* Rank overlay on hover */}
      <span
        aria-hidden
        className="absolute inset-1 flex items-center justify-center rounded-full bg-black/35 text-xl font-bold text-white opacity-0 transition duration-300 group-hover:opacity-100"
      >
        {rankStr}
      </span>
      {/* Title popover to the right on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-full top-1/2 ml-5 -translate-y-1/2 translate-x-2 w-[260px] rounded-md bg-white px-3 py-2 text-sm font-bold leading-tight text-forest-900 opacity-0 shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition group-hover:translate-x-0 group-hover:opacity-100"
      >
        {article.title}
      </span>
    </Link>
  );
}
