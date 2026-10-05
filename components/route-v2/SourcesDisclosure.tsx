'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * The route page's Sources block, collapsed by default. It opens itself when a
 * footnote ([1]) or the "Where this comes from" link points into it, and when
 * the page loads with such a hash, so a footnote never lands on hidden text.
 * Closed or open, the content is in the HTML.
 */
export default function SourcesDisclosure({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const targets = (hash: string | null): HTMLElement | null => {
      if (!hash || !hash.startsWith('#') || hash.length < 2) return null;
      let id = hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        /* keep raw */
      }
      if (id === 'sources') return document.getElementById(id);
      const el = document.getElementById(id);
      return el && details.contains(el) ? el : null;
    };
    const fromLoad = targets(window.location.hash);
    if (fromLoad) {
      details.open = true;
      if (fromLoad !== document.getElementById('sources')) requestAnimationFrame(() => fromLoad.scrollIntoView({ block: 'start' }));
    }
    const onClick = (event: MouseEvent) => {
      const a = (event.target as Element | null)?.closest?.('a[href^="#"]');
      if (a && targets(a.getAttribute('href'))) details.open = true;
    };
    const onHash = () => {
      if (targets(window.location.hash)) details.open = true;
    };
    document.addEventListener('click', onClick);
    window.addEventListener('hashchange', onHash);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  return (
    <details ref={ref} className="group rounded-[0.3rem] border border-forest-900/10" data-testid="route-sources-disclosure">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-semibold text-forest-950 hover:bg-forest-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-emphasis [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <span aria-hidden className="flex-none text-forest-900/60 transition group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="space-y-5 border-t border-forest-900/10 p-4">{children}</div>
    </details>
  );
}
