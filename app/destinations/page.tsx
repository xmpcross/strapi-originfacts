import type { Metadata } from 'next';
import Link from 'next/link';

import DestinationIndex, { type IndexContinent, type IndexPlace } from '@/components/DestinationIndex';
import { JsonLd } from '@/components/SeoBlocks';
import { DIRECTORY_REGIONS } from '@/lib/airline-directory';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { listCountries, listDestinations, mediaUrl } from '@/lib/strapi';

export const revalidate = 60;

const HUB = HUB_INTROS.destinations;
const PATH = HUB_PATHS.destinations;

const DESCRIPTION =
  'Travel guides to every country and city we cover, grouped by continent: entry rules, airports and airlines, money and getting around.';

export const metadata: Metadata = {
  title: 'Travel guides by country and city',
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  robots: { index: true, follow: true },
};

export default async function DestinationsPage() {
  const [destinations, countryRecords] = await Promise.all([
    listDestinations().catch(() => []),
    listCountries().catch(() => []),
  ]);

  // Continent and country name come from the country collection, matched on the
  // ISO code — the same grouping /airports and /airlines use, so a country sits
  // under the same continent on every hub.
  const byCode = new Map(countryRecords.filter((c) => c.code).map((c) => [c.code.toUpperCase(), c]));
  const continentOf = (code?: string) => {
    const r = code ? byCode.get(code.toUpperCase())?.region : undefined;
    return r && DIRECTORY_REGIONS.includes(r) ? r : undefined;
  };
  const countryName = (code?: string) => (code ? byCode.get(code.toUpperCase())?.name : undefined);

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const countries = destinations.filter((d) => d.type === 'country').sort(byName);
  const cities = destinations.filter((d) => d.type === 'city').sort(byName);
  const regionPages = new Map(destinations.filter((d) => d.type === 'region').map((d) => [d.name, d.slug]));

  const continents: IndexContinent[] = DIRECTORY_REGIONS.map((name) => ({
    name,
    slug: regionPages.get(name),
    places: countries
      .filter((c) => continentOf(c.countryCode) === name)
      .map((c): IndexPlace => ({ name: c.name, slug: c.slug, code: c.countryCode?.toUpperCase() })),
  }));
  const unplaced = countries.filter((c) => !continentOf(c.countryCode));
  if (unplaced.length > 0) {
    continents.push({
      name: 'Other countries and territories',
      places: unplaced.map((c) => ({ name: c.name, slug: c.slug, code: c.countryCode?.toUpperCase() })),
    });
  }

  const cityPlaces: IndexPlace[] = cities.map((c) => ({
    name: c.name,
    slug: c.slug,
    code: c.countryCode?.toUpperCase(),
    country: countryName(c.countryCode),
  }));

  const collectionJsonLd = collectionPageJsonLd({
    name: HUB.name,
    description: DESCRIPTION,
    url: PATH,
    itemListName: 'Destinations',
    items: [...cities, ...countries].slice(0, 50).map((d) => ({
      name: d.name,
      url: `/destinations/${d.slug}`,
      image: mediaUrl(d.heroImage ?? null),
    })),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:pt-14" data-testid="destinations-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header className="max-w-3xl" data-testid="destinations-header">
        <h1 className="text-[2.2rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-forest-950 sm:text-5xl">
          Travel guides by country and city
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-slate-600">
          <span className="font-semibold tabular-nums text-forest-950">{countries.length}</span> countries and{' '}
          <span className="font-semibold tabular-nums text-forest-950">{cities.length}</span> cities. Country guides
          cover entry, money, the airports and the airlines that serve them; city guides cover where to stay and how to
          get in from the airport.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Looking for an airport or airline?{' '}
          <Link href="/airports" className="font-semibold text-primary-emphasis underline-offset-4 hover:underline">
            Airport guides
          </Link>{' '}
          ·{' '}
          <Link href="/airlines" className="font-semibold text-primary-emphasis underline-offset-4 hover:underline">
            Airline guides
          </Link>
        </p>
      </header>

      <div className="mt-8">
        <DestinationIndex cities={cityPlaces} continents={continents} />
      </div>
    </div>
  );
}
