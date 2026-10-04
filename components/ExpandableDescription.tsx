'use client';

import { useState } from 'react';

type Props = {
  text: string;
  wordLimit?: number;
  className?: string;
};

/**
 * Renders `text` truncated at `wordLimit` words with a "Read More" link.
 * Clicking expands to the full text with a "Read Less" link to collapse.
 * If the text is shorter than the limit, no toggle is rendered.
 */
export default function ExpandableDescription({
  text,
  wordLimit = 70,
  className = 'mt-4 text-lg font-normal text-forest-900/70',
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const words = text.trim().split(/\s+/);
  const isLong = words.length > wordLimit;

  if (!isLong) {
    return <p className={className}>{text}</p>;
  }

  const truncated = words.slice(0, wordLimit).join(' ');
  const remainder = words.slice(wordLimit).join(' ');

  return (
    <p className={className} data-testid="expandable-description">
      {expanded ? text : `${truncated}… `}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="ml-1 inline cursor-pointer text-base font-normal text-primary-emphasis underline underline-offset-2 hover:no-underline"
        data-testid="expandable-description-toggle"
        aria-expanded={expanded}
      >
        {expanded ? 'Read Less' : 'Read More'}
      </button>
      {/* Hide the remainder when collapsed but keep it in the DOM so search
          engines and copy-paste still see the full paragraph. */}
      {!expanded && <span className="sr-only">{` ${remainder}`}</span>}
    </p>
  );
}
