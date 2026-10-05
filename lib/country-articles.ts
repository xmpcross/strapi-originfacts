import qs from 'qs';
import { HIDDEN_ARTICLE_SLUGS } from '@/lib/strapi';

const BASE = (process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');
const TOKEN = process.env.STRAPI_API_TOKEN;
const PAGE_SIZE = 100;

type Row = { slug?: string; destinations?: { type?: string; countryCode?: string | null }[] };
type Page = { data: Row[]; meta?: { pagination?: { pageCount?: number } } };

/**
 * Published articles per country code (upper case), for /countries.
 *
 * Counts what a country's destination guide lists: articles tagged with the
 * country's own destination or with a city destination in it (see
 * app/destinations/[slug]/page.tsx). An article tagged with two places in one
 * country counts once. Field-limited — slugs and the tag's country code only —
 * and cached for an hour, so it is one or two small requests.
 */
export async function fetchArticleCountsByCountry(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const hidden = new Set(HIDDEN_ARTICLE_SLUGS);
  for (let page = 1; page <= 20; page++) {
    const query = qs.stringify(
      {
        fields: ['slug'],
        populate: { destinations: { fields: ['type', 'countryCode'] } },
        filters: { destinations: { id: { $notNull: true } } },
        pagination: { page, pageSize: PAGE_SIZE },
      },
      { encodeValuesOnly: true },
    );
    const res = await fetch(`${BASE}/api/articles?${query}`, {
      headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`Strapi ${res.status} on articles (country counts)`);
    const body = (await res.json()) as Page;
    for (const a of body.data ?? []) {
      if (a.slug && hidden.has(a.slug)) continue;
      const codes = new Set(
        (a.destinations ?? [])
          .filter((d) => d.type === 'country' || d.type === 'city')
          .map((d) => (d.countryCode ?? '').trim().toUpperCase())
          .filter(Boolean),
      );
      for (const cc of codes) counts.set(cc, (counts.get(cc) ?? 0) + 1);
    }
    if (page >= (body.meta?.pagination?.pageCount ?? 1)) break;
  }
  return counts;
}
