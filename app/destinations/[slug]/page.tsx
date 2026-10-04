import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getDestination,
  listAirlinesByCountry,
  listAirportsByCountryCode,
  listArticles,
  listCountriesByRegion,
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
import TruncatedSection from '@/components/TruncatedSection';
import CountryDetailSections from '@/components/CountryDetailSections';
import CountryFactsPanel from '@/components/CountryFactsPanel';
import FlightSearchCTA from '@/components/FlightSearchCTA';
import { getCountryFacts } from '@/lib/country-facts';
import { faqJsonLd, normalizeFaqs, DEFAULT_OG_IMAGE } from '@/lib/entity-seo';
import { JsonLd, FaqSection } from '@/components/SeoBlocks';
import KeyFacts from '@/components/KeyFacts';
import { buildMetaDescription, programmaticTitle } from '@/lib/seo';
import { absoluteUrl } from '@/lib/jsonld';
import type { Metadata } from 'next';

export const revalidate = 60;

const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'] as const;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await getDestination(slug);
  if (!d) return { title: 'Not found' };
  const description = buildMetaDescription([d.description]);
  const hero = d.heroImage && d.heroImage.url ? d.heroImage : null;
  const title = programmaticTitle(`${d.name} Travel Guide`, 'Flights, Airports & Airlines');
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

export default async function DestinationPage({ params }: Props) {
  const { slug } = await params;
  const destination = await getDestination(slug);
  if (!destination) notFound();

  const isCountry = destination.type === 'country' && !!destination.countryCode;
  const isContinent =
    destination.type === 'region' && (CONTINENTS as readonly string[]).includes(destination.name);
  const routeLimit = isCountry ? 4 : 12;

  const [{ data: articles }, routes, airports, airlines, countries] = await Promise.all([
    listArticles({ destination: slug, pageSize: 24 }),
    listRoutesToDestination(destination, routeLimit).catch(() => []),
    isCountry
      ? listAirportsByCountryCode(destination.countryCode as string).catch(() => [] as StrapiAirport[])
      : Promise.resolve<StrapiAirport[]>([]),
    isCountry
      ? listAirlinesByCountry(destination.name).catch(() => [] as StrapiAirline[])
      : Promise.resolve<StrapiAirline[]>([]),
    isContinent
      ? listCountriesByRegion(destination.name).catch(() => [] as StrapiCountry[])
      : Promise.resolve<StrapiCountry[]>([]),
  ]);

  const hero = mediaUrl(destination.heroImage ?? null);

  // Editor-managed FAQs (Strapi json field), appended below whichever layout
  // renders. FaqSection + faqJsonLd both no-op when < 2 real Q&As survive
  // normalisation.
  const faqs = normalizeFaqs(destination.faqs);
  const faqBlock = (
    <>
      <JsonLd data={faqJsonLd(faqs)} />
      <FaqSection faqs={faqs} title={`${destination.name} — frequently asked questions`} />
    </>
  );

  if (isCountry) {
    return (
      <>
        <CountryDestinationPage
          destination={destination}
          hero={hero}
          airports={airports}
          airlines={airlines}
          routes={routes}
          articles={articles}
        />
        {faqBlock}
      </>
    );
  }

  if (isContinent) {
    return (
      <>
        <ContinentDestinationPage
          destination={destination}
          hero={hero}
          countries={countries}
          articles={articles}
        />
        {faqBlock}
      </>
    );
  }

  // Non-country destinations (city / region) keep the original layout unchanged.
  return (
    <div data-testid={`destination-page-${slug}`}>
      <section className="relative h-[55vh] min-h-[380px] overflow-hidden bg-forest-900">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt={destination.name} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950/90 via-forest-950/30 to-forest-950/10" />
        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-6 pb-14 text-sand-100">
          <div className="text-xs uppercase tracking-widest opacity-80">
            {destination.type ?? 'Destination'}{destination.countryCode ? ` · ${destination.countryCode}` : ''}
          </div>
          <h1 className="editorial-h mt-3 text-3xl font-bold sm:text-4xl">{destination.name}</h1>
          {destination.description && (
            <p className="mt-4 max-w-2xl text-lg opacity-90">{destination.description}</p>
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
          <div className="mt-10 grid gap-12 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => <ArticleCard key={a.id} article={a} size="md" />)}
          </div>
        )}
      </div>

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

      <div className="pb-20" />
    </div>
  );
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
}: {
  destination: StrapiDestination;
  hero: string | null;
  airports: StrapiAirport[];
  airlines: StrapiAirline[];
  routes: Awaited<ReturnType<typeof listRoutesToDestination>>;
  articles: Awaited<ReturnType<typeof listArticles>>['data'];
}) {
  const cityCount = new Set(airports.map((a) => a.city).filter(Boolean)).size;
  const aboutSections = destination.description ? parseAboutSections(destination.description) : [];
  const leadParagraphs = aboutSections.find((s) => !s.heading)?.paragraphs ?? [];
  const namedSections = aboutSections.filter((s) => s.heading);
  // Sections that render next to the stats grid in the About block.
  // Everything else falls into the "extras" grid above Flights.
  const ABOUT_HERO_HEADINGS = new Set(['Overview', 'Visa Requirements']);
  const aboutHeroSections = namedSections.filter((s) => s.heading && ABOUT_HERO_HEADINGS.has(s.heading));
  const extraSections = namedSections.filter((s) => s.heading && !ABOUT_HERO_HEADINGS.has(s.heading));
  // Prefer Strapi-stored facts (populated by enrich-country-content.js),
  // fall back to the static lookup in lib/country-facts.ts.
  const facts = destination.facts ?? getCountryFacts(destination.countryCode);

  return (
    <article data-testid={`destination-page-${destination.slug}`} data-hide-fixed-sidebars="true">
      {/* 1. Hero — bottom-anchored, left-aligned title + lead; country facts on the right */}
      <section className="relative min-h-[420px] overflow-hidden bg-paper py-16">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            alt={destination.name}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.35]"
          />
        )}
        {/* Paper wash — heavier at the bottom so dark text stays crisp */}
        <div className="absolute inset-0 bg-gradient-to-t from-paper/85 via-paper/20 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid items-end gap-10 lg:grid-cols-[1fr_320px]">
            {/* Left — text column */}
            <div>
              <div className="text-xs uppercase tracking-widest text-forest-900/60">
                {destination.type ?? 'Destination'}
                {destination.countryCode ? ` · ${destination.countryCode}` : ''}
              </div>
              <h1 className="editorial-h mt-3 text-3xl font-bold text-forest-900 sm:text-4xl">
                {destination.name}
              </h1>
              {leadParagraphs.length > 0 && (
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-forest-900/75">
                  {leadParagraphs.join(' ')}
                </p>
              )}
            </div>

            {/* Right — country facts */}
            <CountryFactsPanel countryCode={destination.countryCode} facts={facts} />
          </div>
        </div>
      </section>

      {/* About — Overview + Visa Requirements stay alongside the stats column */}
      {aboutHeroSections.length > 0 && (
        <section className="mx-auto mt-14 max-w-7xl px-6" data-testid="country-about">
          <div className="grid gap-y-10 lg:grid-cols-[30%_60%] lg:gap-x-[10%]">
            {/* Left — coverage stats */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-6 self-start">
              <HeroStat label="Airports" value={airports.length} />
              <HeroStat label="Cities" value={cityCount} />
              <HeroStat label="Airlines" value={airlines.length} />
              <HeroStat label="Stories" value={articles.length} />
            </div>
            {/* Right — overview content, fills column */}
            <div className="w-full">
              <CountryAbout sections={aboutHeroSections} />
            </div>
          </div>
        </section>
      )}

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
              <CountryAbout key={s.heading ?? `extra-${i}`} sections={[s]} />
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
              showing 4 of {articles.length}
            </span>
          )}
        </header>
        {articles.length > 0 && (
          <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {articles.slice(0, 4).map((a) => <ArticleCard key={a.id} article={a} size="compact" />)}
          </div>
        )}
      </section>
    </article>
  );
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
  articles,
}: {
  destination: StrapiDestination;
  hero: string | null;
  countries: StrapiCountry[];
  articles: Awaited<ReturnType<typeof listArticles>>['data'];
}) {
  // Parse the markdown description into a short lead + named sections, the
  // same way the country page does. Overview / Travel Notes / Interesting
  // Facts each become their own block below the hero.
  const aboutSections = destination.description ? parseAboutSections(destination.description) : [];
  const leadParagraphs = aboutSections.find((s) => !s.heading)?.paragraphs ?? [];
  const namedSections = aboutSections.filter((s) => s.heading);
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
      {/* 1. Hero — image background; title + lead on the left, facts panel on the right */}
      <section className="relative overflow-hidden bg-paper py-16">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            alt={destination.name}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.35]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-paper/85 via-paper/20 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid items-end gap-10 lg:grid-cols-[1fr_320px]">
            {/* Left — text column */}
            <div>
              <div className="text-xs uppercase tracking-widest text-forest-900/60">Continent</div>
              <h1 className="editorial-h mt-3 text-3xl font-bold text-forest-900 sm:text-4xl">
                {destination.name}
              </h1>
              {leadParagraphs.length > 0 ? (
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-forest-900/75">
                  {leadParagraphs.join(' ')}
                </p>
              ) : destination.description ? (
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-forest-900/75">
                  {destination.description}
                </p>
              ) : null}
            </div>

            {/* Right — facts panel */}
            <ContinentFactsPanel
              destination={destination}
              countriesCount={countries.length}
              articlesCount={articles.length}
            />
          </div>
        </div>
      </section>

      {/* 2. About — stats left, Overview + History right (Thailand-style) */}
      {(aboutHeroSections.length > 0 || historySection) && (
        <section className="mx-auto mt-14 max-w-7xl px-6" data-testid="continent-about">
          <div className="grid gap-y-10 lg:grid-cols-[30%_60%] lg:gap-x-[10%]">
            {/* Left — coverage stats */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-6 self-start">
              <HeroStat label="Countries" value={countries.length} />
              <HeroStat label="Stories" value={articles.length} />
              {facts.population != null && (
                <HeroStat
                  label="Population"
                  value={facts.population}
                  display={
                    facts.population >= 1_000_000_000
                      ? `${(facts.population / 1_000_000_000).toFixed(1)}B`
                      : facts.population >= 1_000_000
                        ? `${(facts.population / 1_000_000).toFixed(0)}M`
                        : facts.population.toLocaleString()
                  }
                />
              )}
              {facts.areaKm2 != null && (
                <HeroStat
                  label="Area km²"
                  value={facts.areaKm2}
                  display={
                    facts.areaKm2 >= 1_000_000
                      ? `${(facts.areaKm2 / 1_000_000).toFixed(1)}M`
                      : facts.areaKm2.toLocaleString()
                  }
                />
              )}
            </div>
            {/* Right — Overview + History and Ancient Civilizations (truncated) */}
            <div className="w-full space-y-8">
              {aboutHeroSections.length > 0 && (
                <CountryAbout sections={aboutHeroSections} />
              )}
              {historySection && (
                <TruncatedSection section={historySection} truncateAfterWords={30} />
              )}
            </div>
          </div>
        </section>
      )}

      {/* 3. Countries — full width, with A-Z letter filter */}
      <ContinentCountriesGrid countries={countries} regionName={destination.name} />

      {/* 3a. Travel Notes — full width, below Countries */}
      {travelNotesSection && (
        <section className="mx-auto mt-14 max-w-7xl px-6" data-testid="continent-travel-notes">
          <CountryAbout sections={[travelNotesSection]} />
        </section>
      )}

      {/* 3b. Interesting Facts + Top Travel Highlights — 2-col grid, below countries */}
      {(interestingFactsSection || topHighlightsSection) && (
        <section
          className="mx-auto mt-14 max-w-7xl px-6"
          data-testid="continent-facts-and-highlights"
        >
          <div className="grid gap-[3.5rem] lg:grid-cols-2">
            {interestingFactsSection && (
              <CountryAbout sections={[interestingFactsSection]} singleColumnBullets />
            )}
            {topHighlightsSection && (
              <CountryAbout sections={[topHighlightsSection]} singleColumnBullets />
            )}
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
              <ArticleCard key={a.id} article={a} size="compact" />
            ))}
          </div>
        </section>
      )}
    </article>
  );
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
