// The city guide layout: rendered for cities that have a written guide in
// data/destination-guides (see lib/destination-guides.ts). Other cities keep
// CityDestinationPage in page.tsx.
import { Fragment } from 'react';
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
  type AboutSection,
} from './destination-shared';

type HeroCrumb = { label: string; href?: string };
type HeroAction = { label: string; href: string; primary?: boolean };

/** Hero shared by the city, country and continent templates. */
function DestinationHero({
  hero,
  title,
  lead,
  crumbs,
  actions = [],
}: {
  hero: string | null;
  title: string;
  lead?: string;
  crumbs: HeroCrumb[];
  actions?: HeroAction[];
}) {
  return (
    <section className="relative overflow-hidden bg-forest-950">
      {hero && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hero} alt={title} className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/55 to-forest-950/10" />
      <div className="relative mx-auto flex min-h-[460px] max-w-7xl flex-col justify-end px-6 pb-12 pt-24 text-white sm:min-h-[520px]">
        <nav aria-label="Breadcrumb" className="text-xs font-semibold text-white/75">
          {crumbs.map((crumb, i) => (
            <Fragment key={crumb.label}>
              {i > 0 && <span className="mx-2 text-white/40">/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-white hover:underline">{crumb.label}</Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
        <h1 className="editorial-h mt-4 text-4xl font-bold leading-tight !text-[#ffffff] sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {lead && <p className="mt-5 max-w-3xl text-lg leading-8 text-white/90">{lead}</p>}
        {actions.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-3">
            {actions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={
                  action.primary
                    ? 'rounded-full bg-white px-5 py-2.5 text-sm font-bold text-forest-950 transition hover:bg-sand-100'
                    : 'rounded-full border border-white/40 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10'
                }
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Jump links under the hero. Callers pass only sections that render. */
function SectionNav({ label, sections }: { label: string; sections: { id: string; label: string }[] }) {
  if (sections.length < 2) return null;
  return (
    <nav aria-label={label} className="border-b border-forest-900/10 bg-paper" data-testid="destination-section-nav">
      <div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-6 text-sm font-semibold text-forest-900/70">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="shrink-0 border-b-2 border-transparent py-4 hover:border-primary-emphasis hover:text-forest-950">
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

const sectionAnchor = (heading: string) =>
  heading.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type GuideKind = 'stay' | 'todo' | 'around' | 'when' | 'tips' | 'other';

const GUIDE_KINDS: { prefix: string; kind: GuideKind; label: string }[] = [
  { prefix: 'Where to stay', kind: 'stay', label: 'Where to stay' },
  { prefix: 'Things to do', kind: 'todo', label: 'Things to do' },
  { prefix: 'Getting around', kind: 'around', label: 'Getting around' },
  { prefix: 'When to visit', kind: 'when', label: 'When to visit' },
  { prefix: 'Practical tips', kind: 'tips', label: 'Tips' },
];

function guideKind(heading: string) {
  return GUIDE_KINDS.find((k) => heading.startsWith(k.prefix)) ?? { kind: 'other' as const, label: heading };
}

// Heroicons outline paths (MIT), drawn at 24×24.
const GUIDE_ICON_PATHS: Record<GuideKind, string[]> = {
  stay: ['M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25'],
  todo: ['M15 10.5a3 3 0 11-6 0 3 3 0 016 0z', 'M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z'],
  around: ['M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5'],
  when: ['M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z'],
  tips: ['M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18'],
  other: ['M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25'],
};

function GuideIcon({ kind, className }: { kind: GuideKind; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {GUIDE_ICON_PATHS[kind].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const isBulletList = (paragraph: string) => {
  const lines = paragraph.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length > 1 && lines.every((l) => /^[-*]\s+/.test(l));
};

/** One guide section's body: prose paragraphs, or a bullet list as tip cards. */
function GuideBody({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="space-y-5">
      {paragraphs.map((p) =>
        isBulletList(p) ? (
          <ul key={p} className="grid gap-3 sm:grid-cols-2">
            {p.split('\n').map((l) => l.trim().replace(/^[-*]\s+/, '')).filter(Boolean).map((tip) => (
              <li key={tip} className="flex gap-3 rounded-xl border border-forest-900/10 bg-forest-50/60 p-4 text-[15px] leading-6 text-forest-900/80">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary-emphasis">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={p} className="leading-8 text-forest-900/80">{p}</p>
        ),
      )}
    </div>
  );
}

/** A destination's written guide: its `## ` sections, one row each, with jump chips. */
function GuideSections({ name, sections }: { name: string; sections: AboutSection[] }) {
  if (sections.length === 0) return null;
  return (
    <section id="guide" className="mx-auto max-w-7xl scroll-mt-28 px-6 pt-14" data-testid="destination-guide">
      <div className="overflow-hidden rounded-2xl border border-forest-900/10 bg-white">
        <header className="flex flex-col gap-5 border-b border-forest-900/10 bg-gradient-to-br from-forest-50 via-white to-sand-50 px-6 py-7 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-emphasis">Travel guide</div>
            <div className="editorial-h mt-2 text-2xl font-bold text-forest-950 sm:text-3xl">The {name} guide</div>
          </div>
          <nav aria-label="In this guide" className="flex flex-wrap gap-2">
            {sections.map((section) => {
              const { kind, label } = guideKind(section.heading ?? '');
              return (
                <a
                  key={section.heading}
                  href={`#${sectionAnchor(section.heading ?? '')}`}
                  className="inline-flex items-center gap-2 rounded-full border border-forest-900/15 bg-white px-3.5 py-2 text-sm font-semibold text-forest-900/80 transition hover:border-primary-emphasis hover:text-primary-emphasis"
                >
                  <GuideIcon kind={kind} className="h-4 w-4" />
                  {label}
                </a>
              );
            })}
          </nav>
        </header>

        <div className="divide-y divide-forest-900/10">
          {sections.map((section, i) => {
            const { kind } = guideKind(section.heading ?? '');
            return (
              <article
                key={section.heading}
                id={sectionAnchor(section.heading ?? '')}
                className="grid scroll-mt-28 gap-5 px-6 py-9 sm:px-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12 lg:py-12"
              >
                <div className="lg:sticky lg:top-28 lg:self-start">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-hover text-primary-emphasis">
                      <GuideIcon kind={kind} className="h-6 w-6" />
                    </span>
                    <span className="text-sm font-bold tabular-nums text-forest-900/35">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <h2 className="editorial-h mt-4 text-2xl font-bold leading-tight text-forest-950">{section.heading}</h2>
                </div>
                <GuideBody paragraphs={section.paragraphs} />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

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
