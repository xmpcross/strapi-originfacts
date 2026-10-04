// The city guide layout: rendered for cities that have a written guide in
// data/destination-guides (see lib/destination-guides.ts). Other cities keep
// CityDestinationPage in page.tsx.
import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';
import FlightSearchCTA from '@/components/FlightSearchCTA';
import KeyFacts from '@/components/KeyFacts';
import MoreStoriesList from '@/components/MoreStoriesList';
import PopularHotelsByCity from '@/components/PopularHotelsByCity';
import destinationCoordinates from '@/data/destination-coordinates.json';
import { airportPath } from '@/lib/airport-slugs';
import { operableCarriers } from '@/lib/route-carriers';
import type { listArticles, listRoutesToDestination, StrapiAirport, StrapiDestination } from '@/lib/strapi';
import {
  countryNameFromCode,
  formatList,
  GetYourGuideActivityWidget,
  parseAboutSections,
  RouteCard,
  unique,
} from './destination-shared';
import { DestinationHero, GuideSections, SectionNav } from './guide-ui';

export default function CityGuidePage({
  destination,
  hero,
  heroDescription,
  countryHref,
  routes,
  airports: cmsAirports,
  articles,
  activityQuery,
  faqBlock,
  hasFaqs,
}: {
  destination: StrapiDestination;
  hero: string | null;
  heroDescription: string;
  countryHref?: string;
  routes: Awaited<ReturnType<typeof listRoutesToDestination>>;
  airports: StrapiAirport[];
  articles: Awaited<ReturnType<typeof listArticles>>['data'];
  activityQuery: string;
  faqBlock: React.ReactNode;
  hasFaqs: boolean;
}) {
  // The airport most tracked routes land at leads: the CMS order put Don Mueang
  // ahead of Suvarnabhumi for Bangkok, though every tracked route flies to BKK.
  const arrivals = (iata: string) => routes.filter((r) => r.destination?.iata === iata).length;
  const airports = [...cmsAirports].sort((a, b) => arrivals(b.iata) - arrivals(a.iata));
  const destIata = airports[0]?.iata || routes.find((r) => r.destination?.iata)?.destination?.iata;
  const country = airports.find((airport) => airport.country)?.country || countryNameFromCode(destination.countryCode);
  const flightSearchHref = destIata ? `/flight-search?destination=${encodeURIComponent(destIata)}` : '/flight-search';

  // Only link sections that render: stories, routes and airports are empty for
  // part of the catalogue, and FaqSection renders nothing under two Q&As.
  const guide = parseAboutSections(destination.description ?? '').filter((s) => s.heading);
  const sections = [
    guide.length > 0 && { id: 'guide', label: 'Guide' },
    articles.length > 0 && { id: 'stories', label: 'Stories' },
    { id: 'hotels', label: 'Hotels' },
    (airports.length > 0 || routes.length > 0) && { id: 'getting-there', label: 'Getting there' },
    { id: 'things-to-do', label: 'Things to do' },
    hasFaqs && { id: 'faq', label: 'FAQ' },
  ].filter((s): s is { id: string; label: string } => Boolean(s));

  return (
    <article className="city-destination-page" data-testid={`destination-page-${destination.slug}`}>
      <DestinationHero
        hero={hero}
        title={destination.name}
        lead={heroDescription}
        crumbs={[{ label: 'Destinations', href: '/destinations' }, ...(country ? [{ label: country, href: countryHref }] : [])]}
        actions={[
          { label: destIata ? `Search flights to ${destIata}` : 'Search flights', href: flightSearchHref, primary: true },
          { label: 'Compare hotels', href: '#hotels' },
        ]}
      />
      <SectionNav label={`${destination.name} guide sections`} sections={sections} />

      <section className="mx-auto max-w-7xl px-6 pt-10" data-testid="city-overview-panel">
        <CityGlance destination={destination} country={country} countryHref={countryHref} airports={airports} routes={routes} articlesCount={articles.length} />
        <div className="mt-6">
          <KeyFacts tldr={destination.tldr} keyFacts={destination.keyFacts} title={`${destination.name} at a glance`} />
        </div>
      </section>

      <GuideSections name={destination.name} sections={guide} />
      <CityStoriesSection destination={destination} articles={articles} />
      <CityPopularHotelsSection destination={destination} airports={airports} />
      <CityGettingThereSection destination={destination} airports={airports} routes={routes} />

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

      <div id="things-to-do" className="mx-auto max-w-7xl scroll-mt-28 px-6">
        <GetYourGuideActivityWidget destination={destination} query={activityQuery} />
      </div>

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

function CityGlance({
  destination,
  country,
  countryHref,
  airports,
  routes,
  articlesCount,
}: {
  destination: StrapiDestination;
  country: string;
  countryHref?: string;
  airports: StrapiAirport[];
  routes: Awaited<ReturnType<typeof listRoutesToDestination>>;
  articlesCount: number;
}) {
  const primaryAirport = airports[0];
  const timezone = airports.find((airport) => airport.timezone)?.timezone;
  const items = [
    country && { label: 'Country', value: country, href: countryHref },
    primaryAirport && {
      label: airports.length > 1 ? `Main airport (of ${airports.length})` : 'Airport',
      value: `${primaryAirport.name} (${primaryAirport.iata})`,
      href: airportPath(primaryAirport, airports),
    },
    timezone && { label: 'Time zone', value: timezone.replace(/_/g, ' ') },
    routes.length > 0 && {
      label: 'Tracked routes',
      value: `${routes.length} inbound route${routes.length === 1 ? '' : 's'}`,
      href: '#getting-there',
    },
    articlesCount > 0 && {
      label: 'Originfacts stories',
      value: `${articlesCount} stor${articlesCount === 1 ? 'y' : 'ies'}`,
      href: '#stories',
    },
  ].filter((item): item is { label: string; value: string; href?: string } => Boolean(item));

  if (items.length === 0) return null;

  return (
    <dl
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-forest-900/10 bg-forest-900/10 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none"
      aria-label={`${destination.name} at a glance`}
      data-testid="city-glance"
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`bg-white p-4 sm:p-5 ${items.length % 2 === 1 && i === items.length - 1 ? 'col-span-2 lg:col-span-1' : ''}`}
        >
          <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-forest-900/50">{item.label}</dt>
          <dd className="mt-1.5 text-base font-bold leading-snug text-forest-950">
            {item.href ? (
              <Link href={item.href} className="hover:text-primary-emphasis hover:underline">{item.value}</Link>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CityStoriesSection({
  destination,
  articles,
}: {
  destination: StrapiDestination;
  articles: Awaited<ReturnType<typeof listArticles>>['data'];
}) {
  if (articles.length === 0) return null;
  const [lead, ...rest] = articles;
  const side = rest.slice(0, 4);

  return (
    <section id="stories" className="mx-auto max-w-7xl scroll-mt-28 px-6 pt-14" data-testid="city-stories">
      <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
        <h2 className="editorial-h text-2xl font-bold text-forest-950 lg:text-3xl">
          Read before you go to {destination.name}
        </h2>
        <span className="text-sm text-forest-900/55">
          {articles.length} stor{articles.length === 1 ? 'y' : 'ies'}
        </span>
      </header>
      <div className={`mt-8 grid gap-8 ${side.length > 0 ? 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]' : 'max-w-3xl'}`}>
        <ArticleCard article={lead} size="lg" />
        {side.length > 0 && (
          <div className="grid content-start gap-6 sm:grid-cols-2">
            {side.map((article) => (
              <ArticleCard key={article.id} article={article} size="compact" />
            ))}
          </div>
        )}
      </div>
      {articles.length > 5 && (
        <MoreStoriesList articles={articles.slice(5)} title={`More stories from ${destination.name}`} />
      )}
    </section>
  );
}

function CityGettingThereSection({
  destination,
  airports,
  routes,
}: {
  destination: StrapiDestination;
  airports: StrapiAirport[];
  routes: Awaited<ReturnType<typeof listRoutesToDestination>>;
}) {
  if (airports.length === 0 && routes.length === 0) return null;
  const carriers = unique(routes.flatMap((route) => operableCarriers(route).map((carrier) => carrier.name)));

  return (
    <section id="getting-there" className="mx-auto max-w-7xl scroll-mt-28 px-6 pt-14" data-testid="city-getting-there">
      <header className="border-b border-forest-900/10 pb-3">
        <h2 className="editorial-h text-2xl font-bold text-forest-950 lg:text-3xl">
          Getting to {destination.name}
        </h2>
      </header>
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {airports.length > 0 && (
          <div data-testid="city-airports">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-emphasis">
              {airports.length === 1 ? 'Airport' : `${airports.length} airports`}
            </h3>
            <ul className="mt-4 space-y-3">
              {airports.map((airport) => (
                <li key={airport.id}>
                  <Link
                    href={airportPath(airport, airports)}
                    className="flex items-center gap-4 rounded-lg border border-forest-900/10 bg-paper p-4 transition hover:border-forest-900/30 hover:shadow-sm"
                  >
                    <span className="rounded bg-forest-950 px-2 py-1 font-mono text-sm font-bold text-white">{airport.iata}</span>
                    <span className="text-sm font-bold leading-snug text-forest-950">{airport.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div data-testid="destination-routes" className={airports.length === 0 ? 'lg:col-span-2' : ''}>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-emphasis">
            {routes.length > 0 ? `${routes.length} tracked route${routes.length === 1 ? '' : 's'}` : 'Routes'}
          </h3>
          {routes.length > 0 ? (
            <>
              {carriers.length > 0 && (
                <p className="mt-3 text-sm leading-6 text-forest-900/70">
                  Flown by {formatList(carriers.slice(0, 5))}
                  {carriers.length > 5 ? ` and ${carriers.length - 5} more` : ''}.
                </p>
              )}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {routes.map((route) => (
                  <RouteCard key={route.id} r={route} />
                ))}
              </div>
              <Link href="/flight-routes" className="mt-5 inline-block text-sm font-medium text-forest-700 hover:underline">
                Browse all routes →
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-forest-900/70">
              No routes into {destination.name} are tracked yet. Live fares are still available from flight search.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
