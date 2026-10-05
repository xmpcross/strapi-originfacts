import Link from 'next/link';
import { compactPageWindow } from '@/lib/pagination';

/**
 * Numbered pagination shared by the category, all-articles, hot-posts and
 * search pages. No 'use client' and no hooks, so it renders from server and
 * client components alike.
 *
 * - From the `sm` breakpoint up it renders exactly what each page rendered
 *   before: every page number, plus the Newer/Older links where a page had
 *   them. The row wraps rather than overflowing if a page count ever grows.
 * - Below `sm` it renders a compact row — previous arrow, the current page
 *   and its neighbours, next arrow — with "Page X of Y" underneath, so 11+
 *   pages never push a 390px viewport sideways. Every tap target is 44px.
 *
 * URLs come from `hrefFor`, so each page keeps its own (page 1 = bare path).
 */
export default function Pagination({
  current,
  total,
  hrefFor,
  label,
  testId,
  pageTestId,
  prevNext,
  activeTone = 'primary',
  align = 'center',
  className = 'mt-12',
}: {
  current: number;
  total: number;
  hrefFor: (page: number) => string;
  /** aria-label for the <nav>. */
  label: string;
  testId: string;
  /** Optional data-testid for each numbered link on the full row, e.g. (p) => `page-${p}`. */
  pageTestId?: (page: number) => string;
  /** Text for the full-row previous/next links. Omit for pages that had none. */
  prevNext?: { prev: string; next: string };
  activeTone?: 'primary' | 'forest';
  align?: 'center' | 'start';
  className?: string;
}) {
  if (total < 2) return null;
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  const compact = compactPageWindow(current, total);
  const justify = align === 'center' ? 'justify-center' : 'justify-start';
  const activeCls =
    activeTone === 'forest'
      ? 'border-forest-950 bg-forest-950 text-white'
      : 'border-primary-emphasis bg-primary-emphasis text-white';
  const idleCls =
    'border-forest-900/15 bg-white text-forest-900 hover:border-primary-emphasis hover:text-primary-emphasis';
  const numberCls = (active: boolean, size: string) =>
    `inline-flex ${size} items-center justify-center rounded-[0.3rem] border px-3 text-sm font-bold transition ${
      active ? activeCls : idleCls
    }`;
  const textLinkCls =
    'inline-flex h-10 items-center rounded-[0.3rem] px-3 text-sm font-bold text-forest-900 hover:text-primary-emphasis';
  const arrowCls = `inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.3rem] border text-base font-bold transition ${idleCls}`;
  const hasPrev = current > 1;
  const hasNext = current < total;

  return (
    <nav aria-label={label} className={className} data-testid={testId}>
      {/* Phone width: arrows + current page and neighbours. */}
      <div className={`flex flex-col gap-2 sm:hidden ${align === 'center' ? 'items-center' : 'items-start'}`}>
        <div className="flex items-center gap-2">
          {hasPrev ? (
            <Link href={hrefFor(current - 1)} rel="prev" aria-label="Previous page" className={arrowCls}>
              ←
            </Link>
          ) : (
            <span aria-hidden="true" className="h-11 w-11 shrink-0" />
          )}
          {compact.map((p) => {
            const active = p === current;
            return (
              <Link
                key={p}
                href={hrefFor(p)}
                aria-current={active ? 'page' : undefined}
                aria-label={`Page ${p}`}
                className={numberCls(active, 'h-11 min-w-[2.75rem]')}
              >
                {p}
              </Link>
            );
          })}
          {hasNext ? (
            <Link href={hrefFor(current + 1)} rel="next" aria-label="Next page" className={arrowCls}>
              →
            </Link>
          ) : (
            <span aria-hidden="true" className="h-11 w-11 shrink-0" />
          )}
        </div>
        <p className="text-xs font-semibold text-forest-900/60">
          Page {current} of {total}
        </p>
      </div>

      {/* sm and up: the full row, as before. */}
      <div className={`hidden flex-wrap items-center gap-2 sm:flex ${justify}`}>
        {prevNext && hasPrev && (
          <Link href={hrefFor(current - 1)} rel="prev" className={textLinkCls}>
            {prevNext.prev}
          </Link>
        )}
        {pages.map((p) => {
          const active = p === current;
          return (
            <Link
              key={p}
              href={hrefFor(p)}
              aria-current={active ? 'page' : undefined}
              className={numberCls(active, 'h-10 min-w-[2.5rem]')}
              data-testid={pageTestId?.(p)}
            >
              {p}
            </Link>
          );
        })}
        {prevNext && hasNext && (
          <Link href={hrefFor(current + 1)} rel="next" className={textLinkCls}>
            {prevNext.next}
          </Link>
        )}
      </div>
    </nav>
  );
}
