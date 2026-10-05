/**
 * Page numbers shown by the compact (phone-width) pagination: the current
 * page and up to one neighbour on each side, clamped to 1..total. Shared by
 * components/Pagination.tsx; kept pure so it can be unit-tested.
 */
export function compactPageWindow(current: number, total: number, radius = 1): number[] {
  if (total < 1) return [];
  const c = Math.min(Math.max(1, Math.trunc(current) || 1), total);
  let start = Math.max(1, c - radius);
  let end = Math.min(total, c + radius);
  // Keep the window the same width at either end (1 2 3, not just 1 2).
  const width = Math.min(total, radius * 2 + 1);
  if (end - start + 1 < width) {
    if (start === 1) end = Math.min(total, start + width - 1);
    else start = Math.max(1, end - width + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
