import type { Metadata } from 'next';
import Link from 'next/link';

import SubscribeBlock from '@/components/SubscribeBlock';
import { listAirportGuideIatas } from '@/lib/airport-guide';
import { airportSlug } from '@/lib/airport-slugs';
import { PUBLISHED_AIRLINE_GUIDES } from '@/lib/airline-tier';
import { getAirlineFacts } from '@/lib/airline-facts';
import { ledgerFacts, type LedgerFact } from '@/lib/home-facts';
import { ORG_ID, organizationJsonLd } from '@/lib/jsonld';
import { partnerLink } from '@/lib/partner-links';
import { SECTIONS } from '@/lib/sections';
import { SITE_PHOTOS } from '@/lib/site-photos';
import {
  listAirlines,
  listAirports,
  listArticles,
  listCountriesBySlugs,
  mediaUrl,
  type StrapiArticle,
} from '@/lib/strapi';

export const revalidate = 60;

const TITLE = 'Originfacts — Sourced Airline & Airport Intelligence';
const DESCRIPTION =
  'Sourced baggage limits, check-in cut-offs, airport transit routes, and flight schedules — read directly from official airline and airport pages, dated and fully cited.';

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

const ARTICLE_SECTIONS = SECTIONS.filter((s) => s.slug !== 'destinations');

type AirlineRow = { slug: string; name: string; iata: string; country: string; checked: number };
type AirportRow = { iata: string; slug: string; city: string; name: string };

export default async function HomePage() {
  const [airlines, airports, articles, countries] = await Promise.all([
    listAirlines().catch(() => []),
    listAirports().catch(() => []),
    listArticles({ pageSize: 7 }).then((r) => r.data).catch(() => [] as StrapiArticle[]),
    listCountriesBySlugs(FEATURED_COUNTRY_SLUGS).catch(() => []),
  ]);

  const airlineBySlug = new Map(airlines.map((a) => [a.slug, a]));
  const airlineRows: AirlineRow[] = [...PUBLISHED_AIRLINE_GUIDES]
    .map((slug) => {
      const a = airlineBySlug.get(slug);
      if (!a) return null;
      const checked = (getAirlineFacts(slug)?.modules ?? []).reduce(
        (n, m) => n + Object.values(m.fields ?? {}).filter((f) => f.status === 'official').length,
        0,
      );
      return { slug, name: a.name, iata: a.iataCode ?? '', country: a.country ?? '', checked };
    })
    .filter((r): r is AirlineRow => r !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const guideIatas = new Set(listAirportGuideIatas());
  const airportRows: AirportRow[] = airports
    .filter((a) => a.iata && guideIatas.has(a.iata.toUpperCase()))
    .map((a) => ({ iata: a.iata.toUpperCase(), slug: airportSlug(a, airports), city: a.city || a.name, name: a.name }))
    .sort((a, b) => a.city.localeCompare(b.city));

  const nameOf = (slug: string) => airlineBySlug.get(slug)?.name ?? slug;
  const ledger = ledgerFacts(5);
  const [lead, ...recent] = articles;

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
      target: 'https://www.originfacts.com/all-articles?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  const servicesCatalogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Originfacts Travel Products & Sourced Data Services',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Verified Airline Policy Guides', url: 'https://www.originfacts.com/airlines' },
      { '@type': 'ListItem', position: 2, name: 'Airport Transit & Terminal Intelligence', url: 'https://www.originfacts.com/airports' },
      { '@type': 'ListItem', position: 3, name: 'Flight Route & Carrier Network Explorer', url: 'https://www.originfacts.com/flight-routes' },
      { '@type': 'ListItem', position: 4, name: 'Country & Destination Handbooks', url: 'https://www.originfacts.com/destinations' },
      { '@type': 'ListItem', position: 5, name: 'Real-Time Fact Verification Ledger', url: 'https://www.originfacts.com/#live-ledger' },
      { '@type': 'ListItem', position: 6, name: 'Travel Articles & Tactical Insights', url: 'https://www.originfacts.com/all-articles' },
    ],
  };

  return (
    <div data-testid="home-page" className="text-forest-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(servicesCatalogJsonLd) }} />

      {/* ---------- Hero Section ---------- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-sand-50/80 via-white to-white px-4 pb-14 pt-12 sm:px-6 lg:pb-20 lg:pt-16" data-testid="home-hero">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14">
            <div>
              {/* Trust Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-forest-900/10 bg-white/80 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-forest-950 shadow-xs backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                100% Primary Source Verified
              </div>

              {/* Single H1 for SEO */}
              <h1 className="mt-5 text-[2.4rem] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-[3.5rem] lg:text-[3.8rem]">
                Sourced Airline &amp; Airport Intelligence.
              </h1>
              <p className="mt-5 max-w-[35rem] text-lg leading-relaxed text-slate-600">
                Official baggage limits, check-in cut-offs, airport transit routes, and flight networks — read directly from airline and airport primary pages, complete with timestamps and source links.
              </p>

              {/* Navigation Jump Pills */}
              <nav aria-label="Explore Products & Services" className="mt-8 flex flex-wrap gap-2.5">
                <JumpPill href="#services" label="Our Services" icon="✨" />
                <JumpPill href="/airlines" label="Airline Guides" count={`${airlineRows.length}`} />
                <JumpPill href="/airports" label="Airport Transit" count={`${airportRows.length}`} />
                <JumpPill href="/flight-routes" label="Flight Routes" />
                <JumpPill href="/destinations" label="Destinations" />
              </nav>

              {/* Quick Stat Counter Bar */}
              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-forest-900/10 pt-6">
                <div>
                  <span className="block text-2xl font-extrabold text-forest-950 sm:text-3xl">{airlineRows.length}+</span>
                  <span className="text-xs font-medium text-slate-500">Airline Policy Guides</span>
                </div>
                <div>
                  <span className="block text-2xl font-extrabold text-forest-950 sm:text-3xl">{airportRows.length}+</span>
                  <span className="text-xs font-medium text-slate-500">Airport Transit Guides</span>
                </div>
                <div>
                  <span className="block text-2xl font-extrabold text-emerald-600 sm:text-3xl">100%</span>
                  <span className="text-xs font-medium text-slate-500">Official Primary Sources</span>
                </div>
              </div>
            </div>

            {/* Live Fact Ledger Widget */}
            {ledger.length > 0 && <Ledger facts={ledger} nameOf={nameOf} />}
          </div>
        </div>
      </section>

      {/* ---------- Products & Services Section ---------- */}
      <section id="services" className="border-t border-forest-900/10 bg-slate-50/50 py-16 lg:py-20" aria-labelledby="services-heading">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary-emphasis">Clear, Reliable &amp; Sourced</span>
            <h2 id="services-heading" className="mt-2 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
              What We Offer
            </h2>
            <p className="mt-3 text-base text-slate-600 sm:text-lg">
              We replace aggregator guesswork with timestamped, verified facts read directly from official carrier and airport documentation.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <ServiceCard
              icon={
                <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              }
              title="Airline Policy Guides"
              description="Sourced carry-on and checked luggage dimensions, fare conditions, seat pitch, cancellation rights, and customer support contacts."
              badge={`${airlineRows.length} Checked Carriers`}
              href="/airlines"
            />
            <ServiceCard
              icon={
                <svg className="h-6 w-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              }
              title="Airport Transit & Terminals"
              description="Official transit routes into town (express trains, subways, buses, taxis), terminal maps, connection times, and parking tariffs."
              badge={`${airportRows.length} Airport Guides`}
              href="/airports"
            />
            <ServiceCard
              icon={
                <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              }
              title="Flight Route Network"
              description="Comprehensive non-stop flight lookup, operator breakdowns, carrier flight frequencies, distances, and seasonal route maps."
              badge="Network Data"
              href="/flight-routes"
            />
            <ServiceCard
              icon={
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h1.5a2.5 2.5 0 002.5-2.5V11a2 2 0 012-2h1.065" />
                </svg>
              }
              title="Country Handbooks"
              description="Essential entry rules, hub airport overviews, local currency mappings, time zones, and destination travel guides."
              badge="Country Guides"
              href="/destinations"
            />
            <ServiceCard
              icon={
                <svg className="h-6 w-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="Live Sourced Fact Ledger"
              description="An audit trail of checked travel facts, showing the exact source URL, verified timestamp, and exact figure for total transparency."
              badge="Source Verified"
              href="#live-ledger"
            />
            <ServiceCard
              icon={
                <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              }
              title="Travel Articles & Insights"
              description="Tactical travel guides, luggage packing strategies, airline tier reviews, and airport transit advice written by expert travel analysts."
              badge="Travel Insights"
              href="/all-articles"
            />
          </div>
        </div>
      </section>

      {/* ---------- Airline Guides Section ---------- */}
      {airlineRows.length > 0 && (
        <Band id="airline-guides" title="Airline guides" more={{ href: '/airlines', label: 'All airlines' }}>
          <p className="max-w-2xl text-slate-600">
            Cabin bags, checked bags, fares, check-in cut-offs, and cancellation rules — each figure checked against the airline’s official pages.
          </p>
          <ul className="mt-8 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {airlineRows.map((a) => (
              <li key={a.slug} className="border-t border-forest-900/10">
                <Link
                  href={`/airlines/${a.slug}`}
                  className="group flex items-center gap-3 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-emphasis"
                >
                  {a.iata && <Tag code={a.iata} />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold group-hover:text-primary-emphasis">{a.name}</span>
                    <span className="block text-sm text-slate-500">{a.country}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-success-emphasis">{a.checked} checked</span>
                </Link>
              </li>
            ))}
          </ul>
        </Band>
      )}

      {/* ---------- Airport Guides Section ---------- */}
      {airportRows.length > 0 && (
        <Band id="airport-guides" title="Airport guides" more={{ href: '/airports/top-100-airports', label: 'Top 100 airports' }}>
          <p className="max-w-2xl text-slate-600">
            Terminals, trains and express buses into town, taxis and parking rates, cited directly to airport and transport operators.
          </p>
          <ul className="mt-8 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
            {airportRows.map((a) => (
              <li key={a.iata} className="border-t border-forest-900/10">
                <Link
                  href={`/airports/${a.slug}`}
                  className="group flex items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-emphasis"
                >
                  <Tag code={a.iata} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold group-hover:text-primary-emphasis">{a.city}</span>
                    <span className="block truncate text-sm text-slate-500">{a.name}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Band>
      )}

      {/* ---------- Destination Photography Section ---------- */}
      {countries.length > 0 && (
        <Band id="countries" title="Featured Destinations" more={{ href: '/destinations', label: 'All destinations' }}>
          <p className="mb-8 max-w-2xl text-slate-600">
            Explore entry rules, hub airports, and flight networks for destinations worldwide.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {countries.map((c) => {
              const photo = SITE_PHOTOS[c.slug as keyof typeof SITE_PHOTOS];
              return (
                <Link
                  key={c.slug}
                  href={`/destinations/${c.slug}`}
                  className="group relative flex h-60 flex-col justify-end overflow-hidden rounded-xl border border-forest-900/10 bg-slate-900 p-5 text-white transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-emphasis"
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.src}
                      alt={photo.alt}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-105 group-hover:opacity-85"
                      style={photo.focus ? { objectPosition: photo.focus } : undefined}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-forest-900 to-slate-950" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="relative z-10">
                    <span className="text-xs font-medium uppercase tracking-wider text-sand-300">Country Guide</span>
                    <h3 className="text-xl font-bold tracking-tight text-white group-hover:text-sand-200">{c.name}</h3>
                    {photo && <p className="mt-1 text-xs text-slate-300 line-clamp-1">{photo.place}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </Band>
      )}

      {/* ---------- Articles Section ---------- */}
      {lead && (
        <Band id="articles" title="Latest articles & insights" more={{ href: '/all-articles', label: 'All articles' }}>
          <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
            <LeadArticle article={lead} />
            <ol className="divide-y divide-forest-900/10 border-y border-forest-900/10">
              {recent.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <Link href={`/articles/${a.slug}`} className="group block py-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {a.category?.name ?? 'Article'} · <time dateTime={a.publishedAt}>{shortDate(a.publishedAt)}</time>
                    </span>
                    <span className="mt-1 block font-semibold leading-snug group-hover:text-primary-emphasis">{a.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          <nav aria-label="Article topics" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {ARTICLE_SECTIONS.map((s) => (
              <Link key={s.slug} href={`/category/${s.slug}`} className="font-semibold text-primary-emphasis underline-offset-4 hover:underline">
                {s.title}
              </Link>
            ))}
          </nav>
        </Band>
      )}

      {/* ---------- Methodology Section ---------- */}
      <Band id="method" title="How a figure gets onto a page">
        <ul className="grid gap-8 sm:grid-cols-3">
          <Principle title="Read from the source">
            Airline figures come from the airline’s own pages; airport figures from the airport and its official transport operators. Aggregators and booking sites are never used as sources.
          </Principle>
          <Principle title="Dated and linked">
            Every figure carries the exact page it was read from and the date we checked it, so you can see how fresh it is.
          </Principle>
          <Principle title="Blank when unchecked">
            If we haven’t verified something, the page says so explicitly instead of guessing. Where official pages disagree, we show both figures side by side.
          </Principle>
        </ul>
        <Link href="/methodology" className="mt-8 inline-block font-semibold text-primary-emphasis underline-offset-4 hover:underline">
          Read our full methodology →
        </Link>
      </Band>

      {/* ---------- Labelled Partner Banner ---------- */}
      <aside className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-label="Advertisement" data-testid="home-ad-banner">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Advertisement</p>
        <a
          href={partnerLink('https://www.cheapoair.com/', 'originfacts_home_banner_wide')}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          className="mt-2 flex flex-col items-start justify-between gap-3 rounded-lg border border-forest-900/10 bg-white px-5 py-4 shadow-xs transition hover:border-forest-900/25 sm:flex-row sm:items-center"
        >
          <span>
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">CheapOair</span>
            <span className="mt-0.5 block font-semibold">Compare flights and book online</span>
          </span>
          <span className="text-sm font-semibold text-primary-emphasis">Search CheapOair →</span>
        </a>
      </aside>

      <SubscribeBlock />
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function JumpPill({ href, label, count, icon }: { href: string; label: string; count?: string; icon?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-forest-900/15 bg-white px-4 py-2 text-sm font-medium text-forest-950 transition hover:border-primary-emphasis hover:text-primary-emphasis hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-emphasis"
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
      {count && <span className="rounded-full bg-sand-200/60 px-2 py-0.5 text-xs font-semibold tabular-nums text-forest-900">{count}</span>}
    </Link>
  );
}

function ServiceCard({
  icon,
  title,
  description,
  badge,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between rounded-xl border border-forest-900/10 bg-white p-6 transition hover:border-primary-emphasis/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-emphasis"
    >
      <div>
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100/80">
            {icon}
          </div>
          <span className="rounded-full bg-sand-100 px-2.5 py-1 text-[11px] font-semibold text-forest-900">
            {badge}
          </span>
        </div>
        <h3 className="mt-4 text-xl font-bold tracking-tight text-forest-950 group-hover:text-primary-emphasis">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {description}
        </p>
      </div>
      <div className="mt-6 flex items-center text-sm font-semibold text-primary-emphasis">
        Explore {title} <span className="ml-1.5 transition-transform group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
}

function Tag({ code }: { code: string }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-8 w-[3.6rem] shrink-0 items-center justify-center rounded-[4px] bg-sand-100 pl-2 text-[0.8rem] font-extrabold tabular-nums tracking-[0.12em] text-forest-950 ring-1 ring-inset ring-sand-400/60"
    >
      <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white ring-1 ring-sand-400/70" />
      {code}
    </span>
  );
}

function Ledger({ facts, nameOf }: { facts: LedgerFact[]; nameOf: (slug: string) => string }) {
  return (
    <figure id="live-ledger" className="self-center rounded-xl border border-forest-900/10 bg-white p-2 shadow-[0_1px_0_rgba(9,24,64,0.04),0_18px_40px_-24px_rgba(9,24,64,0.25)]">
      <figcaption className="flex items-center justify-between px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
        <span>Live Verified Source Ledger</span>
        <span className="inline-flex items-center gap-1.5 text-success-emphasis">
          <CheckMark /> Verified Sourced
        </span>
      </figcaption>
      <ol className="divide-y divide-forest-900/[0.07]">
        {facts.map((f) => (
          <li key={f.slug + f.label} className="px-4 py-4">
            <Link href={`/airlines/${f.slug}`} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-emphasis">
              <span className="block text-sm text-slate-500">
                <span className="font-semibold text-forest-950 group-hover:text-primary-emphasis">{nameOf(f.slug)}</span>
                {' · '}
                {f.label}
              </span>
              <span className="mt-1 block text-xl font-bold leading-snug tracking-[-0.015em]">{f.value}</span>
            </Link>
            <a
              href={f.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary-emphasis"
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

function Band({
  id,
  title,
  more,
  children,
}: {
  id: string;
  title: string;
  more?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="border-t border-forest-900/10" data-testid={`home-${id}`}>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-16">
        <div className="mb-5 flex items-baseline justify-between gap-6">
          <h2 id={`${id}-heading`} className="text-2xl font-extrabold tracking-[-0.025em] sm:text-[1.9rem]">
            {title}
          </h2>
          {more && (
            <Link href={more.href} className="shrink-0 text-sm font-semibold text-primary-emphasis underline-offset-4 hover:underline">
              {more.label} <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

function LeadArticle({ article }: { article: StrapiArticle }) {
  const img = mediaUrl(article.coverImage ?? null);
  return (
    <article className="group">
      <Link href={`/articles/${article.slug}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-emphasis">
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={article.coverImage?.alternativeText || ''}
            loading="lazy"
            className="aspect-[16/9] w-full rounded-lg object-cover shadow-xs"
          />
        )}
        <span className="mt-4 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
          {article.category?.name ?? 'Article'} · <time dateTime={article.publishedAt}>{shortDate(article.publishedAt)}</time>
        </span>
        <h3 className="mt-1.5 text-2xl font-extrabold leading-tight tracking-[-0.02em] group-hover:text-primary-emphasis">
          {article.title}
        </h3>
        {article.excerpt && <p className="mt-2 line-clamp-3 leading-relaxed text-slate-600">{article.excerpt}</p>}
      </Link>
    </article>
  );
}

function Principle({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li>
      <p className="flex items-center gap-2 font-bold">
        <CheckMark className="text-success-emphasis" />
        {title}
      </p>
      <p className="mt-2 leading-relaxed text-slate-600">{children}</p>
    </li>
  );
}

function CheckMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`h-3.5 w-3.5 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
