'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { faqAnswerText, type FaqGroup, type FaqSegment } from '@/lib/faq';

/**
 * Topic nav, search filter and accordions for /faq.
 *
 * Server-rendered with every answer in the HTML (native <details>, closed but
 * present), so crawlers and no-JS readers get the full text. The search only
 * hides non-matching questions with the `hidden` attribute.
 */

const normalise = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[“”"‘’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function reopenCookieSettings() {
  window.dispatchEvent(new Event('originfacts:consent:reopen'));
}

function Answer({ segments }: { segments: FaqSegment[] }) {
  return (
    <>
      {segments.map((s, i) => {
        if (typeof s === 'string') return <span key={i}>{s}</span>;
        if ('action' in s) {
          return (
            <button
              key={i}
              type="button"
              onClick={reopenCookieSettings}
              className="font-semibold text-primary-emphasis underline underline-offset-2 hover:text-primary-highlight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
              data-testid="faq-cookie-settings"
            >
              {s.text}
            </button>
          );
        }
        const cls =
          'break-words font-semibold text-primary-emphasis underline underline-offset-2 hover:text-primary-highlight';
        return s.href.startsWith('/') ? (
          <Link key={i} href={s.href} className={cls}>
            {s.text}
          </Link>
        ) : (
          <a key={i} href={s.href} className={cls}>
            {s.text}
          </a>
        );
      })}
    </>
  );
}

export default function FaqExplorer({ groups }: { groups: FaqGroup[] }) {
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  // Search index: question + answer text, built once.
  const index = useMemo(
    () =>
      groups.flatMap((g) =>
        g.items.map((item) => ({ id: item.id, text: normalise(`${item.q} ${faqAnswerText(item.a)} ${g.title}`) })),
      ),
    [groups],
  );
  const allIds = useMemo(() => index.map((e) => e.id), [index]);

  const terms = useMemo(() => normalise(query).split(' ').filter(Boolean), [query]);
  const matches = useMemo(() => {
    if (!terms.length) return null;
    return new Set(index.filter((e) => terms.every((t) => e.text.includes(t))).map((e) => e.id));
  }, [index, terms]);

  const visible = (id: string) => matches === null || matches.has(id);
  const total = allIds.length;
  const shown = matches === null ? total : matches.size;

  const onQuery = (value: string) => {
    setQuery(value);
    const t = normalise(value).split(' ').filter(Boolean);
    if (!t.length) {
      setOpen(new Set());
      return;
    }
    // Open the hits so the answers are readable without another click.
    setOpen(new Set(index.filter((e) => t.every((x) => e.text.includes(x))).map((e) => e.id)));
  };

  const setItemOpen = useCallback((id: string, isOpen: boolean) => {
    setOpen((prev) => {
      if (prev.has(id) === isOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Deep links: /faq#<question-id> opens that question.
  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id || !allIds.includes(id)) return;
      // A deep link must not land on a question the current search has hidden.
      setQuery('');
      setItemOpen(id, true);
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, [allIds, setItemOpen]);

  const visibleIds = allIds.filter(visible);
  const allOpen = visibleIds.length > 0 && visibleIds.every((id) => open.has(id));
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(visibleIds));

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-14">
      {/* Topic nav: wraps above the list on phones, sticky rail on desktop. */}
      <nav aria-label="FAQ topics" className="min-w-0" data-testid="faq-topics">
        <div className="lg:sticky lg:top-28">
          <p className="text-xs font-bold uppercase tracking-widest text-forest-900/60">Topics</p>
          <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-0 lg:border-l lg:border-forest-900/15">
            {groups.map((g, i) => {
              const n = g.items.filter((it) => visible(it.id)).length;
              return (
                <li key={g.id} className="min-w-0">
                  <a
                    href={`#${g.id}`}
                    className={`flex items-baseline gap-2 rounded-full border border-forest-900/15 bg-white px-3 py-1.5 text-sm font-semibold text-forest-950 transition hover:border-primary-emphasis hover:text-primary-emphasis lg:-ml-px lg:rounded-none lg:border-0 lg:border-l-2 lg:border-transparent lg:bg-transparent lg:py-2 lg:pl-4 lg:hover:border-primary-emphasis ${
                      n === 0 ? 'opacity-45' : ''
                    }`}
                  >
                    <span aria-hidden className="hidden font-mono text-xs text-forest-900/45 lg:inline">
                      0{i + 1}
                    </span>
                    <span className="min-w-0">{g.title}</span>
                    <span className="ml-auto text-xs font-medium text-forest-900/50">
                      <span className="sr-only">(</span>
                      {n}
                      <span className="sr-only"> questions)</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 hidden rounded-[0.3rem] bg-sand-100 p-5 text-sm leading-relaxed text-forest-900/80 lg:block">
            <p className="font-bold text-forest-950">Still stuck?</p>
            <p className="mt-1">
              <Link href="/contact" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                Contact us
              </Link>{' '}
              with the page URL and your question.
            </p>
          </div>
        </div>
      </nav>

      <div className="min-w-0">
        {/* Search */}
        <div className="rounded-[0.3rem] border border-forest-900/15 bg-paper p-4 sm:p-5" role="search" data-testid="faq-search">
          <label htmlFor={searchId} className="text-xs font-bold uppercase tracking-widest text-forest-900/60">
            Search the FAQ
          </label>
          <div className="relative mt-2">
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-900/45"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.preventDefault();
                  onQuery('');
                }
              }}
              placeholder="Try “baggage”, “refund” or “cookies”"
              autoComplete="off"
              className="h-12 w-full rounded-[0.3rem] border border-forest-900/20 bg-white pl-11 pr-4 text-base text-ink shadow-xs placeholder:text-forest-900/45 focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/25"
              data-testid="faq-search-input"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
            <p aria-live="polite" className="text-forest-900/70" data-testid="faq-result-count">
              {matches === null
                ? `${total} questions in ${groups.length} topics`
                : `${shown} of ${total} questions match`}
            </p>
            <button
              type="button"
              onClick={toggleAll}
              disabled={visibleIds.length === 0}
              className="font-semibold text-primary-emphasis underline-offset-2 hover:underline disabled:opacity-40"
              data-testid="faq-toggle-all"
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
        </div>

        {matches !== null && matches.size === 0 && (
          <div className="mt-8 rounded-[0.3rem] border-l-4 border-secondary-emphasis bg-secondary p-6" data-testid="faq-no-results">
            <p className="font-bold text-forest-950">No questions match “{query.trim()}”.</p>
            <p className="mt-2 text-sm leading-relaxed text-forest-900/80">
              Try a shorter word, browse the topics, or{' '}
              <Link href="/contact" className="font-semibold text-primary-emphasis underline underline-offset-2">
                ask us directly
              </Link>
              .
            </p>
          </div>
        )}

        {groups.map((g, gi) => {
          const items = g.items;
          const anyVisible = items.some((it) => visible(it.id));
          return (
            <section
              key={g.id}
              id={g.id}
              aria-labelledby={`${g.id}-heading`}
              hidden={!anyVisible}
              className="scroll-mt-28 border-t border-forest-900/15 pt-10 mt-12"
              data-testid={`faq-group-${g.id}`}
            >
              <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-primary-emphasis">
                <span className="font-mono text-forest-900/45">0{gi + 1}</span>
                <span aria-hidden className="h-px w-8 bg-primary-emphasis/40" />
                {items.length} questions
              </p>
              <h2 id={`${g.id}-heading`} className="mt-3 text-2xl font-bold leading-tight text-forest-950 sm:text-3xl">
                {g.title}
              </h2>
              <p className="mt-2 text-base leading-relaxed text-forest-900/70">{g.intro}</p>

              <div className="mt-6 divide-y divide-forest-900/10 border-y border-forest-900/10">
                {items.map((item) => (
                  <details
                    key={item.id}
                    id={item.id}
                    hidden={!visible(item.id)}
                    open={open.has(item.id)}
                    onToggle={(e) => setItemOpen(item.id, (e.currentTarget as HTMLDetailsElement).open)}
                    className="group scroll-mt-28"
                    data-testid="faq-item"
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-[0.2rem] py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis [&::-webkit-details-marker]:hidden">
                      <h3 className="min-w-0 text-base font-bold leading-snug text-forest-950 group-hover:text-primary-emphasis sm:text-lg">
                        {item.q}
                      </h3>
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-forest-900/20 text-forest-900/70 transition group-open:rotate-45 group-open:border-primary-emphasis group-open:bg-primary-emphasis group-open:text-white"
                      >
                        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                          <path d="M8 3v10M3 8h10" />
                        </svg>
                      </span>
                    </summary>
                    <div className="max-w-3xl pb-5 pr-2 text-[15px] leading-7 text-forest-900/80 sm:pr-11">
                      <p>
                        <Answer segments={item.a} />
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
