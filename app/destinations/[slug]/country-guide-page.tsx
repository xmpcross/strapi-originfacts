// The country template: hero, fact strip, the country's written guide as a
// card of sections, then cities, airports and airlines, flights, activities,
// stories and FAQs. Every country renders it; the guide comes from the CMS
// description (an intro paragraph, then `## ` sections).
import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';
import CountryDetailSections from '@/components/CountryDetailSections';
import { toCountryAirlineItems, toCountryAirportItems } from '@/lib/country-lists';
import KeyFacts from '@/components/KeyFacts';
import MoreStoriesList from '@/components/MoreStoriesList';
import { type CountryFacts, flagImageUrl, formatPopulation, getCountryFacts } from '@/lib/country-facts';
import {
  listArticles,
  listRoutesToDestination,
  mediaUrl,
  type StrapiAirline,
  type StrapiAirport,
  type StrapiDestination,
} from '@/lib/strapi';
import { buildActivityWidgetQuery, GetYourGuideActivityWidget, parseAboutSections, RouteCard } from './destination-shared';
import { DestinationHero, GuideSections, SectionNav } from './guide-ui';
import { getDestinationGuide } from '@/lib/destination-guides';

export default function CountryGuidePage({
  destination,
  hero,
  airports,
  airlines,
  routes,
  articles,
  cities,
  faqBlock,
  hasFaqs,
}: {
  destination: StrapiDestination;
  hero: string | null;
  airports: StrapiAirport[];
  airlines: StrapiAirline[];
  routes: Awaited<ReturnType<typeof listRoutesToDestination>>;
  articles: Awaited<ReturnType<typeof listArticles>>['data'];
  cities: StrapiDestination[];
  faqBlock: React.ReactNode;
  hasFaqs: boolean;
}) {
  const sections = parseAboutSections(destination.description ?? '');
  const guide = sections.filter((s) => s.heading);
  const intro = sections.find((s) => !s.heading)?.paragraphs.join(' ');
  const lead = intro || guide.find((s) => s.heading === 'Overview')?.paragraphs[0];
  // Prefer Strapi-stored facts (populated by enrich-country-content.js),
  // fall back to the static lookup in lib/country-facts.ts.
  const facts = destination.facts ?? getCountryFacts(destination.countryCode);
  const activityQuery = buildActivityWidgetQuery(destination, routes);

  // Only link sections that render.
  const nav = [
    guide.length > 0 && { id: 'guide', label: 'Guide' },
    cities.length > 0 && { id: 'cities', label: 'Cities' },
    (airports.length > 0 || airlines.length > 0) && { id: 'airports', label: 'Airports & airlines' },
    routes.length > 0 && { id: 'flights', label: 'Flights' },
    { id: 'things-to-do', label: 'Things to do' },
    articles.length > 0 && { id: 'stories', label: 'Stories' },
    hasFaqs && { id: 'faq', label: 'FAQ' },
  ].filter((s): s is { id: string; label: string } => Boolean(s));

  return (
    <article data-testid={`destination-page-${destination.slug}`} data-hide-fixed-sidebars="true">
      <DestinationHero
        hero={hero}
        title={destination.name}
        lead={lead}
        crumbs={[{ label: 'Destinations', href: '/destinations' }, { label: 'Countries', href: '/countries' }]}
        actions={[
          { label: 'Search flights', href: '/flight-search', primary: true },
          ...(cities.length > 0 ? [{ label: `Cities in ${destination.name}`, href: '#cities' }] : []),
        ]}
      />
      <SectionNav label={`${destination.name} guide sections`} sections={nav} />

      <section className="mx-auto max-w-7xl px-6 pt-10" data-testid="country-overview-panel">
        <CountryGlance countryCode={destination.countryCode} facts={facts} />
        <div className="mt-6">
          <KeyFacts tldr={destination.tldr} keyFacts={destination.keyFacts} title={`${destination.name} at a glance`} />
        </div>
      </section>

      <GuideSections name={destination.name} sections={guide} />

      <CountryCitiesSection country={destination} cities={cities} />

      {(airports.length > 0 || airlines.length > 0) && (
        <div id="airports" className="scroll-mt-28">
          <CountryDetailSections
            countryName={destination.name}
            airports={toCountryAirportItems(airports)}
            airlines={toCountryAirlineItems(airlines)}
          />
        </div>
      )}

      {routes.length > 0 && (
        <section id="flights" className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6" data-testid="destination-routes">
          <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
            <h2 className="editorial-h text-2xl font-bold text-forest-950 lg:text-3xl">Flights to {destination.name}</h2>
            <span className="text-sm text-forest-900/55">
              {routes.length} route{routes.length === 1 ? '' : 's'}
            </span>
          </header>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {routes.slice(0, 4).map((r) => (
              <RouteCard key={r.id} r={r} />
            ))}
          </div>
          <Link href="/flight-routes" className="mt-5 inline-block text-sm font-medium text-forest-700 hover:underline">
            Browse all routes →
          </Link>
        </section>
      )}

      <div id="things-to-do" className="mx-auto max-w-7xl scroll-mt-28 px-6">
        <GetYourGuideActivityWidget destination={destination} query={activityQuery} />
      </div>

      {articles.length > 0 && (
        <section id="stories" className="mx-auto mt-4 max-w-7xl scroll-mt-28 px-6" data-testid="destination-stories">
          <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
            <h2 className="editorial-h text-2xl font-bold text-forest-950 lg:text-3xl">Stories from {destination.name}</h2>
            <span className="text-sm text-forest-900/55">
              {articles.length} stor{articles.length === 1 ? 'y' : 'ies'}
            </span>
          </header>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {articles.slice(0, 4).map((a) => (
              <ArticleCard key={a.id} article={a} size="compact" imageClassName="h-[200px]" />
            ))}
          </div>
          {articles.length > 4 && (
            <MoreStoriesList articles={articles.slice(4)} title={`More stories from ${destination.name}`} />
          )}
        </section>
      )}

      {faqBlock}
      <div className="pb-20" />
    </article>
  );
}

/** The country's quick facts as one strip, flag first. Missing facts are skipped. */
function CountryGlance({ countryCode, facts }: { countryCode?: string; facts: CountryFacts | null }) {
  const flag = flagImageUrl(countryCode);
  const items = [
    facts?.capital && { label: 'Capital', value: facts.capital },
    facts?.currencyCode && {
      label: 'Currency',
      value: facts.currencyName ? `${facts.currencyName} (${facts.currencyCode})` : facts.currencyCode,
    },
    facts?.languages?.length && {
      label: facts.languages.length > 1 ? 'Languages' : 'Language',
      value: facts.languages.join(', '),
    },
    facts?.population != null && { label: 'Population', value: formatPopulation(facts.population) },
    facts?.timezones && { label: 'Time zone', value: facts.timezones },
    facts?.drivesOn && { label: 'Drives on the', value: facts.drivesOn === 'left' ? 'Left' : 'Right' },
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  if (items.length === 0) return null;

  return (
    <dl
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-forest-900/10 bg-forest-900/10 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none"
      data-testid="country-glance"
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`bg-white p-4 sm:p-5 ${items.length % 2 === 1 && i === items.length - 1 ? 'col-span-2 lg:col-span-1' : ''}`}
        >
          <dt className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-forest-900/50">
            {i === 0 && flag && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={flag} alt="" width={20} height={14} className="h-3.5 w-5 rounded-[2px] object-cover" />
            )}
            {item.label}
          </dt>
          <dd className="mt-1.5 text-base font-bold leading-snug text-forest-950">{item.value}</dd>
        </div>
      ))}
    </dl>
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
      id="cities"
      className="mx-auto mt-16 max-w-7xl scroll-mt-28 overflow-hidden rounded-[0.3rem] border border-forest-900/10 bg-gradient-to-br from-white via-[#f7fbff] to-[#fff8e6] px-6 py-8 sm:px-8"
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
        </div>
        <div className="border-l-2 border-primary-emphasis pl-5">
          <div className="text-4xl font-bold leading-none text-forest-900">
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
          <h5 className="truncate text-2xl font-bold leading-none !text-white drop-shadow-sm">
            {city.name}
          </h5>
          {description && (
            <p
              className="mt-3 line-clamp-3 max-w-md text-sm font-normal leading-6"
              style={{ color: '#e5e5e5' }}
            >
              {description}
            </p>
          )}
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

/** The card's blurb: the city's written guide intro, else its CMS description's first paragraph. */
function cityCardDescription(city: StrapiDestination) {
  const source = getDestinationGuide(city.slug)?.description ?? city.description;
  const firstParagraph = source
    ?.replace(/#{1,6}\s+/g, '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .find(Boolean);
  // No template fallback: the same sentence on every card is boilerplate.
  return firstParagraph?.replace(/\s+/g, ' ') ?? '';
}
