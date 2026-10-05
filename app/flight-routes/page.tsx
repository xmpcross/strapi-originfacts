import type { Metadata } from 'next';
import Link from 'next/link';
import { Globe, Info, Map as MapIcon, Plane, PlaneTakeoff, Route as RouteIcon, Ruler, Search, Star } from 'lucide-react';
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

  const WRAP = 'mx-auto max-w-7xl px-4 sm:px-6';
  const stats = [
    { label: 'Routes', value: directory.length, icon: RouteIcon },
    { label: 'Departure airports', value: originCount, icon: PlaneTakeoff },
    { label: 'Countries', value: countryCount, icon: Globe },
    ...(airlineCount > 0 ? [{ label: 'Airlines', value: airlineCount, icon: Plane }] : []),
  ];
  const jumps = [
    { href: '#featured-routes-heading', label: 'Popular', icon: Star },
    { href: '#route-directory-heading', label: 'Search', icon: Search },
    { href: '#routes-index', label: 'By airport', icon: MapIcon },
    { href: '#routes-guide-heading', label: 'About', icon: RouteIcon },
  ];

  return (
    <div className="bg-forest-50" data-testid="flights-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header
        className="relative overflow-hidden border-b border-forest-900/10 bg-gradient-to-br from-white via-forest-50 to-sand-100"
        data-testid="routes-header"
      >
        <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full text-forest-900/10" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 8">
          <path d="M-50 360 C 250 40, 650 20, 1250 300" />
          <path d="M-50 260 C 300 -40, 800 60, 1250 120" />
          <path d="M200 420 C 500 160, 900 140, 1250 220" />
        </svg>
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sand-300/30 blur-3xl" />
        <div className={`${WRAP} relative pb-8 pt-6 lg:pb-10`}>
          <nav aria-label="Breadcrumb" className="text-sm text-forest-900/75">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li className="flex items-center gap-1.5">
                <Link href="/" className="hover:text-primary-emphasis hover:underline">
                  Home
                </Link>
                <span aria-hidden>/</span>
              </li>
              <li aria-current="page" className="font-medium text-forest-950">
                {HUB.name}
              </li>
            </ol>
          </nav>

          <div className="mt-6 flex min-w-0 items-start gap-4 sm:gap-6">
            <div
              aria-hidden
              className="flex h-16 w-16 flex-none items-center justify-center rounded-[0.5rem] bg-sand-300 text-forest-950 shadow-lg shadow-black/20 sm:h-24 sm:w-24"
            >
              <RouteIcon className="h-8 w-8 sm:h-12 sm:w-12" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary-emphasis">
                <PlaneTakeoff aria-hidden className="h-3.5 w-3.5" />
                Route directory
              </p>
              <h1 className="mt-1 text-3xl leading-tight sm:text-4xl">Flight routes</h1>
              <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-forest-900/80 sm:text-base">
                City pairs from our route records, each with its two airports, the distance, an estimated flight time
                and the airlines we have on file. Open a route for its schedule and fare search.
              </p>
              <p className="mt-2 text-xs text-forest-900/65" data-testid="routes-coverage-note">
                These are the routes we track — not every route flown.
              </p>
            </div>
          </div>

          <dl className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="routes-stats">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 rounded-[0.4rem] border border-forest-900/10 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,39,102,0.04)]">
                <span aria-hidden className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-forest-950 text-sand-300">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-forest-900/70">{label}</dt>
                  <dd className="text-lg font-bold leading-tight text-forest-950">{value.toLocaleString()}</dd>
                </div>
              </div>
            ))}
          </dl>

          <nav aria-label="On this page" className="no-scrollbar mt-6 flex gap-2 overflow-x-auto" data-testid="routes-subnav">
            {jumps.map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                className="inline-flex flex-none items-center gap-2 rounded-full border border-forest-900/15 bg-white px-4 py-2 text-sm font-semibold text-forest-950 transition hover:border-primary-emphasis hover:text-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
              >
                <Icon aria-hidden className="h-4 w-4" />
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className={`${WRAP} pb-16`}>
      <FeaturedRoutes routes={featured} carriers={carriers} />

      <RouteDirectory rows={directory.map(toRow)} carriers={carriers} />

      <details id="routes-index" className="group mt-10 scroll-mt-24 rounded-[0.5rem] border border-forest-900/10 bg-white" data-testid="routes-index">
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

      <section className="mt-14 scroll-mt-24" aria-labelledby="routes-guide-heading" data-testid="routes-about">
        <h2 id="routes-guide-heading" className="flex items-center gap-2.5 text-xl sm:text-2xl">
          <Info aria-hidden className="h-6 w-6 text-primary-emphasis" />
          What the directory shows
        </h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            {
              icon: RouteIcon,
              title: 'Our route records',
              text: `${directory.length.toLocaleString()} routes from ${originCount.toLocaleString()} departure airports, ${(directory.length - domesticCount).toLocaleString()} of them international. They are the routes we keep records for, not a full airline schedule: a city pair missing here may still be flown.`,
            },
            {
              icon: Ruler,
              title: 'Distance and flight time',
              text: 'Distances are in kilometres between the two airports. Flight times are estimates of the nonstop time from our records; the schedule on each route page shows the actual flights.',
            },
            {
              icon: Plane,
              title: 'Airlines on a route',
              text: 'Airlines are the carriers our route records link to the city pair. Airlines with a sourced end of operations are left off, as are foreign carriers listed on a domestic route.',
            },
          ].map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-[0.5rem] border border-forest-900/10 bg-white p-4 shadow-[0_1px_2px_rgba(15,39,102,0.04)]">
              <h3 className="flex items-center gap-2.5 text-base leading-snug text-forest-950">
                <span aria-hidden className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-forest-950 text-sand-300">
                  <Icon className="h-4 w-4" />
                </span>
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-forest-900/80">{text}</p>
            </li>
          ))}
        </ul>
      </section>
      </div>
    </div>
  );
}
