import { listAirports, listCountries, destinationSlugByCountryCode, countryHref } from '@/lib/strapi';
import CountriesDirectory, { type CountryRow } from '@/components/CountriesDirectory';
import ExpandableDescription from '@/components/ExpandableDescription';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';

export const revalidate = 60;

const HUB = HUB_INTROS.countries;
const PATH = HUB_PATHS.countries;

export const metadata = {
  title: 'Countries — travel directory',
  description: HUB.description,
  alternates: { canonical: PATH },
};

export default async function CountriesPage() {
  const [strapiCountries, airports, destSlugs] = await Promise.all([
    listCountries().catch(() => []),
    listAirports().catch(() => []),
    destinationSlugByCountryCode(),
  ]);

  // Build aggregates (airport + city counts) from airports keyed by ISO code.
  const agg = new Map<string, { airports: number; cities: Set<string>; region: CountryRow['region'] }>();
  for (const a of airports) {
    const code = (a.countryCode || '').toUpperCase();
    if (!code) continue;
    let row = agg.get(code);
    if (!row) {
      row = { airports: 0, cities: new Set<string>(), region: a.region ?? null };
      agg.set(code, row);
    }
    row.airports += 1;
    if (a.city) row.cities.add(a.city);
    if (!row.region && a.region) row.region = a.region;
  }

  let countries: CountryRow[];
  if (strapiCountries.length > 0) {
    // Use the Countries collection as the source of truth, enriched with aggregates.
    countries = strapiCountries
      .map((c) => {
        const a = agg.get(c.code.toUpperCase());
        return {
          code: c.code.toUpperCase(),
          name: c.name,
          region: c.region ?? a?.region ?? null,
          airportCount: a?.airports ?? 0,
          cityCount: a?.cities.size ?? 0,
          href: countryHref(c.code, destSlugs),
        };
      })
      .sort((x, y) => x.name.localeCompare(y.name));
  } else {
    // Fallback: aggregate-only view (works before the countries ingest runs).
    countries = Array.from(agg.entries())
      .map(([code, a]) => {
        const airport = airports.find((x) => (x.countryCode || '').toUpperCase() === code);
        return {
          code,
          name: airport?.country || code,
          region: a.region,
          airportCount: a.airports,
          cityCount: a.cities.size,
          href: countryHref(code, destSlugs),
        };
      })
      .sort((x, y) => x.name.localeCompare(y.name));
  }

  const collectionJsonLd = collectionPageJsonLd({
    name: HUB.name,
    description: HUB.description,
    url: PATH,
    itemListName: 'Countries',
    items: countries.map((c) => ({
      name: c.name,
      url: c.href ?? `/countries/${c.code.toLowerCase()}`,
    })),
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-16" data-testid="countries-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header>
        <h1 className="editorial-h text-3xl font-bold text-forest-900">Countries — Travel Directory</h1>
        <ExpandableDescription text={HUB.intro} />
      </header>

      <CountriesDirectory countries={countries} />
    </div>
  );
}
