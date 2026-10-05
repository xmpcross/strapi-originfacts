import Link from 'next/link';
import type { ReactNode } from 'react';
import type { StrapiAirport, StrapiRoute } from '@/lib/strapi';
import type { AirportWeather } from '@/lib/open-meteo';
import { weatherLabel } from '@/lib/open-meteo';
import SectionNav, { type NavItem } from './SectionNav';
import { displayUrl, type Faq } from './faqs';

/**
 * Airport page, v2 layout — a sibling of the airline v2 page
 * (components/airline-v2/AirlineGuideV2.tsx). Rendered only for slugs in
 * lib/airport-template-v2.ts; every other airport keeps the existing layout.
 *
 * Data is not fetched or derived here. The page route computes everything once
 * (airport record, airport-info contact fields, route records, official links,
 * Open-Meteo weather, nearest airports) and passes it in; this component only
 * decides how to show it.
 *
 * Rules the layout follows:
 *   - every figure names its source, and dataset figures carry their date;
 *   - route-derived values (airlines, destinations, counts) are labelled as
 *     Originfacts route records, never as verified or as a full schedule;
 *   - topics with no sourced data (terminals, ground transport, parking,
 *     lounges) render a "not yet verified" state that links to the airport's
 *     own site instead of generic prose;
 *   - the CMS `about` prose is not shown: it is unsourced generated text.
 */

export type AirportV2Airline = { slug: string; name: string; iataCode?: string; logoUrl?: string | null };

export type AirportV2Nearby = {
  iata: string;
  name: string;
  city?: string | null;
  country?: string | null;
  href: string;
  distanceKm: number | null;
};

export type AirportGuideV2Props = {
  airport: StrapiAirport;
  breadcrumb: { name: string; href: string }[];
  routes: StrapiRoute[];
  airlines: AirportV2Airline[];
  countryCount: number;
  /** Contact fields from the airport-info dataset. */
  info: {
    icao?: string | null;
    city?: string | null;
    country?: string | null;
    address?: string | null;
    phone?: string | null;
    website?: string | null;
    hasCoordinates?: boolean;
  };
  officialSite: { url: string; source: 'wikidata' | 'airport-info' } | null;
  wikipediaUrl?: string | null;
  wikidataUrl?: string | null;
  coordinates: { lat: number; lon: number; source: 'record' | 'airport-info' } | null;
  mapHref: string | null;
  weather: AirportWeather | null;
  nearby: AirportV2Nearby[];
  /** Same list the page marks up as FAQPage — built by airportGuideV2Faqs(). */
  faqs: Faq[];
  related: { label: string; href: string }[];
};

/** The site's default content width (matches the airline v2 page). */
const WRAP = 'mx-auto max-w-7xl px-4 sm:px-6';

const SECTION = 'scroll-mt-[6.5rem]';

export function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Newest `updatedAt` across the route records shown — the vintage of the route figures. */
export function routeVintage(routes: StrapiRoute[]): string | null {
  const times = routes
    .map((r) => Date.parse((r as StrapiRoute & { updatedAt?: string }).updatedAt ?? ''))
    .filter((t) => Number.isFinite(t));
  return times.length ? formatDate(new Date(Math.max(...times)).toISOString()) : null;
}

export function formatCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
}

export default function AirportGuideV2(p: AirportGuideV2Props) {
  const { airport, routes, airlines, info, officialSite, coordinates, weather, nearby, faqs } = p;
  const name = airport.name;
  const code = airport.iata.toUpperCase();
  const icao = airport.icao || info.icao || null;
  const city = airport.city || info.city || null;
  const country = airport.country || info.country || null;
  const recordDate = formatDate((airport as StrapiAirport & { updatedAt?: string }).updatedAt);
  const routesDate = routeVintage(routes);
  const destinations = uniqueDestinations(routes);
  const coordText = coordinates ? formatCoordinates(coordinates.lat, coordinates.lon) : null;
  const hasContact = Boolean(info.phone || officialSite);
  const hasRoutes = routes.length > 0;
  const officialHost = officialSite ? displayUrl(officialSite.url) : null;

  const navItems: NavItem[] = [
    { id: 'details', label: 'Airport details', status: 'data' },
    ...(airlines.length ? [{ id: 'airlines', label: 'Airlines', status: 'data' as const }] : []),
    { id: 'routes', label: 'Routes', status: hasRoutes ? ('data' as const) : ('pending' as const) },
    { id: 'planning', label: 'Terminals & transport', status: 'pending' },
    ...(nearby.length ? [{ id: 'nearby', label: 'Nearby airports', status: 'data' as const }] : []),
    ...(faqs.length ? [{ id: 'faq', label: 'FAQ', status: 'none' as const }] : []),
    { id: 'sources', label: 'Sources', status: 'none' },
  ];

  const headerFacts = [
    { label: 'Serves', value: [city, country].filter(Boolean).join(', ') || null },
    { label: 'Codes', value: icao ? `${code} · ${icao}` : code, hint: icao ? 'IATA · ICAO' : 'IATA' },
    { label: 'Time zone', value: airport.timezone || null },
    { label: 'Region', value: airport.region || null },
  ].filter((f) => f.value);

  return (
    <div className="bg-[#fbfcff]" data-testid={`airport-v2-page-${code}`} data-template="v2">
      {/* ---------------------------------------------------------- header */}
      <header className="border-b border-forest-900/10 bg-white">
        <div className={`${WRAP} pb-8 pt-6 lg:pb-10`}>
          <nav aria-label="Breadcrumb" className="text-sm text-forest-900/75">
            <ol className="flex flex-wrap items-center gap-1.5">
              {p.breadcrumb.map((b) => (
                <li key={b.href} className="flex items-center gap-1.5">
                  <Link href={b.href} className="hover:text-primary-emphasis hover:underline">
                    {b.name}
                  </Link>
                  <span aria-hidden>/</span>
                </li>
              ))}
              <li aria-current="page" className="font-medium text-forest-950">
                {name}
              </li>
            </ol>
          </nav>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4 sm:gap-6">
              <div
                aria-hidden
                className="flex h-16 w-16 flex-none items-center justify-center rounded-[0.3rem] bg-forest-950 sm:h-24 sm:w-24"
              >
                <PlaneIcon className="h-8 w-8 text-white sm:h-11 sm:w-11" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-emphasis">Airport guide</p>
                <h1 className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-3xl leading-tight sm:text-4xl">
                  {name}
                  <span className="rounded-[0.3rem] bg-forest-950 px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-white">
                    <span className="sr-only">IATA code </span>
                    {code}
                  </span>
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-forest-900/80">
                  Codes, location and contact details for {name}
                  {hasRoutes ? ', the airlines and routes in Originfacts’ route records,' : ''} and where to check
                  terminal and transport details. Each figure shows where it came from.
                </p>
              </div>
            </div>

            <div className="flex flex-none flex-wrap gap-2 self-start">
              {officialSite && (
                <a
                  href={officialSite.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center justify-center gap-2 rounded-[0.3rem] border border-forest-900/15 bg-white px-4 py-2.5 text-sm font-semibold text-forest-950 transition hover:border-primary-emphasis hover:text-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
                >
                  {officialHost}
                  <ExternalIcon />
                  <span className="sr-only">(official website, opens in a new tab)</span>
                </a>
              )}
              {p.mapHref && (
                <a
                  href={p.mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-[0.3rem] border border-forest-900/15 bg-white px-4 py-2.5 text-sm font-semibold text-forest-950 transition hover:border-primary-emphasis hover:text-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
                >
                  View map
                  <ExternalIcon />
                  <span className="sr-only">(Google Maps, opens in a new tab)</span>
                </a>
              )}
            </div>
          </div>

          <dl
            className={`mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-[0.3rem] border border-forest-900/10 bg-forest-900/10 max-sm:[&>div:last-child:nth-child(odd)]:col-span-2 ${
              { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }[headerFacts.length] ?? 'sm:grid-cols-4'
            }`}
          >
            {headerFacts.map((f) => (
              <div key={f.label} className="bg-white px-4 py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-900/70">{f.label}</dt>
                <dd className="mt-1 text-[15px] font-semibold text-forest-950">{f.value}</dd>
                {f.hint && <dd className="mt-0.5 text-xs text-forest-900/70">{f.hint}</dd>}
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-forest-900/75" data-testid="airport-v2-ledger">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-primary-emphasis" />
              Airport record{recordDate ? `, updated ${recordDate}` : ''}
            </span>
            {hasRoutes && <span>Route records{routesDate ? `, updated ${routesDate}` : ''}</span>}
            <span>Terminals and transport not yet verified</span>
            <a href="#sources" className="text-primary-emphasis underline-offset-2 hover:underline">
              Where this comes from
            </a>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------- at a glance */}
      <section aria-labelledby="glance-title" className={`${WRAP} pt-8`} data-testid="airport-v2-glance">
        <h2 id="glance-title" className="text-xl sm:text-2xl">
          {name} at a glance
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(info.address || coordText) && (
            <Tile title="Location" source={info.address ? 'airport-info dataset' : 'Originfacts airport record'} section="details">
              {info.address && <p className="text-[15px] font-semibold leading-6 text-forest-950">{info.address}</p>}
              {coordText && <p className={info.address ? 'text-sm text-forest-900/75' : 'text-[15px] font-semibold text-forest-950'}>{coordText}</p>}
              {p.mapHref && (
                <ExternalLink href={p.mapHref} className="text-sm" follow>
                  Open in Google Maps
                </ExternalLink>
              )}
            </Tile>
          )}

          {hasContact && (
            <Tile title="Contact" source={contactSource(info.phone, officialSite?.source)} section="details">
              {info.phone && (
                <a href={telHref(info.phone)} className="block text-[15px] font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                  {info.phone}
                </a>
              )}
              {officialSite && (
                <ExternalLink href={officialSite.url} className="block text-[15px] font-semibold [overflow-wrap:anywhere]">
                  {officialHost}
                </ExternalLink>
              )}
            </Tile>
          )}

          {airlines.length > 0 && (
            <Tile title="Airlines in our route data" source={`Route records${routesDate ? ` · ${routesDate}` : ''}`} section="airlines" linkText="See airlines">
              <p className="text-[15px] font-semibold leading-6 text-forest-950">
                {airlines.length} {airlines.length === 1 ? 'airline' : 'airlines'}
              </p>
              <p className="text-sm leading-6 text-forest-900/80">{airlines.map((a) => a.name).join(', ')}</p>
            </Tile>
          )}

          {hasRoutes && (
            <Tile title="Routes in our route data" source={`Route records${routesDate ? ` · ${routesDate}` : ''}`} section="routes" linkText="See routes">
              <p className="text-[15px] font-semibold leading-6 text-forest-950">
                {destinations.length} {destinations.length === 1 ? 'destination' : 'destinations'}
                {p.countryCount > 0 && ` in ${p.countryCount} ${p.countryCount === 1 ? 'country' : 'countries'}`}
              </p>
              <p className="text-sm leading-6 text-forest-900/80">{destinations.slice(0, 6).map((d) => d.name).join(', ')}{destinations.length > 6 ? ' and more' : ''}</p>
            </Tile>
          )}

          {weather?.current && typeof weather.current.temperature2m === 'number' && (
            <Tile title="Weather now" source={`Open-Meteo${weather.current.time ? ` · ${weatherTime(weather.current.time)} local` : ''}`}>
              <p className="flex items-baseline gap-2 text-[15px] font-semibold text-forest-950">
                <span className="text-2xl font-bold">{Math.round(weather.current.temperature2m)}°C</span>
                <span>{weatherLabel(weather.current.weatherCode)}</span>
              </p>
              <p className="text-sm text-forest-900/75">
                {[
                  typeof weather.current.apparentTemperature === 'number' ? `Feels like ${Math.round(weather.current.apparentTemperature)}°C` : null,
                  typeof weather.current.windSpeed10m === 'number' ? `wind ${Math.round(weather.current.windSpeed10m)} km/h` : null,
                  typeof weather.daily?.temperature2mMin?.[0] === 'number' && typeof weather.daily?.temperature2mMax?.[0] === 'number'
                    ? `today ${Math.round(weather.daily.temperature2mMin[0])}° to ${Math.round(weather.daily.temperature2mMax[0])}°`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </Tile>
          )}

          <li className="flex flex-col rounded-[0.3rem] border border-dashed border-forest-900/20 bg-white/60 p-4">
            <h3 className="text-base leading-snug text-forest-950">Terminals &amp; getting into {city || 'town'}</h3>
            <p className="mt-2 text-sm text-forest-900/75">
              Not yet verified.{' '}
              <a href="#planning" className="font-medium text-primary-emphasis hover:underline">
                Where to check<span className="sr-only"> terminal and transport details</span>
              </a>
            </p>
          </li>
        </ul>
      </section>

      {/* ---------------------------------------------------------- body */}
      <div className={`${WRAP} pb-16 pt-8 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10`}>
        <aside className="hidden lg:block">
          <SectionNav items={navItems} />
        </aside>

        <div className="min-w-0">
          {/* Phones and tablets: a wrapping chip list, never a horizontal scroller. */}
          <nav aria-label="On this page" className="mb-6 lg:hidden">
            <ul className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-forest-900/15 bg-white px-3 py-1.5 text-sm text-forest-950 hover:border-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-6">
            {/* ------------------------------------------------ details */}
            <Shell
              id="details"
              title={/\bairport\b/i.test(name) ? `${name} details` : `${name} airport details`}
              badge={<Badge tone="data">Airport record{recordDate ? ` · ${recordDate}` : ''}</Badge>}
            >
              <dl className="grid gap-3 sm:grid-cols-2">
                <Fact label="IATA code" value={code} />
                <Fact label="ICAO code" value={icao} source={!airport.icao && info.icao ? 'airport-info' : undefined} />
                <Fact label="City" value={city} source={!airport.city && info.city ? 'airport-info' : undefined} />
                <Fact label="Country" value={country} source={!airport.country && info.country ? 'airport-info' : undefined} />
                <Fact label="Region" value={airport.region} />
                <Fact label="Time zone" value={airport.timezone} />
                <Fact label="Coordinates" value={coordText} source={coordinates?.source === 'airport-info' ? 'airport-info' : undefined} />
                <Fact label="Address" value={info.address} source="airport-info" />
                <Fact label="Phone" value={info.phone} source="airport-info" href={info.phone ? telHref(info.phone) : undefined} />
                <Fact
                  label="Official website"
                  value={officialHost}
                  source={officialSite?.source === 'wikidata' ? 'Wikidata' : officialSite ? 'airport-info' : undefined}
                  href={officialSite?.url}
                  external
                />
              </dl>
              <p className="text-sm text-forest-900/75">
                Codes, location and time zone come from the Originfacts airport record
                {recordDate ? ` (last updated ${recordDate})` : ''}. Fields marked otherwise come from the dataset named
                on them. None are verified by hand against {name}’s own pages.
              </p>
            </Shell>

            {/* ------------------------------------------------ airlines */}
            {airlines.length > 0 && (
              <Shell
                id="airlines"
                title={`Airlines on routes from ${code}`}
                badge={<Badge tone="data">Route records{routesDate ? ` · ${routesDate}` : ''}</Badge>}
                source={<DatasetNote date={routesDate} />}
              >
                <p className="text-[15px] leading-7 text-forest-900/85">
                  The airlines listed on the {routes.length === 1 ? 'route' : `${routes.length} routes`} Originfacts
                  tracks from {code}. This is not a complete list of airlines at {name}.
                </p>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {airlines.map((a) => (
                    <li key={a.slug}>
                      <Link
                        href={`/airlines/${a.slug}`}
                        className="group flex h-full items-center gap-4 rounded-[0.3rem] border border-forest-900/10 bg-[#fbfcff] px-4 py-3 transition hover:border-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
                      >
                        <span className="flex h-10 w-20 flex-none items-center justify-center">
                          {a.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.logoUrl} alt="" className="max-h-10 max-w-full object-contain" loading="lazy" />
                          ) : (
                            <span className="font-mono text-sm font-bold text-forest-900/70">{a.iataCode || a.name.slice(0, 3).toUpperCase()}</span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold leading-snug text-forest-950 group-hover:text-primary-emphasis">{a.name}</span>
                          {a.iataCode && <span className="mt-0.5 block font-mono text-xs text-forest-900/70">{a.iataCode}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Shell>
            )}

            {/* ------------------------------------------------ routes */}
            {hasRoutes ? (
              <Shell
                id="routes"
                title={`Routes from ${code}`}
                badge={<Badge tone="data">Route records{routesDate ? ` · ${routesDate}` : ''}</Badge>}
                source={<DatasetNote date={routesDate} />}
              >
                <p className="text-[15px] leading-7 text-forest-900/85">
                  {routes.length === 1 ? 'The route' : `The ${routes.length} routes`} Originfacts tracks from {code}, with
                  the distance and estimated flight time in each route record. Check live schedules with the airline.
                </p>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {routes.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/flight-routes/${r.slug}`}
                        className="group flex h-full items-center justify-between gap-4 rounded-[0.3rem] border border-forest-900/10 bg-[#fbfcff] px-4 py-3.5 transition hover:border-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
                      >
                        <span className="min-w-0">
                          <span className="block font-mono text-xs font-semibold tracking-wider text-forest-900/70">
                            {r.origin?.iata ?? code} → {r.destination?.iata}
                          </span>
                          <span className="mt-1 block font-semibold text-forest-950 group-hover:text-primary-emphasis">
                            {r.destination?.city || r.destination?.name}
                          </span>
                          {r.destination?.country && <span className="block text-sm text-forest-900/75">{r.destination.country}</span>}
                        </span>
                        {(r.distanceKm || r.durationMinutes) && (
                          <span className="flex-none text-right text-sm text-forest-900/75">
                            {r.distanceKm ? <span className="block font-semibold text-forest-950">{r.distanceKm.toLocaleString('en-US')} km</span> : null}
                            {r.durationMinutes ? <span className="block">~{formatDuration(r.durationMinutes)} est.</span> : null}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Shell>
            ) : (
              <Shell id="routes" title={`Routes from ${code}`} tone="muted" badge={<Badge tone="pending">No route records yet</Badge>}>
                <p className="text-[15px] leading-7 text-forest-900/80">
                  Originfacts does not track any routes from {code} yet, so no airlines or destinations are listed here.
                  Check current schedules with the airlines or {officialSite ? 'the airport’s own site' : 'the airport'}.
                </p>
              </Shell>
            )}

            {/* ------------------------------------------------ planning (pending) */}
            <Shell
              id="planning"
              title={`Terminals, transport and parking at ${code}`}
              tone="muted"
              badge={<Badge tone="pending">Not yet verified</Badge>}
            >
              <p className="text-[15px] leading-7 text-forest-900/80">
                Terminal assignments, ground transport into {city || 'town'}, parking, lounges and accessibility services
                have not been verified against {name}’s own pages yet, so none are listed here.
              </p>
              {(officialSite || p.mapHref) && (
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-semibold text-forest-950">Check directly:</span>
                  {officialSite && <ExternalLink href={officialSite.url}>{officialHost}</ExternalLink>}
                  {p.mapHref && (
                    <ExternalLink href={p.mapHref} follow>
                      Map of the airport location
                    </ExternalLink>
                  )}
                </p>
              )}
              <div className="rounded-[0.3rem] border border-forest-900/10 bg-white p-4">
                <h3 className="text-base leading-snug text-forest-950">Before you travel</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-7 text-forest-900/85">
                  <li>Confirm your terminal with the operating airline.</li>
                  <li>Check the check-in and bag-drop cut-off times on your booking.</li>
                  <li>Allow extra time if you need to change terminals or check bags in again.</li>
                  <li>Check your flight status before you leave for the airport.</li>
                </ul>
              </div>
            </Shell>

            {/* ------------------------------------------------ nearby */}
            {nearby.length > 0 && (
              <Shell
                id="nearby"
                title={`Airports near ${city || name}`}
                badge={<Badge tone="data">Calculated</Badge>}
                source={
                  <p className="text-sm text-forest-900/75">
                    {nearby.some((n) => n.distanceKm != null)
                      ? 'Straight-line distances calculated from each airport’s coordinates in the Originfacts airport records. Road distances are longer.'
                      : 'Other airports in the same country in the Originfacts airport records.'}
                  </p>
                }
              >
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {nearby.map((a) => (
                    <li key={a.iata}>
                      <Link
                        href={a.href}
                        className="group flex h-full items-center justify-between gap-3 rounded-[0.3rem] border border-forest-900/10 bg-[#fbfcff] px-3.5 py-2.5 transition hover:border-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-forest-950 group-hover:text-primary-emphasis">{a.city || a.name}</span>
                          <span className="block truncate text-xs text-forest-900/70">{a.name}</span>
                        </span>
                        <span className="flex-none text-right">
                          <span className="block font-mono text-xs font-semibold text-forest-900/80">{a.iata}</span>
                          {a.distanceKm != null && (
                            <span className="block text-xs text-forest-900/70">{Math.round(a.distanceKm).toLocaleString('en-US')} km</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Shell>
            )}

            {/* ------------------------------------------------ faq */}
            {faqs.length > 0 && (
              <Shell id="faq" title={`${name}: common questions`}>
                <div className="divide-y divide-forest-900/10 rounded-[0.3rem] border border-forest-900/10">
                  {faqs.map((f, i) => (
                    <details key={f.q} open={i === 0} className="group">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-3.5 font-semibold text-forest-950 hover:bg-forest-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-emphasis [&::-webkit-details-marker]:hidden">
                        <span>{f.q}</span>
                        <span aria-hidden className="mt-0.5 flex-none text-forest-900/60 transition group-open:rotate-45">
                          +
                        </span>
                      </summary>
                      <p className="px-4 pb-4 text-[15px] leading-7 text-forest-900/85">{f.a}</p>
                    </details>
                  ))}
                </div>
              </Shell>
            )}

            {/* ------------------------------------------------ sources */}
            <Shell id="sources" title="Sources">
              <p className="text-[15px] leading-7 text-forest-900/85">
                Nothing on this page is verified by hand yet. Each section comes from the dataset below, with its date
                where the dataset has one. Terminal, transport and parking details are left out until they can be read
                from {name}’s own pages.
              </p>
              <ul className="divide-y divide-forest-900/10 rounded-[0.3rem] border border-forest-900/10" aria-label="Where each part of this page comes from">
                <li aria-hidden className="hidden bg-forest-50/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-forest-900/75 sm:grid sm:grid-cols-[11rem_minmax(0,1fr)_9rem] sm:gap-4">
                  <span>What</span>
                  <span>Source</span>
                  <span>Date</span>
                </li>
                <SourceRow what="Codes, location, time zone" date={recordDate}>
                  Originfacts airport record
                </SourceRow>
                {(info.address || info.phone || officialSite?.source === 'airport-info') && (
                  <SourceRow what={[info.address && 'Address', info.phone && 'phone'].filter(Boolean).join(' and ') || 'Contact'} date={null}>
                    airport-info dataset (third-party API)
                  </SourceRow>
                )}
                {officialSite && (
                  <SourceRow what="Official website" date={null}>
                    {officialSite.source === 'wikidata' && p.wikidataUrl ? (
                      <ExternalLink href={p.wikidataUrl}>Wikidata record (official website property)</ExternalLink>
                    ) : (
                      'airport-info dataset (third-party API)'
                    )}
                  </SourceRow>
                )}
                {hasRoutes && (
                  <SourceRow what="Airlines and routes" date={routesDate}>
                    Originfacts route records — the routes we track, not a full schedule
                  </SourceRow>
                )}
                {nearby.length > 0 && (
                  <SourceRow what="Nearby airports" date={null}>
                    Calculated from airport coordinates
                  </SourceRow>
                )}
                {weather?.current && (
                  <SourceRow what="Weather now" date={weather.current.time ? `${weatherTime(weather.current.time)} local` : null}>
                    <ExternalLink href="https://open-meteo.com/">Open-Meteo</ExternalLink> forecast API
                  </SourceRow>
                )}
                <SourceRow what="Terminals and transport" date={null}>
                  Not yet verified
                </SourceRow>
              </ul>
              {(p.wikipediaUrl || p.wikidataUrl) && (
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-semibold text-forest-950">Background reading:</span>
                  {p.wikipediaUrl && <ExternalLink href={p.wikipediaUrl}>Wikipedia</ExternalLink>}
                  {p.wikidataUrl && <ExternalLink href={p.wikidataUrl}>Wikidata</ExternalLink>}
                </p>
              )}
            </Shell>

            {p.related.length > 0 && (
              <aside aria-labelledby="related-title" className="rounded-[0.3rem] border border-forest-900/10 bg-white p-5">
                <h2 id="related-title" className="text-lg">
                  Keep planning
                </h2>
                <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  {p.related.map((r) => (
                    <li key={r.href}>
                      <Link href={r.href} className="font-medium text-primary-emphasis hover:underline">
                        {r.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm leading-6 text-forest-900/75">
                  Airport services and schedules change. Confirm with {officialSite ? `${name}’s own site` : 'the airport'}{' '}
                  and your airline before you travel.
                </p>
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * Pieces
 * ================================================================== */

function Shell({
  id,
  title,
  badge,
  source,
  children,
  tone = 'default',
}: {
  id: string;
  title: string;
  badge?: ReactNode;
  source?: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'muted';
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-testid={`airport-v2-section-${id}`}
      className={`${SECTION} rounded-[0.3rem] border p-5 sm:p-7 ${
        tone === 'muted' ? 'border-dashed border-forest-900/20 bg-white/60' : 'border-forest-900/10 bg-white'
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <h2 id={`${id}-title`} className="text-xl leading-snug sm:text-2xl">
          {title}
        </h2>
        {badge && <div className="flex-none sm:pt-1">{badge}</div>}
      </div>
      {source && <div className="mt-2">{source}</div>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Tile({
  title,
  source,
  section,
  linkText = 'Details',
  children,
}: {
  title: string;
  source: string;
  section?: string;
  linkText?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col rounded-[0.3rem] border border-forest-900/10 bg-white p-4 shadow-[0_1px_2px_rgba(15,39,102,0.04)]">
      <h3 className="text-base leading-snug text-forest-950">{title}</h3>
      <div className="mt-2 space-y-1">{children}</div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
        <span className="text-xs text-forest-900/70">{source}</span>
        {section && (
          <a href={`#${section}`} className="text-xs font-medium text-primary-emphasis hover:underline">
            {linkText}
            <span className="sr-only">: {title}</span> <span aria-hidden>↓</span>
          </a>
        )}
      </div>
    </li>
  );
}

function Fact({
  label,
  value,
  source,
  href,
  external = false,
}: {
  label: string;
  value?: string | null;
  source?: string;
  href?: string;
  external?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="rounded-[0.3rem] border border-forest-900/10 bg-[#fbfcff] p-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-forest-900/75">{label}</dt>
      <dd className="mt-1.5 text-[15px] font-semibold leading-6 text-forest-950 [overflow-wrap:anywhere]">
        {href && external ? (
          <ExternalLink href={href}>{value}</ExternalLink>
        ) : href ? (
          <a href={href} className="text-primary-emphasis underline-offset-2 hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
      {source && <dd className="mt-1 text-xs text-forest-900/70">From {source}</dd>}
    </div>
  );
}

function SourceRow({ what, date, children }: { what: string; date: string | null; children: ReactNode }) {
  return (
    <li className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)_9rem] sm:gap-4">
      <span className="font-medium text-forest-950">{what}</span>
      <span className="min-w-0 text-forest-900/85 [overflow-wrap:anywhere]">{children}</span>
      <span className="text-forest-900/75">{date ?? '—'}</span>
    </li>
  );
}

function DatasetNote({ date }: { date: string | null }) {
  return (
    <p className="text-sm text-forest-900/75">
      Source: Originfacts route records{date ? `, last updated ${date}` : ''}. Not verified by hand.
    </p>
  );
}

type BadgeTone = 'data' | 'pending';

function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  const cls: Record<BadgeTone, string> = {
    data: 'border-forest-200 bg-forest-50 text-forest-800',
    pending: 'border-slate-300 bg-white text-slate-700',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${cls[tone]}`}>
      {tone === 'pending' && <span aria-hidden className="h-2 w-2 rounded-full border border-slate-500" />}
      {tone === 'data' && <span aria-hidden className="h-2 w-2 rounded-full bg-primary-emphasis" />}
      {children}
    </span>
  );
}

function ExternalLink({
  href,
  children,
  className = '',
  follow = false,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  /** Map links keep the legacy page's rel (no nofollow). */
  follow?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel={follow ? 'noopener noreferrer' : 'noopener noreferrer nofollow'}
      className={`text-primary-emphasis underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-emphasis ${className}`}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function ExternalIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 3h4v4M13 3 7.5 8.5M12 9.5V13H3V4h3.5" />
    </svg>
  );
}

function PlaneIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z" />
    </svg>
  );
}

function uniqueDestinations(routes: StrapiRoute[]): { iata: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const r of routes) {
    const d = r.destination;
    const n = d?.city || d?.name;
    if (d?.iata && n && !seen.has(d.iata)) seen.set(d.iata, n);
  }
  return [...seen.entries()].map(([iata, name]) => ({ iata, name }));
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function weatherTime(value: string): string {
  const match = value.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : value;
}

function contactSource(phone?: string | null, site?: 'wikidata' | 'airport-info'): string {
  if (site === 'wikidata') return phone ? 'airport-info · website via Wikidata' : 'Wikidata';
  return 'airport-info dataset';
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, '')}`;
}
