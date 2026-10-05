import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import FeaturedAirlineGuides, { type FeaturedGuide } from '@/components/FeaturedAirlineGuides';
import SubscribeBlock from '@/components/SubscribeBlock';
import { JsonLd } from '@/components/SeoBlocks';
import {
  Kicker,
  LeadStory,
  MosaicStory,
  StoryCard,
  StoryRow,
  WideStoryCard,
  shortDate,
} from '@/components/home/Stories';
import { listAirportGuideIatas } from '@/lib/airport-guide';
import { airportSlug } from '@/lib/airport-slugs';
import { PUBLISHED_AIRLINE_GUIDES } from '@/lib/airline-tier';
import { getAirlineFacts } from '@/lib/airline-facts';
import { faqJsonLd } from '@/lib/entity-seo';
import { ledgerFacts, type LedgerFact } from '@/lib/home-facts';
import { categoryCounts, homeFaqs, selectHomeStories, type CategoryBand } from '@/lib/home-page';
import { ORG_ID, collectionPageJsonLd, organizationJsonLd } from '@/lib/jsonld';
import { partnerLink } from '@/lib/partner-links';
import { getRouteFacts } from '@/lib/route-facts';
import { clampDescription } from '@/lib/seo';
import {
  listAirlines,
  listAirports,
  listArticleIndex,
  listArticles,
  listCountriesBySlugs,
  mediaUrl,
  type StrapiArticle,
  type StrapiDestination,
} from '@/lib/strapi';

export const revalidate = 60;

const TITLE = 'Originfacts — Travel Guides, Flight Tips & Airline Facts';
const DESCRIPTION = clampDescription(
  'Travel guides, flight and hotel advice, and airline and airport guides with facts checked against official sources. Read the latest travel stories.',
);

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: '/',
    types: { 'application/rss+xml': [{ url: '/feed.xml', title: 'Originfacts RSS' }] },
  },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/', type: 'website' },
};

const FEATURED_COUNTRY_SLUGS = [
  'japan', 'singapore', 'germany', 'south-korea', 'thailand', 'australia', 'united-states', 'united-kingdom',
];

/** Airline guides shown on the home page; the rest are one click away on /airlines. */
const HOME_AIRLINE_GUIDES = 8;

type AirportRow = { iata: string; slug: string; city: string; name: string };

/**
 * The slim article index (no body text) is all the page needs. If it fails,
 * fall back to one page of full articles so the stories still render.
 */
async function loadArticles(): Promise<{ rows: StrapiArticle[]; total: number }> {
  try {
    const res = await listArticleIndex();
    return { rows: res.data, total: res.meta?.pagination?.total ?? res.data.length };
  } catch (err) {
    console.error('[home] article index unavailable, falling back to latest articles:', err);
    try {
      const res = await listArticles({ pageSize: 30 });
      return { rows: res.data, total: res.meta?.pagination?.total ?? res.data.length };
    } catch {
      return { rows: [], total: 0 };
    }
  }
}

export default async function HomePage() {
  const [airlines, airports, articleData, countries] = await Promise.all([
    listAirlines().catch(() => []),
    listAirports().catch(() => []),
    loadArticles(),
    listCountriesBySlugs(FEATURED_COUNTRY_SLUGS).catch(() => [] as StrapiDestination[]),
  ]);

  const { rows: index, total: articleTotal } = articleData;
  const indexComplete = index.length > 0 && index.length >= articleTotal;
  const { lead, secondary, latest, bands, recentList } = selectHomeStories(index);
  const topics = categoryCounts(index);

  /* ---------- Airline and airport guides (unchanged sources) ---------- */
  const airlineBySlug = new Map(airlines.map((a) => [a.slug, a]));
  const airlineGuides: FeaturedGuide[] = [...PUBLISHED_AIRLINE_GUIDES]
    .map((slug): FeaturedGuide | null => {
      const a = airlineBySlug.get(slug);
      if (!a) return null;
      const verifiedFields = (getAirlineFacts(slug)?.modules ?? []).reduce(
        (n, m) => n + Object.values(m.fields ?? {}).filter((f) => f.status === 'official').length,
        0,
      );
      return {
        airline: { name: a.name, slug: a.slug, iataCode: a.iataCode, type: a.type, logo: a.logo ?? null },
        verifiedFields,
        destinations: getRouteFacts(a.iataCode)?.destinationCount ?? 0,
        homeCountry: a.country || 'International',
      };
    })
    .filter((g): g is FeaturedGuide => g !== null)
    .sort((a, b) => b.verifiedFields - a.verifiedFields || a.airline.name.localeCompare(b.airline.name));

  const guideIatas = new Set(listAirportGuideIatas());
  const airportRows: AirportRow[] = airports
    .filter((a) => a.iata && guideIatas.has(a.iata.toUpperCase()))
    .map((a) => ({ iata: a.iata.toUpperCase(), slug: airportSlug(a, airports), city: a.city || a.name, name: a.name }))
    .sort((a, b) => a.city.localeCompare(b.city));

  const nameOf = (slug: string) => airlineBySlug.get(slug)?.name ?? slug;
  const ledger = ledgerFacts(5);

  /* ---------- Copy that depends on data ---------- */
  const faqs = homeFaqs({
    topics: topics.map((t) => t.name.toLowerCase()),
    airlineGuides: airlineGuides.length,
    airportGuides: airportRows.length,
  });

  // Every number in this band is counted at render time; a stat with no data is dropped.
  const stats = [
    articleTotal > 0 ? { value: articleTotal.toLocaleString('en-GB'), label: 'published articles' } : null,
    indexComplete && topics.length > 0 ? { value: String(topics.length), label: 'travel topics' } : null,
    airlineGuides.length > 0 ? { value: String(airlineGuides.length), label: 'verified airline guides' } : null,
    airportRows.length > 0 ? { value: String(airportRows.length), label: 'airport guides' } : null,
  ].filter((s): s is { value: string; label: string } => s !== null);

  // Chapters are numbered in page order, so the count follows however many bands render.
  let chapter = 0;
  const nextChapter = () => String(++chapter).padStart(2, '0');

  /* ---------- Structured data ---------- */
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://www.originfacts.com/#website',
    name: 'Originfacts',
    alternateName: ['Originfacts.com', 'Origin Facts'],
    url: 'https://www.originfacts.com',
    inLanguage: 'en',
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://www.originfacts.com/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  const servicesCatalogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Originfacts Travel Guides & Sourced Travel Data',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Travel Articles & Guides', url: 'https://www.originfacts.com/all-articles' },
      { '@type': 'ListItem', position: 2, name: 'Verified Airline Policy Guides', url: 'https://www.originfacts.com/airlines' },
      { '@type': 'ListItem', position: 3, name: 'Airport Transit & Terminal Guides', url: 'https://www.originfacts.com/airports' },
      { '@type': 'ListItem', position: 4, name: 'Flight Route & Carrier Network Explorer', url: 'https://www.originfacts.com/flight-routes' },
      { '@type': 'ListItem', position: 5, name: 'Country & Destination Handbooks', url: 'https://www.originfacts.com/destinations' },
      { '@type': 'ListItem', position: 6, name: 'Checked Airline Facts Ledger', url: 'https://www.originfacts.com/#live-ledger' },
    ],
  };

  const shownStories = [lead, ...secondary, ...latest, ...bands.flatMap((b) => b.stories), ...recentList].filter(
    (a): a is StrapiArticle => Boolean(a),
  );
  const collectionJsonLd = collectionPageJsonLd({
    name: 'Latest travel stories on Originfacts',
    description: DESCRIPTION,
    url: '/',
    itemListName: 'Latest travel stories',
    items: shownStories.map((a) => ({ name: a.title, url: `/articles/${a.slug}`, image: mediaUrl(a.coverImage ?? null) })),
  });

  const lastPublished = lead ? shortDate(lead.publishedAt) : '';

  return (
    <div data-testid="home-page" className="overflow-x-clip text-forest-950">
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd} />
      <JsonLd data={servicesCatalogJsonLd} />
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={faqJsonLd(faqs)} />

      {/* ================= Hero ================= */}
      <header className="mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 sm:pt-14" data-testid="home-hero">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div className="min-w-0 max-w-4xl">
            <p className="eyebrow-tag">Originfacts travel journal</p>
            <h1 className="mt-5 text-[2.1rem] font-bold leading-[1.08] tracking-tight text-forest-950 sm:text-5xl lg:text-[3.4rem]">
              Travel guides and the facts behind every place worth visiting
            </h1>
          </div>
          {lastPublished && (
            <p className="shrink-0 text-sm text-forest-900/65 lg:pb-2 lg:text-right">
              Latest story <time dateTime={lead?.publishedAt}>{lastPublished}</time>
              {articleTotal > 0 && (
                <>
                  <span aria-hidden="true"> · </span>
                  <Link href="/all-articles" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                    {articleTotal.toLocaleString('en-GB')} articles
                  </Link>
                </>
              )}
            </p>
          )}
        </div>

        <nav aria-label="Browse by topic" className="mt-7 border-y border-forest-900/10 py-3" data-testid="home-topic-nav">
          <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {topics.map((t) => (
              <li key={t.slug} className="shrink-0">
                <TopicPill href={`/category/${t.slug}`} label={t.name} count={indexComplete ? t.count : undefined} />
              </li>
            ))}
            <li className="shrink-0">
              <TopicPill href="/destinations" label="Countries" />
            </li>
            <li className="shrink-0">
              <TopicPill href="/airlines" label="Airline guides" count={airlineGuides.length || undefined} />
            </li>
            <li className="shrink-0">
              <TopicPill href="/airports" label="Airport guides" count={airportRows.length || undefined} />
            </li>
            <li className="shrink-0">
              <TopicPill href="/flight-routes" label="Flight routes" />
            </li>
          </ul>
        </nav>

        {lead ? (
          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
            <LeadStory article={lead} />
            {secondary.length > 0 && (
              <section aria-label="More top stories" className="min-w-0" data-testid="home-hero-mosaic">
                <div className="grid gap-5 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-7">
                  {secondary.map((a) => (
                    <MosaicStory key={a.slug} article={a} />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <EmptyStories />
        )}
      </header>

      {/* ================= Intro + numbers ================= */}
      <section aria-labelledby="home-intro-heading" className="border-y border-forest-900/15 bg-paper" data-testid="home-intro">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:py-16">
          <div className="min-w-0">
            <h2 id="home-intro-heading" className="text-2xl font-bold leading-tight text-forest-950 sm:text-3xl">
              A travel blog that starts with the place itself
            </h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-forest-900/80 sm:text-lg">
              <p>
                Originfacts is an independent travel website, published in English for readers around the world. We
                write destination guides, flight and hotel advice, car rental explainers and practical travel tips, and
                pair them with reference guides to airlines and airports, so you can understand a place and plan the trip
                to it in one place.
              </p>
              <p>
                It is written for independent travellers who plan their own trips: people comparing routes and fares,
                choosing a neighbourhood to stay in, working out how many days a city needs, or checking a baggage
                allowance before they pack. Prices, schedules and entry rules change often, so confirm the final details
                with the airline, hotel or official source before you book.
              </p>
            </div>
            <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
              <Link href="/about" className="text-primary-emphasis underline-offset-2 hover:underline">
                About Originfacts →
              </Link>
              <Link href="/methodology" className="text-forest-950 underline-offset-2 hover:underline">
                How we research and write →
              </Link>
            </p>
          </div>
          {stats.length > 0 && (
            <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-8 self-center" data-testid="home-stats">
              {stats.map((s) => (
                <div key={s.label} className="flex min-w-0 flex-col-reverse border-l-2 border-primary-emphasis pl-4">
                  <dt className="mt-2 text-xs font-bold uppercase tracking-widest text-forest-900/60">{s.label}</dt>
                  <dd className="text-4xl font-bold leading-none text-forest-950 sm:text-5xl">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* ================= Latest stories ================= */}
      {latest.length > 0 && (
        <section aria-labelledby="home-latest-heading" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20" data-testid="home-latest">
          <ChapterHeading
            id="home-latest-heading"
            n={nextChapter()}
            kicker="Latest"
            title="Latest travel stories"
            intro="New guides and advice from across the site, newest first."
            more={{ href: '/all-articles', label: 'All articles' }}
          />
          <div className="mt-10 grid gap-x-6 gap-y-7 sm:grid-cols-2 sm:gap-y-12 lg:grid-cols-3">
            {latest.map((a, i) =>
              i === 0 ? (
                <div key={a.slug} className="min-w-0 sm:col-span-2">
                  <WideStoryCard article={a} />
                </div>
              ) : (
                <StoryCard key={a.slug} article={a} />
              ),
            )}
          </div>
        </section>
      )}

      {/* ================= Category bands (first two) ================= */}
      {bands.slice(0, 2).map((band, i) => (
        <CategorySection key={band.slug} band={band} n={nextChapter()} flip={i % 2 === 1} />
      ))}

      {/* ================= Recently published (text list) ================= */}
      {recentList.length > 0 && (
        <section
          aria-labelledby="home-recent-heading"
          className="border-t border-forest-900/15"
          data-testid="home-recent"
        >
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
            <div className="min-w-0">
              <Kicker n={nextChapter()} label="Just in" />
              <h2 id="home-recent-heading" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
                Recently published
              </h2>
              <p className="mt-4 text-base leading-relaxed text-forest-900/75">
                More of the newest articles, in the order they went up. Every article is listed, newest first, on the
                all-articles page, and the RSS feed carries the most recent ones.
              </p>
              <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
                <Link href="/all-articles" className="text-primary-emphasis underline-offset-2 hover:underline">
                  Browse all articles →
                </Link>
                <a href="/feed.xml" className="text-forest-950 underline-offset-2 hover:underline">
                  RSS feed
                </a>
              </p>
            </div>
            <ol className="grid min-w-0 gap-x-10 sm:grid-cols-2" data-testid="home-recent-list">
              {recentList.map((a, i) => (
                <li key={a.slug} className="flex min-w-0 gap-4 border-t border-forest-900/10 py-5">
                  <span aria-hidden="true" className="w-8 shrink-0 font-mono text-2xl font-bold leading-none text-primary-emphasis/35">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-forest-900/60">
                      {a.category && (
                        <>
                          <Link href={`/category/${a.category.slug}`} className="font-bold text-primary-emphasis underline-offset-2 hover:underline">
                            {a.category.name}
                          </Link>
                          <span aria-hidden="true"> · </span>
                        </>
                      )}
                      <time dateTime={a.publishedAt}>{shortDate(a.publishedAt)}</time>
                    </p>
                    <h3 className="mt-1.5 text-base leading-snug">
                      <Link
                        href={`/articles/${a.slug}`}
                        className="text-forest-950 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
                      >
                        {a.title}
                      </Link>
                    </h3>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ================= Category bands (rest; the first of these is the dark band) ================= */}
      {bands.slice(2).map((band, i) => (
        <CategorySection key={band.slug} band={band} n={nextChapter()} flip={i % 2 === 1} dark={i === 0} />
      ))}

      {/* ================= Destinations ================= */}
      {countries.length > 0 && (
        <section aria-labelledby="home-countries-heading" className="border-t border-forest-900/15" data-testid="home-countries">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
            <ChapterHeading
              id="home-countries-heading"
              n={nextChapter()}
              kicker="Destinations"
              title="Explore by country"
              intro="Country guides bring together the background on a place, its main airports, the airlines that serve it and the articles we have written about it."
              more={{ href: '/destinations', label: 'All countries' }}
            />
            <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
              {countries.map((c) => (
                <li key={c.slug} className="min-w-0">
                  <CountryTile country={c} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ================= Airline and airport guides ================= */}
      {(airlineGuides.length > 0 || airportRows.length > 0) && (
        <section className="border-t border-forest-900/15 bg-paper" aria-label="Airline and airport guides" data-testid="home-guides">
          <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
            {airlineGuides.length > 0 && (
              <>
                <FeaturedAirlineGuides guides={airlineGuides.slice(0, HOME_AIRLINE_GUIDES)} />
                <p className="mt-5 text-sm font-semibold">
                  <Link href="/airlines" className="text-primary-emphasis underline-offset-2 hover:underline">
                    All {airlineGuides.length} verified airline guides and the airline directory →
                  </Link>
                </p>
              </>
            )}

            {airportRows.length > 0 && (
              <div className="mt-14" data-testid="home-airport-guides">
                <div className="flex flex-col gap-2 border-b border-forest-900/10 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
                  <div className="min-w-0">
                    <h2 id="home-airports-heading" className="text-2xl font-bold leading-tight sm:text-3xl">
                      Airport guides: from the gate into town
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-forest-900/70 sm:text-base">
                      Terminals, trains and express buses into the city, taxis and parking, cited to the airport and its
                      official transport operators.
                    </p>
                  </div>
                  <Link
                    href="/airports/top-100-airports"
                    className="shrink-0 text-sm font-semibold text-primary-emphasis underline-offset-2 hover:underline"
                  >
                    Top 100 airports →
                  </Link>
                </div>
                <ul className="mt-6 flex flex-wrap gap-2.5">
                  {airportRows.map((a) => (
                    <li key={a.iata}>
                      <Link
                        href={`/airports/${a.slug}`}
                        title={a.name}
                        className="group inline-flex items-center gap-2 rounded-full border border-forest-900/15 bg-white py-1 pl-1 pr-3.5 text-sm font-semibold text-forest-950 transition hover:border-primary-emphasis hover:text-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
                      >
                        <span className="rounded-full bg-forest-950 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider text-white">
                          <span className="sr-only">IATA code </span>
                          {a.iata}
                        </span>
                        {a.city}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================= How we choose and check ================= */}
      <section aria-labelledby="home-method-heading" className="border-t border-forest-900/15" data-testid="home-method">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div className="min-w-0">
            <Kicker n={nextChapter()} label="Our standards" />
            <h2 id="home-method-heading" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
              How we choose and check what we publish
            </h2>
            <ol className="mt-8 grid gap-8 sm:grid-cols-2">
              {METHOD.map((m, i) => (
                <li key={m.title} className="min-w-0 border-t-2 border-forest-950 pt-4">
                  <p className="font-mono text-xs font-bold text-forest-900/50">{String(i + 1).padStart(2, '0')}</p>
                  <h3 className="mt-2 text-lg font-bold leading-snug text-forest-950">{m.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-forest-900/75">{m.text}</p>
                </li>
              ))}
            </ol>
            <blockquote className="mt-10 border-l-4 border-primary-emphasis pl-5">
              <p className="text-xl font-bold leading-snug text-forest-950 sm:text-2xl">
                “We use AI as a tool to research and structure content faster, not as a way to publish without human
                judgement.”
              </p>
            </blockquote>
            <p className="mt-6 text-sm font-semibold">
              <Link href="/methodology" className="text-primary-emphasis underline-offset-2 hover:underline">
                Read the full methodology →
              </Link>
            </p>
          </div>
          {ledger.length > 0 && <Ledger facts={ledger} nameOf={nameOf} />}
        </div>
      </section>

      {/* ================= Labelled partner slot ================= */}
      <aside className="mx-auto max-w-7xl px-4 pb-6 sm:px-6" aria-label="Advertisement" data-testid="home-ad-banner">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-forest-900/60">Advertisement</p>
        <a
          href={partnerLink('https://www.cheapoair.com/', 'originfacts_home_banner_wide')}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          className="mt-2 flex flex-col items-start justify-between gap-3 rounded-[0.3rem] border border-forest-900/10 bg-white px-5 py-4 shadow-xs transition hover:border-forest-900/25 sm:flex-row sm:items-center"
        >
          <span>
            <span className="block text-xs font-bold uppercase tracking-wider text-forest-900/60">CheapOair</span>
            <span className="mt-0.5 block font-semibold">Compare flights and book online</span>
          </span>
          <span className="text-sm font-semibold text-primary-emphasis">Search CheapOair →</span>
        </a>
      </aside>

      {/* ================= FAQ ================= */}
      <section aria-labelledby="home-faq-heading" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20" data-testid="home-faq">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
          <div className="min-w-0">
            <Kicker n={nextChapter()} label="FAQ" />
            <h2 id="home-faq-heading" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
              Questions about Originfacts
            </h2>
            <p className="mt-4 text-base leading-relaxed text-forest-900/75">
              Who runs the site, how it is written and how it makes money. Anything else, ask at{' '}
              <a href="mailto:contact@originfacts.com" className="break-words font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                contact@originfacts.com
              </a>
              .
            </p>
          </div>
          <div className="min-w-0 divide-y divide-forest-900/10 border-y border-forest-900/15">
            {faqs.map((f, i) => (
              <details key={f.q} className="group" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 text-base font-bold leading-snug text-forest-950 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis sm:text-lg [&::-webkit-details-marker]:hidden">
                  <h3 className="text-base leading-snug sm:text-lg">{f.q}</h3>
                  <span aria-hidden="true" className="mt-0.5 text-xl font-light leading-none text-forest-900/50 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="pb-6 pr-8 text-base leading-relaxed text-forest-900/80">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <SubscribeBlock />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

/** Restates /about and /methodology; keep in step with those pages. */
const METHOD = [
  {
    title: 'Topics travellers actually plan around',
    text: 'Topics come from a planned list, based on what travellers search for, current routes, seasonal demand and destinations we want to cover in depth.',
  },
  {
    title: 'AI-assisted, and said so',
    text: 'Many articles are researched and drafted with a large language model (currently Anthropic’s Claude) working from an editorial brief and guidelines. Many cover images are AI-generated illustrations, not photographs of a specific hotel, aircraft or person.',
  },
  {
    title: 'Airline and airport facts from the source',
    text: 'Airline figures are read from the airline’s own pages, and airport figures from the airport and its official transport operators. Each checked figure carries its source link and the date it was checked; unchecked fields are left blank.',
  },
  {
    title: 'Corrected when we are wrong',
    text: 'Prices, routes, visa rules and fees are the details most likely to go out of date. Report an error to contact@originfacts.com and it is corrected or removed.',
  },
];

/* ------------------------------------------------------------------ */
/* Subcomponents                                                       */
/* ------------------------------------------------------------------ */

function TopicPill({ href, label, count }: { href: string; label: string; count?: number }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-forest-900/15 bg-white px-3.5 py-1.5 text-sm font-semibold text-forest-950 transition hover:border-primary-emphasis hover:bg-primary-hover hover:text-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
    >
      {label}
      {count !== undefined && (
        <span className="rounded-full bg-sand-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-forest-900">{count}</span>
      )}
    </Link>
  );
}

function ChapterHeading({
  id,
  n,
  kicker,
  title,
  intro,
  more,
  tone = 'light',
}: {
  id: string;
  n: string;
  kicker: string;
  title: string;
  intro?: string;
  more?: { href: string; label: string };
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-10">
      <div className="min-w-0 max-w-3xl">
        <Kicker n={n} label={kicker} tone={tone} />
        <h2 id={id} className={`mt-3 text-3xl font-bold leading-tight sm:text-4xl ${dark ? '!text-white' : 'text-forest-950'}`}>
          {title}
        </h2>
        {intro && (
          <p className={`mt-4 text-base leading-relaxed sm:text-lg ${dark ? 'text-white/80' : 'text-forest-900/75'}`}>{intro}</p>
        )}
      </div>
      {more && (
        <Link
          href={more.href}
          className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-[0.3rem] border px-4 py-2 text-xs font-bold uppercase tracking-wider transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            dark
              ? 'border-white/40 text-white hover:bg-white hover:text-forest-950 focus-visible:outline-sand-300'
              : 'border-forest-900 text-forest-900 hover:bg-primary-emphasis hover:text-white focus-visible:outline-primary-emphasis'
          }`}
        >
          {more.label} <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}

/**
 * One category: heading and intro, a feature story with a large cover, and
 * three more as compact rows. `flip` mirrors the columns so consecutive bands
 * alternate image-left / image-right; `dark` sets the band on the navy panel.
 */
function CategorySection({ band, n, flip = false, dark = false }: { band: CategoryBand; n: string; flip?: boolean; dark?: boolean }) {
  const [feature, ...rest] = band.stories;
  if (!feature) return null;
  const headingId = `home-cat-${band.slug}-heading`;
  return (
    <section
      aria-labelledby={headingId}
      className={dark ? 'bg-forest-950 text-white' : 'border-t border-forest-900/15'}
      data-testid={`home-category-${band.slug}`}
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <ChapterHeading
          id={headingId}
          n={n}
          kicker={band.tagline ?? band.name}
          title={band.name}
          intro={band.intro}
          more={{ href: `/category/${band.slug}`, label: `All ${band.name.toLowerCase()}` }}
          tone={dark ? 'dark' : 'light'}
        />
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
          <article className={`min-w-0 ${flip ? 'lg:order-2' : ''}`}>
            <FeatureCover article={feature} />
            <FeatureMeta article={feature} dark={dark} />
          </article>
          <ul className={`min-w-0 space-y-6 self-center ${flip ? 'lg:order-1' : ''}`}>
            {rest.map((a) => (
              <li key={a.slug} className={`border-t pt-6 first:border-t-0 first:pt-0 ${dark ? 'border-white/15' : 'border-forest-900/10'}`}>
                <StoryRow article={a} tone={dark ? 'dark' : 'light'} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function FeatureCover({ article }: { article: StrapiArticle }) {
  const src = mediaUrl(article.coverImage ?? null);
  return (
    <Link
      href={`/articles/${article.slug}`}
      tabIndex={-1}
      aria-hidden="true"
      className="group/cover relative block aspect-[16/9] overflow-hidden rounded-[0.3rem] bg-forest-900"
    >
      {src ? (
        <Image
          src={src}
          alt={article.coverImage?.alternativeText?.trim() || `Cover image: ${article.title}`}
          fill
          sizes="(min-width: 1420px) 790px, (min-width: 1024px) 56vw, 100vw"
          className="object-cover transition-transform duration-500 ease-out group-hover/cover:scale-[1.03] motion-reduce:transition-none"
        />
      ) : (
        <span className="absolute inset-0 bg-gradient-to-br from-forest-800 to-forest-950" />
      )}
    </Link>
  );
}

function FeatureMeta({ article, dark }: { article: StrapiArticle; dark: boolean }) {
  return (
    <div className="mt-5">
      <p className={`flex flex-wrap gap-x-2 text-xs font-semibold uppercase tracking-wider ${dark ? 'text-white/70' : 'text-forest-900/60'}`}>
        <time dateTime={article.publishedAt}>{shortDate(article.publishedAt)}</time>
        {article.readingTimeMinutes ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{article.readingTimeMinutes} min read</span>
          </>
        ) : null}
      </p>
      <h3 className={`mt-2 text-2xl leading-tight sm:text-[1.9rem] ${dark ? '!text-white' : ''}`}>
        <Link
          href={`/articles/${article.slug}`}
          className={`underline-offset-4 decoration-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            dark ? 'text-white focus-visible:outline-sand-300' : 'text-forest-950 focus-visible:outline-primary-emphasis'
          }`}
        >
          {article.title}
        </Link>
      </h3>
      {article.excerpt && (
        <p className={`mt-3 max-w-2xl text-base leading-relaxed ${dark ? 'text-white/80' : 'text-forest-900/75'}`}>{article.excerpt}</p>
      )}
    </div>
  );
}

function CountryTile({ country }: { country: StrapiDestination }) {
  const src = mediaUrl(country.heroImage ?? null);
  return (
    <div className="group min-w-0">
      <Link
        href={`/destinations/${country.slug}`}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-[4/3] overflow-hidden rounded-[0.3rem] bg-forest-900"
      >
        {src ? (
          <Image
            src={src}
            alt={country.heroImage?.alternativeText?.trim() || `${country.name}`}
            fill
            sizes="(min-width: 1420px) 340px, (min-width: 1024px) 24vw, 50vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
          />
        ) : (
          <span className="absolute inset-0 bg-gradient-to-br from-forest-800 to-forest-950" />
        )}
      </Link>
      <h3 className="mt-3 text-lg leading-snug sm:text-xl">
        <Link
          href={`/destinations/${country.slug}`}
          className="text-forest-950 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
        >
          {country.name}
        </Link>
      </h3>
      <p className="mt-0.5 text-sm text-forest-900/65">Country guide</p>
    </div>
  );
}

function Ledger({ facts, nameOf }: { facts: LedgerFact[]; nameOf: (slug: string) => string }) {
  return (
    <figure
      id="live-ledger"
      className="min-w-0 self-start rounded-[0.3rem] bg-forest-950 p-6 text-white sm:p-8"
      data-testid="home-ledger"
    >
      <figcaption>
        <p className="text-xs font-bold uppercase tracking-widest text-sand-300">From the airline guides</p>
        <p className="mt-2 text-xl font-bold leading-snug text-white">Recently checked figures, with their sources</p>
      </figcaption>
      <ol className="mt-5 divide-y divide-white/10">
        {facts.map((f) => (
          <li key={f.slug + f.label} className="py-4">
            <Link
              href={`/airlines/${f.slug}`}
              className="group block rounded-[0.2rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand-300"
            >
              <span className="block text-sm text-white/70">
                <span className="font-semibold text-white group-hover:underline">{nameOf(f.slug)}</span>
                {' · '}
                {f.label}
              </span>
              <span className="mt-1 block text-lg font-bold leading-snug text-white">{f.value}</span>
            </Link>
            <a
              href={f.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex flex-wrap items-center gap-x-1.5 text-xs text-white/65 underline-offset-2 hover:text-white hover:underline"
            >
              <span className="font-medium">{f.sourceHost}</span>
              <span aria-hidden="true">·</span>
              <span>
                checked <time dateTime={f.verifiedAt}>{shortDate(f.verifiedAt)}</time>
              </span>
              <span aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ol>
    </figure>
  );
}

function EmptyStories() {
  return (
    <div className="mt-8 rounded-[0.3rem] border border-forest-900/15 bg-paper p-8" data-testid="home-empty">
      <p className="text-lg font-semibold text-forest-950">The latest stories are not available right now.</p>
      <p className="mt-2 text-forest-900/75">
        Browse{' '}
        <Link href="/all-articles" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
          all articles
        </Link>
        , the{' '}
        <Link href="/airlines" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
          airline guides
        </Link>{' '}
        or the{' '}
        <Link href="/destinations" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
          country guides
        </Link>{' '}
        instead.
      </p>
    </div>
  );
}
