import type { Metadata } from 'next';
import { listAirlines, listCountries, mediaUrl } from '@/lib/strapi';
import { airlineGuideIsPublished, airlineTier } from '@/lib/airline-tier';
import { getRouteFacts } from '@/lib/route-facts';
import { getAirlineFacts } from '@/lib/airline-facts';
import { airlineHasCeased } from '@/lib/airline-status';
import { isNonPassengerAirline } from '@/lib/airline-exclusions';
import { countryRegionIndex, type DirectoryAirline } from '@/lib/airline-directory';
import AirlineDirectory from '@/components/AirlineDirectory';
import AirlineCompareGuide from '@/components/AirlineCompareGuide';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';

export const revalidate = 60;

const HUB = HUB_INTROS.airlines;
const PATH = HUB_PATHS.airlines;

// Quick-access tiles above the directory, in this order (those present in the directory).
const TOP_PRIORITY_SLUGS = [
  'qantas',
  'singapore-airlines',
  'qatar-airways',
  'emirates',
  'united-airlines',
  'delta-air-lines',
  'american-airlines',
  'british-airways',
  'lufthansa',
  'air-france',
  'klm-royal-dutch-airlines',
  'cathay-pacific',
  'all-nippon-airways',
  'japan-airlines',
  'air-canada',
  'air-new-zealand',
  'virgin-australia',
  'turkish-airlines',
  'etihad-airways',
  'finnair',
  'korean-air',
  'asiana-airlines',
  'eva-air',
  'fiji-airways',
  'virgin-atlantic',
  'jetblue',
  'southwest-airlines',
  'alaska-airlines',
  'ryanair',
  'easyjet',
];

const POPULAR_COUNT = 12;

export const metadata: Metadata = {
  title: 'Airline Guides & Directory',
  description: HUB.description,
  alternates: { canonical: PATH },
  robots: { index: true, follow: true },
};

export default async function AirlinesPage() {
  const [allAirlines, countries] = await Promise.all([
    listAirlines().catch(() => []),
    listCountries().catch(() => []),
  ]);
  // The directory lists commercial passenger airlines only; cargo and parcel
  // carriers (DHL, FedEx, ...) and charter/ACMI-only operators keep their
  // pages but are not listed here.
  const airlines = allAirlines.filter((a) => {
    if (isNonPassengerAirline(a)) return false;
    const dests = getRouteFacts(a.iataCode)?.destinationCount ?? 0;
    return airlineGuideIsPublished(a.slug) || airlineTier(a, dests > 0) <= 2;
  });

  // Carriers with a sourced cessation date get a label in the directory so
  // nobody reads them as bookable (lib/airline-status.ts).
  const ceasedSlugs = airlines.filter((a) => airlineHasCeased(a.slug)).map((a) => a.slug);

  // Group by the region of the airline's country: the airline records' own
  // region field is wrong for roughly one carrier in ten.
  const regionOf = countryRegionIndex(countries);
  const compactAirlines: DirectoryAirline[] = airlines.map((a) => ({
    name: a.name,
    slug: a.slug,
    iataCode: a.iataCode || undefined,
    country: a.country || undefined,
    city: a.city || undefined,
    region: regionOf(a),
    type: a.type || undefined,
    logo: a.logo?.url || undefined,
  }));
  const countryCount = new Set(airlines.map((a) => a.country).filter(Boolean)).size;
  const listed = new Set(airlines.map((a) => a.slug));
  const popularSlugs = TOP_PRIORITY_SLUGS.filter((slug) => listed.has(slug)).slice(0, POPULAR_COUNT);
  // Airlines whose fact file carries at least five sourced (`official`) fields.
  const verifiedCount = airlines.filter((a) => {
    const facts = getAirlineFacts(a.slug);
    if (!facts) return false;
    const official = facts.modules.reduce(
      (n, m) => n + Object.values(m.fields ?? {}).filter((f) => f.status === 'official').length,
      0,
    );
    return official >= 5;
  }).length;

  const collectionJsonLd = collectionPageJsonLd({
    name: HUB.name,
    description: HUB.description,
    url: PATH,
    itemListName: 'Airlines',
    items: airlines.slice(0, 50).map((a) => ({
      name: a.iataCode ? `${a.name} (${a.iataCode})` : a.name,
      url: `/airlines/${a.slug}`,
      image: mediaUrl(a.logo ?? null),
    })),
  });

  return (
    <div data-testid="airlines-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14">
        <header className="max-w-3xl" data-testid="airlines-header">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-emphasis">Airline directory</p>
          <h1 className="mt-2 text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">Airlines</h1>
          <p className="mt-4 text-lg leading-relaxed text-forest-900/75">
            Find any airline by name, IATA code or country, then open its baggage, seat and policy guide.
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-forest-900/70" data-testid="airlines-stats">
            <li>
              <strong className="font-semibold text-forest-950">{airlines.length.toLocaleString()}</strong> airlines
            </li>
            <li>
              <strong className="font-semibold text-forest-950">{countryCount.toLocaleString()}</strong> countries
            </li>
            {verifiedCount > 0 && (
              <li>
                <strong className="font-semibold text-forest-950">{verifiedCount.toLocaleString()}</strong> with verified
                policy facts
              </li>
            )}
          </ul>
        </header>

        <div className="mt-8">
          <AirlineDirectory airlines={compactAirlines} popularSlugs={popularSlugs} ceasedSlugs={ceasedSlugs} />
        </div>
      </div>

      <AirlineCompareGuide airlineCount={airlines.length} countryCount={countryCount} verifiedCount={verifiedCount} />
    </div>
  );
}
