import qs from 'qs';

const BASE = (process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');
const TOKEN = process.env.STRAPI_API_TOKEN;

export type StrapiImage = { url: string; alternativeText?: string; width?: number; height?: number } | null;

export type StrapiArticle = {
  id: number;
  documentId?: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  readingTimeMinutes?: number;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  publishedAt: string;
  updatedAt: string;
  coverImage?: StrapiImage;
  ogImage?: StrapiImage;
  gallery?: NonNullable<StrapiImage>[];
  category?: { id: number; name: string; slug: string; color?: string } | null;
  tags?: { id: number; name: string; slug: string }[];
  author?: {
    id: number;
    name: string;
    slug: string;
    avatar?: StrapiImage;
    role?: string;
    bio?: string;
    credentials?: string;
    twitter?: string;
    linkedin?: string;
    website?: string;
  } | null;
  destinations?: { id: number; name: string; slug: string; type?: 'country' | 'region' | 'city' }[];
  /** Optional editor-managed Q&As (legacy json field) — see normalizeFaqs(). */
  faqs?: unknown;
  /** Structured FAQ entries (Strapi repeatable `faq.item` component). Takes
   *  precedence over the legacy `faqs` json when present; sorted by `order`. */
  faqItems?: { id: number; question: string; answer: string; order?: number | null }[];
  /** Optional how-to steps (json field) — flags the post as a HowTo, see normalizeSteps(). */
  steps?: unknown;
  /** Optional 40-60 word direct-answer summary shown in the KeyFacts callout. */
  tldr?: string;
  /** Optional quick-scan facts (json) — see normalizeKeyFacts(). */
  keyFacts?: unknown;
};

export type StrapiCategory = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
  site?: string;
  parent?: { id: number; name: string; slug: string } | null;
  children?: { id: number; name: string; slug: string }[];
};

export type StrapiCountry = {
  id: number;
  documentId?: string;
  code: string;
  name: string;
  currency?: string;
  region?: AirlineRegion;
  about?: string;
  heroImage?: StrapiImage;
};

export type StrapiDestination = {
  id: number;
  name: string;
  slug: string;
  type?: 'country' | 'region' | 'city';
  countryCode?: string;
  description?: string;
  /** Optional per-country facts that override the static lookup in
   *  `lib/country-facts.ts`. Populated by enrich-country-content.js. */
  facts?: {
    officialName?: string;
    government?: string;
    monarch?: string;
    population?: number;
    areaKm2?: number;
    currencyCode?: string;
    currencyName?: string;
    languages?: string[];
    capital?: string;
    callingCode?: string;
    drivesOn?: 'left' | 'right';
    timezones?: string;
  };
  heroImage?: StrapiImage;
  /** Optional editor-managed Q&As (json field) — see normalizeFaqs(). */
  faqs?: unknown;
  /** Optional 40-60 word direct-answer summary shown in the KeyFacts callout. */
  tldr?: string;
  /** Optional quick-scan facts (json) — see normalizeKeyFacts(). */
  keyFacts?: unknown;
};

export type AirlineType = 'Scheduled' | 'Charter' | 'Cargo' | 'Low-cost' | 'Regional';
export type AirlineRegion = 'Africa' | 'Asia' | 'Europe' | 'North America' | 'Oceania' | 'South America';

export type StrapiAirline = {
  id: number;
  documentId?: string;
  name: string;
  slug: string;
  about?: string;
  iataCode?: string;
  icaoCode?: string;
  legalName?: string;
  type?: AirlineType;
  country?: string;
  airport?: string;
  city?: string;
  region?: AirlineRegion;
  founded?: number;
  logo?: StrapiImage;
  address?: string;
  phone?: string;
  website?: string;
  keyDestinations?: string[];
  faqs?: { q: string; a: string }[];
  frequentFlyerProgram?: string;
  frequentFlyerUrl?: string;
  goodToKnow?: { title: string; body: string }[];
  shortDescription?: string;
};

export type StrapiAirport = {
  id: number;
  documentId?: string;
  iata: string;
  icao?: string;
  name: string;
  city?: string;
  country?: string;
  countryCode?: string;
  region?: AirlineRegion;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  about?: string;
  heroImage?: StrapiImage;
};

export type StrapiRoute = {
  id: number;
  documentId?: string;
  slug: string;
  origin?: StrapiAirport;
  destination?: StrapiAirport;
  carriers?: StrapiAirline[];
  distanceKm?: number;
  durationMinutes?: number;
  popularity?: number;
  about?: string;
};

type ListResponse<T> = { data: T[]; meta: { pagination: { page: number; pageSize: number; pageCount: number; total: number } } };

/**
 * Total record count for a collection (optionally filtered) straight from
 * Strapi's pagination meta — one row of payload regardless of collection
 * size. This is THE way to state dataset sizes in copy; never derive a
 * "how many X" claim from a capped list fetch (see lib/counts.ts).
 */
export async function countRecords(path: string, filters?: Record<string, unknown>, revalidate = 3600): Promise<number> {
  const res = await strapiFetch<ListResponse<unknown>>(
    path,
    { ...(filters ? { filters } : {}), pagination: { pageSize: 1 } },
    revalidate,
  );
  return res.meta?.pagination?.total ?? 0;
}

async function strapiFetch<T>(path: string, params?: Record<string, unknown>, revalidate = 60): Promise<T> {
  const query = params ? '?' + qs.stringify(params, { encodeValuesOnly: true }) : '';
  const url = `${BASE}/api/${path}${query}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    next: { revalidate },
  });
  if (!res.ok) {
    throw new Error(`Strapi ${res.status} on ${url}: ${await res.text().catch(() => '')}`);
  }
  return res.json();
}

export function mediaUrl(img: StrapiImage): string | null {
  if (!img?.url) return null;
  return img.url.startsWith('http') ? img.url : `${BASE}${img.url}`;
}

export async function listArticles(opts: { page?: number; pageSize?: number; category?: string; destination?: string; q?: string } = {}) {
  const filters: Record<string, unknown> = {};
  if (opts.category) filters.category = { slug: { $eqi: opts.category } };
  if (opts.destination) filters.destinations = { slug: { $eqi: opts.destination } };
  if (opts.q?.trim()) {
    const q = opts.q.trim();
    filters.$or = [
      { title: { $containsi: q } },
      { excerpt: { $containsi: q } },
      { content: { $containsi: q } },
      { category: { name: { $containsi: q } } },
      { destinations: { name: { $containsi: q } } },
    ];
  }

  const res = await strapiFetch<ListResponse<StrapiArticle>>('articles', {
    sort: ['publishedAt:desc'],
    populate: ['coverImage', 'category', 'tags', 'author', 'destinations'],
    pagination: { page: opts.page ?? 1, pageSize: opts.pageSize ?? 12 },
    filters,
  });
  return res;
}

/**
 * For the BlogSidebar's "Categories" block: given an ordered list of
 * category slugs, returns each one's name, post count, and a sample
 * cover image (taken from the most-recent article in the category).
 */
export async function listSidebarCategoryTiles(slugs: string[]) {
  if (slugs.length === 0) return [];
  const results = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const res = await strapiFetch<ListResponse<StrapiArticle>>('articles', {
          filters: { category: { slug: { $eqi: slug } } },
          sort: ['publishedAt:desc'],
          populate: ['coverImage', 'category'],
          pagination: { pageSize: 1 },
        });
        const sample = res.data[0];
        return {
          slug,
          name: sample?.category?.name ?? slug,
          count: res.meta?.pagination?.total ?? 0,
          image: sample ? mediaUrl(sample.coverImage ?? null) : null,
        };
      } catch {
        return { slug, name: slug, count: 0, image: null };
      }
    }),
  );
  return results;
}

/**
 * Returns articles for the Hot Posts page — ranked by readingTimeMinutes
 * desc (engagement-depth proxy until we track real views).
 */
export async function listHotArticles(opts: { page?: number; pageSize?: number } = {}) {
  const res = await strapiFetch<ListResponse<StrapiArticle>>('articles', {
    sort: ['readingTimeMinutes:desc', 'publishedAt:desc'],
    populate: ['coverImage', 'category', 'tags', 'author', 'destinations'],
    pagination: { page: opts.page ?? 1, pageSize: opts.pageSize ?? 12 },
  });
  return res;
}

/**
 * Returns the article whose publishedAt is immediately before / after
 * the given timestamp. Used for the Previous/Next post nav on the
 * single-article page.
 */
export async function getAdjacentArticles(publishedAt: string, currentId: number) {
  const [prevRes, nextRes] = await Promise.all([
    strapiFetch<ListResponse<StrapiArticle>>('articles', {
      filters: { publishedAt: { $lt: publishedAt } },
      sort: ['publishedAt:desc'],
      populate: ['coverImage', 'category'],
      pagination: { pageSize: 1 },
    }).catch(() => ({ data: [] as StrapiArticle[] })),
    strapiFetch<ListResponse<StrapiArticle>>('articles', {
      filters: { publishedAt: { $gt: publishedAt } },
      sort: ['publishedAt:asc'],
      populate: ['coverImage', 'category'],
      pagination: { pageSize: 1 },
    }).catch(() => ({ data: [] as StrapiArticle[] })),
  ]);
  const prev = prevRes.data.find((a) => a.id !== currentId) ?? null;
  const next = nextRes.data.find((a) => a.id !== currentId) ?? null;
  return { prev, next };
}

/**
 * Returns 5 most-recent and 5 "popular" articles for the BlogSidebar.
 * Popular uses reading-time desc as a depth/engagement proxy until we
 * track real views.
 */
export async function listSidebarArticles(limit = 5) {
  const [recentRes, popularRes] = await Promise.all([
    strapiFetch<ListResponse<StrapiArticle>>('articles', {
      sort: ['publishedAt:desc'],
      populate: ['coverImage', 'category'],
      pagination: { pageSize: limit },
    }),
    strapiFetch<ListResponse<StrapiArticle>>('articles', {
      sort: ['readingTimeMinutes:desc', 'publishedAt:desc'],
      populate: ['coverImage', 'category'],
      pagination: { pageSize: limit },
    }),
  ]);
  return { recent: recentRes.data, popular: popularRes.data };
}

export async function listDestinationArticles(opts: { page?: number; pageSize?: number } = {}) {
  const res = await strapiFetch<ListResponse<StrapiArticle>>('articles', {
    sort: ['publishedAt:desc'],
    populate: ['coverImage', 'category', 'tags', 'author', 'destinations'],
    pagination: { page: opts.page ?? 1, pageSize: opts.pageSize ?? 12 },
    filters: {
      destinations: {
        id: { $notNull: true },
        type: { $in: ['city', 'country', 'region'] },
      },
    },
  });

  return {
    ...res,
    data: res.data.filter((article) =>
      article.destinations?.some((destination) =>
        ['city', 'country', 'region'].includes(destination.type ?? ''),
      ),
    ),
  };
}

export async function getArticle(slug: string) {
  const res = await strapiFetch<ListResponse<StrapiArticle>>('articles', {
    filters: { slug: { $eq: slug } },
    populate: ['coverImage', 'ogImage', 'category', 'tags', 'author', 'author.avatar', 'destinations', 'gallery', 'faqItems'],
    pagination: { pageSize: 1 },
  });
  return res.data?.[0] ?? null;
}

export async function listCategories(opts: { site?: string; topLevelOnly?: boolean } = {}) {
  const filters: Record<string, unknown> = {};
  if (opts.site) filters.site = { $in: ['all', opts.site] };
  if (opts.topLevelOnly) filters.parent = { id: { $null: true } };

  const res = await strapiFetch<ListResponse<StrapiCategory>>('categories', {
    sort: ['order:asc', 'name:asc'],
    populate: ['parent', 'children'],
    pagination: { pageSize: 100 },
    filters,
  });
  return res.data;
}

export async function getCategory(slug: string) {
  const res = await strapiFetch<ListResponse<StrapiCategory>>('categories', {
    filters: { slug: { $eqi: slug } },
    populate: ['parent', 'children'],
    pagination: { pageSize: 1 },
  });
  return res.data?.[0] ?? null;
}

export async function listDestinations() {
  return fetchAllPages<StrapiDestination>('destinations', {
    sort: ['name:asc'],
    populate: ['heroImage'],
  });
}

/**
 * ISO country code (uppercased) → destination slug, for linking a country at
 * its canonical URL. `/countries/<code>` permanently redirects to
 * `/destinations/<slug>` whenever a CMS destination exists, so internal links
 * should go straight to the destination and skip the 308 hop. Codes without a
 * destination fall back to `/countries/<code>` (which renders directly).
 */
export async function destinationSlugByCountryCode(): Promise<Record<string, string>> {
  const dests = await listDestinations().catch(() => []);
  const map: Record<string, string> = {};
  for (const d of dests) {
    if (d.countryCode && d.slug) map[d.countryCode.toUpperCase()] = d.slug;
  }
  return map;
}

/** Canonical href for a country: its destination page when one exists. */
export function countryHref(code: string, slugMap: Record<string, string>): string {
  const slug = slugMap[code.toUpperCase()];
  return slug ? `/destinations/${slug}` : `/countries/${code.toLowerCase()}`;
}

export async function getDestination(slug: string) {
  const res = await strapiFetch<ListResponse<StrapiDestination>>('destinations', {
    filters: { slug: { $eq: slug } },
    populate: ['heroImage'],
    pagination: { pageSize: 1 },
  });
  return res.data?.[0] ?? null;
}

export async function getDestinationByCountryCode(code: string) {
  const res = await strapiFetch<ListResponse<StrapiDestination>>('destinations', {
    filters: { countryCode: { $eqi: code }, type: { $eq: 'country' } },
    populate: ['heroImage'],
    pagination: { pageSize: 1 },
  });
  return res.data?.[0] ?? null;
}

export async function listCountryDestinations(limit = 12) {
  const res = await strapiFetch<ListResponse<StrapiDestination>>('destinations', {
    filters: { type: { $eq: 'country' } },
    sort: ['name:asc'],
    populate: ['heroImage'],
    pagination: { pageSize: limit },
  });
  return res.data;
}

/**
 * Country destinations ranked by "popularity":
 *   1. Only countries with a hero image are eligible (no blank tiles).
 *   2. Within that pool, rank by number of articles linked to the destination.
 *   3. Tie-break alphabetically.
 *
 * Uses 1-3 paginated requests on /articles plus one on /destinations.
 */
export async function listPopularCountryDestinations(limit = 8) {
  const ready = await fetchAllPages<StrapiDestination>('destinations', {
    filters: { type: { $eq: 'country' }, heroImage: { $notNull: true } },
    populate: ['heroImage'],
  });

  // Walk articles once and build a slug → count map.
  const counts = new Map<string, number>();
  type ArticleWithDests = { destinations?: { slug?: string }[] };
  let page = 1;
  const pageSize = 100;
  while (true) {
    const r = await strapiFetch<ListResponse<ArticleWithDests>>('articles', {
      fields: ['id'],
      populate: { destinations: { fields: ['slug'] } },
      pagination: { page, pageSize },
    });
    for (const a of r.data) {
      for (const d of a.destinations ?? []) {
        if (d?.slug) counts.set(d.slug, (counts.get(d.slug) ?? 0) + 1);
      }
    }
    const pageCount = r.meta?.pagination?.pageCount ?? 1;
    if (page >= pageCount) break;
    page++;
  }

  return ready
    .map((c) => ({ c, count: counts.get(c.slug) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((r) => r.c);
}

/**
 * Fetch a curated list of country-type destinations by slug, preserving the
 * order the slugs were given. Used by the homepage "Explore by country"
 * block when we want a hand-picked set instead of the popularity ranking.
 */
export async function listCountriesBySlugs(slugs: string[]) {
  if (slugs.length === 0) return [] as StrapiDestination[];
  const res = await strapiFetch<ListResponse<StrapiDestination>>('destinations', {
    filters: { type: { $eq: 'country' }, slug: { $in: slugs } },
    populate: ['heroImage'],
    pagination: { pageSize: Math.max(slugs.length, 25) },
  });
  const bySlug = new Map(res.data.map((d) => [d.slug, d]));
  return slugs.map((s) => bySlug.get(s)).filter((d): d is StrapiDestination => Boolean(d));
}

export async function listCitiesByCountryCode(code: string, limit = 100) {
  const res = await strapiFetch<ListResponse<StrapiDestination>>('destinations', {
    filters: { type: { $eq: 'city' }, countryCode: { $eqi: code } },
    sort: ['name:asc'],
    populate: ['heroImage'],
    pagination: { pageSize: limit },
  });
  return res.data;
}

async function fetchAllPages<T>(
  collection: string,
  query: Record<string, unknown> & { pageSize?: number },
): Promise<T[]> {
  const { pageSize: rawPageSize, ...base } = query;
  const pageSize = (rawPageSize as number | undefined) ?? 100;
  const all: T[] = [];
  let page = 1;
  while (true) {
    const res = await strapiFetch<ListResponse<T>>(collection, {
      ...base,
      pagination: { page, pageSize },
    });
    all.push(...res.data);
    const pageCount = res.meta?.pagination?.pageCount ?? 1;
    if (page >= pageCount) break;
    page++;
  }
  return all;
}

export async function listAirlines() {
  return fetchAllPages<StrapiAirline>('airlines', {
    sort: ['name:asc'],
    populate: ['logo'],
  });
}

export async function getAirline(slug: string) {
  const res = await strapiFetch<ListResponse<StrapiAirline>>('airlines', {
    filters: { slug: { $eq: slug } },
    populate: ['logo'],
    pagination: { pageSize: 1 },
  });
  return res.data?.[0] ?? null;
}

export async function listAirports() {
  return fetchAllPages<StrapiAirport>('airports', {
    sort: ['name:asc'],
    populate: ['heroImage'],
  });
}

export async function getAirport(iata: string) {
  const res = await strapiFetch<ListResponse<StrapiAirport>>('airports', {
    filters: { iata: { $eqi: iata } },
    populate: ['heroImage'],
    pagination: { pageSize: 1 },
  });
  return res.data?.[0] ?? null;
}

export async function listCountries() {
  return fetchAllPages<StrapiCountry>('countries', {
    sort: ['name:asc'],
    populate: ['heroImage'],
  });
}

export async function getCountry(code: string) {
  const res = await strapiFetch<ListResponse<StrapiCountry>>('countries', {
    filters: { code: { $eqi: code } },
    populate: ['heroImage'],
    pagination: { pageSize: 1 },
  });
  return res.data?.[0] ?? null;
}

export async function listCountriesByRegion(region: string) {
  return fetchAllPages<StrapiCountry>('countries', {
    filters: { region: { $eq: region } },
    sort: ['name:asc'],
    populate: ['heroImage'],
  });
}

export async function listAirportsByCountryCode(code: string, limit = 500) {
  const res = await strapiFetch<ListResponse<StrapiAirport>>('airports', {
    filters: { countryCode: { $eqi: code } },
    sort: ['name:asc'],
    populate: ['heroImage'],
    pagination: { pageSize: limit },
  });
  return res.data;
}

export async function listAirlinesByCountry(countryName: string, limit = 200) {
  const res = await strapiFetch<ListResponse<StrapiAirline>>('airlines', {
    filters: { country: { $eqi: countryName } },
    sort: ['name:asc'],
    populate: ['logo'],
    pagination: { pageSize: limit },
  });
  return res.data;
}

export async function listRoutesByCountryCode(code: string, limit = 20) {
  const res = await strapiFetch<ListResponse<StrapiRoute>>('routes', {
    filters: { destination: { countryCode: { $eqi: code } } },
    populate: {
      origin: true,
      destination: true,
      carriers: { populate: ['logo'] },
    },
    sort: ['popularity:desc'],
    pagination: { pageSize: limit },
  });
  return res.data;
}

export async function getRoute(slug: string) {
  const res = await strapiFetch<ListResponse<StrapiRoute>>('routes', {
    filters: { slug: { $eq: slug } },
    populate: {
      origin: { populate: ['heroImage'] },
      destination: { populate: ['heroImage'] },
      carriers: { populate: ['logo'] },
    },
    pagination: { pageSize: 1 },
  });
  return res.data?.[0] ?? null;
}

export async function listRoutes() {
  const res = await strapiFetch<ListResponse<StrapiRoute>>('routes', {
    sort: ['popularity:desc', 'slug:asc'],
    populate: {
      origin: true,
      destination: true,
      carriers: { populate: ['logo'] },
    },
    pagination: { pageSize: 1000 },
  }, 0);
  return res.data;
}

export async function listRoutesToDestination(
  dest: Pick<StrapiDestination, 'name' | 'countryCode' | 'type'>,
  limit = 12,
) {
  // Destinations aren't directly linked to routes in Strapi.
  // Match on the arrival airport: city for city-type destinations, countryCode otherwise.
  const filters: Record<string, unknown> =
    dest.type === 'city'
      ? { destination: { city: { $eqi: dest.name } } }
      : dest.countryCode
        ? { destination: { countryCode: { $eqi: dest.countryCode } } }
        : { destination: { country: { $eqi: dest.name } } };

  const res = await strapiFetch<ListResponse<StrapiRoute>>('routes', {
    filters,
    populate: {
      origin: true,
      destination: true,
      carriers: { populate: ['logo'] },
    },
    sort: ['popularity:desc'],
    pagination: { pageSize: limit },
  });
  return res.data;
}

export async function listRoutesByCarrier(airlineSlug: string, limit = 20) {
  const res = await strapiFetch<ListResponse<StrapiRoute>>('routes', {
    filters: { carriers: { slug: { $eq: airlineSlug } } },
    populate: {
      origin: true,
      destination: true,
      carriers: { populate: ['logo'] },
    },
    sort: ['popularity:desc'],
    pagination: { pageSize: limit },
  });
  return res.data;
}

/**
 * Lightweight one-pass scan of the whole routes collection, returning the set
 * of airport IATA codes that appear as a route ORIGIN and the set of carrier
 * slugs that operate any route. Used by the sitemap quality gate to decide
 * which airport/airline pages carry real network data (and so deserve
 * indexing). Pulls minimal fields only.
 */
export async function fetchRouteCoverage(): Promise<{
  originIatas: Set<string>;
  carrierSlugs: Set<string>;
}> {
  const originIatas = new Set<string>();
  const carrierSlugs = new Set<string>();
  let page = 1;
  const pageSize = 300;
  while (true) {
    const r = await strapiFetch<ListResponse<StrapiRoute>>(
      'routes',
      {
        fields: ['id'],
        populate: { origin: { fields: ['iata'] }, carriers: { fields: ['slug'] } },
        pagination: { page, pageSize },
      },
      3600,
    );
    for (const rt of r.data) {
      if (rt.origin?.iata) originIatas.add(rt.origin.iata.toLowerCase());
      for (const c of rt.carriers ?? []) {
        if (c?.slug) carrierSlugs.add(c.slug);
      }
    }
    const pageCount = r.meta?.pagination?.pageCount ?? 1;
    if (page >= pageCount) break;
    page++;
  }
  return { originIatas, carrierSlugs };
}

export async function listRoutesFromAirport(iata: string, limit = 20) {
  const res = await strapiFetch<ListResponse<StrapiRoute>>('routes', {
    filters: { origin: { iata: { $eqi: iata } } },
    populate: {
      origin: true,
      destination: true,
      carriers: { populate: ['logo'] },
    },
    sort: ['popularity:desc'],
    pagination: { pageSize: limit },
  });
  return res.data;
}
