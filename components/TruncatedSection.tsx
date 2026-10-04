'use client';

import { useState } from 'react';

type Section = { heading: string | null; paragraphs: string[] };

/**
 * Renders a single section's heading + collapsible body. The first
 * `truncateAfterWords` words of the joined paragraphs are shown by default,
 * followed by an inline "… Read More" link. Clicking it expands the full
 * content; clicking "Show less" collapses it again.
 *
 * Designed to slot into the same prose-article column as `CountryAbout` and
 * inherit its typography.
 */
export default function TruncatedSection({
  section,
  truncateAfterWords = 30,
}: {
  section: Section;
  truncateAfterWords?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (section.paragraphs.length === 0) return null;

  const fullText = section.paragraphs.join(' ');
  const words = fullText.split(/\s+/);
  const shouldTruncate = words.length > truncateAfterWords;
  const preview = shouldTruncate ? words.slice(0, truncateAfterWords).join(' ') : fullText;

  return (
    <div
      className="prose-article w-full"
      style={{ maxWidth: '100%' }}
      data-testid={`truncated-section-${section.heading?.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {section.heading && (
        <h3 className="!mt-0 text-xl font-bold text-forest-900">
          {section.heading}
        </h3>
      )}
      {!expanded && shouldTruncate && (
        <p className="mt-3">
          {preview}…{' '}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="font-medium text-primary-emphasis hover:text-primary-highlight hover:underline"
            data-testid="truncated-section-read-more"
            aria-expanded="false"
          >
            Read More
          </button>
        </p>
      )}
      {(expanded || !shouldTruncate) && (
        <>
          {section.paragraphs.map((p, i) => (
            <p key={i} className={i === 0 ? 'mt-3' : ''}>
              {p}
            </p>
          ))}
          {shouldTruncate && (
            <p className="mt-3">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="font-medium text-primary-emphasis hover:text-primary-highlight hover:underline"
                data-testid="truncated-section-show-less"
                aria-expanded="true"
              >
                Show less
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
}
