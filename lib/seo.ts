/**
 * Meta-tag hygiene helpers.
 *
 * clampDescription() keeps <meta name="description"> within SERP-safe length:
 * Google truncates around 155-160 chars, so anything longer gets cut
 * mid-sentence in results. Sources that produce long copy (Strapi
 * seoDescription/excerpt, entity `about` text, authored page constants) run
 * through this at the generateMetadata()/metadata layer.
 *
 * warnIfLong() logs oversized source copy at build/render time so editors get
 * feedback without titles being hard-truncated.
 */

export const DESCRIPTION_MAX = 155;
const TITLE_WARN = 60;
const DESCRIPTION_WARN = 160;

/**
 * Trims + collapses whitespace, cuts at the last word boundary before `max`,
 * and appends an ellipsis only when something was actually removed. Never
 * cuts mid-word. Empty/undefined input returns ''.
 */
export function clampDescription(input?: string | null, max = DESCRIPTION_MAX): string {
  const clean = (input ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  // Reserve one char for the ellipsis, then back off to a word boundary.
  const slice = clean.slice(0, max - 1);
  const cut = slice.lastIndexOf(' ');
  return `${(cut > 0 ? slice.slice(0, cut) : slice).replace(/[,;:.\s]+$/, '')}…`;
}

/**
 * Strips markdown syntax to plain prose: fenced/inline code, images, links
 * (keeping the link text), blockquotes, list markers, horizontal rules,
 * emphasis/strong/strikethrough, and raw HTML tags. Heading LINES are dropped
 * whole — "## Overview" is structure, not prose, and a description reading
 * "Overview Sydney Airport sits…" is exactly the artefact we're avoiding.
 * Whitespace is collapsed. Input that is entirely markup returns ''.
 */
export function stripMarkdown(input?: string | null): string {
  let s = String(input ?? '');
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/`([^`]*)`/g, '$1');
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/^\s{0,3}#{1,6}\s+.*$/gm, ' ');
  s = s.replace(/^\s{0,3}>\s?/gm, '');
  s = s.replace(/^\s{0,3}(?:[-*+]|\d+[.)])\s+/gm, '');
  s = s.replace(/^\s{0,3}(?:[-*_]\s?){3,}\s*$/gm, ' ');
  s = s.replace(/(\*\*|__)([\s\S]*?)\1/g, '$2');
  s = s.replace(/(^|[^\w*])\*([^*\n]+)\*(?=[^\w*]|$)/g, '$1$2');
  s = s.replace(/(^|[^\w_])_([^_\n]+)_(?=[^\w_]|$)/g, '$1$2');
  s = s.replace(/~~([\s\S]*?)~~/g, '$1');
  s = s.replace(/<[^>]+>/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * SERP-safe budget for the page-specific part of a <title>. The root layout
 * appends " · Originfacts" via its title template, so the full tag runs ~14
 * chars longer than this; Google truncates around 60 visible chars, keeping
 * the keyword-bearing front of the title intact either way.
 */
export const TITLE_MAX = 60;

/**
 * Title builder for programmatic templates: "{base} — {keywordTail}", e.g.
 * "Qantas (QF) — Routes, Hubs & Fleet". When the combined form would blow the
 * TITLE_MAX budget the keyword tail is dropped whole — a long entity name
 * ("Saint Helena, Ascension and Tristan da Cunha") keeps its full, correct
 * name rather than a truncated tail. Never cuts inside the name itself.
 */
export function programmaticTitle(base: string, keywordTail: string, max = TITLE_MAX): string {
  const clean = base.replace(/\s+/g, ' ').trim();
  const full = `${clean} — ${keywordTail}`;
  return full.length <= max ? full : clean;
}

/**
 * The one description builder every template's generateMetadata should use.
 * Takes candidate sources in priority order — purpose-written summary fields
 * first (seoDescription, excerpt, shortDescription), derived body text
 * (about/description) after — and returns the first that still has content
 * once markdown is stripped, clamped to a word boundary at `max` chars with
 * an ellipsis only when text was actually removed. Stripping happens BEFORE
 * clamping, so markup never eats into the length budget or leaks into SERPs.
 */
export function buildMetaDescription(
  sources: Array<string | null | undefined>,
  max = DESCRIPTION_MAX,
): string {
  for (const source of sources) {
    const clean = stripMarkdown(source);
    if (clean) return clampDescription(clean, max);
  }
  return '';
}

/**
 * Logs a console warning when source copy exceeds SERP-safe lengths — shows up
 * in `yarn build` output (static pages) and server logs (dynamic ones).
 * Returns the inputs untouched: feedback for editors, never a hard truncation
 * of titles.
 */
export function warnIfLong(url: string, opts: { title?: string | null; description?: string | null }): void {
  const title = opts.title?.trim();
  const description = opts.description?.trim();
  if (title && title.length > TITLE_WARN) {
    console.warn(`[seo] ${url}: title is ${title.length} chars (> ${TITLE_WARN}): "${title.slice(0, 80)}"`);
  }
  if (description && description.length > DESCRIPTION_WARN) {
    console.warn(
      `[seo] ${url}: description is ${description.length} chars (> ${DESCRIPTION_WARN}) — will truncate in SERPs`,
    );
  }
}
