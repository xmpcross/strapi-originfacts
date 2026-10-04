import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getDestination,
  getDestinationByCountryCode,
  listAirlinesByCountry,
  listAirports,
  listAirportsByCountryCode,
  listArticles,
  listCitiesByCountryCode,
  listCountriesByRegion,
  listCountryAndCityDestinationsByCountryCodes,
  listRoutesToDestination,
  mediaUrl,
  type StrapiAirline,
  type StrapiAirport,
  type StrapiCountry,
  type StrapiDestination,
} from '@/lib/strapi';
import MoreStoriesList from '@/components/MoreStoriesList';
import ArticleCard from '@/components/ArticleCard';
import FlightSearchCTA from '@/components/FlightSearchCTA';
import PopularHotelsByCity from '@/components/PopularHotelsByCity';
import destinationCoordinates from '@/data/destination-coordinates.json';
import TableOfContents from '@/components/TableOfContents';
import { operableCarriers } from '@/lib/route-carriers';
import { SITE_URL, DEFAULT_OG_IMAGE, entityWebPageJsonLd, faqJsonLd, normalizeFaqs } from '@/lib/entity-seo';
import { resolveAuthor } from '@/lib/authors';
import { JsonLd, FaqSection } from '@/components/SeoBlocks';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import KeyFacts from '@/components/KeyFacts';
import { buildMetaDescription, clampDescription, compactTitle } from '@/lib/seo';
import { airportPath } from '@/lib/airport-slugs';
import { absoluteUrl } from '@/lib/jsonld';
import type { Metadata } from 'next';
import {
  buildActivityWidgetQuery,
  countryNameFromCode,
  formatList,
  GetYourGuideActivityWidget,
  parseAboutSections,
  RouteCard,
  unique,
} from './destination-shared';
import CityGuidePage from './city-guide-page';
import ContinentGuidePage from './continent-guide-page';
import CountryGuidePage from './country-guide-page';
import { getDestinationGuide, withGuide } from '@/lib/destination-guides';

export const revalidate = 60;

// An empty list opts the route into on-demand ISR: each page renders on its
// first request and is then cached and revalidated, instead of rendering on
// every request (it was served `private, no-store`).
export async function generateStaticParams() {
  return [];
}

const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'] as const;
const CITY_HERO_DESCRIPTION_OVERRIDES: Record<string, string> = {
  perth:
    'Visiting Perth requires selecting optimal long-haul flight connections, matching airport transfers at Perth Airport (PER) to beachside or central hotel districts, and timing travel around Mediterranean climate patterns. Our comprehensive destination guide synthesizes operating airline networks, local transit options, regional excursion routes, and verified editorial research for Western Australia travel.',
  bangkok:
    'Visiting Bangkok requires navigating multi-airport transfers between Suvarnabhumi (BKK) and Don Mueang (DMK), selecting strategic hotel districts along the Chao Phraya River, and timing itineraries around seasonal monsoons. Our comprehensive city guide combines real-time flight route data, urban transit links, cultural neighborhood research, and expert travel advice for Thailand travelers.',
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cms = await getDestination(slug);
  if (!cms) return { title: 'Not found' };
  const d = withGuide(cms, getDestinationGuide(slug));
  // Title and description come from main's destination helpers; the PR adds
  // the hero og:image on top.
  const description = destinationMetaDescription(d);
  const hero = d.heroImage && d.heroImage.url ? d.heroImage : null;
  const title = destinationMetaTitle(d);
  return {
    title,
    description,
    alternates: { canonical: `/destinations/${slug}` },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `/destinations/${slug}`,
      images: hero
        ? [{
            url: absoluteUrl(mediaUrl(hero)!),
            width: hero.width ?? 1024,
            height: hero.height ?? 576,
            alt: `${d.name} travel guide`,
          }]
        : [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Originfacts' }],
    },
    twitter: {
      card: 'summary_large_image',
      images: [hero ? absoluteUrl(mediaUrl(hero)!) : DEFAULT_OG_IMAGE],
    },
  };
}

function destinationMetaTitle(destination: StrapiDestination) {
  if (destination.type === 'city') return compactTitle(`${destination.name} travel guide`);
  if (destination.type === 'country') return compactTitle(`${destination.name} travel guide`);
  if (destination.type === 'region') return compactTitle(`${destination.name} destinations guide`);
  return compactTitle(destination.name);
}

function destinationMetaDescription(destination: StrapiDestination) {
  const fromDescription = buildMetaDescription([destination.description]);
  if (fromDescription) return fromDescription;

  const country = countryNameFromCode(destination.countryCode);
  if (destination.type === 'city') {
    return clampDescription(
      `Plan ${destination.name}${country ? `, ${country}` : ''} with hotels, airports, activities, routes, local stories and practical travel notes from Originfacts.`,
    );
  }

  if (destination.type === 'country') {
    return clampDescription(
      `Explore ${destination.name} with city guides, airports, airlines, visa notes, travel stories and practical planning context from Originfacts.`,
    );
  }

  return clampDescription(
    `Explore ${destination.name} travel planning with countries, cities, airports, airlines, routes, stories and practical context from Originfacts.`,
  );
}

export default async function DestinationPage({ params }: Props) {
  const { slug } = await params;
  const cms = await getDestination(slug);
  if (!cms) notFound();
  const guide = cms.type === 'city' ? getDestinationGuide(slug) : null;
  const destination = withGuide(cms, guide);

  const isCountry = destination.type === 'country' && !!destination.countryCode;
  const isCity = destination.type === 'city';
  const isContinent =
    destination.type === 'region' && (CONTINENTS as readonly string[]).includes(destination.name);
  const routeLimit = isCountry ? 4 : 12;
  const countryCitiesPromise = isCountry
    ? listCitiesByCountryCode(destination.countryCode as string, 100).catch(() => [] as StrapiDestination[])
    : Promise.resolve<StrapiDestination[]>([]);
  const countryCities = await countryCitiesPromise;
  const countries = isContinent
    ? await listCountriesByRegion(destination.name).catch(() => [] as StrapiCountry[])
    : [];
  const continentDestinations = isContinent
    ? await listCountryAndCityDestinationsByCountryCodes(countries.map((country) => country.code)).catch(
        () => [] as StrapiDestination[],
      )
    : [];
  const articleDestinationSlugs = isCountry
    ? [slug, ...countryCities.map((city) => city.slug)]
    : isContinent
      ? [slug, ...continentDestinations.map((d) => d.slug)]
    : [slug];
  const articlePageSize = isCountry ? 100 : isContinent ? 50 : 24;

  const [{ data: articles }, routes, airports, airlines, cityAirports] = await Promise.all([
    listArticles({ destinations: articleDestinationSlugs, pageSize: articlePageSize }),
    listRoutesToDestination(destination, routeLimit).catch(() => []),
    isCountry
      ? listAirportsByCountryCode(destination.countryCode as string).catch(() => [] as StrapiAirport[])
      : isContinent
        ? listAirports()
            .then((all) => {
              const countryCodes = new Set(countries.map((country) => country.code.toUpperCase()));
              return all.filter((airport) => airport.countryCode && countryCodes.has(airport.countryCode.toUpperCase()));
            })
            .catch(() => [] as StrapiAirport[])
      : Promise.resolve<StrapiAirport[]>([]),
    isCountry
      ? listAirlinesByCountry(destination.name).catch(() => [] as StrapiAirline[])
      : Promise.resolve<StrapiAirline[]>([]),
    isCity
      ? listAirports()
          .then((all) =>
            all.filter((airport) => {
              const sameCity = airport.city?.toLowerCase() === destination.name.toLowerCase();
              const sameCountry = !destination.countryCode || airport.countryCode === destination.countryCode;
              return sameCity && sameCountry;
            }),
          )
          .catch(() => [] as StrapiAirport[])
      : Promise.resolve<StrapiAirport[]>([]),
  ]);

  const hero = mediaUrl(destination.heroImage ?? null);
  const activityQuery = buildActivityWidgetQuery(destination, routes);
  const heroDescription = isCity
    ? buildCityHeroDescription(destination, cityAirports, routes, articles.length)
    : destination.description;

  // Article/BlogPosting JSON-LD for destination guides
  const centre = (destinationCoordinates.cities as Record<string, { lat: number; lng: number }>)[destination.slug];
  const articleSchema = entityWebPageJsonLd({
    name: destinationMetaTitle(destination),
    description: destinationMetaDescription(destination),
    url: `${SITE_URL}/destinations/${destination.slug}`,
    image: hero,
    author: await resolveAuthor(),
    mainEntity: {
      '@type': destination.type === 'city' ? 'City' : destination.type === 'country' ? 'Country' : 'Place',
      name: destination.name,
      ...(centre ? { geo: { '@type': 'GeoCoordinates', latitude: centre.lat, longitude: centre.lng } } : {}),
    },
  });

  const breadcrumbItems: { name: string; url: string }[] = [{ name: 'Destinations', url: '/destinations' }];
  let countryHref: string | undefined;
  if (isCountry) {
    breadcrumbItems.push({ name: 'Countries', url: '/countries' });
  } else if (isCity && destination.countryCode) {
    const cName = countryNameFromCode(destination.countryCode);
    if (cName) {
      // Link the country crumb to its destination guide; /countries/<code>
      // would only redirect there.
      const countryGuide = await getDestinationByCountryCode(destination.countryCode).catch(() => null);
      countryHref = countryGuide ? `/destinations/${countryGuide.slug}` : `/countries/${destination.countryCode.toLowerCase()}`;
      breadcrumbItems.push({ name: cName, url: countryHref });
    }
  }
  breadcrumbItems.push({ name: destination.name, url: `/destinations/${destination.slug}` });
  const breadcrumbSchema = breadcrumbJsonLd(breadcrumbItems);

  // Editor-managed FAQs (Strapi json field), appended below whichever layout
  // renders. FaqSection + faqJsonLd both no-op when < 2 real Q&As survive
  // normalisation.
  const faqs = normalizeFaqs(destination.faqs);
  const citationsBlock = (
    <div className="mx-auto max-w-7xl px-6">
    </div>
  );
  const faqBlock = (
    <>
      <JsonLd data={faqJsonLd(faqs)} />
      <FaqSection faqs={faqs} title={`${destination.name} — frequently asked questions`} />
    </>
  );

  if (isCountry) {
    return (
      <>
        <JsonLd data={articleSchema} />
        <JsonLd data={breadcrumbSchema} />
        <CountryGuidePage
          destination={destination}
          hero={hero}
          airports={airports}
          airlines={airlines}
          routes={routes}
          articles={articles}
          cities={countryCities}
          faqBlock={faqBlock}
          hasFaqs={faqs.length >= 2}
        />
        {citationsBlock}
      </>
    );
  }

  if (isContinent) {
    return (
      <>
        <JsonLd data={articleSchema} />
        <JsonLd data={breadcrumbSchema} />
        <ContinentGuidePage
          destination={destination}
          hero={hero}
          countries={countries}
          airports={airports}
          childDestinations={continentDestinations}
          articles={articles}
          faqBlock={faqBlock}
          hasFaqs={faqs.length >= 2}
        />
        {citationsBlock}
      </>
    );
  }

  if (isCity && guide) {
    const lead = parseAboutSections(destination.description ?? '').find((s) => !s.heading)?.paragraphs.join(' ');
    return (
      <>
        <JsonLd data={articleSchema} />
        <JsonLd data={breadcrumbSchema} />
        <CityGuidePage
          destination={destination}
          hero={hero}
          heroDescription={lead ?? ''}
          countryHref={countryHref}
          routes={routes}
          airports={cityAirports}
          articles={articles}
          activityQuery={activityQuery}
          faqBlock={faqBlock}
          hasFaqs={faqs.length >= 2}
        />
      </>
    );
  }

  if (isCity) {
    return (
      <>
        <JsonLd data={articleSchema} />
        <JsonLd data={breadcrumbSchema} />
        <CityDestinationPage
          destination={destination}
          hero={hero}
          heroDescription={heroDescription}
          routes={routes}
          airports={cityAirports}
          articles={articles}
          activityQuery={activityQuery}
          faqBlock={faqBlock}
        />
        {citationsBlock}
      </>
    );
  }

  // Non-country destinations (city / region) keep the original layout unchanged.
  return (
    <div data-testid={`destination-page-${slug}`}>
      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumbSchema} />
      <section className="relative h-[55vh] min-h-[380px] overflow-hidden bg-forest-900">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt={destination.name} className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950/90 via-forest-950/30 to-forest-950/10" />
        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-6 pb-14 text-sand-100">
          <div className="text-xs uppercase tracking-widest text-white/80">
            {destination.type ?? 'Destination'}{destination.countryCode ? ` · ${destination.countryCode}` : ''}
          </div>
          <h1 className="editorial-h mt-3 text-3xl font-bold !text-[#ffffff] sm:text-4xl">{destination.name}</h1>
          {heroDescription && (
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/90">
              {heroDescription}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-16">
        <KeyFacts
          tldr={destination.tldr}
          keyFacts={destination.keyFacts}
          title={`${destination.name} at a glance`}
        />
        <h2 className="editorial-h text-3xl font-bold text-forest-900">
          {articles.length === 0 ? 'No stories yet' : `${articles.length} stor${articles.length === 1 ? 'y' : 'ies'} from ${destination.name}`}
        </h2>
        {articles.length > 0 && (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => <ArticleCard key={a.id} article={a} size="md" />)}
          </div>
        )}
      </div>

      {destination.type === 'city' && (
        <CityPlanningSections destination={destination} routes={routes} airports={cityAirports} articlesCount={articles.length} />
      )}

      {destination.type === 'city' && (
        <CitySeoGuide destination={destination} routes={routes} airports={cityAirports} articlesCount={articles.length} />
      )}

      {destination.type === 'city' && (
        <div className="mx-auto max-w-7xl px-6">
          <GetYourGuideActivityWidget destination={destination} query={activityQuery} />
        </div>
      )}

      {/* Sponsored search CTA — only when we have a representative city IATA */}
      {(() => {
        const destIata = routes.find((r) => r.destination?.iata)?.destination?.iata;
        if (!destIata) return null;
        return (
          <div className="mx-auto max-w-7xl px-6">
            <FlightSearchCTA
              title={`Find cheap flights to ${destination.name}`}
              subtitle="Live fares from hundreds of airlines and OTAs, ranked by total price."
              cta={`Search flights to ${destIata}`}
              subId={`dest_${destination.slug}`}
              destination={destIata}
            />
          </div>
        );
      })()}

      {routes.length > 0 && (
        <section className="mx-auto max-w-7xl px-6" data-testid="destination-routes">
          <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
            <h2 className="editorial-h text-2xl font-bold text-forest-900 lg:text-2xl">
              Flights to {destination.name}
            </h2>
            <span className="text-sm font-light text-forest-900/50">
              {routes.length} route{routes.length === 1 ? '' : 's'}
            </span>
          </header>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((r) => <RouteCard key={r.id} r={r} />)}
          </div>
          <div className="mt-6">
            <Link href="/flight-routes" className="text-sm font-medium text-forest-700 hover:underline">
              Browse all routes →
            </Link>
          </div>
        </section>
      )}

      {faqBlock}

      {citationsBlock}

      <div className="pb-20" />
    </div>
  );
}

function CityDestinationPage({
  destination,
  hero,
  heroDescription,
  routes,
  airports,
  articles,
  activityQuery,
  faqBlock,
}: {
  destination: StrapiDestination;
  hero: string | null;
  heroDescription?: string;
  routes: Awaited<ReturnType<typeof listRoutesToDestination>>;
  airports: StrapiAirport[];
  articles: Awaited<ReturnType<typeof listArticles>>['data'];
  activityQuery: string;
  faqBlock: React.ReactNode;
}) {
  const destIata = routes.find((r) => r.destination?.iata)?.destination?.iata;
  const country =
    airports.find((airport) => airport.country)?.country ||
    countryNameFromCode(destination.countryCode) ||
    'the region';
  const primaryAirport = airports[0];

  return (
    <article className="city-destination-page" data-testid={`destination-page-${destination.slug}`}>
      <section className="relative min-h-[520px] overflow-hidden bg-forest-950">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt={destination.name} className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/45 to-forest-950/10" />
        <div className="relative mx-auto flex min-h-[520px] max-w-7xl flex-col justify-end px-6 pb-12 pt-24 text-white">
          <div className="max-w-4xl">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/75">
              City guide{country !== 'the region' ? ` · ${country}` : ''}
            </div>
            <h1 className="editorial-h mt-4 text-4xl font-bold leading-tight !text-[#ffffff] sm:text-5xl lg:text-6xl">
              {destination.name}
            </h1>
            {heroDescription && (
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/90">
                {heroDescription}
              </p>
            )}
          </div>
          <div className="mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
            <CityHeroMetric label="Stories" value={articles.length} />
            <CityHeroMetric label="Routes" value={routes.length} />
            <CityHeroMetric label="Airports" value={airports.length} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14" data-testid="city-overview-panel">
        <TableOfContents
          items={[
            { id: 'overview', text: `Overview & City Snapshot` },
            { id: 'seasons', text: `Best Time to Visit (Peak vs Low Season)` },
            { id: 'flight-routes', text: `Direct & 1-Stop Flight Routes (${routes.length})` },
            { id: 'airports', text: `Airports Near ${destination.name}` },
            { id: 'hotels', text: `Popular Hotels & Neighborhoods` },
            { id: 'faq', text: `Frequently Asked Questions` },
          ]}
        />
        <KeyFacts
          tldr={destination.tldr}
          keyFacts={destination.keyFacts}
          title={`${destination.name} at a glance`}
        />
        <div className="mt-8 grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-[0.3rem] border border-forest-900/10 bg-gradient-to-br from-[#f7fbff] via-white to-[#fff8e6] p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-emphasis">
              Planning snapshot
            </p>
            <div className="mt-5 space-y-5">
              <CitySnapshotItem label="Country context" value={country} />
              <CitySnapshotItem
                label="Primary airport"
                value={primaryAirport ? primaryAirport.name : 'Airport coverage expanding'}
                href={primaryAirport ? airportPath(primaryAirport, airports) : undefined}
              />
              <CitySnapshotItem
                label="Best first check"
                value={destIata ? `Search flights to ${destIata}` : 'Compare live flight options'}
                href={destIata ? `/flight-search?destination=${encodeURIComponent(destIata)}` : '/flight-search'}
              />
            </div>
            <div className="mt-6 border-t border-forest-900/10 pt-5">
              <h3 className="text-lg font-bold text-forest-950">
                What this snapshot helps with
              </h3>
              <p className="mt-3 text-sm leading-7 text-forest-900/72">
                Use these quick signals to avoid the most common planning mistake: choosing a cheap fare or hotel
                before checking how the airport, neighbourhood and onward route fit together.
              </p>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-forest-900/72">
                <li>Match the airport to your arrival plans.</li>
                <li>Check hotel areas before comparing prices.</li>
                <li>Use routes to spot practical connections.</li>
              </ul>
            </div>
          </aside>

          <div id="overview" className="border-y border-forest-900/10 py-8 scroll-mt-28">
            <p className="section-eyebrow">
              <span className="inline-block h-px w-8 bg-primary-emphasis" />
              Start here
            </p>
            <h2 id="overview-heading" className="editorial-h mt-3 text-3xl font-bold text-forest-950">
              Build your {destination.name} trip around arrivals, areas and routes
            </h2>
            <p className="mt-4 max-w-4xl text-base leading-7 text-forest-900/72">
              Use this city page to compare the practical pieces that shape a trip: where you arrive, where you stay,
              which routes are currently tracked and what local stories can help you choose smarter.
            </p>
            <p className="mt-4 max-w-4xl text-base leading-7 text-forest-900/72">
              Start by confirming the airport and arrival time, then compare central hotel areas with airport-area
              stays if your itinerary includes an early departure, late landing or short stopover. After that, use
              the route and article sections to understand how {destination.name} connects with nearby regions,
              major gateways and the rest of {country}.
            </p>
            <p className="mt-4 max-w-4xl text-base leading-7 text-forest-900/72">
              This page is designed for quick trip decisions rather than generic inspiration. It brings together
              flight context, hotel discovery, local activities and related Originfacts stories so you can move from
              “where should I go?” to “what should I book first?” with fewer open tabs.
            </p>
          </div>
        </div>
      </section>

      <CityPopularHotelsSection destination={destination} airports={airports} />
      <CityPlanningSections destination={destination} routes={routes} airports={airports} articlesCount={articles.length} />

      <div className="mx-auto max-w-7xl px-6">
        <GetYourGuideActivityWidget destination={destination} query={activityQuery} />
      </div>

      <CitySeoGuide destination={destination} routes={routes} airports={airports} articlesCount={articles.length} />

      {destIata && (
        <div className="mx-auto max-w-7xl px-6">
          <FlightSearchCTA
            title={`Find cheap flights to ${destination.name}`}
            subtitle="Live fares from hundreds of airlines and OTAs, ranked by total price."
            cta={`Search flights to ${destIata}`}
            subId={`dest_${destination.slug}`}
            destination={destIata}
          />
        </div>
      )}

      <CityRoutesSection destination={destination} routes={routes} />
      <CityStoriesSection destination={destination} articles={articles} />
      {faqBlock}
      <div className="pb-20" />
    </article>
  );
}

function CityPopularHotelsSection({
  destination,
  airports,
}: {
  destination: StrapiDestination;
  airports: StrapiAirport[];
}) {
  const country = airports.find((airport) => airport.country)?.country || countryNameFromCode(destination.countryCode) || '';
  // Anchor the hotel search on the city centre (data/destination-coordinates.json;
  // destinations carry no coordinates in the CMS). Fall back to an airport in
  // the same city; with neither, the widget renders nothing rather than guess.
  const centre = (destinationCoordinates.cities as Record<string, { lat: number; lng: number }>)[destination.slug];
  const cityAirport = airports.find(
    (a) =>
      a.city?.toLowerCase() === destination.name.toLowerCase() &&
      typeof a.latitude === 'number' &&
      typeof a.longitude === 'number',
  );
  const anchor = centre
    ? { latitude: centre.lat, longitude: centre.lng }
    : cityAirport
      ? { latitude: cityAirport.latitude, longitude: cityAirport.longitude }
      : undefined;

  return (
    <div className="mx-auto max-w-7xl px-6 pb-12" data-testid="city-popular-hotels">
      <PopularHotelsByCity
        city={destination.name}
        country={country}
        lat={anchor?.latitude}
        lng={anchor?.longitude}
        eyebrow="Popular hotels"
        title={`Popular hotels in ${destination.name}`}
        description={`Compare highly rated ${destination.name} hotels from live Google Hotels data before choosing where to stay. Use the filters to scan central, airport, luxury, budget and family-friendly options for the city.`}
        searchContextLabel="Page city"
      />
    </div>
  );
}

function CityHeroMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-white/25 bg-white/10 px-4 py-3 backdrop-blur">
      <div className="text-2xl font-bold leading-none text-white">{value.toLocaleString()}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">{label}</div>
    </div>
  );
}

function CitySnapshotItem({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = (
    <>
      <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-forest-900/50">{label}</dt>
      <dd className="mt-1 text-lg font-bold leading-tight text-forest-950">{value}</dd>
    </>
  );

  return href ? (
    <Link href={href} className="block border-b border-forest-900/10 pb-4 last:border-b-0 last:pb-0">
      {content}
    </Link>
  ) : (
    <div className="border-b border-forest-900/10 pb-4 last:border-b-0 last:pb-0">{content}</div>
  );
}

function CityStoriesSection({
  destination,
  articles,
}: {
  destination: StrapiDestination;
  articles: Awaited<ReturnType<typeof listArticles>>['data'];
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-12 pt-[50px]" data-testid="city-stories">
      <header className="flex flex-col gap-3 border-b border-forest-900/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-eyebrow">
            <span className="inline-block h-px w-8 bg-primary-emphasis" />
            Local stories
          </p>
          <h2 className="editorial-h mt-3 text-3xl font-bold text-forest-950">
            {articles.length === 0 ? `Stories from ${destination.name} coming soon` : `Stories from ${destination.name}`}
          </h2>
        </div>
        {articles.length > 0 && (
          <span className="text-sm text-forest-900/55">
            {articles.length} stor{articles.length === 1 ? 'y' : 'ies'}
          </span>
        )}
      </header>
      {articles.length > 0 && (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {articles.slice(0, 8).map((article) => (
            <ArticleCard key={article.id} article={article} size="md" />
          ))}
        </div>
      )}
      <MoreStoriesList articles={articles.slice(8)} title={`More stories from ${destination.name}`} />
    </section>
  );
}

function CityRoutesSection({
  destination,
  routes,
}: {
  destination: StrapiDestination;
  routes: Awaited<ReturnType<typeof listRoutesToDestination>>;
}) {
  if (routes.length === 0) return null;

  return (
    <section id="flight-routes" className="mx-auto max-w-7xl scroll-mt-28 px-6" data-testid="destination-routes">
      <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
        <h2 id="flight-routes-heading" className="editorial-h text-2xl font-bold text-forest-900 lg:text-2xl">
          Which flight routes connect to {destination.name}?
        </h2>
        <span className="text-sm font-light text-forest-900/50">
          {routes.length} route{routes.length === 1 ? '' : 's'}
        </span>
      </header>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {routes.map((route) => (
          <RouteCard key={route.id} r={route} />
        ))}
      </div>
      <div className="mt-6">
        <Link href="/flight-routes" className="text-sm font-medium text-forest-700 hover:underline">
          Browse all routes →
        </Link>
      </div>
    </section>
  );
}

function CitySeoGuide({
  destination,
  routes,
  airports,
  articlesCount,
}: {
  destination: StrapiDestination;
  routes: Awaited<ReturnType<typeof listRoutesToDestination>>;
  airports: StrapiAirport[];
  articlesCount: number;
}) {
  const country =
    airports.find((airport) => airport.country)?.country ||
    countryNameFromCode(destination.countryCode) ||
    'the region';
  const primaryAirport = airports[0];
  const originCities = unique(
    routes
      .map((route) => route.origin?.city || route.origin?.name)
      .filter((name): name is string => Boolean(name)),
  ).slice(0, 4);
  const airlines = unique(routes.flatMap((route) => operableCarriers(route).map((carrier) => carrier.name))).slice(0, 4);
  const routeSummary = originCities.length
    ? `Current route data connects ${destination.name} with ${formatList(originCities)}, giving travellers a quick view of useful inbound flight patterns.`
    : `Route coverage for ${destination.name} is still growing, so use the flight search tools alongside this guide when comparing live fares.`;

  const sections = [
    {
      title: `Where to stay in ${destination.name}`,
      body: `For a first visit, compare central neighbourhoods with airport-area hotels before choosing the lowest nightly rate. Central stays usually work better for sightseeing, dining and short city breaks, while airport hotels can make sense for early departures, late arrivals or one-night stopovers in ${country}.`,
    },
    {
      title: `Airport and arrival planning`,
      body: primaryAirport
        ? `${primaryAirport.name} is the main airport matched to ${destination.name}. Check the exact airport name on your ticket, then compare transfer time, arrival hour and baggage rules before booking tight onward plans.`
        : `Before booking flights to ${destination.name}, check whether the fare uses a primary or secondary airport and how long the transfer into the city is likely to take.`,
    },
    {
      title: `Flight and route context`,
      body: `${routeSummary} ${airlines.length ? `Airlines appearing in the current route set include ${formatList(airlines)}.` : 'Airlines and schedules can change by season, so confirm the final carrier, fare rules and baggage allowance before payment.'}`,
    },
    {
      title: `How to use this ${destination.name} guide`,
      body: `Start with the city overview, then compare articles, airport details, activity ideas and flight routes. ${articlesCount > 0 ? `Originfacts currently links ${articlesCount} related ${articlesCount === 1 ? 'story' : 'stories'} to ${destination.name}.` : `Originfacts is still adding local stories for ${destination.name}.`} Use the live booking pages only after you know the area, airport and route that fit your trip.`,
    },
  ];

  const checklist = [
    'Confirm the arrival airport.',
    'Compare central and airport hotels.',
    'Check transfer time before booking.',
    'Review baggage and fare rules.',
    'Save flexible plans for late arrivals.',
  ];

  return (
    <section className="mx-auto mt-12 max-w-7xl px-6" data-testid="city-seo-guide">
      <div className="rounded-[0.3rem] border border-forest-900/10 bg-gradient-to-br from-white via-[#f7fbff] to-[#fff8e6] p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <p className="section-eyebrow">
              <span className="inline-block h-px w-8 bg-primary-emphasis" />
              Practical city guide
            </p>
            <h2 className="editorial-h mt-3 text-3xl font-bold text-forest-950">
              How should you plan a trip to {destination.name}?
            </h2>
            <p className="mt-4 max-w-4xl text-base leading-7 text-forest-900/72">
              Use this guide to connect the big travel decisions for {destination.name}: where to stay, which airport
              to use, how flight routes compare and what to verify before booking.
            </p>
          </div>
          <div className="border-l-2 border-primary-emphasis pl-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-emphasis">
              Quick checklist
            </div>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-forest-900/72">
              {checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="border-t border-forest-900/10 pt-5">
              <h3 className="text-xl font-bold text-forest-950">{section.title}</h3>
              <p className="mt-3 text-sm leading-7 text-forest-900/72">{section.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CityPlanningSections({
  destination,
  routes,
  airports,
  articlesCount,
}: {
  destination: StrapiDestination;
  routes: Awaited<ReturnType<typeof listRoutesToDestination>>;
  airports: StrapiAirport[];
  articlesCount: number;
}) {
  const routeCities = unique(
    routes
      .map((route) => route.origin?.city || route.origin?.name)
      .filter((name): name is string => Boolean(name)),
  ).slice(0, 5);
  const carriers = unique(routes.flatMap((route) => operableCarriers(route).map((carrier) => carrier.name))).slice(0, 5);
  const country =
    airports.find((airport) => airport.country)?.country ||
    countryNameFromCode(destination.countryCode) ||
    'the region';
  const airportNames = airports.map((airport) => airport.name).slice(0, 3);
  const primaryAirport = airportNames[0];

  return (
    <section className="mx-auto max-w-7xl px-6" data-testid="city-planning-sections">
      <div className="grid gap-8 border-y border-forest-900/10 py-12 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="section-eyebrow">
            <span className="inline-block h-px w-8 bg-forest-800/60" />
            City planning notes
          </p>
          <h2 className="editorial-h mt-3 text-3xl font-bold text-forest-900">
            Plan {destination.name} with airports, routes and stays in one view
          </h2>
          <p className="mt-4 text-base font-light leading-7 text-forest-900/75">
            Use this page as the practical starting point for {destination.name}. It connects the city guide with
            flight routes, airport context, hotel planning and local activity ideas, so you can compare the trip before
            opening separate booking tabs.
          </p>
          <p className="mt-4 text-base font-light leading-7 text-forest-900/75">
            {primaryAirport
              ? `${primaryAirport} is the main airport record we match to ${destination.name}, and the route data below shows where Originfacts currently has structured flight coverage.`
              : `Originfacts is still expanding airport-level coverage for ${destination.name}, so use the route and article sections here as the first planning layer.`}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CityPlanningCard
            label="Airport access"
            title={airports.length ? `${airports.length} airport${airports.length === 1 ? '' : 's'} linked to the city` : 'Airport coverage is being expanded'}
            body={
              airportNames.length
                ? `${airportNames.join(', ')} ${airports.length === 1 ? 'serves' : 'serve'} ${destination.name}. Check airport pages for terminal, route and nearby-airport details before booking a tight connection.`
                : `When flying to ${destination.name}, compare the airport named on your ticket with transfer time into the city centre before choosing the lowest fare.`
            }
          />
          <CityPlanningCard
            label="Routes"
            title={routes.length ? `${routes.length} tracked inbound route${routes.length === 1 ? '' : 's'}` : 'Route data is still growing'}
            body={
              routeCities.length
                ? `Tracked origins include ${formatList(routeCities)}. These routes help show which city pairs already have structured flight data on Originfacts.`
                : `Use the flight search module on this page to compare live fares while Originfacts expands structured routes for ${destination.name}.`
            }
          />
          <CityPlanningCard
            label="Airlines"
            title={carriers.length ? `${carriers.length} carrier${carriers.length === 1 ? '' : 's'} in route data` : 'Carrier mix varies by route'}
            body={
              carriers.length
                ? `${formatList(carriers)} appear in the current route set. Always confirm baggage, seat and change rules on the seller page before paying.`
                : `Carrier options can change by season, so compare direct airline prices with metasearch results before locking in dates.`
            }
          />
          <CityPlanningCard
            label="Where to stay"
            title={`Hotel planning for ${destination.name}`}
            body={`For ${destination.name}, compare central stays against airport-area hotels if you have an early departure, late arrival or short stopover in ${country}.`}
          />
        </div>
      </div>

      {/*
        The seasonal comparison table was removed here. It was captioned per
        destination — "Travel Windows for {name}" — but its rows were hardcoded
        and identical on all 258 destination pages: peak Nov–Feb at 25–32°C,
        low season Jun–Aug with "tropical rainfall". That is wrong for most of
        the set (Tuscany, Provence, Patagonia among them) and it was presented
        as destination-specific research.

        Restore it only from real per-destination climate data on the
        destination record, not from literals in the template.
      */}

      <div className="grid gap-6 py-12 lg:grid-cols-3" data-testid="city-useful-context">
        <CityContextNote
          title={`Before booking ${destination.name}`}
          body={`Look at the airport name, not just the city label. Some itineraries use secondary airports or awkward arrival times that can erase the saving from a cheaper fare.`}
        />
        <CityContextNote
          title="Best use of this page"
          body={`Start with articles if you want editorial guidance, routes if you are comparing flights, and activities if you already know your dates. Together they give ${destination.name} more context than a plain destination stub.`}
        />
        <CityContextNote
          title="What to verify live"
          body="Confirm fares, baggage, hotel cancellation rules, transfer times and activity availability on the booking provider before paying, because those details can change faster than destination pages."
        />
      </div>
    </section>
  );
}

function CityPlanningCard({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <article className="rounded-[0.3rem] border border-forest-900/10 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-emphasis">{label}</p>
      <h3 className="mt-3 text-xl font-bold leading-tight text-forest-950">{title}</h3>
      <p className="mt-3 text-sm font-light leading-7 text-forest-900/72">{body}</p>
    </article>
  );
}

function CityContextNote({ title, body }: { title: string; body: string }) {
  return (
    <article className="border-t border-forest-900/10 pt-5">
      <h3 className="text-lg font-bold text-forest-950">{title}</h3>
      <p className="mt-3 text-sm font-light leading-7 text-forest-900/72">{body}</p>
    </article>
  );
}

function buildCityHeroDescription(
  destination: StrapiDestination,
  airports: StrapiAirport[],
  routes: Awaited<ReturnType<typeof listRoutesToDestination>>,
  articlesCount: number,
) {
  const override = CITY_HERO_DESCRIPTION_OVERRIDES[destination.slug];
  if (override) return override;

  const country = airports.find((airport) => airport.country)?.country || countryNameFromCode(destination.countryCode);
  const primaryAirport = airports[0]?.name;

  return `Visiting ${destination.name}${country ? `, ${country}` : ''} requires choosing optimal flight routes, matching local arrival hubs like ${primaryAirport || 'regional gateway airports'} to key neighborhoods, and timing travel around seasonal weather patterns. Our comprehensive destination guide synthesizes real-time carrier connectivity, airport transit options, hotel area recommendations, and verified editorial coverage, empowering travelers to structure seamless itineraries and secure competitive flight prices.`;
}
