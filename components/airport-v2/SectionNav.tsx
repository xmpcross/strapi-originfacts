'use client';

import { useEffect, useState } from 'react';

/**
 * Sticky "On this page" nav for the v2 airport page. Same behaviour and look as
 * components/airline-v2/SectionNav.tsx; only the status vocabulary differs —
 * airport sections are dataset-backed or not yet verified, never hand-verified.
 */
export type NavStatus = 'data' | 'live' | 'pending' | 'none';

export type NavItem = { id: string; label: string; status: NavStatus };

const STATUS_TEXT: Record<NavStatus, string> = {
  data: 'from datasets, not verified by hand',
  live: 'live data',
  pending: 'not yet verified',
  none: '',
};

const DOT: Record<NavStatus, string> = {
  data: 'bg-primary-emphasis',
  live: 'bg-forest-600',
  pending: 'border border-slate-400 bg-white',
  none: 'bg-transparent',
};

export default function SectionNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (!visible.length) return;
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        setActive(visible[0].target.id);
      },
      { rootMargin: '-110px 0px -60% 0px', threshold: 0 },
    );
    items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null)
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="On this page" className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-900/70">On this page</p>
      <ol className="mt-3 space-y-0.5 border-l border-forest-900/10">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'location' : undefined}
                className={`-ml-px flex items-center gap-2.5 border-l-2 py-1.5 pl-3.5 pr-2 text-sm leading-snug transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-emphasis ${
                  isActive
                    ? 'border-primary-emphasis font-semibold text-forest-950'
                    : 'border-transparent text-forest-900/75 hover:border-forest-900/30 hover:text-forest-950'
                }`}
              >
                <span aria-hidden className={`h-2 w-2 flex-none rounded-full ${DOT[item.status]}`} />
                <span>{item.label}</span>
                {STATUS_TEXT[item.status] && <span className="sr-only">({STATUS_TEXT[item.status]})</span>}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
