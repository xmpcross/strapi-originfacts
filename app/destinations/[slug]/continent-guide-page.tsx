// The continent template: hero, fact strip, the continent's written guide
// as a card of sections, then its countries, gateway airports and city
// guides, stories and FAQs. Built from the CMS description and facts plus
// the per-continent planning and timing notes below.
import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';
import ContinentCountriesGrid from '@/components/ContinentCountriesGrid';
import KeyFacts from '@/components/KeyFacts';
import MoreStoriesList from '@/components/MoreStoriesList';
import { airportPath } from '@/lib/airport-slugs';
import type { listArticles, StrapiAirport, StrapiCountry, StrapiDestination } from '@/lib/strapi';
import { parseAboutSections, type AboutSection } from './destination-shared';
import { DestinationHero, GuideSections, SectionNav } from './guide-ui';

export default function ContinentGuidePage({
  destination,
  hero,
  countries,
  airports,
  childDestinations,
  articles,
  faqBlock,
  hasFaqs,
}: {
  destination: StrapiDestination;
  hero: string | null;
  countries: StrapiCountry[];
  airports: StrapiAirport[];
  childDestinations: StrapiDestination[];
  articles: Awaited<ReturnType<typeof listArticles>>['data'];
  faqBlock: React.ReactNode;
  hasFaqs: boolean;
}) {
  const name = destination.name;
  const sections = parseAboutSections(destination.description ?? '');
  const named = sections.filter((s) => s.heading);
  const intro = sections.find((s) => !s.heading)?.paragraphs.join(' ');
  const facts = (destination.facts as ContinentFacts | undefined) ?? {};

  // The guide: the CMS sections. A description without researched "Getting
  // around" / "When to visit" sections gets the template's planning and timing
  // notes slotted in before the facts list instead.
  const factsSections = named.filter((s) => s.heading?.startsWith('Interesting Facts'));
  const researched = named.some((s) => s.heading?.startsWith('When to visit') || s.heading?.startsWith('Getting around'));
  const guide: AboutSection[] = [
    ...named.filter((s) => !s.heading?.startsWith('Interesting Facts')),
    ...(researched ? [] : [planningSection(name, facts), timingSection(name)]),
    ...factsSections,
  ];

  const countryHrefByCode: Record<string, string> = {};
  for (const d of childDestinations) {
    if (d.type === 'country' && d.countryCode && d.slug) countryHrefByCode[d.countryCode.toUpperCase()] = `/destinations/${d.slug}`;
  }
  const hubs = sortAirportsByHubPriority(airports).slice(0, 8);
  const cities = childDestinations.filter((d) => d.type === 'city');

  const nav = [
    { id: 'guide', label: 'Guide' },
    countries.length > 0 && { id: 'countries', label: 'Countries' },
    (hubs.length > 0 || cities.length > 0) && { id: 'gateways', label: 'Gateways & cities' },
    articles.length > 0 && { id: 'stories', label: 'Stories' },
    hasFaqs && { id: 'faq', label: 'FAQ' },
  ].filter((s): s is { id: string; label: string } => Boolean(s));

  return (
    <article data-testid={`destination-page-${destination.slug}`}>
      <DestinationHero
        hero={hero}
        title={name}
        lead={intro || named.find((s) => s.heading === 'Overview')?.paragraphs[0]}
        crumbs={[{ label: 'Destinations', href: '/destinations' }]}
        actions={[
          ...(countries.length > 0 ? [{ label: `Countries in ${name}`, href: '#countries', primary: true }] : []),
          { label: 'Search flights', href: '/flight-search', primary: countries.length === 0 },
        ]}
      />
      <SectionNav label={`${name} guide sections`} sections={nav} />

      <section className="mx-auto max-w-7xl px-6 pt-10" data-testid="continent-overview-panel">
        <ContinentGlance facts={facts} countriesCount={countries.length} />
        <div className="mt-6">
          <KeyFacts tldr={destination.tldr} keyFacts={destination.keyFacts} title={`${name} at a glance`} />
        </div>
      </section>

      <GuideSections name={name} sections={guide} />

      {countries.length > 0 && (
        <div id="countries" className="scroll-mt-28">
          <ContinentCountriesGrid countries={countries} regionName={name} hrefByCode={countryHrefByCode} />
        </div>
      )}

      <ContinentGateways name={name} hubs={hubs} allAirports={airports} cities={cities} />

      {articles.length > 0 && (
        <section id="stories" className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6" data-testid="continent-stories">
          <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
            <h2 className="editorial-h text-2xl font-bold text-forest-950 lg:text-3xl">Stories from {name}</h2>
            <span className="text-sm text-forest-900/55">
              {articles.length} stor{articles.length === 1 ? 'y' : 'ies'}
            </span>
          </header>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {articles.slice(0, 8).map((a) => (
              <ArticleCard key={a.id} article={a} size="compact" imageClassName="h-[200px]" />
            ))}
          </div>
          {articles.length > 8 && <MoreStoriesList articles={articles.slice(8)} title={`More stories from ${name}`} />}
        </section>
      )}

      {faqBlock}
      <div className="pb-20" />
    </article>
  );
}

function planningSection(name: string, facts: ContinentFacts): AboutSection {
  const angle = continentPlanningAngle(name);
  const scale = [
    facts.population ? `about ${formatContinentPopulation(facts.population)} people` : null,
    facts.areaKm2 ? `${facts.areaKm2.toLocaleString()} km²` : null,
  ].filter(Boolean);
  const lead = scale.length
    ? `${name} covers ${scale.join(' across ')}, so distance, season and route choice matter more than a single headline itinerary.`
    : '';
  return {
    heading: `How to plan travel across ${name}`,
    paragraphs: [[lead, angle.summary].filter(Boolean).join(' '), angle.points.map((p) => `- ${p}`).join('\n')],
  };
}

function timingSection(name: string): AboutSection {
  const timing = bestTimeToVisit(name);
  return {
    heading: `Best time to visit ${name}`,
    paragraphs: [timing.summary, timing.notes.map((n) => `- ${n.label}: ${n.body}`).join('\n')],
  };
}

/** The continent's quick facts as one strip. Missing facts are skipped. */
function ContinentGlance({ facts, countriesCount }: { facts: ContinentFacts; countriesCount: number }) {
  const items = [
    { label: 'Countries', value: (facts.countriesCount ?? countriesCount).toLocaleString() },
    facts.population != null && { label: 'Population', value: formatContinentPopulation(facts.population) },
    facts.areaKm2 != null && { label: 'Area', value: `${facts.areaKm2.toLocaleString()} km²` },
    facts.largestCountry && { label: 'Largest country', value: facts.largestCountry },
    facts.highestPoint && { label: 'Highest point', value: facts.highestPoint },
    facts.longestRiver && { label: 'Longest river', value: facts.longestRiver },
    facts.timezoneSpan && { label: 'Time zones', value: facts.timezoneSpan },
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <dl
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-forest-900/10 bg-forest-900/10 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none"
      data-testid="continent-glance"
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`bg-white p-4 sm:p-5 ${items.length % 2 === 1 && i === items.length - 1 ? 'col-span-2 lg:col-span-1' : ''}`}
        >
          <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-forest-900/50">{item.label}</dt>
          <dd className="mt-1.5 text-base font-bold leading-snug text-forest-950">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Main gateway airports and the city guides in the continent, side by side. */
function ContinentGateways({
  name,
  hubs,
  allAirports,
  cities,
}: {
  name: string;
  hubs: StrapiAirport[];
  allAirports: StrapiAirport[];
  cities: StrapiDestination[];
}) {
  if (hubs.length === 0 && cities.length === 0) return null;
  return (
    <section id="gateways" className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6" data-testid="continent-gateways">
      <header className="border-b border-forest-900/10 pb-3">
        <h2 className="editorial-h text-2xl font-bold text-forest-950 lg:text-3xl">Gateways and cities in {name}</h2>
      </header>
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        {hubs.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-emphasis">Main gateway airports</h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {hubs.map((airport) => (
                <li key={airport.id}>
                  <Link
                    href={airportPath(airport, allAirports)}
                    className="flex items-center gap-3 rounded-lg border border-forest-900/10 bg-paper p-3 transition hover:border-forest-900/30 hover:shadow-sm"
                  >
                    <span className="rounded bg-forest-950 px-2 py-1 font-mono text-sm font-bold text-white">{airport.iata}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-forest-950">{airport.city || airport.name}</span>
                      <span className="block truncate text-xs text-forest-900/60">{airport.country}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {cities.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-emphasis">City guides</h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {cities.map((city) => (
                <li key={city.id}>
                  <Link
                    href={`/destinations/${city.slug}`}
                    className="inline-flex rounded-full border border-forest-900/15 bg-white px-4 py-2 text-sm font-semibold text-forest-900/80 transition hover:border-primary-emphasis hover:text-primary-emphasis"
                  >
                    {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
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
