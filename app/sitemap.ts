import type { MetadataRoute } from 'next';
import {
  listArticles,
  listAirlines,
  listAirports,
  listCountries,
  listDestinations,
  fetchRouteCoverage,
} from '@/lib/strapi';
import { SECTIONS } from '@/lib/sections';
import { LEGAL_DOCS } from '@/lib/legal';
import { AIRLINES_INDEXABLE, AIRPORTS_INDEXABLE, airportIsPublished, airportIsSubstantive } from '@/lib/entity-seo';
import { airlineGuideIsPublished, airlineIsIndexable } from '@/lib/airline-tier';
import { airportPath } from '@/lib/airport-slugs';

import { getAllAuthors } from '@/lib/authors';

const SITE_URL = 'https://www.originfacts.com';

export const revalidate = 3600;

/** A record's real CMS update time, or nothing — never the generation time. */
function lastModifiedOf(record: { updatedAt?: string | null; publishedAt?: string | null }) {
  const value = record.updatedAt || record.publishedAt;
  return value ? { lastModified: new Date(value) } : {};
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  const [articlesRes, destinations, airlines, airports, countries, coverage] = await Promise.all([
    listArticles({ pageSize: 200 }).catch(() => ({ data: [], meta: null as never })),
    listDestinations().catch(() => []),
    listAirlines().catch(() => []),
    listAirports().catch(() => []),
    listCountries().catch(() => []),
    fetchRouteCoverage().catch(() => ({ originIatas: new Set<string>(), carrierSlugs: new Set<string>() })),
  ]);

  const articles = articlesRes.data;

  const staticPaths: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/contact`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/methodology`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/authors`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/all-articles`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/destinations`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/flight-search`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/flight-routes`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/airlines`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/faq`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/hot-posts`, changeFrequency: 'daily', priority: 0.5 },
    { url: `${SITE_URL}/countries`, changeFrequency: 'weekly', priority: 0.7 },
    // /sitemap (the HTML index) is intentionally absent: it now carries
    // `noindex, follow`, and submitting a noindexed URL asks Google to crawl a
    // page it is told not to index. It stays linked from the footer for people.
  ];

  const categoryPaths: MetadataRoute.Sitemap = SECTIONS.map((s) => ({
    url: `${SITE_URL}/category/${s.slug}`,
   
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  const articlePaths: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE_URL}/articles/${a.slug}`,
    ...lastModifiedOf(a),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  const destinationPaths: MetadataRoute.Sitemap = destinations
    .filter((d) => d.slug)
    .map((d) => ({
      url: `${SITE_URL}/destinations/${d.slug}`,
      ...lastModifiedOf(d as { updatedAt?: string }),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));

  // Reviewed Tier 1 guides enter the sitemap individually while the broad
  // directory hold remains in place. If that hold is later lifted, the normal
  // tier gate adds other substantive airlines without duplicating these URLs.
  const airlinePaths: MetadataRoute.Sitemap = airlines
    .filter(
      (a) =>
        a.slug &&
        (airlineGuideIsPublished(a.slug) ||
          (AIRLINES_INDEXABLE && airlineIsIndexable(a, coverage.carrierSlugs.has(a.slug)))),
    )
    .map((a) => ({
      url: `${SITE_URL}/airlines/${a.slug}`,
      ...lastModifiedOf(a as { updatedAt?: string }),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }));

  // Reviewed airport guides enter the sitemap individually while the broad
  // directory hold remains in place.
  const airportPaths: MetadataRoute.Sitemap = airports
    .filter((a) => (AIRPORTS_INDEXABLE || airportIsPublished(a.iata)) && airportIsSubstantive(a, coverage.originIatas.has(a.iata.toLowerCase())))
    .map((a) => ({
      url: `${SITE_URL}${airportPath(a, airports)}`,
      ...lastModifiedOf(a as { updatedAt?: string }),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }));

  // /countries/<code> permanently redirects to /destinations/<slug>; the
  // destination pages are already listed, so the redirecting URLs stay out
  // of the sitemap (Google flags sitemaps full of redirects).
  const countryPaths: MetadataRoute.Sitemap = [];
  void countries;

  const legalPaths: MetadataRoute.Sitemap = LEGAL_DOCS.map((d) => ({
    url: `${SITE_URL}/legal/${d.slug}`,
   
    changeFrequency: 'yearly' as const,
    priority: 0.3,
  }));

  const authorPaths: MetadataRoute.Sitemap = getAllAuthors().map((a) => ({
    url: `${SITE_URL}/authors/${a.slug}`,
   
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [
    ...staticPaths,
    ...authorPaths,
    ...categoryPaths,
    ...articlePaths,
    ...destinationPaths,
    ...airlinePaths,
    ...airportPaths,
    ...countryPaths,
    ...legalPaths,
  ];
}
