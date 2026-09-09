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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

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
    { url: `${SITE_URL}`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/methodology`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/authors`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/all-articles`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/destinations`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/flight-search`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/flight-routes`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/airlines`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/countries`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    // /sitemap (the HTML index) is intentionally absent: it now carries
    // `noindex, follow`, and submitting a noindexed URL asks Google to crawl a
    // page it is told not to index. It stays linked from the footer for people.
  ];

  const categoryPaths: MetadataRoute.Sitemap = SECTIONS.map((s) => ({
    url: `${SITE_URL}/category/${s.slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  const articlePaths: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE_URL}/articles/${a.slug}`,
    lastModified: a.updatedAt ? new Date(a.updatedAt) : (a.publishedAt ? new Date(a.publishedAt) : now),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  const destinationPaths: MetadataRoute.Sitemap = destinations
    .filter((d) => d.slug)
    .map((d) => ({
      url: `${SITE_URL}/destinations/${d.slug}`,
      lastModified: now,
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
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }));

  // Reviewed airport guides enter the sitemap individually while the broad
  // directory hold remains in place.
  const airportPaths: MetadataRoute.Sitemap = airports
    .filter((a) => (AIRPORTS_INDEXABLE || airportIsPublished(a.iata)) && airportIsSubstantive(a, coverage.originIatas.has(a.iata)))
    .map((a) => ({
      url: `${SITE_URL}${airportPath(a, airports)}`,
      lastModified: now,
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
    lastModified: now,
    changeFrequency: 'yearly' as const,
    priority: 0.3,
  }));

  const authorPaths: MetadataRoute.Sitemap = getAllAuthors().map((a) => ({
    url: `${SITE_URL}/authors/${a.slug}`,
    lastModified: now,
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
