'use client';

import { useState } from 'react';

export default function ExpandableAirportDescription({
  text,
  fallback,
}: {
  text?: string | null;
  fallback?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentText = text || null;

  if (!contentText) {
    return (
      <p className="mt-3 w-full max-w-none text-base leading-7 text-forest-900/80">
        {fallback}
      </p>
    );
  }

  return (
    <div className="mt-3 w-full max-w-none text-base leading-7 text-forest-900/80">
      <p className={expanded ? '' : 'line-clamp-2'}>
        {contentText}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="mt-1 inline-flex items-center text-sm font-semibold text-primary-emphasis hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
        aria-expanded={expanded}
      >
        {expanded ? 'Show less' : 'Read more'}
      </button>
    </div>
  );
}
