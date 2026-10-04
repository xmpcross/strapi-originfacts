'use client';

import React, { useState } from 'react';
import type { TocItem } from '@/lib/toc';

interface TableOfContentsProps {
  items: TocItem[];
  title?: string;
  className?: string;
}

export default function TableOfContents({
  items,
  title = 'Table of Contents',
  className = '',
}: TableOfContentsProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Table of contents"
      className={`my-8 rounded-lg border border-forest-900/15 bg-forest-900/[0.02] p-5 shadow-sm transition ${className}`}
      data-testid="table-of-contents"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <svg
            className="h-4 w-4 text-primary-emphasis"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
          <h2 className="font-urbanist text-xs font-bold uppercase tracking-widest text-forest-950">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 font-urbanist text-[11px] font-semibold text-forest-800/70 hover:text-primary-emphasis focus:outline-none"
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Collapse Table of Contents' : 'Expand Table of Contents'}
        >
          <span>{isOpen ? 'Hide' : 'Show'}</span>
          <svg
            className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <ol className="mt-4 grid gap-2 border-t border-forest-900/10 pt-4 text-sm">
          {items.map((item, idx) => {
            const isH3 = item.level === 3;
            return (
              <li
                key={`${item.id}-${idx}`}
                className={`${isH3 ? 'ml-4 list-[circle]' : 'list-decimal'} list-inside font-urbanist leading-relaxed text-forest-900/80`}
              >
                <a
                  href={`#${item.id}`}
                  className="font-medium text-forest-900 transition hover:text-primary-emphasis hover:underline"
                >
                  {item.text}
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
