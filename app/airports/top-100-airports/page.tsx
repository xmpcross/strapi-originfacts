import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchRouteCoverage, listAirports, listCountries } from '@/lib/strapi';
import { PUBLISHED_AIRPORT_IATAS } from '@/lib/entity-seo';
import { airportSlug } from '@/lib/airport-slugs';
import {
  DIRECTORY_REGIONS,
  airportCountryIndex,
  compareAirports,
  type DirectoryAirport,
} from '@/lib/airport-directory';
import { SECTIONS } from '@/lib/sections';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import TopAirportsList from '@/components/TopAirportsList';
import { CheckIcon } from '@/components/FeaturedAirlineGuides';

export const revalidate = 60;

const PATH = '/airports/top-100-airports';
const NAME = 'Top 100 airports';
const DESCRIPTION = `The ${PUBLISHED_AIRPORT_IATAS.size} airports with a reviewed Originfacts guide, grouped by region, with IATA and ICAO codes, city, country and route records.`;

// Robots policy is unchanged from the old hubs page: no explicit
// `robots`, so the site default (indexable) applies.
export const metadata: Metadata = {
  title: 'Top 100 airports: our reviewed airport guides',
  description: DESCRIPTION,
  alternates: { canonical: PATH },
};

/**
 * The 100 reviewed airport guides (PUBLISHED_AIRPORT_IATAS) — the same set the
 * old hubs page listed (lib/hub-airports.ts holds the same 100 codes).
 * Not a ranking: the list is ordered by region, then city A–Z. Text-only cards.
 */
export default async function TopAirportsPage() {
  const [all, countries, coverage] = await Promise.all([
    listAirports().catch(() => []),
    listCountries().catch(() => []),
    fetchRouteCoverage().catch(() => ({
      originIatas: new Set<string>(),
      carrierSlugs: new Set<string>(),
      originRouteCounts: new Map<string, number>(),
    })),
  ]);

  // Slugs are resolved against every airport, exactly as /airports does, so a
  // duplicate city name gets the same -iata suffix here as there.
  const everyAirport = all.filter((a) => a.iata);
  const countryOf = airportCountryIndex(countries);
  const regionRank = (r?: string) => {
    const i = DIRECTORY_REGIONS.indexOf(r as (typeof DIRECTORY_REGIONS)[number]);
    return i === -1 ? DIRECTORY_REGIONS.length : i;
  };

  const airports: DirectoryAirport[] = everyAirport
    .filter((a) => PUBLISHED_AIRPORT_IATAS.has(a.iata.toUpperCase()))
    .map((a): DirectoryAirport => {
      const { country, region } = countryOf(a);
      return {
        iata: a.iata.toUpperCase(),
        ...(a.icao ? { icao: a.icao } : {}),
        name: a.name,
        ...(a.city ? { city: a.city } : {}),
        ...(country ? { country } : {}),
        ...(region ? { region } : {}),
        slug: airportSlug(a, everyAirport),
        reviewed: true,
        routes: coverage.originRouteCounts.get(a.iata.toLowerCase()) ?? 0,
      };
    })
    .sort((x, y) => regionRank(x.region) - regionRank(y.region) || compareAirports(x, y));

  const countryCount = new Set(airports.map((a) => a.country).filter(Boolean)).size;
  const regionCount = new Set(airports.map((a) => a.region).filter(Boolean)).size;
  const withRoutesCount = airports.filter((a) => (a.routes ?? 0) > 0).length;
  const routeTotal = airports.reduce((sum, a) => sum + (a.routes ?? 0), 0);

  // The ItemList follows the visible order (region, then city A–Z).
  const collectionJsonLd = collectionPageJsonLd({
    name: NAME,
    description: DESCRIPTION,
    url: PATH,
    itemListName: NAME,
    max: 100,
    items: airports.map((a) => ({
      name: a.city ? `${a.name} (${a.iata}) — ${a.city}` : `${a.name} (${a.iata})`,
      url: `/airports/${a.slug}`,
    })),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16" data-testid="top-airports-page">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Airports', url: '/airports' },
          { name: NAME, url: PATH },
        ])}
      />
      <JsonLd data={collectionJsonLd} />

      <header data-testid="top-airports-header">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm text-forest-900/60">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/airports" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                Airports
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page">{NAME}</li>
          </ol>
        </nav>

        <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-12">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-success-emphasis">
              <CheckIcon className="h-3.5 w-3.5" />
              Reviewed airport guides
            </p>
            <h1 className="mt-3 text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">
              Top 100 airports
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-forest-900/75 sm:text-lg">
              The airports we have written a reviewed guide for, picked to cover every region. This is not a ranking:
              airports are grouped by region and listed by city, A–Z.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-forest-900/70" data-testid="top-airports-stats">
              <li className="sm:hidden">
                <strong className="font-semibold text-forest-950">{airports.length}</strong> airports
              </li>
              <li>
                <strong className="font-semibold text-forest-950">{countryCount}</strong> countries
              </li>
              <li>
                <strong className="font-semibold text-forest-950">{regionCount}</strong> regions
              </li>
              {withRoutesCount > 0 && (
                <li>
                  <strong className="font-semibold text-forest-950">{withRoutesCount}</strong> with route records
                </li>
              )}
              <li>
                <Link href="/airports" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                  All airports →
                </Link>
              </li>
            </ul>
          </div>
          <div
            className="hidden h-32 w-32 flex-col items-center justify-center rounded-[0.3rem] bg-forest-50 text-center text-forest-950 sm:flex"
            data-testid="top-airports-count"
          >
            <span className="text-4xl font-bold leading-none">{airports.length}</span>
            <span className="mt-2 px-2 text-[11px] font-bold uppercase leading-tight tracking-widest text-forest-900/70">
              Reviewed guides
            </span>
          </div>
        </div>

        <nav
          className="no-scrollbar mt-10 flex items-center gap-x-8 overflow-x-auto whitespace-nowrap border-y border-forest-900/15 py-4 text-[14px] font-bold uppercase tracking-widest text-forest-950 sm:flex-wrap sm:gap-y-3"
          aria-label="Categories"
          data-testid="top-airports-subnav"
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
            <Link
              key={item.slug}
              href={item.href}
              className={`transition hover:text-primary-emphasis ${item.slug === 'airports' ? 'text-primary-emphasis' : ''}`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </header>

      <TopAirportsList airports={airports} />

      <section
        className="mt-20 border-t border-forest-900/15 pt-12"
        aria-labelledby="top-airports-about-heading"
        data-testid="top-airports-about"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-forest-900/55">About this list</p>
        <h2 id="top-airports-about-heading" className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
          What this list is
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
          {[
            {
              title: 'Our reviewed guides',
              text: `These ${airports.length} airports are the ones with a reviewed Originfacts guide: an editorial selection of international airports, chosen so that every region is covered. Being on the list does not mean an airport is busier or better than one that is not.`,
            },
            {
              title: 'Not a ranking',
              text: 'The order is region, then city A–Z. Regions follow the country records used across our airport and airline directories. Search by city, airport name, country, or the IATA or ICAO code.',
            },
            {
              title: 'Route records',
              text: `Route counts are the routes in Originfacts route records that depart from each airport: ${routeTotal} across these ${airports.length} airports, with ${withRoutesCount} having at least one. They show what our dataset covers, not a full airline schedule.`,
            },
          ].map((item, i) => (
            <article key={item.title} className="border-t-2 border-forest-950 pt-4">
              <p className="font-mono text-xs font-bold text-forest-900/50">0{i + 1}</p>
              <h3 className="mt-2 text-xl font-bold leading-snug">{item.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-forest-900/70">{item.text}</p>
            </article>
          ))}
        </div>
        <p className="mt-10 text-base text-forest-900/75">
          Looking for an airport that is not here?{' '}
          <Link href="/airports" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
            Search all airports in the directory →
          </Link>
        </p>
      </section>
    </div>
  );
}
