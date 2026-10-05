'use client';

import { useEffect, useState } from 'react';
import { FALLBACK_ICON, SECTION_ICONS } from './icons';

export type NavStatus = 'verified' | 'data' | 'pending' | 'disputed' | 'none';

export type NavItem = { id: string; label: string; status: NavStatus };

const STATUS_TEXT: Record<NavStatus, string> = {
  verified: 'verified',
  data: 'from route data',
  pending: 'not yet verified',
  disputed: 'sources disagree',
  none: '',
};

const DOT: Record<NavStatus, string> = {
  verified: 'bg-emerald-600',
  data: 'bg-primary-emphasis',
  pending: 'border border-slate-400 bg-white',
  disputed: 'bg-amber-500',
  none: 'bg-transparent',
};

/**
 * Desktop in-page navigation: sticky, with the section in view highlighted and
 * each entry's verification status shown as a dot (and spelled out for screen
 * readers). Phones get a static chip list rendered by the page instead.
 */
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
      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-900/70">On this page</p>
      <ol className="mt-3 space-y-0.5">
        {items.map((item) => {
          const isActive = item.id === active;
          const Icon = SECTION_ICONS[item.id] ?? FALLBACK_ICON;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'location' : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm leading-snug transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-emphasis ${
                  isActive
                    ? 'bg-primary-emphasis/10 font-semibold text-primary-emphasis'
                    : 'text-forest-900/75 hover:bg-forest-900/5 hover:text-forest-950'
                }`}
              >
                <Icon aria-hidden className="h-4 w-4 flex-none" strokeWidth={isActive ? 2.25 : 1.75} />
                <span className="flex-1">{item.label}</span>
                <span aria-hidden className={`h-1.5 w-1.5 flex-none rounded-full ${DOT[item.status]}`} />
                {STATUS_TEXT[item.status] && <span className="sr-only">({STATUS_TEXT[item.status]})</span>}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
