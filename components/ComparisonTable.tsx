import type { ReactNode } from 'react';

/**
 * Accessible comparison table for coded pages (best-of lists, route/price
 * comparisons, X vs Y tables) — real <caption>, <th scope="col">, <th scope="row">,
 * and an overflow wrapper so wide tables scroll gracefully. Semantic <table>
 * markup makes these sections eligible for Google Table Featured Snippets.
 */
export default function ComparisonTable({
  caption,
  head,
  rows,
  firstColIsHeader = true,
  className = '',
}: {
  caption: string;
  head: ReactNode[];
  rows: ReactNode[][];
  /** Mark each row's first cell as a row header (scope="row"). */
  firstColIsHeader?: boolean;
  className?: string;
}) {
  if (head.length === 0 || rows.length === 0) return null;

  return (
    <div className={`my-6 overflow-hidden rounded-[0.4rem] border border-forest-900/12 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${className}`} data-testid="comparison-table">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-forest-950">
          <caption className="border-b border-forest-900/10 bg-forest-900/[0.03] px-5 py-3.5 text-left font-urbanist text-sm font-bold uppercase tracking-wider text-forest-900">
            {caption}
          </caption>
          <thead>
            <tr className="border-b border-forest-900/15 bg-forest-900/[0.06]">
              {head.map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  className="px-5 py-3 font-urbanist text-xs font-bold uppercase tracking-wider text-forest-900"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-900/10">
            {rows.map((cells, r) => (
              <tr key={r} className="transition-colors hover:bg-forest-900/[0.02] odd:bg-white even:bg-sand-100/30">
                {cells.map((cell, c) =>
                  c === 0 && firstColIsHeader ? (
                    <th
                      key={c}
                      scope="row"
                      className="px-5 py-3.5 font-urbanist font-bold text-forest-950 whitespace-nowrap"
                    >
                      {cell}
                    </th>
                  ) : (
                    <td key={c} className="px-5 py-3.5 font-normal leading-relaxed text-forest-900/80">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
