export interface TocItem {
  id: string;
  text: string;
  level?: number;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

/**
 * Turn HTML character references back into text ("Don&#39;t" → "Don't").
 * Headings come out of the Markdown renderer with apostrophes and ampersands
 * escaped; the table of contents renders its text through React, which escapes
 * again, so without this the reader saw the raw "&#39;".
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? match;
  });
}

/**
 * Convert plain text into a clean URL anchor slug suitable for HTML element IDs.
 */
export function slugifyHeading(text: string): string {
  const clean = text.replace(/<[^>]+>/g, '').trim();
  const slug = clean
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
  return slug || 'section';
}

/**
 * Parse an HTML content string, ensure every <h2> and <h3> heading has a unique `id`
 * attribute, and extract a Table of Contents list.
 */
export function injectHeadingIdsAndExtractToc(html: string): {
  html: string;
  toc: TocItem[];
} {
  if (!html) return { html: '', toc: [] };

  const toc: TocItem[] = [];
  const usedIds = new Set<string>();

  // Matches <h2>...</h2> and <h3>...</h3> tags with optional attributes
  const regex = /<(h[23])([^>]*)>([\s\S]*?)<\/h[23]>/gi;

  const newHtml = html.replace(regex, (match, tag, attrs, inner) => {
    const cleanText = inner.replace(/<[^>]+>/g, '').trim();
    if (!cleanText) return match;

    let headingId = '';
    const idMatch = attrs.match(/id=["']([^"']+)["']/i);

    if (idMatch) {
      headingId = idMatch[1];
    } else {
      const baseId = slugifyHeading(cleanText);
      headingId = baseId;
      let counter = 1;
      while (usedIds.has(headingId)) {
        headingId = `${baseId}-${counter}`;
        counter++;
      }
      usedIds.add(headingId);

      // Prepend id attribute to existing attributes
      attrs = ` id="${headingId}"${attrs}`;
    }

    const level = parseInt(tag.charAt(1), 10);
    // The id keeps being built from the raw text above (e.g. "don39t-…"), so
    // existing links to sections still work; only the visible label is decoded.
    toc.push({ id: headingId, text: decodeHtmlEntities(cleanText), level });

    return `<${tag}${attrs}>${inner}</${tag}>`;
  });

  return { html: newHtml, toc };
}
