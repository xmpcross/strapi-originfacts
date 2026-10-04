export interface TocItem {
  id: string;
  text: string;
  level?: number;
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
    toc.push({ id: headingId, text: cleanText, level });

    return `<${tag}${attrs}>${inner}</${tag}>`;
  });

  return { html: newHtml, toc };
}
