import Link from 'next/link';
import type { Metadata } from 'next';
import {
  listArticles,
  listAirlines,
  listAirports,
  listDestinations,
  fetchRouteCoverage,
} from '@/lib/strapi';
import { SECTIONS } from '@/lib/sections';
import { LEGAL_DOCS } from '@/lib/legal';
import { AIRLINES_INDEXABLE, AIRPORTS_INDEXABLE, airportIsPublished, airportIsSubstantive } from '@/lib/entity-seo';
import { airlineGuideIsPublished, airlineIsIndexable } from '@/lib/airline-tier';
import { airportPath } from '@/lib/airport-slugs';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/SeoBlocks';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Site Map',
  description: 'An index of every indexed page on Originfacts — articles, destination guides, verified airline guides, airport guides, categories and policies.',
  /**
   * `noindex, follow`. This page is a navigation aid for people, not a
   * destination, and `follow` is kept because crawling through to the real
   * pages is the point of it.
   *
   * It used to enumerate every airline, airport and country straight from
   * Strapi with no tier gate — 5,190 directory rows against 90 articles — so
   * anyone sampling the site from here landed on a noindexed stub 98 times in
   * 100. It now lists exactly what the XML sitemap lists: the same gates,
   * the same sets, and no URLs that only redirect.
   */
  robots: { index: false, follow: true },
};

export default async function SitemapPage() {
  const [articlesRes, destinations, allAirlines, allAirports, coverage] = await Promise.all([
    listArticles({ pageSize: 200 }).catch(() => ({ data: [], meta: null as never })),
    listDestinations().catch(() => []),
    listAirlines().catch(() => []),
    listAirports().catch(() => []),
    fetchRouteCoverage().catch(() => ({ originIatas: new Set<string>(), carrierSlugs: new Set<string>() })),
  ]);

  const articles = articlesRes.data;
  const sortedDestinations = [...destinations].sort((a, b) => a.name.localeCompare(b.name));

  // Same gate as app/sitemap.ts — reviewed guides, plus the tier gate once the
  // directory-wide hold is lifted.
  const airlines = allAirlines
    .filter(
      (a) =>
        a.slug &&
        (airlineGuideIsPublished(a.slug) ||
          (AIRLINES_INDEXABLE && airlineIsIndexable(a, coverage.carrierSlugs.has(a.slug)))),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const airports = allAirports
    .filter((a) => a.iata && (AIRPORTS_INDEXABLE || airportIsPublished(a.iata)) && airportIsSubstantive(a, coverage.originIatas.has(a.iata)))
    .sort((a, b) => a.iata.localeCompare(b.iata));

  const linkClass = 'text-primary-emphasis hover:text-primary-highlight hover:underline';
  const sectionTitle = 'editorial-h text-2xl font-bold text-forest-900';

  const breadcrumbs = breadcrumbJsonLd([{ name: 'Site Map', url: '/sitemap' }]);

  return (
    <article className="mx-auto max-w-7xl px-6 py-16" data-testid="sitemap-page">
      <JsonLd data={breadcrumbs} />
      <header className="max-w-3xl">
        <p className="chip">Site Map</p>
        <h1 className="editorial-h mt-5 text-3xl font-bold leading-tight text-forest-900 sm:text-4xl">
          Site Map
        </h1>
        <p className="mt-3 text-lg text-forest-900/75">
          Every indexed page on Originfacts, in one place. The full airline and airport directories are
          searchable from their own hubs. Looking for something a search engine can read?{' '}
          <a href="/sitemap.xml" className={linkClass}>View the XML sitemap</a>.
        </p>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className={sectionTitle}>What are the core site sections on Originfacts?</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/" className={linkClass}>Home</Link></li>
            <li><Link href="/about" className={linkClass}>About</Link></li>
            <li><Link href="/authors" className={linkClass}>Authors &amp; Editorial Experts</Link></li>
            <li><Link href="/methodology" className={linkClass}>Methodology</Link></li>
            <li><Link href="/faq" className={linkClass}>FAQ</Link></li>
            <li><Link href="/contact" className={linkClass}>Contact</Link></li>
            <li><Link href="/all-articles" className={linkClass}>All articles</Link></li>
          </ul>
        </section>

        <section>
          <h2 className={sectionTitle}>Which travel topics can you explore?</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.slug}>
                <Link href={`/category/${s.slug}`} className={linkClass}>{s.title}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className={sectionTitle}>Which flight directories and travel tools can you discover?</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/flight-search" className={linkClass}>Flight Search</Link></li>
            <li><Link href="/flight-routes" className={linkClass}>Flight Routes</Link></li>
            <li><Link href="/hotels" className={linkClass}>Hotels</Link></li>
            <li><Link href="/destinations" className={linkClass}>Destinations</Link></li>
            <li><Link href="/countries" className={linkClass}>Countries</Link></li>
            <li><Link href="/airlines" className={linkClass}>Airlines</Link></li>
            <li><Link href="/airports" className={linkClass}>Airports</Link></li>
            <li><Link href="/airports/hubs" className={linkClass}>International hubs</Link></li>
          </ul>
        </section>

        <section>
          <h2 className={sectionTitle}>Which legal policies govern Originfacts?</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {LEGAL_DOCS.map((d) => (
              <li key={d.slug}>
                <Link href={`/legal/${d.slug}`} className={linkClass}>{d.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {articles.length > 0 && (
        <section className="mt-16">
          <h2 className={sectionTitle}>
            Articles <span className="text-base font-normal text-forest-900/60">({articles.length})</span>
          </h2>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <li key={a.id}>
                <Link href={`/articles/${a.slug}`} className={linkClass}>{a.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sortedDestinations.length > 0 && (
        <section className="mt-16">
          <h2 className={sectionTitle}>
            Destinations <span className="text-base font-normal text-forest-900/60">({sortedDestinations.length})</span>
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-forest-900/65">
            Continents, countries and cities. Country guides are the canonical page for each country — the
            older <Link href="/countries" className={linkClass}>/countries</Link> URLs redirect here.
          </p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {sortedDestinations.map((d) => (
              <li key={d.id}>
                <Link href={`/destinations/${d.slug}`} className={linkClass}>{d.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {airlines.length > 0 && (
        <section className="mt-16">
          <h2 className={sectionTitle}>
            Airline guides <span className="text-base font-normal text-forest-900/60">({airlines.length})</span>
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-forest-900/65">
            Verified guides whose figures cite official carrier sources. Every other carrier is listed on the{' '}
            <Link href="/airlines" className={linkClass}>airlines directory</Link>.
          </p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {airlines.map((a) => (
              <li key={a.id}>
                <Link href={`/airlines/${a.slug}`} className={linkClass}>{a.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {airports.length > 0 && (
        <section className="mt-16">
          <h2 className={sectionTitle}>
            Airport guides <span className="text-base font-normal text-forest-900/60">({airports.length})</span>
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-forest-900/65">
            Major hubs with a full guide. The complete airport directory is searchable from the{' '}
            <Link href="/airports" className={linkClass}>airports hub</Link>.
          </p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {airports.map((a) => (
              <li key={a.id}>
                <Link href={airportPath(a, allAirports)} className={linkClass}>
                  {a.iata.toUpperCase()} — {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
