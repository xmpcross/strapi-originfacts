/**
 * Client-safe formatting helpers for interpolated counts in prose.
 * (lib/counts.ts is server-only — it pulls in next/cache and Strapi.)
 */

/** Spell small counts the way prose does ("six continental regions");
 *  larger numbers stay numeric. */
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export function spelledCount(n: number): string {
  return n >= 0 && n < WORDS.length ? WORDS[n] : n.toLocaleString('en-US');
}

export const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
