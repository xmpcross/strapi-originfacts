import { notFound } from 'next/navigation';
import { Fragment } from 'react';
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
import ArticleCard from '@/components/ArticleCard';
import ContinentCountriesGrid from '@/components/ContinentCountriesGrid';
import CountryAbout from '@/components/CountryAbout';
import CountryDetailSections from '@/components/CountryDetailSections';
import CountryFactsPanel from '@/components/CountryFactsPanel';
import FlightSearchCTA from '@/components/FlightSearchCTA';
import OutboundCitations from '@/components/OutboundCitations';
import PopularHotelsByCity from '@/components/PopularHotelsByCity';
import TableOfContents from '@/components/TableOfContents';
import { getCountryFacts } from '@/lib/country-facts';
import { SITE_URL, articleBlogPostingJsonLd, faqJsonLd, normalizeFaqs } from '@/lib/entity-seo';
import { JsonLd, FaqSection } from '@/components/SeoBlocks';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import KeyFacts from '@/components/KeyFacts';
import { clampDescription, compactTitle } from '@/lib/seo';
import { airportPath } from '@/lib/airport-slugs';
import type { Metadata } from 'next';

export const revalidate = 60;

const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'] as const;
const GYG_EXCLUDED_TOUR_IDS_BY_DESTINATION: Record<string, string> = {
  bangkok: '1457595',
};
const CITY_HERO_DESCRIPTION_OVERRIDES: Record<string, string> = {
  perth:
    'Visiting Perth requires selecting optimal long-haul flight connections, matching airport transfers at Perth Airport (PER) to beachside or central hotel districts, and timing travel around Mediterranean climate patterns. Our comprehensive destination guide synthesizes operating airline networks, local transit options, regional excursion routes, and verified editorial research for Western Australia travel.',
  bangkok:
    'Visiting Bangkok requires navigating multi-airport transfers between Suvarnabhumi (BKK) and Don Mueang (DMK), selecting strategic hotel districts along the Chao Phraya River, and timing itineraries around seasonal monsoons. Our comprehensive city guide combines real-time flight route data, urban transit links, cultural neighborhood research, and expert travel advice for Thailand travelers.',
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await getDestination(slug);
  if (!d) return { title: 'Not found' };
  return {
    title: destinationMetaTitle(d),
    description: destinationMetaDescription(d),
    alternates: { canonical: `/destinations/${slug}` },
  };
}

function destinationMetaTitle(destination: StrapiDestination) {
  if (destination.type === 'city') return compactTitle(`${destination.name} travel guide`);
  if (destination.type === 'country') return compactTitle(`${destination.name} travel guide`);
  if (destination.type === 'region') return compactTitle(`${destination.name} destinations guide`);
  return compactTitle(destination.name);
}

function destinationMetaDescription(destination: StrapiDestination) {
  if (destination.description?.trim()) return clampDescription(destination.description);

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
  const destination = await getDestination(slug);
  if (!destination) notFound();

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
  const articleSchema = articleBlogPostingJsonLd({
    headline: destinationMetaTitle(destination),
    description: destinationMetaDescription(destination),
    url: `${SITE_URL}/destinations/${destination.slug}`,
    image: hero,
    authorNameOrSlug: 'marcus-vance',
    categoryName: 'Destinations',
    type: 'BlogPosting',
  });

  const breadcrumbItems: { name: string; url: string }[] = [{ name: 'Destinations', url: '/destinations' }];
  if (isCountry) {
    breadcrumbItems.push({ name: 'Countries', url: '/countries' });
  } else if (isCity && destination.countryCode) {
    const cName = countryNameFromCode(destination.countryCode);
    if (cName) {
      // Link the country crumb to its destination guide; /countries/<code>
      // would only redirect there.
      const countryGuide = await getDestinationByCountryCode(destination.countryCode).catch(() => null);
      breadcrumbItems.push({
        name: cName,
        url: countryGuide ? `/destinations/${countryGuide.slug}` : `/countries/${destination.countryCode.toLowerCase()}`,
      });
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
      <OutboundCitations category="destinations" title={`${destination.name} — Verified Primary & Government Sources`} />
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
        <CountryDestinationPage
          destination={destination}
          hero={hero}
          airports={airports}
          airlines={airlines}
          routes={routes}
          articles={articles}
          cities={countryCities}
        />
        {faqBlock}
        {citationsBlock}
      </>
    );
  }

  if (isContinent) {
    return (
      <>
        <JsonLd data={articleSchema} />
        <JsonLd data={breadcrumbSchema} />
        <ContinentDestinationPage
          destination={destination}
          hero={hero}
          countries={countries}
          airports={airports}
          childDestinations={continentDestinations}
          articles={articles}
        />
        {faqBlock}
        {citationsBlock}
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
          <img src={hero} alt={destination.name} className="absolute inset-0 h-full w-full object-cover" />
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
          <img src={hero} alt={destination.name} className="absolute inset-0 h-full w-full object-cover" />
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
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-primary-emphasis">
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
              <h3 className="font-urbanist text-lg font-bold text-forest-950">
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

  return (
    <div className="mx-auto max-w-7xl px-6 pb-12" data-testid="city-popular-hotels">
      <PopularHotelsByCity
        city={destination.name}
        country={country}
        eyebrow="Popular hotels"
        title={`Popular hotels in ${destination.name}`}
        description={`Compare highly rated ${destination.name} hotels from live Google Hotels data before choosing where to stay. Use the filters to scan central, airport, luxury, budget and family-friendly options for the city.`}
        searchContextLabel="Page city"
      />
    </div>
  );
}

function countryNameFromCode(code?: string) {
  if (!code || code.length !== 2) return '';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || '';
  } catch {
    return '';
  }
}

function CityHeroMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-white/25 bg-white/10 px-4 py-3 backdrop-blur">
      <div className="font-urbanist text-2xl font-bold leading-none text-white">{value.toLocaleString()}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">{label}</div>
    </div>
  );
}

function CitySnapshotItem({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = (
    <>
      <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-forest-900/50">{label}</dt>
      <dd className="mt-1 font-urbanist text-lg font-bold leading-tight text-forest-950">{value}</dd>
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
  const airlines = unique(routes.flatMap((route) => route.carriers?.map((carrier) => carrier.name) ?? [])).slice(0, 4);
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
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-primary-emphasis">
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
              <h3 className="font-urbanist text-xl font-bold text-forest-950">{section.title}</h3>
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
  const carriers = unique(routes.flatMap((route) => route.carriers?.map((carrier) => carrier.name) ?? [])).slice(0, 5);
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
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary-emphasis">{label}</p>
      <h3 className="mt-3 font-urbanist text-xl font-bold leading-tight text-forest-950">{title}</h3>
      <p className="mt-3 text-sm font-light leading-7 text-forest-900/72">{body}</p>
    </article>
  );
}

function CityContextNote({ title, body }: { title: string; body: string }) {
  return (
    <article className="border-t border-forest-900/10 pt-5">
      <h3 className="font-urbanist text-lg font-bold text-forest-950">{title}</h3>
      <p className="mt-3 text-sm font-light leading-7 text-forest-900/72">{body}</p>
    </article>
  );
}

function GetYourGuideActivityWidget({
  destination,
  query,
}: {
  destination: StrapiDestination;
  query: string;
}) {
  const campaign = `originfacts-destination-${destination.slug}`.slice(0, 80);
  const excludedTourIds = GYG_EXCLUDED_TOUR_IDS_BY_DESTINATION[destination.slug];

  return (
    <section
      className="my-12 overflow-hidden rounded-2xl border border-forest-900/10 bg-gradient-to-br from-white via-sand-50 to-sky-50 p-6 shadow-sm sm:p-8"
      data-nosnippet
      data-testid="destination-activity-widget"
    >
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-forest-700/70">
            Sponsored activities
          </div>
          <h2 className="editorial-h mt-3 text-3xl font-bold text-forest-900">
            What are the top things to do in {destination.name}?
          </h2>
          <p className="mt-4 text-base leading-7 text-forest-900/70">
            Compare tours, tickets, day trips and local experiences related to {destination.name}.
            The activity feed is supplied by GetYourGuide and updates based on live availability.
          </p>
          <p className="mt-3 text-sm leading-6 text-forest-900/55">
            Origin Facts may earn a commission when you book through this widget, at no extra cost to you.
          </p>
        </div>

        <div className="min-h-[360px] rounded-xl border border-white/70 bg-white/80 p-4 shadow-inner">
          <div
            data-gyg-href="https://widget.getyourguide.com/default/activities.frame"
            data-gyg-locale-code="en-US"
            data-gyg-locale-currency="USD"
            data-gyg-widget="activities"
            data-gyg-number-of-items="3"
            data-gyg-partner-id="H8Y3KHZ"
            data-gyg-campaign={campaign}
            data-gyg-cmp={campaign}
            data-gyg-q={query}
            data-gyg-excluded-tour-ids={excludedTourIds}
          >
            <span className="text-sm text-forest-900/55">
              Powered by{' '}
              <a
                target="_blank"
                rel="sponsored nofollow noopener noreferrer"
                href={`https://www.getyourguide.com/s/?q=${encodeURIComponent(query)}`}
                className="font-medium text-forest-800 underline underline-offset-4"
              >
                GetYourGuide
              </a>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function unique(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function formatList(items: string[]) {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function buildActivityWidgetQuery(
  destination: Pick<StrapiDestination, 'name' | 'countryCode'>,
  routes: Awaited<ReturnType<typeof listRoutesToDestination>>,
) {
  const country = routes.find((route) => route.destination?.country)?.destination?.country;
  const countryHint = country || countryNameFromCode(destination.countryCode) || destination.countryCode;
  return [destination.name, countryHint].filter(Boolean).join(', ');
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

/* -------------------------------------------------------------------------- */
/* Country-type destination page                                              */
/* -------------------------------------------------------------------------- */

function CountryDestinationPage({
  destination,
  hero,
  airports,
  airlines,
  routes,
  articles,
  cities,
}: {
  destination: StrapiDestination;
  hero: string | null;
  airports: StrapiAirport[];
  airlines: StrapiAirline[];
  routes: Awaited<ReturnType<typeof listRoutesToDestination>>;
  articles: Awaited<ReturnType<typeof listArticles>>['data'];
  cities: StrapiDestination[];
}) {
  const aboutSections = destination.description ? parseAboutSections(destination.description) : [];
  const leadParagraphs = aboutSections.find((s) => !s.heading)?.paragraphs ?? [];
  const namedSections = aboutSections.filter((s) => s.heading);
  // Sections that render next to the stats grid in the About block.
  // Everything else falls into the "extras" grid above Flights.
  const ABOUT_HERO_HEADINGS = new Set(['Overview', 'Visa Requirements']);
  const aboutHeroSections = namedSections.filter((s) => s.heading && ABOUT_HERO_HEADINGS.has(s.heading));
  const extraSections = namedSections.filter((s) => s.heading && !ABOUT_HERO_HEADINGS.has(s.heading));
  const activityQuery = buildActivityWidgetQuery(destination, routes);
  // Prefer Strapi-stored facts (populated by enrich-country-content.js),
  // fall back to the static lookup in lib/country-facts.ts.
  const facts = destination.facts ?? getCountryFacts(destination.countryCode);

  return (
    <article data-testid={`destination-page-${destination.slug}`} data-hide-fixed-sidebars="true">
      {/* 1. Hero — bottom-anchored, left-aligned title + lead */}
      <section className="relative h-[55vh] min-h-[380px] overflow-hidden bg-forest-900">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            alt={destination.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950/90 via-forest-950/30 to-forest-950/10" />

        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-6 pb-14 text-sand-100">
          <div className="max-w-3xl">
            {/* Left — text column */}
            <div>
              <div className="text-xs uppercase tracking-widest text-white/80">
                {destination.type ?? 'Destination'}
                {destination.countryCode ? ` · ${destination.countryCode}` : ''}
              </div>
              <h1 className="editorial-h mt-3 text-3xl font-bold !text-[#ffffff] sm:text-4xl">
                {destination.name}
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-white/90">
                {leadParagraphs.length > 0 && leadParagraphs.join(' ').split(/\s+/).length >= 40
                  ? leadParagraphs.join(' ')
                  : `Exploring ${destination.name} requires evaluating regional airport hubs, understanding national entry regulations, and selecting preferred domestic transit corridors across key cities. Our comprehensive country travel guide organizes commercial air links, operating carrier options, local hotel areas, and verified editorial research, allowing travelers to build efficient itineraries and secure cost-effective flight connections.`}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About — Overview + Visa Requirements stay alongside the stats column */}
      {aboutHeroSections.length > 0 && (
        <section className="mx-auto mt-14 max-w-7xl px-6" data-testid="country-about">
          <div className="grid gap-y-10 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-x-12">
            <div className="self-start">
              <CountryFactsPanel countryCode={destination.countryCode} facts={facts} />
            </div>
            {/* Right — overview content, fills column */}
            <div className="w-full">
              {aboutHeroSections.map((section) => (
                <Fragment key={section.heading ?? 'country-about-section'}>
                  <CountryAbout sections={[section]} />
                  {section.heading === 'Visa Requirements' && (
                    <CountryArrivalPlanningNote
                      destination={destination}
                      airportsCount={airports.length}
                      airlinesCount={airlines.length}
                    />
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        </section>
      )}

      <CountryPlanningNote
        destination={destination}
        airportsCount={airports.length}
        airlinesCount={airlines.length}
        routesCount={routes.length}
        articlesCount={articles.length}
      />

      <CountryCitiesSection country={destination} cities={cities} />

      {/* 2 + 3. Airports and Airlines */}
      <CountryDetailSections
        countryName={destination.name}
        airports={airports}
        airlines={airlines}
      />

      {/* Extra editorial sections (Attractions / Weather full-width, then
          Interesting Facts + Official Resources side-by-side, no card chrome) */}
      {extraSections.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl space-y-12 px-6" data-testid="country-extras">
          {extraSections
            .filter((s) => s.heading !== 'Interesting Facts About the UK' && s.heading !== 'Official Resources' && !s.heading?.startsWith('Interesting Facts About '))
            .map((s, i) => (
              <Fragment key={s.heading ?? `extra-${i}`}>
                {s.heading === 'Weather & Climate' && (
                  <GetYourGuideActivityWidget destination={destination} query={activityQuery} />
                )}
                <CountryAbout sections={[s]} />
              </Fragment>
            ))}
          {(() => {
            const interestingFacts = extraSections.find(
              (s) => s.heading?.startsWith('Interesting Facts About '),
            );
            const officialResources = extraSections.find((s) => s.heading === 'Official Resources');
            if (!interestingFacts && !officialResources) return null;
            return (
              <div className="grid gap-[3.5rem] lg:grid-cols-2" data-testid="country-extras-pair">
                {interestingFacts && (
                  <CountryAbout sections={[interestingFacts]} singleColumnBullets />
                )}
                {officialResources && (
                  <CountryAbout sections={[officialResources]} singleColumnBullets />
                )}
              </div>
            );
          })()}
        </section>
      )}

      {/* 4. Flights — 4 cards */}
      {routes.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-6" data-testid="destination-routes">
          <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
            <h2 className="editorial-h text-2xl font-bold text-forest-900 lg:text-2xl">
              Flights to {destination.name}
            </h2>
            <span className="text-sm font-light text-forest-900/50">
              {routes.length} route{routes.length === 1 ? '' : 's'}
            </span>
          </header>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {routes.slice(0, 4).map((r) => <RouteCard key={r.id} r={r} />)}
          </div>
          <div className="mt-6">
            <Link href="/flight-routes" className="text-sm font-medium text-forest-700 hover:underline">
              Browse all routes →
            </Link>
          </div>
        </section>
      )}

      {/* 5. Stories — 4 cards */}
      <section className="mx-auto mt-16 max-w-7xl px-6 pb-20" data-testid="destination-stories">
        <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
          <h2 className="editorial-h text-2xl font-bold text-forest-900 lg:text-2xl">
            {articles.length === 0
              ? `No stories from ${destination.name} yet`
              : `${articles.length} stor${articles.length === 1 ? 'y' : 'ies'} from ${destination.name}`}
          </h2>
          {articles.length > 4 && (
            <span className="text-sm font-light text-forest-900/50">
              {articles.length} available
            </span>
          )}
        </header>
        {articles.length > 0 && (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {articles.slice(0, 4).map((a) => (
              <ArticleCard key={a.id} article={a} size="compact" imageClassName="h-[200px]" />
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

function CountryArrivalPlanningNote({
  destination,
  airportsCount,
  airlinesCount,
}: {
  destination: StrapiDestination;
  airportsCount: number;
  airlinesCount: number;
}) {
  return (
    <section
      className="prose-article border-forest-900/10"
      data-testid="country-arrival-planning-note"
    >
      <h3>
        Entry planning after the visa check
      </h3>
      <p className="mt-3">
        Once the entry rules for {destination.name} are clear, compare arrival airports, onward cities and airline
        options together: Originfacts currently links this country guide to {airportsCount.toLocaleString()} airport{airportsCount === 1 ? '' : 's'} and {airlinesCount.toLocaleString()} airline{airlinesCount === 1 ? '' : 's'}, helping you choose the route that best matches your timing, connection margin and first stop.
      </p>
    </section>
  );
}

function CountryPlanningNote({
  destination,
  airportsCount,
  airlinesCount,
  routesCount,
  articlesCount,
}: {
  destination: StrapiDestination;
  airportsCount: number;
  airlinesCount: number;
  routesCount: number;
  articlesCount: number;
}) {
  const coverageItems = [
    {
      label: 'Start with cities',
      body: `Choose your first stop in ${destination.name}, then compare nearby airports and onward travel before booking a fare.`,
    },
    {
      label: 'Compare the flight setup',
      body: `${airportsCount.toLocaleString()} airport${airportsCount === 1 ? '' : 's'} and ${airlinesCount.toLocaleString()} airline${airlinesCount === 1 ? '' : 's'} are linked here, so you can scan gateways and local carriers together.`,
    },
    {
      label: 'Use live context',
      body:
        routesCount > 0
          ? `${routesCount.toLocaleString()} tracked inbound route${routesCount === 1 ? '' : 's'} and ${articlesCount.toLocaleString()} related stor${articlesCount === 1 ? 'y' : 'ies'} help connect trip ideas with practical flight options.`
          : `Live route-planning tools and ${articlesCount.toLocaleString()} related stor${articlesCount === 1 ? 'y' : 'ies'} help turn the country overview into a practical next step.`,
    },
  ];

  return (
    <section className="mx-auto mt-12 max-w-7xl px-6" data-testid="country-planning-note">
      <div className="overflow-hidden rounded-[0.3rem] border border-forest-900/10 bg-white">
        <div className="grid gap-6 bg-gradient-to-br from-[#f7fbff] via-white to-[#fff8e6] p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div>
            <p className="section-eyebrow">
              <span className="inline-block h-px w-8 bg-primary-emphasis" />
              Planning snapshot
            </p>
            <h2 className="editorial-h mt-3 text-2xl font-bold text-forest-950 lg:text-3xl">
              Build your {destination.name} trip around the right first stop
            </h2>
            <p className="mt-4 max-w-4xl text-base font-light leading-7 text-forest-900/75">
              Use this country page as a practical bridge between inspiration and booking. Start with the entry basics,
              then compare cities, airports, airlines, routes and related guides before choosing dates.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-[0.3rem] border border-forest-900/10 bg-white/80 p-3 text-center lg:grid-cols-1 lg:text-left">
            <PlanningStat label="Airports" value={airportsCount} />
            <PlanningStat label="Airlines" value={airlinesCount} />
            <PlanningStat label="Stories" value={articlesCount} />
          </div>
        </div>
        <div className="grid divide-y divide-forest-900/10 md:grid-cols-3 md:divide-x md:divide-y-0">
          {coverageItems.map((item, index) => (
            <article key={item.label} className="p-6 sm:p-7">
              <div className="font-mono text-[11px] font-bold tracking-[0.18em] text-primary-emphasis">
                {String(index + 1).padStart(2, '0')}
              </div>
              <h3 className="mt-3 font-urbanist text-lg font-bold text-forest-950">{item.label}</h3>
              <p className="mt-3 text-sm font-light leading-7 text-forest-900/72">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanningStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-2">
      <div className="font-urbanist text-2xl font-bold leading-none text-forest-900">
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-forest-900/55">{label}</div>
    </div>
  );
}

function CountryCitiesSection({
  country,
  cities,
}: {
  country: StrapiDestination;
  cities: StrapiDestination[];
}) {
  if (cities.length === 0) return null;
  const shown = cities.slice(0, 5);

  return (
    <section
      className="mx-auto mt-16 max-w-7xl overflow-hidden rounded-[0.3rem] border border-forest-900/10 bg-gradient-to-br from-white via-[#f7fbff] to-[#fff8e6] px-6 py-8 sm:px-8"
      data-testid="country-cities"
    >
      <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
        <div>
          <p className="section-eyebrow">
            <span className="inline-block h-px w-8 bg-primary-emphasis" />
            City guides
          </p>
          <h2 className="editorial-h mt-3 text-2xl font-bold text-2xl">
            Cities in {country.name}
          </h2>
          <p className="mt-4 max-w-4xl text-base font-light leading-7 text-forest-900/72">
            Compare the main city pages for {country.name} before you choose where to stay, connect or start a trip.
            Each guide links city context with nearby airports, routes, local planning notes and related Originfacts
            stories where we have them.
          </p>
        </div>
        <div className="border-l-2 border-primary-emphasis pl-5">
          <div className="font-urbanist text-4xl font-bold leading-none text-forest-900">
            {cities.length}
          </div>
          <div className="mt-2 text-xs font-bold uppercase tracking-[0.22em] text-forest-900/55">
            city guide{cities.length === 1 ? '' : 's'}
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-4 lg:grid-cols-6" data-testid="country-cities-grid">
        {shown.map((city, index) => (
          <CountryCityCard
            key={city.id}
            city={city}
            countryCode={country.countryCode}
            wide={index < 2}
          />
        ))}
      </div>
    </section>
  );
}

function CountryCityCard({
  city,
  countryCode,
  wide,
}: {
  city: StrapiDestination;
  countryCode?: string;
  wide?: boolean;
}) {
  const image = mediaUrl(city.heroImage ?? null);
  const description = cityCardDescription(city);

  return (
    <Link
      href={`/destinations/${city.slug}`}
      className={`group relative block overflow-hidden rounded-[0.3rem] bg-forest-900 ring-1 ring-forest-900/10 ${
        wide ? 'min-h-[245px] lg:col-span-3' : 'min-h-[230px] lg:col-span-2'
      }`}
      data-testid={`country-city-${city.slug}`}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={city.name}
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary-emphasis/80 via-forest-900 to-forest-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-forest-950/75 via-forest-950/15 to-forest-950/35" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
        <div className="min-w-0">
          <h5 className="truncate font-urbanist text-2xl font-bold leading-none !text-white drop-shadow-sm">
            {city.name}
          </h5>
          <p
            className="mt-3 line-clamp-3 max-w-md text-sm font-normal leading-6"
            style={{ color: '#e5e5e5' }}
          >
            {description}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          {countryCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://flagcdn.com/${countryCode.toLowerCase()}.svg`}
              alt={`${countryCode.toUpperCase()} flag`}
              className="h-5 w-7 rounded-[2px] object-cover shadow-sm"
              loading="lazy"
            />
          )}
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-forest-900 transition group-hover:bg-primary-emphasis group-hover:text-white">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}

function cityCardDescription(city: StrapiDestination) {
  const firstParagraph = city.description
    ?.replace(/#{1,6}\s+/g, '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .find(Boolean);

  if (!firstParagraph) {
    return `Plan where to stay, which airport to use and what to check before booking ${city.name}.`;
  }

  return firstParagraph.replace(/\s+/g, ' ');
}

function HeroStat({ label, value, display }: { label: string; value: number; display?: string }) {
  return (
    <div>
      <div className="font-urbanist text-3xl font-bold leading-none text-forest-900">
        {display ?? value.toLocaleString()}
      </div>
      <div className="mt-2 text-xs uppercase tracking-widest text-forest-900/60">{label}</div>
    </div>
  );
}

function RouteCard({ r }: { r: Awaited<ReturnType<typeof listRoutesToDestination>>[number] }) {
  return (
    <Link
      href={`/flight-routes/${r.slug}`}
      className="group flex items-center justify-between rounded-lg border border-forest-900/10 bg-paper p-5 transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm"
      data-testid={`destination-route-${r.slug}`}
    >
      <div>
        <div className="font-mono text-xs font-bold tracking-wider text-forest-900/70">
          {r.origin?.iata} → {r.destination?.iata}
        </div>
        <div className="mt-2 font-urbanist text-base font-bold text-forest-900 group-hover:text-forest-700">
          From {r.origin?.city || r.origin?.name}
        </div>
        <div className="mt-1 text-xs text-forest-900/60">{r.origin?.country}</div>
      </div>
      {r.distanceKm && (
        <div className="text-right text-xs text-forest-900/50">
          <div className="font-mono font-bold text-forest-900/70">
            {r.distanceKm.toLocaleString()} km
          </div>
          {r.durationMinutes && (
            <div className="mt-1">{formatDuration(r.durationMinutes)}</div>
          )}
        </div>
      )}
    </Link>
  );
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

type AboutSection = { heading: string | null; paragraphs: string[] };

function parseAboutSections(md: string): AboutSection[] {
  const sections: AboutSection[] = [];
  let current: AboutSection = { heading: null, paragraphs: [] };
  for (const block of md.split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const headingMatch = trimmed.match(/^##\s+(.+)$/m);
    if (headingMatch && trimmed.startsWith('##')) {
      if (current.heading || current.paragraphs.length) sections.push(current);
      current = { heading: headingMatch[1].trim(), paragraphs: [] };
      const remainder = trimmed.replace(/^##\s+.+\n?/, '').trim();
      if (remainder) current.paragraphs.push(remainder);
    } else {
      current.paragraphs.push(trimmed);
    }
  }
  if (current.heading || current.paragraphs.length) sections.push(current);
  return sections;
}

/* -------------------------------------------------------------------------- */
/* Continent-type destination page                                            */
/*                                                                            */
/* Triggered when destination.type='region' AND destination.name is one of    */
/* the 6 canonical continent values. Pulls all countries with matching        */
/* `region` from the countries collection and renders a grid.                 */
/* -------------------------------------------------------------------------- */

function ContinentDestinationPage({
  destination,
  hero,
  countries,
  airports,
  childDestinations,
  articles,
}: {
  destination: StrapiDestination;
  hero: string | null;
  countries: StrapiCountry[];
  airports: StrapiAirport[];
  childDestinations: StrapiDestination[];
  articles: Awaited<ReturnType<typeof listArticles>>['data'];
}) {
  // Parse the markdown description into a short lead + named sections, the
  // same way the country page does. Overview / Travel Notes / Interesting
  // Facts each become their own block below the hero.
  const aboutSections = destination.description ? parseAboutSections(destination.description) : [];
  const leadParagraphs = aboutSections.find((s) => !s.heading)?.paragraphs ?? [];
  const namedSections = aboutSections.filter((s) => s.heading);
  const countryHrefByCode: Record<string, string> = {};
  for (const d of childDestinations) {
    if (d.type === 'country' && d.countryCode && d.slug) countryHrefByCode[d.countryCode.toUpperCase()] = `/destinations/${d.slug}`;
  }
  // About block right column = Overview (full) + History (Read More
  // truncates after 30 words). Travel Notes renders full-width below
  // Countries. Interesting Facts + Top Travel Highlights render in a 2-col
  // grid further down. Anything else (e.g. Official Resources) falls through
  // to the full-width extras block.
  const overviewSection = namedSections.find((s) => s.heading === 'Overview');
  const historySection = namedSections.find((s) => s.heading === 'History and Ancient Civilizations');
  const aboutHeroSections = overviewSection ? [overviewSection] : [];
  const travelNotesSection = namedSections.find((s) => s.heading === 'Travel Notes');
  const interestingFactsSection = namedSections.find((s) => s.heading?.startsWith('Interesting Facts About '));
  const topHighlightsSection = namedSections.find((s) => s.heading === 'Top Travel Highlights');
  const consumedHeadings = new Set([
    overviewSection?.heading,
    historySection?.heading,
    travelNotesSection?.heading,
    interestingFactsSection?.heading,
    topHighlightsSection?.heading,
  ].filter((h): h is string => Boolean(h)));
  const extraSections = namedSections.filter((s) => s.heading && !consumedHeadings.has(s.heading));
  const facts = (destination.facts as ContinentFacts | undefined) ?? {};

  return (
    <article data-testid={`destination-page-${destination.slug}`}>
      {/* 1. Hero — bottom-anchored, left-aligned title + lead */}
      <section className="relative h-[55vh] min-h-[380px] overflow-hidden bg-forest-900">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            alt={destination.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950/90 via-forest-950/30 to-forest-950/10" />

        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-6 pb-14 text-sand-100">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-widest text-white/80">Continent</div>
            <h1 className="editorial-h mt-3 text-3xl font-bold !text-[#ffffff] sm:text-4xl">
              {destination.name}
            </h1>
            {leadParagraphs.length > 0 ? (
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/90">
                {leadParagraphs.join(' ')}
              </p>
            ) : destination.description ? (
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/90">
                {destination.description}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* 2. About — facts panel left, Overview + History right */}
      {(aboutHeroSections.length > 0 || historySection) && (
        <section className="mx-auto mt-14 max-w-7xl px-6" data-testid="continent-about">
          <div className="grid gap-y-10 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-x-12">
            <ContinentFactsPanel
              destination={destination}
              countriesCount={countries.length}
              articlesCount={articles.length}
            />
            {/* Right — Overview + History and Ancient Civilizations (truncated) */}
            <div className="w-full space-y-8">
              {aboutHeroSections.length > 0 && (
                <CountryAbout sections={aboutHeroSections} />
              )}
              {historySection && (
                <CountryAbout sections={[historySection]} />
              )}
            </div>
          </div>
        </section>
      )}

      <ContinentPlanningContent
        destination={destination}
        facts={facts}
        countriesCount={countries.length}
        articlesCount={articles.length}
      />

      {/* 3. Countries — full width, with A-Z letter filter. Each chip links
          to the country's destination guide (the canonical URL). */}
      <ContinentCountriesGrid countries={countries} regionName={destination.name} hrefByCode={countryHrefByCode} />

      {/* 3a. Travel Notes — full width, below Countries */}
      {travelNotesSection && (
        <section className="mx-auto mt-14 max-w-7xl px-6" data-testid="continent-travel-notes">
          <CountryAbout sections={[travelNotesSection]} />
        </section>
      )}

      <ContinentTravelToolkit
        regionName={destination.name}
        airports={airports}
        cities={childDestinations.filter((d) => d.type === 'city')}
      />

      {/* 3b. Interesting Facts + Top Travel Highlights — 2-col grid, below countries */}
      {(interestingFactsSection || topHighlightsSection || articles.length > 0) && (
        <section
          className="mx-auto mt-14 max-w-7xl px-6"
          data-testid="continent-facts-and-highlights"
        >
          <div className="grid gap-[3.5rem] lg:grid-cols-2">
            {interestingFactsSection && (
              <CountryAbout sections={[interestingFactsSection]} singleColumnBullets />
            )}
            {articles.length > 0 ? (
              <ContinentPostHighlights regionName={destination.name} articles={articles} />
            ) : topHighlightsSection ? (
              <CountryAbout sections={[topHighlightsSection]} singleColumnBullets />
            ) : null}
          </div>
        </section>
      )}

      {/* 4. Interesting Facts / Official Resources / other extras */}
      {extraSections.length > 0 && (
        <section className="mx-auto mt-12 max-w-7xl space-y-10 px-6" data-testid="continent-extras">
          {extraSections.map((s, i) => (
            <CountryAbout key={s.heading ?? `extra-${i}`} sections={[s]} singleColumnBullets />
          ))}
        </section>
      )}

      {/* 5. Stories */}
      {articles.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-6 pb-20" data-testid="continent-stories">
          <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
            <h2 className="editorial-h text-2xl font-bold text-forest-900 lg:text-2xl">
              Stories from {destination.name}
            </h2>
          </header>
          <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {articles.slice(0, 8).map((a) => (
              <ArticleCard key={a.id} article={a} size="compact" imageClassName="h-[200px]" />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function ContinentPostHighlights({
  regionName,
  articles,
}: {
  regionName: string;
  articles: Awaited<ReturnType<typeof listArticles>>['data'];
}) {
  const highlights = articles.slice(0, 4);

  return (
    <section data-testid="continent-top-travel-highlights">
      <div className="mb-6">
        <div className="kicker text-primary-highlight">Top Travel Highlights</div>
        <h2 className="editorial-h mt-3 text-2xl font-bold text-forest-900 lg:text-3xl">
          Fresh stories from {regionName}
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/75">
          Explore practical travel stories automatically gathered from countries and cities across {regionName}.
        </p>
      </div>
      <div className="grid gap-3">
        {highlights.map((article) => (
          <Link
            key={article.id}
            href={`/articles/${article.slug}`}
            className="group border-b border-forest-900/10 py-3"
          >
            <h3 className="editorial-h text-lg font-bold leading-tight text-forest-900 transition-colors group-hover:text-primary-highlight">
              {article.title}
            </h3>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ContinentTravelToolkit({
  regionName,
  airports,
  cities,
}: {
  regionName: string;
  airports: StrapiAirport[];
  cities: StrapiDestination[];
}) {
  const hubs = sortAirportsByHubPriority(airports).slice(0, 6);
  const featuredCities = cities.slice(0, 5);
  const timing = bestTimeToVisit(regionName);

  if (hubs.length === 0 && featuredCities.length === 0) return null;

  return (
    <section className="mx-auto mt-14 max-w-7xl px-6" data-testid="continent-travel-toolkit">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        {hubs.length > 0 && (
          <div className="rounded-[0.3rem] border border-forest-900/10 bg-white p-6 sm:p-8">
            <p className="section-eyebrow">
              <span className="inline-block h-px w-8 bg-primary-emphasis" />
              Major travel hubs
            </p>
            <h2 className="editorial-h mt-3 text-2xl font-bold text-2xl">
              Which airports are main gateways for {regionName}?
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-forest-900/72">
              Start with the airports that usually anchor long-haul arrivals, regional connections and onward city
              planning across {regionName}.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {hubs.map((airport) => (
                <Link
                  key={airport.id}
                  href={airportPath(airport, airports)}
                  className="group flex items-center justify-between gap-4 border-b border-forest-900/10 py-3"
                >
                  <span>
                    <span className="block font-urbanist text-base font-bold text-forest-950 group-hover:text-primary-highlight">
                      {airport.city || airport.name}
                    </span>
                    <span className="mt-1 block text-xs font-bold uppercase tracking-[0.16em] text-forest-900/55">
                      {airport.iata} · {airport.country}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-primary-emphasis">View</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-[0.3rem] border border-forest-900/10 bg-gradient-to-br from-[#f7fbff] via-white to-[#fff8e6] p-6 sm:p-8">
          <p className="section-eyebrow">
            <span className="inline-block h-px w-8 bg-primary-emphasis" />
            Best time to visit
          </p>
          <h2 className="editorial-h mt-3 text-2xl font-bold text-forest-950">
            When {regionName} is easiest to plan
          </h2>
          <p className="mt-3 text-base leading-7 text-forest-900/72">{timing.summary}</p>
          <div className="mt-6 space-y-4">
            {timing.notes.map((note) => (
              <div key={note.label} className="border-l-2 border-primary-emphasis pl-4">
                <h3 className="font-urbanist text-base font-bold text-forest-950">{note.label}</h3>
                <p className="mt-1 text-sm leading-6 text-forest-900/70">{note.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {featuredCities.length > 0 && (
        <div className="mt-6 rounded-[0.3rem] border border-forest-900/10 bg-white p-6 sm:p-8" data-testid="continent-featured-cities">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-eyebrow">
                <span className="inline-block h-px w-8 bg-primary-emphasis" />
                Featured cities
              </p>
              <h2 className="editorial-h mt-3 text-2xl font-bold text-forest-950">
                City guides across {regionName}
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-forest-900/70">
              Use these city pages to compare airports, routes, local planning context and related stories.
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {featuredCities.map((city) => (
              <Link
                key={city.id}
                href={`/destinations/${city.slug}`}
                className="group border-b border-forest-900/10 py-3"
              >
                <h3 className="font-urbanist text-lg font-bold text-forest-950 group-hover:text-primary-highlight">
                  {city.name}
                </h3>
                {city.countryCode && (
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-forest-900/55">
                    {city.countryCode}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function sortAirportsByHubPriority(airports: StrapiAirport[]) {
  const preferred = new Set([
    'ATL', 'PEK', 'PVG', 'HND', 'DXB', 'SIN', 'ICN', 'BKK', 'DEL', 'HKG',
    'LHR', 'CDG', 'AMS', 'FRA', 'MAD', 'IST', 'FCO', 'MUC',
    'JFK', 'LAX', 'ORD', 'DFW', 'DEN', 'YYZ', 'MEX',
    'GRU', 'BOG', 'SCL', 'LIM', 'EZE',
    'SYD', 'MEL', 'AKL', 'BNE',
    'JNB', 'ADD', 'CAI', 'NBO', 'CMN',
  ]);

  return [...airports].sort((a, b) => {
    const aPreferred = preferred.has(a.iata?.toUpperCase());
    const bPreferred = preferred.has(b.iata?.toUpperCase());
    if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;
    return (a.city || a.name).localeCompare(b.city || b.name);
  });
}

function bestTimeToVisit(regionName: string) {
  const byRegion: Record<string, { summary: string; notes: { label: string; body: string }[] }> = {
    Africa: {
      summary:
        'Africa works best when you plan around dry seasons, safari calendars, coastal heat and regional rainy periods rather than relying on one continent-wide weather rule.',
      notes: [
        { label: 'Dry-season travel', body: 'Often best for wildlife viewing and easier overland movement in many safari regions.' },
        { label: 'Coastal timing', body: 'North African, island and Indian Ocean trips can have very different beach seasons.' },
      ],
    },
    Asia: {
      summary:
        'Asia is easiest to plan by subregion: monsoon timing, mountain seasons, typhoon risk and holiday peaks can vary sharply between neighbouring countries.',
      notes: [
        { label: 'Shoulder seasons', body: 'Spring and autumn often balance weather, prices and crowds across many major city routes.' },
        { label: 'Holiday peaks', body: 'Lunar New Year, Golden Week and school holidays can change fares and hotel availability fast.' },
      ],
    },
    Europe: {
      summary:
        'Europe is usually most comfortable in spring and autumn, while summer brings the widest schedules but also heavier crowds and higher prices.',
      notes: [
        { label: 'City breaks', body: 'April to June and September to October are strong months for capitals and rail-linked trips.' },
        { label: 'Peak summer', body: 'Book earlier for Mediterranean beaches, island routes and school-holiday travel.' },
      ],
    },
    'North America': {
      summary:
        'North America rewards seasonal planning: winter, spring break, summer road trips and autumn city travel each shift prices and airport demand.',
      notes: [
        { label: 'Shoulder months', body: 'May, early June, September and October can be easier for cities, parks and cross-country flights.' },
        { label: 'Weather checks', body: 'Hurricane, wildfire and winter-storm seasons can affect routes in different parts of the region.' },
      ],
    },
    Oceania: {
      summary:
        'Oceania is often strongest from spring through autumn, but island weather, school holidays and long domestic distances make local timing important.',
      notes: [
        { label: 'Australia and New Zealand', body: 'Spring and autumn are useful for cities, coasts and easier road or flight connections.' },
        { label: 'Island travel', body: 'Check wet seasons and cyclone risk before booking Pacific island stays.' },
      ],
    },
    'South America': {
      summary:
        'South America needs route-by-route timing because Andes altitude, Amazon rainfall, Patagonia seasons and beach weather all follow different patterns.',
      notes: [
        { label: 'Southern summer', body: 'December to March is the main window for Patagonia and far-south outdoor trips.' },
        { label: 'Altitude and rain', body: 'Build flexibility into Andean and Amazon itineraries where weather can change plans quickly.' },
      ],
    },
  };

  return byRegion[regionName] ?? {
    summary:
      `Plan ${regionName} by matching the season to the countries, cities and routes you want most, then check local holiday periods before booking.`,
    notes: [
      { label: 'Compare subregions', body: 'Weather and pricing can change quickly across borders, coasts and inland routes.' },
      { label: 'Check major dates', body: 'Festivals, school holidays and event weeks can affect flights and hotels.' },
    ],
  };
}

function flagEmoji(code?: string): string {
  if (!code || code.length !== 2) return '🌍';
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function CountryChip({ country }: { country: StrapiCountry }) {
  return (
    <Link
      href={`/countries/${country.code}`}
      className="group flex items-center gap-3 rounded-lg border border-forest-900/10 bg-paper px-4 py-3 transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm"
      data-testid={`continent-country-${country.code}`}
    >
      <span className="text-2xl" aria-hidden>{flagEmoji(country.code)}</span>
      <div className="min-w-0 flex-1">
        <div className="font-urbanist text-sm font-bold text-forest-900 transition group-hover:text-forest-700">
          {country.name}
        </div>
        {country.currency && (
          <div className="mt-0.5 truncate text-xs text-forest-900/60">
            <span className="font-mono">{country.code}</span>
            <span className="ml-2">{country.currency}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

/**
 * Continent-flavoured facts panel. Reads the optional `facts` JSON on the
 * destination (populated by ai-writer-cli/enrich-region.js) and renders
 * whichever fields are present — missing rows hide silently so partial data
 * stays clean.
 */
type ContinentFacts = {
  countriesCount?: number;
  population?: number;
  areaKm2?: number;
  languagesTop?: string[];
  currenciesTop?: string[];
  largestCountry?: string;
  largestByArea?: string;
  highestPoint?: string;
  longestRiver?: string;
  timezoneSpan?: string;
  subregions?: string[];
};

function ContinentPlanningContent({
  destination,
  facts,
  countriesCount,
  articlesCount,
}: {
  destination: StrapiDestination;
  facts: ContinentFacts;
  countriesCount: number;
  articlesCount: number;
}) {
  const angle = continentPlanningAngle(destination.name);
  const countryLabel = `${countriesCount.toLocaleString()} countr${countriesCount === 1 ? 'y' : 'ies'}`;
  const storyLabel = `${articlesCount.toLocaleString()} related stor${articlesCount === 1 ? 'y' : 'ies'}`;
  const scaleParts = [
    facts.population
      ? `about ${formatContinentPopulation(facts.population)} people`
      : null,
    facts.areaKm2
      ? `${facts.areaKm2.toLocaleString()} km²`
      : null,
  ].filter(Boolean);
  const scaleSentence = scaleParts.length
    ? `${destination.name} covers ${scaleParts.join(' across ')}, so distance, season, and route choice matter more than a single headline itinerary.`
    : `${destination.name} is too varied for one generic itinerary, so distance, season, and route choice matter more than a single headline plan.`;

  return (
    <section
      className="mx-auto mt-14 max-w-7xl px-6"
      data-testid="continent-planning-content"
      aria-labelledby="continent-planning-heading"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
        <div className="rounded-[0.3rem] border border-forest-900/10 bg-white p-6 sm:p-8">
          <p className="section-eyebrow">
            <span className="inline-block h-px w-8 bg-forest-800/60" />
            Regional planning guide
          </p>
          <h2
            id="continent-planning-heading"
            className="editorial-h mt-3 text-3xl font-bold text-forest-950"
          >
            How to plan travel across {destination.name}
          </h2>
          <div className="mt-5 grid gap-5 text-base font-normal leading-7 text-forest-900/75 md:grid-cols-2">
            <p>
              {scaleSentence} Use this page to move from a broad regional idea into the countries,
              cities, airports, airlines, routes, and stories that make the trip practical.
            </p>
            <p>
              OriginFacts currently connects {countryLabel} and {storyLabel} to this region. That
              helps you compare where coverage is strongest, which gateways appear most often, and
              whether a route is better planned as a direct arrival, a stopover, or a multi-country
              journey.
            </p>
          </div>
        </div>

        <aside className="rounded-[0.3rem] border border-forest-900/10 bg-[#f8fafc] p-6">
          <h3 className="font-urbanist text-xl font-bold leading-tight text-forest-950">
            Best planning angle
          </h3>
          <p className="mt-3 text-sm font-normal leading-7 text-forest-900/70">{angle.summary}</p>
          <ul className="mt-5 space-y-3 text-sm font-normal leading-6 text-forest-900/70">
            {angle.points.map((point) => (
              <li key={point} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-emphasis" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

function formatContinentPopulation(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} billion`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000).toLocaleString()} million`;
  return value.toLocaleString();
}

function continentPlanningAngle(name: string) {
  const angles: Record<string, { summary: string; points: string[] }> = {
    Africa: {
      summary:
        'Plan around gateway cities, visa differences, and long overland distances rather than assuming neighbouring countries are simple add-ons.',
      points: [
        'Check regional hubs before choosing a first arrival city.',
        'Compare dry and wet seasons by country, not continent.',
        'Leave margin for multi-country flights and border formalities.',
      ],
    },
    Asia: {
      summary:
        'Asia rewards route planning: major hubs can make long trips cheap, but climate, visa rules, and airport transfers vary sharply by country.',
      points: [
        'Use hub airports to compare direct flights and stopovers.',
        'Check monsoon, heat, and festival periods before booking.',
        'Treat big metro areas as multi-airport destinations.',
      ],
    },
    Europe: {
      summary:
        'Europe is best planned by mixing rail, low-cost flights, and major airport hubs, especially when several countries sit within one trip.',
      points: [
        'Compare city-centre arrival time against cheaper secondary airports.',
        'Group countries by transport links, not only geography.',
        'Watch baggage rules on short-haul low-cost carriers.',
      ],
    },
    'North America': {
      summary:
        'North America is easier when you plan around flight hubs, domestic distances, and seasonal weather that can reshape routes quickly.',
      points: [
        'Check whether a hub airport adds useful onward options.',
        'Allow extra time for domestic connections and immigration.',
        'Compare city stays with airport-area hotels for early flights.',
      ],
    },
    Oceania: {
      summary:
        'Oceania trips depend heavily on flight timing, island connections, and long distances between countries that look close on a map.',
      points: [
        'Plan island hops around limited weekly flight schedules.',
        'Compare Australia and New Zealand gateways before committing.',
        'Build weather flexibility into beach and outdoor itineraries.',
      ],
    },
    'South America': {
      summary:
        'South America works best when routes are planned through major hubs and climate zones, because mountains, rainforest, and coastlines change travel time fast.',
      points: [
        'Use hub cities to avoid awkward backtracking.',
        'Check altitude, wet season, and domestic flight reliability.',
        'Keep extra margin for long bus or regional-airline legs.',
      ],
    },
  };

  return angles[name] ?? {
    summary:
      'Use this regional page as a planning layer before choosing countries, airports, routes, and city guides.',
    points: [
      'Start broad, then narrow by country and city.',
      'Compare airports before choosing the cheapest fare.',
      'Use related stories for practical trip details.',
    ],
  };
}

function ContinentFactsPanel({
  destination,
  countriesCount,
  articlesCount,
}: {
  destination: StrapiDestination;
  countriesCount: number;
  articlesCount: number;
}) {
  const facts: ContinentFacts = (destination.facts as ContinentFacts | undefined) ?? {};
  const fmtNum = (n: number) => n.toLocaleString();
  const fmtPop = (n: number) =>
    n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(2)}B` :
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(0)}M` :
    n.toLocaleString();

  const rows: { label: string; value: string }[] = [];
  rows.push({ label: 'Countries', value: fmtNum(facts.countriesCount ?? countriesCount) });
  if (facts.population != null) rows.push({ label: 'Population', value: fmtPop(facts.population) });
  if (facts.areaKm2 != null) rows.push({ label: 'Area', value: `${fmtNum(facts.areaKm2)} km²` });
  if (facts.largestCountry) rows.push({ label: 'Largest (pop.)', value: facts.largestCountry });
  if (facts.largestByArea) rows.push({ label: 'Largest (area)', value: facts.largestByArea });
  if (facts.languagesTop?.length) rows.push({ label: 'Top languages', value: facts.languagesTop.join(', ') });
  if (facts.highestPoint) rows.push({ label: 'Highest point', value: facts.highestPoint });
  if (facts.longestRiver) rows.push({ label: 'Longest river', value: facts.longestRiver });
  if (facts.timezoneSpan) rows.push({ label: 'Time zones', value: facts.timezoneSpan });
  rows.push({ label: 'Stories', value: fmtNum(articlesCount) });

  return (
    <aside
      data-testid="continent-facts-panel"
      className="self-start rounded-lg border border-forest-900/10 bg-paper/80 p-6"
    >
      <p className="text-xs uppercase tracking-widest text-forest-900/60">
        {destination.name} at a glance
      </p>
      <dl className="mt-4 divide-y divide-forest-900/10 text-sm">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0"
          >
            <dt className="text-xs uppercase tracking-widest text-forest-900/60">{r.label}</dt>
            <dd className="text-right font-urbanist font-bold text-forest-900">{r.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
