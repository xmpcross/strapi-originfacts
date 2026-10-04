import { normalizeKeyFacts } from '@/lib/entity-seo';

/**
 * TL;DR / Key-facts callout — the direct-answer block engines lift for
 * featured snippets, voice answers and AI Overviews.
 *
 * Sourced from two optional Strapi fields on articles and destinations:
 *  - `tldr` (text): a 40–60 word plain-language summary. Rendered first.
 *  - `keyFacts` (json): quick-scan facts. Either `["fact", ...]` or
 *    `[{"label": "Best time to go", "value": "May–September"}, ...]`.
 *
 * ## Editorial pattern (for writers)
 *
 * Beyond this block, structure article bodies so each major section opens
 * with a natural-language question heading (## When is the cheapest month to
 * fly to Tokyo?) followed IMMEDIATELY by a 40–60 word direct answer paragraph
 * that stands alone — then the detail. Engines quote the answer paragraph;
 * readers who want depth keep reading. Use GFM tables for best-of / price /
 * route comparisons (rendered accessibly by the article pipeline), or the
 * <ComparisonTable /> component on coded pages.
 *
 * Renders nothing when both fields are empty.
 */
export default function KeyFacts({
  tldr,
  keyFacts,
  title = 'TL;DR',
}: {
  tldr?: string | null;
  keyFacts?: unknown;
  title?: string;
}) {
  const facts = normalizeKeyFacts(keyFacts);
  const summary = typeof tldr === 'string' ? tldr.trim() : '';
  if (!summary && facts.length === 0) return null;

  return (
    <aside
      className="mb-10 rounded-[0.3rem] border border-primary-emphasis/20 bg-forest-50 px-6 py-5"
      data-testid="key-facts"
      aria-label={title}
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-primary-emphasis">
        {title}
      </p>
      {summary && (
        <p className="mt-2 text-[15px] font-normal leading-7 text-forest-950">{summary}</p>
      )}
      {facts.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {facts.map((f, i) => (
            <li key={i} className="flex gap-2 text-[15px] leading-7 text-forest-950">
              <span aria-hidden className="mt-[2px] shrink-0 text-primary-emphasis">▸</span>
              <span>
                {f.label ? <strong className="font-semibold">{f.label}: </strong> : null}
                {f.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
