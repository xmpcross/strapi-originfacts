'use client';

import { useEffect, useState } from 'react';

export type Chapter = { id: string; n: string; label: string };

/**
 * Chapter list for /methodology. Sticky beside the content on desktop with the
 * chapter in view highlighted; on phones it renders as a plain list above the
 * first chapter (the page decides where it sits).
 */
export default function ChapterNav({ chapters }: { chapters: Chapter[] }) {
  const [active, setActive] = useState(chapters[0]?.id ?? '');

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
    chapters
      .map((c) => document.getElementById(c.id))
      .filter((el): el is HTMLElement => el !== null)
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [chapters]);

  return (
    <nav aria-label="Chapters" className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pb-4" data-testid="methodology-nav">
      <p className="text-xs font-bold uppercase tracking-widest text-forest-900/60">In this methodology</p>
      <ol className="mt-4 grid gap-0.5 border-l border-forest-900/15">
        {chapters.map((c) => {
          const isActive = c.id === active;
          return (
            <li key={c.id} className="min-w-0">
              <a
                href={`#${c.id}`}
                aria-current={isActive ? 'location' : undefined}
                className={`-ml-px flex items-baseline gap-3 border-l-2 py-1.5 pl-3.5 pr-2 text-sm leading-snug transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-emphasis ${
                  isActive
                    ? 'border-primary-emphasis font-semibold text-forest-950'
                    : 'border-transparent text-forest-900/75 hover:border-forest-900/30 hover:text-forest-950'
                }`}
              >
                <span className="font-mono text-xs text-forest-900/45">{c.n}</span>
                <span>{c.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
