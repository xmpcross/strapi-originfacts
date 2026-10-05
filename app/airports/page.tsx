import type { Metadata } from 'next';
import { fetchRouteCoverage, listAirports, listCountries } from '@/lib/strapi';
import AirportDirectory from '@/components/AirportDirectory';
import FeaturedAirportGuides from '@/components/FeaturedAirportGuides';
import CategoryDescription from '@/components/CategoryDescription';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';
import { airportSlug } from '@/lib/airport-slugs';
import { airportIsPublished } from '@/lib/entity-seo';
import {
  AIRPORTS_BROWSE_LIMIT,
  DIRECTORY_REGIONS,
  airportCountryIndex,
  compareAirports,
  rankAirports,
  toRow,
  type DirectoryAirport,
} from '@/lib/airport-directory';
import { SECTIONS } from '@/lib/sections';
import Link from 'next/link';

export const revalidate = 60;

const HUB = HUB_INTROS.airports;
const PATH = HUB_PATHS.airports;
/** Reviewed guides shown in the featured grid, per region. */
const FEATURED_PER_REGION = 2;

export const metadata: Metadata = {
  title: 'Airport Guides & Directory',
  description: HUB.description,
  alternates: { canonical: PATH },
  robots: { index: true, follow: true },
};

export default async function AirportsPage() {
  const [all, countries, coverage] = await Promise.all([
    listAirports().catch(() => []),
    listCountries().catch(() => []),
    fetchRouteCoverage().catch(() => ({
      originIatas: new Set<string>(),
      carrierSlugs: new Set<string>(),
      originRouteCounts: new Map<string, number>(),
    })),
  ]);

  // Every airport record is listed: #128 restored the full list after #125
  // had cut it to the 100 reviewed guides.
  const airports = all.filter((a) => a.iata);

  // Region and country spelling come from the country collection (see
  // lib/airport-directory.ts), the same source /airlines groups by.
  const countryOf = airportCountryIndex(countries);
  const directory: DirectoryAirport[] = airports
    .map((a): DirectoryAirport => {
      const { country, region } = countryOf(a);
      const routes = coverage.originRouteCounts.get(a.iata.toLowerCase()) ?? 0;
      return {
        iata: a.iata.toUpperCase(),
        ...(a.icao ? { icao: a.icao } : {}),
        name: a.name,
        ...(a.city ? { city: a.city } : {}),
        ...(country ? { country } : {}),
        ...(region ? { region } : {}),
        slug: airportSlug(a, airports),
        ...(airportIsPublished(a.iata) ? { reviewed: true } : {}),
        ...(routes > 0 ? { routes } : {}),
      };
    })
    // The order "Browse all airports" opens in (rankAirports).
    .sort(rankAirports);

  const countryCount = new Set(directory.map((a) => a.country).filter(Boolean)).size;
  const reviewedCount = directory.filter((a) => a.reviewed).length;
  const withRoutesCount = directory.filter((a) => a.routes).length;

  // Featured: reviewed guides, the two per region with the most route records.
  const featured = DIRECTORY_REGIONS.flatMap((r) =>
    directory
      .filter((a) => a.reviewed && a.region === r)
      .sort((x, y) => (y.routes ?? 0) - (x.routes ?? 0) || compareAirports(x, y))
      .slice(0, FEATURED_PER_REGION),
  );

  // Every indexable airport page (a reviewed guide or route records, the
  // airportIsSubstantive gate) stays linked from this page as a plain A–Z
  // list under the featured grid: the directory below renders only the first
  // AIRPORTS_BROWSE_LIMIT cards.
  const guideIndex = directory.filter((a) => a.reviewed || a.routes).sort(compareAirports);

  // The ItemList is the cards the directory shows on load, in that order.
  const collectionJsonLd = collectionPageJsonLd({
    name: HUB.name,
    description: HUB.description,
    url: PATH,
    itemListName: 'Airports',
    max: AIRPORTS_BROWSE_LIMIT,
    items: directory.map((a) => ({
      name: a.city ? `${a.name} (${a.iata}) — ${a.city}` : `${a.name} (${a.iata})`,
      url: `/airports/${a.slug}`,
    })),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16" data-testid="airports-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header data-testid="airports-header">
        <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-12">
          <div className="min-w-0">
            <h1 className="text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">Airports</h1>
            <CategoryDescription text={HUB.intro} />
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-forest-900/70" data-testid="airports-stats">
              <li className="sm:hidden">
                <strong className="font-semibold text-forest-950">{directory.length.toLocaleString()}</strong> airports
              </li>
              <li>
                <strong className="font-semibold text-forest-950">{countryCount.toLocaleString()}</strong> countries
              </li>
              {reviewedCount > 0 && (
                <li className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success-emphasis" />
                  <strong className="font-semibold text-forest-950">{reviewedCount}</strong> reviewed guide
                  {reviewedCount === 1 ? '' : 's'}
                </li>
              )}
              {withRoutesCount > 0 && (
                <li>
                  <strong className="font-semibold text-forest-950">{withRoutesCount.toLocaleString()}</strong> with
                  route records
                </li>
              )}
              <li>
                <a
                  href="#airport-directory-heading"
                  className="font-semibold text-primary-emphasis underline-offset-2 hover:underline"
                >
                  Search the directory ↓
                </a>
              </li>
            </ul>
          </div>
          <div
            className="hidden h-32 w-32 flex-col items-center justify-center rounded-[0.3rem] bg-forest-50 text-forest-950 sm:flex"
            data-testid="airports-count"
          >
            <span className="text-4xl font-bold leading-none">{directory.length.toLocaleString()}</span>
            <span className="mt-2 text-[11px] font-bold uppercase tracking-widest text-forest-900/70">Airports</span>
          </div>
        </div>

        <nav
          className="no-scrollbar mt-10 flex items-center gap-x-8 overflow-x-auto whitespace-nowrap border-y border-forest-900/15 py-4 text-[14px] font-bold uppercase tracking-widest text-forest-950 sm:flex-wrap sm:gap-y-3"
          aria-label="Categories"
          data-testid="airports-subnav"
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
              aria-current={item.slug === 'airports' ? 'page' : undefined}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </header>

      <FeaturedAirportGuides airports={featured} reviewedCount={reviewedCount} guideIndex={guideIndex} />

      <AirportDirectory rows={directory.map(toRow)} />

      <section
        className="mt-20 border-t border-forest-900/15 pt-12"
        aria-labelledby="airports-guide-heading"
        data-testid="airports-about"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-forest-900/55">Using the directory</p>
        <h2 id="airports-guide-heading" className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
          What the directory shows
        </h2>
        <div className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
          {[
            {
              title: 'Codes, city and country',
              text: 'Every airport is listed with its three-letter IATA code, and most with the four-letter ICAO code too. Search accepts either code, the airport name, the city it serves or the country, with or without accents.',
            },
            {
              title: 'Reviewed guides',
              text: `${reviewedCount} airports have a reviewed guide, marked with a tick. Every other airport page shows the record's codes and location, and any routes we hold for it.`,
            },
            {
              title: 'Route records',
              text: 'Route counts are the routes in Originfacts route records that depart from that airport. They show what our dataset covers, not a full airline schedule: an airport with no route records may still have scheduled flights.',
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
