'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { GridCard } from './Cards';
import { matchesQuery, type CategoryCard, type DestinationChip } from './search';

/**
 * The full listing. With no search and no destination picked it shows the
 * server-rendered ?page= slice (the same articles the route's ItemList
 * JSON-LD describes) with page links. Searching or picking a destination
 * filters the whole category index on the client; the URL does not change.
 */
export default function CategoryBrowser({
  categoryName,
  slug,
  pageCards,
  indexCards,
  chips,
  page,
  pageCount,
  allShownAbove = false,
}: {
  categoryName: string;
  slug: string;
  pageCards: CategoryCard[];
  indexCards: CategoryCard[];
  chips: DestinationChip[];
  page: number;
  pageCount: number;
  /** Every article on this page is already in the Latest block above. */
  allShownAbove?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<string | null>(null);
  const searchId = useId();
  const filtering = query.trim() !== '' || destination !== null;
  const canFilter = indexCards.length > 0;

  const results = useMemo(() => {
    if (!filtering) return pageCards;
    return indexCards.filter(
      (c) => matchesQuery(c, query) && (!destination || c.destinations.some((d) => d.slug === destination)),
    );
  }, [filtering, pageCards, indexCards, query, destination]);

  const reset = () => {
    setQuery('');
    setDestination(null);
  };
  const activeChip = chips.find((c) => c.slug === destination);

  return (
    <div data-testid="category-v2-browser">
      {canFilter && (
        <div className="sticky top-[75px] z-20 -mx-4 border-y border-forest-900/10 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-[0.3rem] sm:border sm:px-3">
          <div className="relative">
            <label htmlFor={searchId} className="sr-only">
              Search {indexCards.length} {categoryName} articles by title or destination
            </label>
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-forest-900/45">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or destination"
              autoComplete="off"
              className="h-11 w-full rounded-[0.3rem] border border-forest-900/20 bg-white pl-11 pr-11 text-base text-ink placeholder:text-forest-900/45 focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/25 [&::-webkit-search-cancel-button]:hidden"
              data-testid="category-v2-search"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-forest-900/50 hover:text-forest-950"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            )}
          </div>

          {chips.length > 1 && (
            <div className="mt-3 flex items-center gap-3" role="group" aria-label="Filter by destination">
              <span className="hidden flex-none text-xs font-bold uppercase tracking-widest text-forest-900/55 sm:inline">Where</span>
              <ul className="no-scrollbar -my-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 lg:flex-wrap lg:overflow-visible" data-testid="category-v2-chips">
                <li className="flex-none">
                  <Chip active={destination === null} onClick={() => setDestination(null)} label="All" count={indexCards.length} />
                </li>
                {chips.map((c) => (
                  <li key={c.slug} className="flex-none">
                    <Chip
                      active={destination === c.slug}
                      onClick={() => setDestination(destination === c.slug ? null : c.slug)}
                      label={c.name}
                      count={c.count}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-forest-900/70">
        <p aria-live="polite" data-testid="category-v2-result-count">
          {filtering ? (
            <>
              <strong className="font-semibold text-forest-950">{results.length}</strong> of {indexCards.length} articles
              {activeChip ? ` about ${activeChip.name}` : ''}
              {query.trim() ? ` matching “${query.trim()}”` : ''}
            </>
          ) : null}
        </p>
        {filtering && (
          <button
            type="button"
            onClick={reset}
            className="font-semibold text-primary-emphasis underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="mt-6 rounded-[0.3rem] border border-dashed border-forest-900/20 px-6 py-12 text-center" data-testid="category-v2-empty">
          <p className="text-base font-semibold text-forest-950">
            {filtering
              ? 'No articles match that search.'
              : allShownAbove
                ? `Every article in ${categoryName} so far is in Latest, above.`
                : 'No articles in this category yet. Check back soon.'}
          </p>
          {filtering && (
            <button
              type="button"
              onClick={reset}
              className="mt-5 rounded-[0.3rem] bg-forest-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-900"
            >
              Show all articles
            </button>
          )}
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2" data-testid="category-v2-grid">
          {results.map((c) => (
            <li key={c.slug} className="min-w-0">
              <GridCard card={c} />
            </li>
          ))}
        </ul>
      )}

      {!filtering && pageCount > 1 && <Pagination current={page} total={pageCount} slug={slug} />}
    </div>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-emphasis ${
        active
          ? 'border-forest-950 bg-forest-950 text-white'
          : 'border-forest-900/15 bg-white text-forest-950 hover:border-primary-emphasis hover:text-primary-emphasis'
      }`}
    >
      {label}
      <span className={active ? 'text-white/70' : 'text-forest-900/50'}>{count}</span>
    </button>
  );
}

/** Same URLs as the original template: page 1 is the bare path, then ?page=N. */
function Pagination({ current, total, slug }: { current: number; total: number; slug: string }) {
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  const href = (p: number) => (p === 1 ? `/category/${slug}` : `/category/${slug}?page=${p}`);
  return (
    <nav aria-label="Category pagination" className="mt-14 flex flex-wrap items-center justify-center gap-2" data-testid="category-pagination">
      {current > 1 && (
        <Link href={href(current - 1)} rel="prev" className="inline-flex h-10 items-center rounded-[0.3rem] px-3 text-sm font-bold text-forest-900 hover:text-primary-emphasis">
          ← Newer
        </Link>
      )}
      {pages.map((p) => {
        const active = p === current;
        return (
          <Link
            key={p}
            href={href(p)}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-[0.3rem] border px-3 text-sm font-bold transition ${
              active
                ? 'border-forest-950 bg-forest-950 text-white'
                : 'border-forest-900/15 bg-white text-forest-900 hover:border-primary-emphasis hover:text-primary-emphasis'
            }`}
          >
            {p}
          </Link>
        );
      })}
      {current < total && (
        <Link href={href(current + 1)} rel="next" className="inline-flex h-10 items-center rounded-[0.3rem] px-3 text-sm font-bold text-forest-900 hover:text-primary-emphasis">
          Older →
        </Link>
      )}
    </nav>
  );
}
