import { listRoutes, type StrapiAirport, type StrapiRoute } from '@/lib/strapi';
import RouteDirectory from '@/components/RouteDirectory';
import ExpandableDescription from '@/components/ExpandableDescription';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';

export const revalidate = 60;

const HUB = HUB_INTROS['flight-routes'];
const PATH = HUB_PATHS['flight-routes'];

export const metadata = {
  title: 'Flight Routes & Airlines by City Pair',
  description: HUB.description,
  alternates: { canonical: PATH },
};

export default async function FlightsPage() {
  const routes = await listRoutes().catch(() => []);

  // RouteDirectory is a client component, so everything passed to it is
  // serialised into the page. Full airport/airline records made this page
  // 22 MB; send only the fields the directory renders.
  const compactAirport = (a?: StrapiAirport) =>
    a
      ? ({ iata: a.iata, city: a.city, country: a.country, name: a.name, region: a.region } as StrapiAirport)
      : undefined;
  const compactRoutes: StrapiRoute[] = routes.map((r) => ({
    id: r.id,
    slug: r.slug,
    popularity: r.popularity,
    origin: compactAirport(r.origin),
    destination: compactAirport(r.destination),
    carriers: (r.carriers ?? []).map((c) => ({ id: c.id }) as NonNullable<StrapiRoute['carriers']>[number]),
  }));

  const collectionJsonLd = collectionPageJsonLd({
    name: HUB.name,
    description: HUB.description,
    url: PATH,
    itemListName: 'Flight routes',
    // Routes missing either endpoint render as a broken card and 404 on click —
    // keep them out of the structured data.
    items: routes
      .filter((r) => r.origin && r.destination)
      .map((r) => ({
        name: `Flights from ${r.origin!.city || r.origin!.name} to ${r.destination!.city || r.destination!.name} (${r.origin!.iata} → ${r.destination!.iata})`,
        url: `/flight-routes/${r.slug}`,
      })),
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-16" data-testid="flights-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header>
        <h1 className="editorial-h text-3xl font-bold text-forest-900">Flight Routes Directory</h1>
        <ExpandableDescription text={HUB.intro} />
      </header>

      <RouteDirectory routes={compactRoutes} />
    </div>
  );
}
