import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchRouteCoverage, listAirlines, listAirports, listCountries, listDestinations } from '@/lib/strapi';
import { airlineGuideIsPublished, airlineTier } from '@/lib/airline-tier';
import { getRouteFacts } from '@/lib/route-facts';
import { isNonPassengerAirline } from '@/lib/airline-exclusions';
import { fetchArticleCountsByCountry } from '@/lib/country-articles';
import {
  COUNTRIES_BROWSE_LIMIT,
  DIRECTORY_REGIONS,
  buildCountryDirectory,
  countryHref,
  featuredCountries,
  toRow,
} from '@/lib/country-directory';
import CountryDirectory from '@/components/country-directory/CountryDirectory';
import FeaturedCountryGrid from '@/components/country-directory/FeaturedCountryGrid';
import CategoryDescription from '@/components/CategoryDescription';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';
import { SECTIONS } from '@/lib/sections';

export const revalidate = 60;

const HUB = HUB_INTROS.countries;
const PATH = HUB_PATHS.countries;
// Says what the page now shows: counts per country, not cities.
const DESCRIPTION =
  'Browse countries by region — flag, ISO code, and how many airports, airlines, route records, city guides and articles we hold for each.';

export const metadata: Metadata = {
  title: 'Country Guides & Directory',
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  robots: { index: true, follow: true },
};

export default async function CountriesPage() {
  const [countries, airports, destinations, allAirlines, coverage, articleCounts] = await Promise.all([
    listCountries().catch(() => []),
    listAirports().catch(() => []),
    listDestinations().catch(() => []),
    listAirlines().catch(() => []),
    fetchRouteCoverage().catch(() => ({ originRouteCounts: new Map<string, number>() })),
    fetchArticleCountsByCountry().catch(() => new Map<string, number>()),
  ]);

  // The same airlines /airlines lists (passenger carriers, tier 1–2 or a
  // published guide), so a country's airline count matches what
  // /airlines?country= shows.
  const airlines = allAirlines.filter((a) => {
    if (isNonPassengerAirline(a)) return false;
    const dests = getRouteFacts(a.iataCode)?.destinationCount ?? 0;
    return airlineGuideIsPublished(a.slug) || airlineTier(a, dests > 0) <= 2;
  });

  const directory = buildCountryDirectory({
    countries,
    airports,
    destinations,
    airlines,
    originRouteCounts: coverage.originRouteCounts,
    articleCounts,
  });
  const featured = featuredCountries(directory);

  const regionCount = new Set(directory.map((c) => c.region).filter(Boolean)).size;
  const withAirports = directory.filter((c) => c.airports > 0).length;
  const withRoutes = directory.filter((c) => c.routes > 0).length;
  const withArticles = directory.filter((c) => c.articles > 0).length;

  // The ItemList is the cards the directory shows on load, in that order (A–Z).
  const collectionJsonLd = collectionPageJsonLd({
    name: HUB.name,
    description: DESCRIPTION,
    url: PATH,
    itemListName: 'Countries',
    max: COUNTRIES_BROWSE_LIMIT,
    items: directory.map((c) => ({ name: c.name, url: countryHref(c) })),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16" data-testid="countries-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header data-testid="countries-header">
        <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-12">
          <div className="min-w-0">
            <h1 className="text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">Countries</h1>
            <CategoryDescription text={HUB.intro} />
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-forest-900/70" data-testid="countries-stats">
              <li className="sm:hidden">
                <strong className="font-semibold text-forest-950">{directory.length.toLocaleString()}</strong> countries
              </li>
              <li>
                <strong className="font-semibold text-forest-950">{regionCount}</strong> regions
              </li>
              {withAirports < directory.length && (
                <li>
                  <strong className="font-semibold text-forest-950">{withAirports.toLocaleString()}</strong> with
                  airports listed
                </li>
              )}
              {withRoutes > 0 && (
                <li>
                  <strong className="font-semibold text-forest-950">{withRoutes.toLocaleString()}</strong> with route
                  records
                </li>
              )}
              {withArticles > 0 && (
                <li>
                  <strong className="font-semibold text-forest-950">{withArticles}</strong> with articles
                </li>
              )}
              <li>
                <a
                  href="#country-directory-heading"
                  className="font-semibold text-primary-emphasis underline-offset-2 hover:underline"
                >
                  Search the directory ↓
                </a>
              </li>
            </ul>
          </div>
          <div
            className="hidden h-32 w-32 flex-col items-center justify-center rounded-[0.3rem] bg-forest-50 text-forest-950 sm:flex"
            data-testid="countries-count"
          >
            <span className="text-4xl font-bold leading-none">{directory.length.toLocaleString()}</span>
            <span className="mt-2 text-[11px] font-bold uppercase tracking-widest text-forest-900/70">Countries</span>
          </div>
        </div>

        <nav
          className="no-scrollbar mt-10 flex items-center gap-x-8 overflow-x-auto whitespace-nowrap border-y border-forest-900/15 py-4 text-[14px] font-bold uppercase tracking-widest text-forest-950 sm:flex-wrap sm:gap-y-3"
          aria-label="Categories"
          data-testid="countries-subnav"
        >
          {[
            ...SECTIONS.filter((s) => s.slug !== 'destinations').map((s) => ({
              href: `/category/${s.slug}`,
              slug: s.slug,
              name: s.title,
            })),
            { href: '/airlines', slug: 'airlines', name: 'Airlines' },
            { href: '/airports', slug: 'airports', name: 'Airports' },
          ].map((item) => (
            <Link key={item.slug} href={item.href} className="transition hover:text-primary-emphasis">
              {item.name}
            </Link>
          ))}
        </nav>
      </header>

      <FeaturedCountryGrid countries={featured} />

      <CountryDirectory rows={directory.map(toRow)} />

      {/* Every country stays linked from the server HTML, by region: the
          directory above renders only the first COUNTRIES_BROWSE_LIMIT cards. */}
      <details className="group mt-10 rounded-[0.3rem] border border-forest-900/10 bg-white" data-testid="country-index">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-forest-950 hover:text-primary-emphasis [&::-webkit-details-marker]:hidden">
          All {directory.length} countries by region, A–Z
          <span aria-hidden className="text-forest-900/50 transition group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 border-t border-forest-900/10 px-4 py-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...DIRECTORY_REGIONS, undefined].map((r) => {
            const list = directory.filter((c) => c.region === r);
            if (list.length === 0) return null;
            return (
              <div key={r ?? 'other'} className="min-w-0">
                <h3 className="text-xs font-bold uppercase tracking-widest text-forest-900/55">
                  {r ?? 'Other'} <span className="font-semibold text-forest-900/40">{list.length}</span>
                </h3>
                <ul className="mt-2 columns-2 gap-x-4 text-sm [&>li]:truncate [&_a]:text-forest-900/80 [&_a:hover]:text-primary-emphasis [&_a:hover]:underline">
                  {list.map((c) => (
                    <li key={c.code}>
                      <a href={countryHref(c)}>{c.name}</a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </details>

      <section
        className="mt-20 border-t border-forest-900/15 pt-12"
        aria-labelledby="countries-guide-heading"
        data-testid="countries-about"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-forest-900/55">Using the directory</p>
        <h2 id="countries-guide-heading" className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
          What the counts mean
        </h2>
        <div className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
          {[
            {
              title: 'Airports and airlines',
              text: 'Airports are the airports with an IATA code in our airport directory; airlines are the passenger airlines in our airline directory whose home country is this one. Both counts link to that directory filtered to the country.',
            },
            {
              title: 'Route records',
              text: 'Route records are the routes in Originfacts route records that depart from an airport in the country. They show what our dataset covers, not a full airline schedule: a country with few or no route records may still have scheduled flights.',
            },
            {
              title: 'Guides and articles',
              text: 'The country name opens its destination guide. City guides are the city guides we have filed under the country, and articles are the published articles tagged with the country or one of those cities.',
            },
          ].map((item, i) => (
            <article key={item.title} className="border-t-2 border-forest-950 pt-4">
              <p className="font-mono text-xs font-bold text-forest-900/50">0{i + 1}</p>
              <h3 className="mt-2 text-xl font-bold leading-snug">{item.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-forest-900/70">{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
