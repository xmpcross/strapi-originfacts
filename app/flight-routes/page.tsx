import type { Metadata } from 'next';
import Link from 'next/link';
import { listAirportSlugIndex, listCountries, listRoutes, type StrapiAirport } from '@/lib/strapi';
import RouteDirectory from '@/components/route-directory/RouteDirectory';
import FeaturedRoutes from '@/components/route-directory/FeaturedRoutes';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';
import { airportSlug } from '@/lib/airport-slugs';
import { airportCountryIndex } from '@/lib/airport-directory';
import { operableCarriers } from '@/lib/route-carriers';
import { airlineHasCeased, isNonAirline } from '@/lib/airline-status';
import { SECTIONS } from '@/lib/sections';
import {
  FEATURED_ROUTES,
  ROUTES_BROWSE_LIMIT,
  compareRoutesAZ,
  isDomestic,
  rankRoutes,
  toRow,
  type DirectoryCarrier,
  type DirectoryRoute,
  type RouteEnd,
} from '@/lib/route-directory';

export const revalidate = 60;

const HUB = HUB_INTROS['flight-routes'];
const PATH = HUB_PATHS['flight-routes'];

export const metadata: Metadata = {
  title: 'Flight Routes & Airlines by City Pair',
  description: HUB.description,
  alternates: { canonical: PATH },
  robots: { index: true, follow: true },
};

export default async function FlightsPage() {
  const [routes, slugIndex, countries] = await Promise.all([
    listRoutes().catch(() => []),
    listAirportSlugIndex().catch(() => []),
    listCountries().catch(() => []),
  ]);

  // Country spelling and region come from the country collection, as on
  // /airports and /airlines, so a country groups the same way on all three.
  const countryOf = airportCountryIndex(countries);
  const toEnd = (a: StrapiAirport): RouteEnd => {
    const { country, region } = countryOf(a);
    return {
      iata: a.iata.toUpperCase(),
      city: a.city || a.name,
      name: a.name,
      ...(country ? { country } : {}),
      ...(region ? { region } : {}),
      slug: airportSlug(a, slugIndex),
    };
  };

  // One carrier table for the page; routes refer to it by index. Carriers are
  // the ones the route page itself lists (operableCarriers), minus anything
  // that is not an airline and any airline with a sourced cessation — both
  // matched by slug, never by IATA code.
  const carriers: DirectoryCarrier[] = [];
  const carrierIndex = new Map<string, number>();
  const carrierRef = (c: { slug: string; name: string; iataCode?: string }) => {
    let i = carrierIndex.get(c.slug);
    if (i === undefined) {
      i = carriers.length;
      carriers.push({ slug: c.slug, name: c.name, ...(c.iataCode ? { iata: c.iataCode } : {}) });
      carrierIndex.set(c.slug, i);
    }
    return i;
  };

  // Routes missing either endpoint have no page (the route page 404s).
  const directory: DirectoryRoute[] = routes
    .filter((r) => r.origin?.iata && r.destination?.iata && r.slug)
    .map((r) => ({
      slug: r.slug,
      origin: toEnd(r.origin!),
      destination: toEnd(r.destination!),
      ...(r.distanceKm && r.distanceKm > 0 ? { distanceKm: r.distanceKm } : {}),
      ...(r.durationMinutes && r.durationMinutes > 0 ? { durationMinutes: r.durationMinutes } : {}),
      popularity: r.popularity ?? 0,
      carriers: operableCarriers(r)
        .filter((c) => c?.slug && !isNonAirline(c.slug) && !airlineHasCeased(c.slug))
        .map(carrierRef),
    }))
    .sort(rankRoutes);

  const originCount = new Set(directory.map((r) => r.origin.iata)).size;
  const destinationCount = new Set(directory.map((r) => r.destination.iata)).size;
  const countryCount = new Set(
    directory.flatMap((r) => [r.origin.country, r.destination.country]).filter(Boolean),
  ).size;
  const airlineCount = new Set(directory.flatMap((r) => r.carriers)).size;
  const domesticCount = directory.filter(isDomestic).length;

  const featured = directory.slice(0, FEATURED_ROUTES);

  // Every route page stays linked from this page: the directory renders only
  // the first ROUTES_BROWSE_LIMIT cards, so all routes are also listed here
  // as plain links, grouped by departure airport.
  const byOrigin = new Map<string, { end: RouteEnd; routes: DirectoryRoute[] }>();
  for (const r of [...directory].sort(compareRoutesAZ)) {
    const g = byOrigin.get(r.origin.iata);
    if (g) g.routes.push(r);
    else byOrigin.set(r.origin.iata, { end: r.origin, routes: [r] });
  }

  // The ItemList is the cards the directory shows on load, in that order.
  const collectionJsonLd = collectionPageJsonLd({
    name: HUB.name,
    description: HUB.description,
    url: PATH,
    itemListName: 'Flight routes',
    max: ROUTES_BROWSE_LIMIT,
    items: directory.map((r) => ({
      name: `Flights from ${r.origin.city} to ${r.destination.city} (${r.origin.iata} → ${r.destination.iata})`,
      url: `/flight-routes/${r.slug}`,
    })),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16" data-testid="flights-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header data-testid="routes-header">
        <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-12">
          <div className="min-w-0">
            <h1 className="text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">Flight routes</h1>
            <p className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-forest-900/70 sm:text-lg">
              City pairs from our route records, each with its two airports, the distance, an estimated flight time
              and the airlines we have on file for it. Open a route for its schedule and fare search.
            </p>
            <p className="mt-3 text-sm text-forest-900/60" data-testid="routes-coverage-note">
              These are the routes we track — not every route flown.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-forest-900/70" data-testid="routes-stats">
              <li className="sm:hidden">
                <strong className="font-semibold text-forest-950">{directory.length.toLocaleString()}</strong> routes
              </li>
              <li>
                <strong className="font-semibold text-forest-950">{originCount.toLocaleString()}</strong> departure
                airports
              </li>
              <li>
                <strong className="font-semibold text-forest-950">{destinationCount.toLocaleString()}</strong> arrival
                airports
              </li>
              <li>
                <strong className="font-semibold text-forest-950">{countryCount.toLocaleString()}</strong> countries
              </li>
              {airlineCount > 0 && (
                <li>
                  <strong className="font-semibold text-forest-950">{airlineCount.toLocaleString()}</strong> airlines
                </li>
              )}
              <li>
                <a
                  href="#route-directory-heading"
                  className="font-semibold text-primary-emphasis underline-offset-2 hover:underline"
                >
                  Search the routes ↓
                </a>
              </li>
            </ul>
          </div>
          <div
            className="hidden h-32 w-32 flex-col items-center justify-center rounded-[0.3rem] bg-forest-50 text-forest-950 sm:flex"
            data-testid="routes-count"
          >
            <span className="text-4xl font-bold leading-none">{directory.length.toLocaleString()}</span>
            <span className="mt-2 text-[11px] font-bold uppercase tracking-widest text-forest-900/70">Routes</span>
          </div>
        </div>

        <nav
          className="no-scrollbar mt-10 flex items-center gap-x-8 overflow-x-auto whitespace-nowrap border-y border-forest-900/15 py-4 text-[14px] font-bold uppercase tracking-widest text-forest-950 sm:flex-wrap sm:gap-y-3"
          aria-label="Categories"
          data-testid="routes-subnav"
        >
          {[
            ...SECTIONS.filter((s) => s.slug !== 'destinations').map((s) => ({
              href: `/category/${s.slug}`,
              slug: s.slug,
              name: s.title,
            })),
            { href: '/airlines', slug: 'airlines', name: 'Airlines' },
            { href: '/airports', slug: 'airports', name: 'Airports' },
          ].map((item) => (
            <Link key={item.slug} href={item.href} className="transition hover:text-primary-emphasis">
              {item.name}
            </Link>
          ))}
        </nav>
      </header>

      <FeaturedRoutes routes={featured} carriers={carriers} />

      <RouteDirectory rows={directory.map(toRow)} carriers={carriers} />

      <details className="group mt-10 rounded-[0.3rem] border border-forest-900/10 bg-white" data-testid="routes-index">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-forest-950 hover:text-primary-emphasis [&::-webkit-details-marker]:hidden">
          All {directory.length.toLocaleString()} routes by departure airport, A–Z
          <span aria-hidden className="text-forest-900/50 transition group-open:rotate-180">
            ▾
          </span>
        </summary>
        {/* Styled from the list down: 500+ links, so no per-item class strings. */}
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 border-t border-forest-900/10 px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-3 [&_dt]:font-semibold [&_dt_a]:text-forest-950 [&_dd]:mt-0.5 [&_dd]:leading-relaxed [&_dd_a]:text-forest-900/75 [&_a:hover]:text-primary-emphasis [&_a:hover]:underline [&_small]:font-mono [&_small]:text-xs [&_small]:text-forest-900/50">
          {[...byOrigin.values()].map(({ end, routes: list }) => (
            <div key={end.iata} className="min-w-0">
              <dt>
                <a href={`/airports/${end.slug}`}>{end.city}</a> <small>{end.iata}</small>
              </dt>
              <dd>
                {list.map((r, i) => (
                  <span key={r.slug}>
                    {i > 0 && ' · '}
                    <a href={`/flight-routes/${r.slug}`}>{r.destination.city}</a>
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </details>

      <section
        className="mt-20 border-t border-forest-900/15 pt-12"
        aria-labelledby="routes-guide-heading"
        data-testid="routes-about"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-forest-900/55">Using the directory</p>
        <h2 id="routes-guide-heading" className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
          What the directory shows
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
          {[
            {
              title: 'Our route records',
              text: `${directory.length.toLocaleString()} routes from ${originCount.toLocaleString()} departure airports, ${(directory.length - domesticCount).toLocaleString()} of them international. They are the routes we keep records for, not a full airline schedule: a city pair missing here may still be flown.`,
            },
            {
              title: 'Distance and flight time',
              text: 'Distances are in kilometres between the two airports. Flight times are estimates of the nonstop time from our records; the schedule on each route page shows the actual flights.',
            },
            {
              title: 'Airlines on a route',
              text: 'Airlines are the carriers our route records link to the city pair. Airlines with a sourced end of operations are left off, as are foreign carriers listed on a domestic route.',
            },
          ].map((item, i) => (
            <article key={item.title} className="border-t-2 border-forest-950 pt-4">
              <p className="font-mono text-xs font-bold text-forest-900/50">0{i + 1}</p>
              <h3 className="mt-2 text-xl font-bold leading-snug">{item.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-forest-900/70">{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
