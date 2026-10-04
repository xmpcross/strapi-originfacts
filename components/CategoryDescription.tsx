'use client';

import { useState } from 'react';

const PREVIEW_WORDS = 70;

export default function CategoryDescription({
  text,
  previewWords = PREVIEW_WORDS,
}: {
  text: string;
  previewWords?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const words = text.split(/\s+/).filter(Boolean);
  const isTruncatable = words.length > previewWords;
  const preview = isTruncatable ? words.slice(0, previewWords).join(' ') : text;

  return (
    <div className="mt-6 max-w-[80%]" data-testid="category-description">
      <p className="text-base font-medium leading-relaxed text-forest-900/70 sm:text-lg">
        {expanded || !isTruncatable ? text : `${preview}… `}
        {isTruncatable && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-1 inline align-baseline text-[15px] font-semibold text-primary-emphasis underline underline-offset-2 hover:no-underline"
            aria-expanded={expanded}
            data-testid="category-description-read-more"
          >
            {expanded ? 'Show less' : 'Read More'}
          </button>
        )}
      </p>
    </div>
  );
}
