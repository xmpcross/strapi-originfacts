import { listAirlines, mediaUrl } from '@/lib/strapi';
import { getSiteCounts } from '@/lib/counts';
import AirlineDirectory, { PopularAirlinesStrip } from '@/components/AirlineDirectory';
import ExpandableDescription from '@/components/ExpandableDescription';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';

export const revalidate = 60;

const HUB = HUB_INTROS.airlines;
const PATH = HUB_PATHS.airlines;

export const metadata = {
  title: 'Airline Directory',
  description: HUB.description,
  alternates: { canonical: PATH },
};

export default async function AirlinesPage() {
  const [airlines, siteCounts] = await Promise.all([listAirlines().catch(() => []), getSiteCounts()]);

  const collectionJsonLd = collectionPageJsonLd({
    name: HUB.name,
    description: HUB.description,
    url: PATH,
    itemListName: 'Airlines',
    items: airlines.map((a) => ({
      name: a.iataCode ? `${a.name} (${a.iataCode})` : a.name,
      url: `/airlines/${a.slug}`,
      image: mediaUrl(a.logo ?? null),
    })),
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-16" data-testid="airlines-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header>
        <h1 className="editorial-h text-3xl font-bold text-forest-900">Airline Directory</h1>
        <ExpandableDescription text={HUB.intro} />
      </header>

      <PopularAirlinesStrip airlines={airlines} />

      <AirlineDirectory airlines={airlines} stats={{ regions: siteCounts.regions }} />
    </div>
  );
}
