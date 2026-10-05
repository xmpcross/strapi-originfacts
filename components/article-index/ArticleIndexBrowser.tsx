'use client';

import Link from 'next/link';
import SharedPagination from '@/components/Pagination';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { GridCard } from '@/components/category-v2/Cards';
import {
  DATE_RANGES,
  EMPTY_FILTERS,
  activePills,
  applyFilters,
  dateFacet,
  facetOptions,
  filtersToHref,
  fullTextSearchHref,
  isFiltering,
  type ArticleFilters,
  type FacetOption,
  type IndexCard,
} from './filters';

const FILTERED_PAGE = 24;
const TOP_DESTINATIONS = 8;

/**
 * The archive listing with its filters. With no filter set it shows the
 * server-rendered ?page= slice (the articles the route's ItemList JSON-LD
 * describes) and the original page links. Any filter switches to the whole
 * archive index, filtered on the client; the filter state is mirrored into the
 * URL with history.replaceState, so a filtered view can be shared and is
 * rendered identically by the server when loaded directly.
 *
 * Desktop (lg+): sticky filter sidebar on the left. Below lg: a "Filters"
 * button opens the same controls in a bottom sheet.
 */
export default function ArticleIndexBrowser({
  total,
  pageCards,
  indexCards,
  page,
  pageCount,
  pageSize,
  initialFilters,
  nowIso,
}: {
  total: number;
  pageCards: IndexCard[];
  /** Every article (slim), or [] if the index fetch failed — then no filters are offered. */
  indexCards: IndexCard[];
  page: number;
  pageCount: number;
  pageSize: number;
  initialFilters: ArticleFilters;
  /** Server render time, so the server and the first client render bucket dates identically. */
  nowIso: string;
}) {
  const canFilter = indexCards.length > 0;
  const [filters, setFilters] = useState<ArticleFilters>(canFilter ? initialFilters : EMPTY_FILTERS);
  const [visible, setVisible] = useState(FILTERED_PAGE);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const now = useMemo(() => Date.parse(nowIso), [nowIso]);
  const filtering = canFilter && isFiltering(filters);

  const update = useCallback((next: ArticleFilters) => {
    setFilters(next);
    setVisible(FILTERED_PAGE);
  }, []);

  // Mirror the filters into the URL (debounced so typing does not spam history).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      const href = filtersToHref(filters, page);
      if (href !== window.location.pathname + window.location.search) {
        window.history.replaceState(window.history.state, '', href);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [filters, page]);

  const results = useMemo(
    () => (filtering ? applyFilters(indexCards, filters, now) : pageCards),
    [filtering, indexCards, filters, now, pageCards],
  );
  const shown = filtering ? results.slice(0, visible) : results;

  const names = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of indexCards) {
      if (c.category) m[`categories:${c.category.slug}`] = c.category.name;
      if (c.author) m[`authors:${c.author.slug}`] = c.author.name;
      for (const d of c.destinations) m[`destinations:${d.slug}`] = d.name;
    }
    return m;
  }, [indexCards]);
  const pills = filtering ? activePills(filters, names) : [];
  const reset = () => update(EMPTY_FILTERS);

  const start = (page - 1) * pageSize + 1;
  const end = start + pageCards.length - 1;

  return (
    <div
      className={canFilter ? 'lg:grid lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-10 xl:gap-14' : ''}
      data-testid="article-index-browser"
    >
      {canFilter && (
        <aside
          className="hidden lg:block"
          aria-label="Filter articles"
          data-testid="article-index-sidebar"
        >
          <div className="sticky top-[96px] [scrollbar-width:thin] max-h-[calc(100vh-112px)] overflow-y-auto pb-6 pr-1">
            <FilterPanel
              cards={indexCards}
              filters={filters}
              now={now}
              onChange={update}
              onReset={reset}
              filtering={filtering}
              idPrefix="side"
            />
          </div>
        </aside>
      )}

      <div className="min-w-0" ref={resultsRef}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-forest-900/15 pb-4">
          <p className="text-sm text-forest-900/70" aria-live="polite" data-testid="article-index-count">
            {filtering ? (
              <>
                Showing <strong className="font-semibold text-forest-950">{shown.length}</strong> of{' '}
                <strong className="font-semibold text-forest-950">{results.length}</strong> matching{' '}
                {results.length === 1 ? 'article' : 'articles'}
                <span className="text-forest-900/55"> ({total} in total)</span>
              </>
            ) : pageCards.length > 0 ? (
              <>
                Showing{' '}
                <strong className="font-semibold text-forest-950">
                  {start}–{end}
                </strong>{' '}
                of <strong className="font-semibold text-forest-950">{total}</strong> articles, newest first
              </>
            ) : null}
          </p>
          {canFilter && (
            <button
              ref={filterButtonRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              aria-controls="article-filters-sheet"
              aria-haspopup="dialog"
              className="inline-flex h-10 items-center gap-2 rounded-[0.3rem] border border-forest-900/20 bg-white px-4 text-sm font-bold text-forest-950 transition hover:border-primary-emphasis hover:text-primary-emphasis lg:hidden"
              data-testid="article-index-filters-button"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" d="M3 5h14M6 10h8M8.5 15h3" />
              </svg>
              Filters
              {pills.length > 0 && (
                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-emphasis px-1.5 text-xs text-white">
                  {pills.length}
                </span>
              )}
            </button>
          )}
        </div>

        {pills.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="article-index-pills">
            <span className="sr-only">Active filters:</span>
            {pills.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => update(p.remove(filters))}
                className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-forest-950 bg-forest-950 pl-3 pr-2 text-sm font-semibold text-white transition hover:bg-forest-900"
                aria-label={`Remove filter: ${p.label}`}
              >
                <span className="truncate">{p.label}</span>
                <svg className="h-3.5 w-3.5 flex-none text-white/70" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            ))}
            <button
              type="button"
              onClick={reset}
              className="ml-1 text-sm font-semibold text-primary-emphasis underline-offset-2 hover:underline"
              data-testid="article-index-clear-pills"
            >
              Clear all
            </button>
          </div>
        )}

        {shown.length === 0 ? (
          <div className="mt-8 rounded-[0.3rem] border border-dashed border-forest-900/20 px-6 py-14 text-center" data-testid="article-index-empty">
            <p className="text-lg font-semibold text-forest-950">
              {filtering ? 'No articles match these filters.' : 'No articles on this page.'}
            </p>
            {filtering ? (
              <>
                <p className="mx-auto mt-2 max-w-md text-sm text-forest-900/65">
                  Try removing a filter{filters.q.trim() ? ', or search the full text of every article' : ''}.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-[0.3rem] bg-forest-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-900"
                  >
                    Show all articles
                  </button>
                  {filters.q.trim() && (
                    <Link
                      href={fullTextSearchHref(filters.q)}
                      className="rounded-[0.3rem] border border-forest-900/20 px-4 py-2.5 text-sm font-semibold text-forest-950 hover:border-primary-emphasis hover:text-primary-emphasis"
                      data-testid="article-index-fulltext-empty"
                    >
                      Search full article text
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <Link href="/all-articles" className="mt-5 inline-block text-sm font-semibold text-primary-emphasis hover:underline">
                Back to the newest articles
              </Link>
            )}
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3" data-testid="article-index-grid">
            {shown.map((c) => (
              <li key={c.slug} className="min-w-0">
                <GridCard card={c} />
              </li>
            ))}
          </ul>
        )}

        {filtering && results.length > shown.length && (
          <div className="mt-12 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setVisible((v) => v + FILTERED_PAGE)}
              className="inline-flex h-11 items-center rounded-[0.3rem] border border-forest-950 px-6 text-sm font-bold text-forest-950 transition hover:bg-forest-950 hover:text-white"
              data-testid="article-index-show-more"
            >
              Show more
            </button>
            <p className="text-xs text-forest-900/55">
              {results.length - shown.length} more {results.length - shown.length === 1 ? 'article' : 'articles'}
            </p>
          </div>
        )}

        {!filtering && pageCount > 1 && <Pagination current={page} total={pageCount} />}
      </div>

      {canFilter && drawerOpen && (
        <FilterSheet
          onClose={() => {
            setDrawerOpen(false);
            filterButtonRef.current?.focus();
          }}
          resultCount={filtering ? results.length : total}
        >
          <FilterPanel
            cards={indexCards}
            filters={filters}
            now={now}
            onChange={update}
            onReset={reset}
            filtering={filtering}
            idPrefix="sheet"
            hideHeading
          />
        </FilterSheet>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FilterPanel({
  cards,
  filters,
  now,
  onChange,
  onReset,
  filtering,
  idPrefix,
  hideHeading = false,
}: {
  cards: IndexCard[];
  filters: ArticleFilters;
  now: number;
  onChange: (f: ArticleFilters) => void;
  onReset: () => void;
  filtering: boolean;
  idPrefix: string;
  hideHeading?: boolean;
}) {
  const uid = useId();
  const id = (s: string) => `${idPrefix}-${uid}-${s}`;
  const [allDestinations, setAllDestinations] = useState(false);

  const categories = useMemo(() => facetOptions(cards, filters, now, 'categories'), [cards, filters, now]);
  const destinations = useMemo(() => facetOptions(cards, filters, now, 'destinations'), [cards, filters, now]);
  const authors = useMemo(() => facetOptions(cards, filters, now, 'authors'), [cards, filters, now]);
  const dates = useMemo(() => dateFacet(cards, filters, now), [cards, filters, now]);

  const toggle = (group: 'categories' | 'destinations' | 'authors', slug: string) => {
    const cur = filters[group];
    onChange({ ...filters, [group]: cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug] });
  };

  const destinationList = allDestinations
    ? destinations
    : [
        ...destinations.slice(0, TOP_DESTINATIONS),
        ...destinations.slice(TOP_DESTINATIONS).filter((d) => filters.destinations.includes(d.slug)),
      ];

  return (
    <div className="space-y-7" data-testid={`article-index-filters-${idPrefix}`}>
      {!hideHeading && (
        <div className="flex items-baseline justify-between border-b border-forest-900/15 pb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-forest-950">Filter articles</h2>
          {filtering && (
            <button
              type="button"
              onClick={onReset}
              className="text-sm font-semibold text-primary-emphasis underline-offset-2 hover:underline"
              data-testid="article-index-clear"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <div>
        <label htmlFor={id('q')} className="text-xs font-bold uppercase tracking-widest text-forest-900/60">
          Search
        </label>
        <div className="relative mt-2">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-forest-900/45">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            id={id('q')}
            type="search"
            value={filters.q}
            onChange={(e) => onChange({ ...filters, q: e.target.value })}
            placeholder="Titles, places, topics"
            autoComplete="off"
            maxLength={100}
            className="h-10 w-full rounded-[0.3rem] border border-forest-900/20 bg-white pl-9 pr-9 text-base text-ink placeholder:text-forest-900/45 focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/25 lg:text-sm [&::-webkit-search-cancel-button]:hidden"
            data-testid="article-index-search"
          />
          {filters.q && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, q: '' })}
              aria-label="Clear search"
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-forest-900/50 hover:text-forest-950"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>
        <Link
          href={fullTextSearchHref(filters.q)}
          className="mt-2 inline-block text-xs font-semibold text-primary-emphasis underline-offset-2 hover:underline"
          data-testid="article-index-fulltext"
        >
          Search full article text →
        </Link>
      </div>

      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-widest text-forest-900/60">Sort</legend>
        <div className="mt-2 grid grid-cols-2 rounded-[0.3rem] border border-forest-900/20 p-0.5" data-testid="article-index-sort">
          {(['newest', 'oldest'] as const).map((s) => (
            <label
              key={s}
              className={`flex h-8 cursor-pointer items-center justify-center rounded-[0.2rem] text-sm font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-emphasis ${
                filters.sort === s ? 'bg-forest-950 text-white' : 'text-forest-950 hover:text-primary-emphasis'
              }`}
            >
              <input
                type="radio"
                name={id('sort')}
                value={s}
                checked={filters.sort === s}
                onChange={() => onChange({ ...filters, sort: s })}
                className="sr-only"
              />
              {s === 'newest' ? 'Newest' : 'Oldest'}
            </label>
          ))}
        </div>
      </fieldset>

      {categories.length > 1 && (
        <CheckGroup
          legend="Category"
          options={categories}
          selected={filters.categories}
          onToggle={(slug) => toggle('categories', slug)}
          testId="article-index-category"
        />
      )}

      {destinations.length > 1 && (
        <div>
          <CheckGroup
            legend="Destination"
            options={destinationList}
            selected={filters.destinations}
            onToggle={(slug) => toggle('destinations', slug)}
            testId="article-index-destination"
            listId={id('destinations')}
          />
          {destinations.length > TOP_DESTINATIONS && (
            <button
              type="button"
              onClick={() => setAllDestinations((v) => !v)}
              aria-expanded={allDestinations}
              aria-controls={id('destinations')}
              className="mt-2 text-sm font-semibold text-primary-emphasis underline-offset-2 hover:underline"
              data-testid="article-index-destination-toggle"
            >
              {allDestinations ? 'Show fewer' : `Show all ${destinations.length} destinations`}
            </button>
          )}
        </div>
      )}

      {authors.length > 1 && (
        <CheckGroup
          legend="Author"
          options={authors}
          selected={filters.authors}
          onToggle={(slug) => toggle('authors', slug)}
          testId="article-index-author"
        />
      )}

      <fieldset data-testid="article-index-date">
        <legend className="text-xs font-bold uppercase tracking-widest text-forest-900/60">Published</legend>
        <ul className="mt-2 space-y-0.5">
          {[{ value: null, label: 'Any time' } as const, ...DATE_RANGES].map((r) => {
            const count = r.value === null ? null : dates[r.value];
            const checked = filters.date === r.value;
            return (
              <li key={r.value ?? 'any'}>
                <label className={`flex cursor-pointer items-center gap-2.5 rounded-[0.2rem] py-1.5 text-sm ${count === 0 && !checked ? 'text-forest-900/40' : 'text-forest-950'}`}>
                  <input
                    type="radio"
                    name={id('date')}
                    checked={checked}
                    onChange={() => onChange({ ...filters, date: r.value })}
                    className="h-4 w-4 flex-none accent-forest-950"
                  />
                  <span className="min-w-0 flex-1">{r.label}</span>
                  {count !== null && <span className="text-xs tabular-nums text-forest-900/50">{count}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </div>
  );
}

function CheckGroup({
  legend,
  options,
  selected,
  onToggle,
  testId,
  listId,
}: {
  legend: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (slug: string) => void;
  testId: string;
  listId?: string;
}) {
  return (
    <fieldset data-testid={testId}>
      <legend className="text-xs font-bold uppercase tracking-widest text-forest-900/60">{legend}</legend>
      <ul className="mt-2 space-y-0.5" id={listId}>
        {options.map((o) => {
          const checked = selected.includes(o.slug);
          return (
            <li key={o.slug}>
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-[0.2rem] py-1.5 text-sm hover:text-primary-emphasis ${
                  o.count === 0 && !checked ? 'text-forest-900/40' : 'text-forest-950'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(o.slug)}
                  className="h-4 w-4 flex-none rounded-[0.15rem] accent-forest-950"
                  data-slug={o.slug}
                />
                <span className={`min-w-0 flex-1 truncate ${checked ? 'font-semibold' : ''}`}>{o.name}</span>
                <span className="text-xs tabular-nums text-forest-900/50">{o.count}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/** Bottom sheet for <lg: modal, focus-trapped, Esc and backdrop close it. */
function FilterSheet({
  children,
  onClose,
  resultCount,
}: {
  children: React.ReactNode;
  onClose: () => void;
  resultCount: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('[data-autofocus]')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>('button, input, a[href], [tabindex]:not([tabindex="-1"])'),
      ].filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" data-testid="article-index-sheet">
      <div className="absolute inset-0 bg-forest-950/50" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        id="article-filters-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-[0.75rem] bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-forest-900/10 px-4 py-3">
          <h2 id={titleId} className="text-base font-bold text-forest-950">
            Filter articles
          </h2>
          <button
            type="button"
            onClick={onClose}
            data-autofocus
            aria-label="Close filters"
            className="flex h-10 w-10 items-center justify-center rounded-full text-forest-950 hover:bg-forest-900/5"
          >
            <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">{children}</div>
        <div className="border-t border-forest-900/10 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-[0.3rem] bg-forest-950 text-sm font-bold text-white hover:bg-forest-900"
            data-testid="article-index-sheet-apply"
          >
            Show {resultCount} {resultCount === 1 ? 'article' : 'articles'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Same URLs as before the redesign: page 1 is /all-articles, then ?page=N. */
function Pagination({ current, total }: { current: number; total: number }) {
  return (
    <SharedPagination
      current={current}
      total={total}
      hrefFor={(p) => (p === 1 ? '/all-articles' : `/all-articles?page=${p}`)}
      label="Article pages"
      testId="pagination"
      pageTestId={(p) => `page-${p}`}
      prevNext={{ prev: '← Newer', next: 'Older →' }}
      activeTone="forest"
      className="mt-14"
    />
  );
}
