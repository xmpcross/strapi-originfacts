import type { Metadata } from 'next';
import { listAirlines, listCountries, mediaUrl } from '@/lib/strapi';
import { PUBLISHED_AIRLINE_GUIDES, airlineGuideIsPublished, airlineTier } from '@/lib/airline-tier';
import { getRouteFacts } from '@/lib/route-facts';
import { getAirlineFacts } from '@/lib/airline-facts';
import { airlineHasCeased } from '@/lib/airline-status';
import { isNonPassengerAirline } from '@/lib/airline-exclusions';
import { countryRegionIndex, type DirectoryAirline } from '@/lib/airline-directory';
import AirlineDirectory from '@/components/AirlineDirectory';
import FeaturedAirlineGuides, { type FeaturedGuide } from '@/components/FeaturedAirlineGuides';
import ComparisonTable from '@/components/ComparisonTable';
import CategoryDescription from '@/components/CategoryDescription';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';
import { SECTIONS } from '@/lib/sections';
import Link from 'next/link';

export const revalidate = 60;

const HUB = HUB_INTROS.airlines;
const PATH = HUB_PATHS.airlines;

// Top global airlines ordered by priority for Featured Policy Guides
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

  const bySlug = new Map(allAirlines.map((a) => [a.slug, a]));
  // Carriers with a sourced cessation date get a label in the directory so
  // nobody reads them as bookable (lib/airline-status.ts).
  const ceasedSlugs = airlines.filter((a) => airlineHasCeased(a.slug)).map((a) => a.slug);

  // Build slides and sort top priority global carriers first
  const featuredGuides: FeaturedGuide[] = Array.from(PUBLISHED_AIRLINE_GUIDES)
    .map((slug): FeaturedGuide | null => {
      const airline = bySlug.get(slug);
      if (!airline) return null;
      const destinations = getRouteFacts(airline.iataCode)?.destinationCount ?? 0;
      // Display Tier 1 & verified policy guide airlines in Featured section
      if (airlineTier(airline, destinations > 0) !== 1) return null;

      const facts = getAirlineFacts(slug);
      const verifiedFields = facts
        ? facts.modules.reduce(
            (total, m) => total + Object.values(m.fields ?? {}).filter((f) => f.status === 'official').length,
            0,
          )
        : 0;
      return {
        airline: {
          name: airline.name,
          slug: airline.slug,
          iataCode: airline.iataCode,
          type: airline.type,
          logo: airline.logo ?? null,
        },
        verifiedFields,
        destinations,
        homeCountry: airline.country || 'International',
      };
    })
    .filter((s): s is FeaturedGuide => s !== null)
    .sort((a, b) => {
      const indexA = TOP_PRIORITY_SLUGS.indexOf(a.airline.slug);
      const indexB = TOP_PRIORITY_SLUGS.indexOf(b.airline.slug);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return b.verifiedFields - a.verifiedFields;
    });

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
  const verifiedCount = airlines.filter((a) => airlineGuideIsPublished(a.slug)).length;

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
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-6" data-testid="airlines-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header data-testid="airlines-header">
        <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-12">
          <div className="min-w-0">
            <h1 className="text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">
              Airlines
            </h1>
            <CategoryDescription text={HUB.intro} />
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-forest-900/70" data-testid="airlines-stats">
              <li>
                <strong className="font-semibold text-forest-950">{countryCount.toLocaleString()}</strong> countries
              </li>
              {verifiedCount > 0 && (
                <li className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success-emphasis" />
                  <strong className="font-semibold text-forest-950">{verifiedCount}</strong> verified policy guide
                  {verifiedCount === 1 ? '' : 's'}
                </li>
              )}
              <li>
                <a href="#airline-directory-heading" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                  Search the directory ↓
                </a>
              </li>
            </ul>
          </div>
          <div
            className="hidden h-32 w-32 flex-col items-center justify-center rounded-[0.3rem] bg-forest-50 text-forest-950 sm:flex"
            data-testid="airlines-count"
          >
            <span className="text-4xl font-bold leading-none">{airlines.length.toLocaleString()}</span>
            <span className="mt-2 text-[11px] font-bold uppercase tracking-widest text-forest-900/70">
              Airlines
            </span>
          </div>
        </div>

        <nav
          className="no-scrollbar mt-10 flex items-center gap-x-8 overflow-x-auto whitespace-nowrap border-y border-forest-900/15 py-4 text-[14px] font-bold uppercase tracking-widest text-forest-950 sm:flex-wrap sm:gap-y-3"
          aria-label="Categories"
          data-testid="airlines-subnav"
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
              className={`transition hover:text-primary-emphasis ${
                item.slug === 'airlines' ? 'text-primary-emphasis' : ''
              }`}
              aria-current={item.slug === 'airlines' ? 'page' : undefined}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </header>

      <FeaturedAirlineGuides guides={featuredGuides} />

      <AirlineDirectory
        airlines={compactAirlines}
        publishedSlugs={Array.from(PUBLISHED_AIRLINE_GUIDES)}
        ceasedSlugs={ceasedSlugs}
      />

      <section className="mt-20 border-t border-forest-900/15 pt-12" aria-labelledby="airlines-guide-heading" data-testid="airlines-about">
        <p className="text-xs font-bold uppercase tracking-widest text-forest-900/55">Using the directory</p>
        <h2 id="airlines-guide-heading" className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
          How to compare airlines before you book
        </h2>

        <div className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
          {[
            {
              title: 'Compare the carrier behind the fare',
              text:
                'A cheap flight can look different once you know which airline operates it, where the carrier is based, and whether the itinerary depends on a partner or codeshare. Use this airline directory to check names, IATA codes, home countries, hubs, and verified policy guides before you move from search results to checkout.',
            },
            {
              title: 'Check baggage, seats, and airport context',
              text:
                'Airline rules vary most around cabin baggage, checked bags, seat selection, refunds, schedule changes, and airport transfers. OriginFacts keeps carrier profiles connected to airports and routes so you can see the practical context around a booking, not only the brand name printed on the ticket.',
            },
            {
              title: 'Use codes to avoid booking mistakes',
              text:
                'Two-letter IATA codes are useful when airlines have similar names, regional subsidiaries, or flights sold by another carrier. Search by name, country, or code to confirm you are comparing the right airline, especially on multi-carrier trips, regional flights, and low-cost connections.',
            },
          ].map((item, i) => (
            <article key={item.title} className="border-t-2 border-forest-950 pt-4">
              <p className="font-mono text-xs font-bold text-forest-900/50">0{i + 1}</p>
              <h3 className="mt-2 text-xl font-bold leading-snug">{item.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-forest-900/70">{item.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-14 rounded-[0.3rem] bg-paper p-5 sm:p-8">
          <h3 className="text-xl font-bold leading-snug sm:text-2xl">What makes an airline page useful</h3>
          <div className="mt-4 grid gap-5 text-base leading-relaxed text-forest-900/70 md:grid-cols-2">
            <p>
              The most useful airline information is operational: where the airline is registered,
              which airport acts as its main hub, what type of carrier it is, and whether OriginFacts
              has enough verified policy information to publish a deeper guide. That helps travellers
              separate a familiar brand from the airline that will actually handle check-in, boarding,
              baggage, schedule changes, and customer support.
            </p>
            <p>
              We also connect airline pages to route and airport data wherever it is available. That
              gives the directory more context than a code lookup table: a carrier can be compared by
              region, country, operating model, and network footprint, then followed into the airport
              or route pages that explain how the trip fits together.
            </p>
          </div>

          <ComparisonTable
            className="mb-0 mt-8"
            caption="Airline Types vs Service Inclusions Comparison Matrix"
            head={['Carrier Type', 'Carry-on Bag', 'Checked Baggage', 'Seat Selection', 'Loyalty / Alliances', 'Best For']}
            rows={[
              ['Full-Service Carrier (FSC)', 'Included (7-10kg)', 'Included (1-2 Bags)', 'Included (Most fares)', 'Global Alliance (Oneworld/Star/SkyTeam)', 'Long-haul comfort & connecting travel'],
              ['Low-Cost Carrier (LCC)', 'Included (7kg)', 'Fee required', 'Fee required', 'Point-to-point rewards', 'Point-to-point regional flights'],
              ['Ultra-Low-Cost (ULCC)', 'Personal item only', 'Strict fee', 'Strict fee', 'Minimal / None', 'Short domestic budget hops'],
              ['Hybrid Carrier', 'Included (7kg)', 'Route dependent', 'Tier dependent', 'Independent partner network', 'Regional value & medium-haul'],
            ]}
          />
        </div>
      </section>
    </div>
  );
}
