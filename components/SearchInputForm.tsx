'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const FILTERS = [
  'All Content',
  'Posts',
  'Pages',
  'Products',
  'Categories',
  'Tags',
  'Authors',
] as const;
type Filter = (typeof FILTERS)[number];

function toSlug(label: string) {
  return label.toLowerCase().replace(/\s+/g, '-');
}

export default function SearchInputForm({
  initialQuery = '',
  initialType = 'all-content',
}: {
  initialQuery?: string;
  initialType?: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(() => {
    const match = FILTERS.find((f) => toSlug(f) === initialType);
    return match ?? 'All Content';
  });
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedRef = useRef(initialQuery);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Live search — debounce 300ms, replace URL so server re-renders results.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === lastPushedRef.current.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (trimmed) params.set('q', trimmed);
      if (filter !== 'All Content') params.set('type', toSlug(filter));
      const url = params.toString() ? `/search?${params.toString()}` : '/search';
      lastPushedRef.current = trimmed;
      router.replace(url, { scroll: false });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, filter, router]);

  return (
    <form
      action="/search"
      method="get"
      role="search"
      data-testid="search-form"
      className="w-full"
    >
      <div className="flex w-full items-center border-b border-forest-900/25 focus-within:border-primary-emphasis">
        {/* Filter dropdown */}
        <div className="relative" ref={wrapRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
            data-testid="search-filter-trigger"
            className="flex h-12 items-center gap-2 whitespace-nowrap pr-4 text-[12px] font-bold uppercase tracking-widest text-forest-950"
          >
            {filter}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {open && (
            <ul
              role="listbox"
              data-testid="search-filter-options"
              className="absolute left-0 top-full z-20 mt-2 min-w-[180px] rounded-[0.3rem] border border-forest-900/10 bg-white py-2 shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
            >
              {FILTERS.map((f) => {
                const active = f === filter;
                return (
                  <li key={f}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setFilter(f);
                        setOpen(false);
                      }}
                      className={`block w-full px-4 py-1.5 text-left text-[12px] font-bold uppercase tracking-widest transition ${
                        active
                          ? 'text-primary-emphasis'
                          : 'text-forest-900 hover:bg-forest-900/5'
                      }`}
                    >
                      {f}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Hidden type input so the filter is submitted with the form */}
        <input type="hidden" name="type" value={toSlug(filter)} />

        {/* Vertical separator */}
        <span aria-hidden className="mx-3 h-5 w-px bg-forest-900/15" />

        {/* Search icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0 text-forest-900/45"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>

        <label htmlFor="search-input" className="sr-only">
          Search
        </label>
        <input
          id="search-input"
          type="search"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="Please enter a keyword to start your search"
          className="h-14 w-full bg-transparent px-3 text-left text-base text-forest-950 placeholder:text-forest-900/45 focus:outline-none sm:text-lg"
        />

        <button
          type="submit"
          className="hidden sm:inline-flex h-10 items-center rounded-[20px] bg-forest-900 px-5 text-[14px] font-bold capitalize tracking-wider text-white transition hover:bg-primary-emphasis"
        >
          Search
        </button>
      </div>
    </form>
  );
}
