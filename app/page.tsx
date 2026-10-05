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
import {
  listAirlines,
  listAirports,
  listArticles,
  listCountriesBySlugs,
  mediaUrl,
  type StrapiArticle,
} from '@/lib/strapi';

export const revalidate = 60;

const TITLE = 'Originfacts — airline and airport facts, each with its source';
const DESCRIPTION =
  'Baggage limits, check-in cut-offs and airport transport, read from the airlines’ and airports’ own pages and dated. Airline guides, airport guides, flight routes and travel articles.';

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

  return (
    <div data-testid="home-page" className="text-forest-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />

      {/* ---------- Thesis + ledger ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-10 sm:px-6 lg:pb-20 lg:pt-16" data-testid="home-hero">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div className="flex flex-col justify-center">
            <h1 className="text-[2.35rem] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[3.4rem] lg:text-[4rem]">
              Airline and airport facts, each one with its source.
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-slate-600">
              Baggage limits, check-in cut-offs and how to get into town, read from the airlines’ and airports’ own
              pages and dated when we checked them. Where we haven’t checked a figure, the page says so.
            </p>
            <nav aria-label="Start here" className="mt-9 grid grid-cols-2 gap-2.5 sm:max-w-md">
              <JumpLink href="/airlines" label="Airlines" note={`${airlineRows.length} checked guides`} />
              <JumpLink href="/airports" label="Airports" note={`${airportRows.length} airport guides`} />
              <JumpLink href="/flight-routes" label="Flight routes" note="Who flies where" />
              <JumpLink href="/destinations" label="Countries" note="Country guides" />
            </nav>
          </div>

          {ledger.length > 0 && <Ledger facts={ledger} nameOf={nameOf} />}
        </div>
      </section>

      {/* ---------- Airline guides ---------- */}
      {airlineRows.length > 0 && (
        <Band id="airline-guides" title="Airline guides" more={{ href: '/airlines', label: 'All airlines' }}>
          <p className="max-w-2xl text-slate-600">
            Cabin bags, checked bags, fares, check-in and what happens when a flight is cancelled, each figure checked
            against the airline’s own pages.
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

      {/* ---------- Airport guides ---------- */}
      {airportRows.length > 0 && (
        <Band id="airport-guides" title="Airport guides" more={{ href: '/airports/top-100-airports', label: 'Top 100 airports' }}>
          <p className="max-w-2xl text-slate-600">
            Terminals, trains and buses into town, taxis and parking, cited to the airport and transport operators.
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

      {/* ---------- Articles ---------- */}
      {lead && (
        <Band id="articles" title="Latest articles" more={{ href: '/all-articles', label: 'All articles' }}>
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

      {/* ---------- Countries ---------- */}
      {countries.length > 0 && (
        <Band id="countries" title="Countries" more={{ href: '/destinations', label: 'All countries' }}>
          <ul className="flex flex-wrap gap-x-2 gap-y-3">
            {countries.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/destinations/${c.slug}`}
                  className="inline-block rounded-full border border-forest-900/15 px-4 py-2 font-medium hover:border-primary-emphasis hover:text-primary-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-emphasis"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </Band>
      )}

      {/* ---------- Method ---------- */}
      <Band id="method" title="How a figure gets onto a page">
        <ul className="grid gap-8 sm:grid-cols-3">
          <Principle title="Read from the source">
            Airline figures come from the airline’s own pages; airport figures from the airport and its transport
            operators. Aggregators and booking sites are not used.
          </Principle>
          <Principle title="Dated and linked">
            Every figure carries the page it came from and the day we checked it, so you can see how fresh it is.
          </Principle>
          <Principle title="Blank when unchecked">
            If we haven’t verified something, the page says so instead of guessing. Where official pages disagree, we
            show both.
          </Principle>
        </ul>
        <Link href="/methodology" className="mt-8 inline-block font-semibold text-primary-emphasis underline-offset-4 hover:underline">
          Read our methodology
        </Link>
      </Band>

      {/* ---------- One labelled partner slot ---------- */}
      <aside className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-label="Advertisement" data-testid="home-ad-banner">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Advertisement</p>
        <a
          href={partnerLink('https://www.cheapoair.com/', 'originfacts_home_banner_wide')}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          className="mt-2 flex flex-col items-start justify-between gap-3 rounded-md border border-forest-900/10 px-5 py-4 transition hover:border-forest-900/25 sm:flex-row sm:items-center"
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

/* ---------- pieces ---------- */

/** An IATA code set like the code on a bag tag: the one thing travellers already read at a glance. */
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

function JumpLink({ href, label, note }: { href: string; label: string; note: string }) {
  return (
    <Link
      href={href}
      className="group rounded-md border border-forest-900/15 px-4 py-3 transition hover:border-primary-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-emphasis"
    >
      <span className="block font-semibold group-hover:text-primary-emphasis">
        {label} <span aria-hidden="true">→</span>
      </span>
      <span className="block text-sm text-slate-500">{note}</span>
    </Link>
  );
}

function Ledger({ facts, nameOf }: { facts: LedgerFact[]; nameOf: (slug: string) => string }) {
  return (
    <figure className="self-center rounded-xl border border-forest-900/10 bg-white p-2 shadow-[0_1px_0_rgba(9,24,64,0.04),0_18px_40px_-24px_rgba(9,24,64,0.25)]">
      <figcaption className="flex items-center justify-between px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
        <span>From the airline guides</span>
        <span className="inline-flex items-center gap-1.5 text-success-emphasis">
          <CheckMark /> Checked
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
    <section aria-labelledby={`${id}-heading`} className="border-t border-forest-900/10" data-testid={`home-${id}`}>
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
            className="aspect-[16/9] w-full rounded-md object-cover"
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
