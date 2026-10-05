import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { StrapiAirport, StrapiRoute } from '@/lib/strapi';
import type { AirportWeather } from '@/lib/open-meteo';
import { weatherLabel } from '@/lib/open-meteo';
import SectionNav, { type NavItem } from './SectionNav';
import { displayUrl, type Faq } from './faqs';
import { routeCoverage, type AirportCityPhoto } from '@/lib/airport-v2';
import { formatCeasedOn } from '@/lib/airline-status';
import {
  compassWords,
  formatElevation,
  formatKm,
  formatLength,
  formatOpened,
  formatPassengers,
  hostOf,
  metres,
  wikidataUrl,
  type AirportEnrichmentView,
} from '@/lib/airport-enrichment';

/**
 * Airport page, v2 layout — a sibling of the airline v2 page
 * (components/airline-v2/AirlineGuideV2.tsx). Rendered only for slugs in
 * lib/airport-template-v2.ts; every other airport keeps the existing layout.
 *
 * Data is not fetched or derived here. The page route computes everything once
 * (airport record, OurAirports/Wikidata/Travelpayouts/NASA POWER enrichment
 * from data/airport-enrichment, route records, official links, Open-Meteo
 * weather, nearest airports) and passes it in; this component only decides
 * how to show it. Enrichment sections render only when their data exists.
 *
 * Rules the layout follows:
 *   - every figure names its source, and dataset figures carry their date;
 *   - route-derived values (airlines, destinations, counts) are labelled as
 *     Originfacts route records, never as verified or as a full schedule;
 *   - topics with no sourced data (terminals, ground transport, parking,
 *     lounges) render a "not yet verified" state that links to the airport's
 *     own site instead of generic prose;
 *   - the CMS `about` prose is not shown: it is unsourced generated text;
 *   - carriers Wikidata records as ceased are left out of the airline list and
 *     counts, and named in a footnote with their date;
 *   - route counts always say the records are partial (lib/airport-v2.ts
 *     routeCoverage), more strongly when only a few routes are tracked;
 *   - the header photo is a reviewed real photograph of the city the airport
 *     serves (lib/airport-v2.ts REVIEWED_CITY_PHOTOS), captioned as the city,
 *     or nothing at all — never the airport record's generated hero image.
 */

export type AirportV2Airline = { slug: string; name: string; iataCode?: string; logoUrl?: string | null };

export type AirportV2CeasedAirline = { slug: string; name: string; ceasedOn: string; wikidata: string };

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
  /** Carriers on the route records that are still operating, as far as the site knows. */
  airlines: AirportV2Airline[];
  /** Carriers on the route records with a sourced cessation date — listed in a footnote only. */
  ceasedAirlines: AirportV2CeasedAirline[];
  /** All route records from this airport and how many `routes` holds. */
  routeCount: { tracked: number; shown: number };
  countryCount: number;
  cityPhoto: AirportCityPhoto | null;
  /** Fallback identity fields from OurAirports, used when the record lacks them. */
  info: {
    icao?: string | null;
    city?: string | null;
    country?: string | null;
  };
  officialSite: { url: string; source: 'wikidata' | 'ourairports' } | null;
  wikipediaUrl?: string | null;
  wikidataUrl?: string | null;
  coordinates: { lat: number; lon: number; source: 'record' | 'ourairports' } | null;
  /** Dataset sections (lib/airport-enrichment.ts buildEnrichmentView). */
  enrichment: AirportEnrichmentView;
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
  const e = p.enrichment;
  const src = e.sources;
  const oaDate = src.ourairports ? formatDate(src.ourairports.retrieved) : null;
  const wdDate = src.wikidata ? formatDate(src.wikidata.retrieved) : null;
  const faresDate = e.fares ? formatDate(e.fares.retrieved) : null;
  const hasFacts = Boolean(e.typeLabel || e.elevationFt != null || e.opened || e.operators.length || e.owners.length || e.patronage || e.nearestScheduled.length);
  const hasFares = Boolean(e.fares && e.fares.destinationCount > 0);
  const officialSourceName = officialSite?.source === 'wikidata' ? 'Wikidata' : 'OurAirports';
  const hasRoutes = routes.length > 0;
  const officialHost = officialSite ? displayUrl(officialSite.url) : null;
  const coverage = routeCoverage({ name, code, tracked: p.routeCount.tracked, shown: routes.length });
  const photo = p.cityPhoto;

  const navItems: NavItem[] = [
    { id: 'details', label: 'Airport details', status: 'data' },
    ...(hasFacts ? [{ id: 'facts', label: 'Airport facts', status: 'data' as const }] : []),
    ...(e.runways.length ? [{ id: 'runways', label: 'Runways', status: 'data' as const }] : []),
    ...(hasFares ? [{ id: 'destinations', label: 'Airlines & destinations', status: 'data' as const }] : []),
    ...(airlines.length ? [{ id: 'airlines', label: 'Airlines (route records)', status: 'data' as const }] : []),
    { id: 'routes', label: 'Routes', status: hasRoutes ? ('data' as const) : ('pending' as const) },
    ...(e.hubs.length ? [{ id: 'hubs', label: 'Hub airlines', status: 'data' as const }] : []),
    ...(e.cityCentre ? [{ id: 'getting-there', label: 'Getting there', status: 'data' as const }] : []),
    { id: 'planning', label: 'Terminals & transport', status: 'pending' },
    ...(e.climate ? [{ id: 'climate', label: 'Climate', status: 'data' as const }] : []),
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

          <div
            className={
              photo
                ? 'mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start lg:gap-10'
                : 'mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between'
            }
          >
            <div className={photo ? 'flex min-w-0 flex-col gap-6' : 'contents'}>
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
                    {introTopics(e, hasRoutes, Boolean(officialSite))} for {name}, and where to check terminal and transport
                    details. Each figure shows where it came from.
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

            {photo && (
              <figure className="min-w-0" data-testid="airport-v2-city-photo">
                <div className="relative aspect-[16/10] overflow-hidden rounded-[0.3rem] bg-forest-900/5">
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    priority
                    sizes="(min-width: 1024px) 26rem, calc(100vw - 2rem)"
                    className="object-cover"
                  />
                </div>
                <figcaption className="mt-2 text-xs leading-5 text-forest-900/75">
                  {photo.city}, the city the airport serves — not a photo of {name}. From our{' '}
                  <Link href={photo.guideHref} className="text-primary-emphasis underline-offset-2 hover:underline">
                    {photo.city} travel guide
                  </Link>
                  .
                </figcaption>
              </figure>
            )}
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
            {(e.runways.length > 0 || hasFacts) && oaDate && <span>OurAirports, {oaDate}</span>}
            {e.qid && wdDate && <span>Wikidata, {wdDate}</span>}
            {hasFares && faresDate && <span>Travelpayouts fares, {faresDate}</span>}
            {e.climate && <span>NASA POWER climate, {e.climate.period}</span>}
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
          {coordText && (
            <Tile title="Location" source={coordinates?.source === 'ourairports' ? 'OurAirports' : 'Originfacts airport record'} section="details">
              <p className="text-[15px] font-semibold text-forest-950">{coordText}</p>
              {e.cityCentre && (
                <p className="text-sm text-forest-900/75">
                  {formatKm(e.cityCentre.km)} {compassWords(e.cityCentre.compass)} of {e.cityCentre.name} centre (straight line)
                </p>
              )}
              {p.mapHref && (
                <ExternalLink href={p.mapHref} className="text-sm" follow>
                  Open in Google Maps
                </ExternalLink>
              )}
            </Tile>
          )}

          {officialSite && (
            <Tile title="Official website" source={officialSourceName} section="details">
              <ExternalLink href={officialSite.url} className="block text-[15px] font-semibold [overflow-wrap:anywhere]">
                {officialHost}
              </ExternalLink>
            </Tile>
          )}

          {e.runways.length > 0 && (
            <Tile title="Runways" source={`OurAirports${oaDate ? ` · ${oaDate}` : ''}`} section="runways" linkText="See runways">
              <p className="text-[15px] font-semibold leading-6 text-forest-950">
                {e.runways.length === 1 ? '1 runway' : `${e.runways.length} runways`}
              </p>
              <p className="text-sm leading-6 text-forest-900/80">{runwayCaption(e.runways)}</p>
            </Tile>
          )}

          {hasFares && e.fares && (
            <Tile title="Nonstop fares found" source={`Travelpayouts${faresDate ? ` · ${faresDate}` : ''}`} section="destinations" linkText="See destinations">
              <p className="text-[15px] font-semibold leading-6 text-forest-950">
                {e.fares.destinationCount} {e.fares.destinationCount === 1 ? 'destination' : 'destinations'}
                {e.fares.countryCount > 1 ? ` in ${e.fares.countryCount} countries` : ''}
              </p>
              <p className="text-sm leading-6 text-forest-900/80">
                {e.fares.airlines.length} {e.fares.airlines.length === 1 ? 'airline' : 'airlines'} named on the fares
              </p>
              <p className="text-xs leading-5 text-forest-900/70">Fares travellers found, not a schedule.</p>
            </Tile>
          )}

          {e.climate && (
            <Tile title="Climate" source={`NASA POWER · ${e.climate.period}`} section="climate" linkText="See months">
              <p className="text-[15px] font-semibold leading-6 text-forest-950">
                {e.climate.summary.warmest.month}: avg high {Math.round(e.climate.summary.warmest.hi)}°C
              </p>
              <p className="text-sm leading-6 text-forest-900/80">
                {e.climate.summary.coolest.month}: avg high {Math.round(e.climate.summary.coolest.hi)}°C, low{' '}
                {Math.round(e.climate.summary.coolest.lo)}°C
              </p>
            </Tile>
          )}

          {airlines.length > 0 && (
            <Tile title="Airlines on tracked routes" source={`Route records${routesDate ? ` · ${routesDate}` : ''}`} section="airlines" linkText="See airlines">
              <p className="text-[15px] font-semibold leading-6 text-forest-950">
                {airlines.length} {airlines.length === 1 ? 'airline' : 'airlines'} on{' '}
                {routes.length === 1 ? 'the 1 route' : `the ${routes.length} routes`} {coverage.shownNote ? 'shown' : 'tracked'}
              </p>
              <p className="text-sm leading-6 text-forest-900/80">{airlines.map((a) => a.name).join(', ')}</p>
              <p className="text-xs leading-5 text-forest-900/70">Not a complete list of airlines at {code}.</p>
            </Tile>
          )}

          {hasRoutes && (
            <Tile title="Route records" source={`Route records${routesDate ? ` · ${routesDate}` : ''}`} section="routes" linkText="See routes">
              <p className="text-[15px] font-semibold leading-6 text-forest-950">
                {coverage.headline}
                {coverage.shownNote ? ` · ${coverage.shownNote}` : ''}
              </p>
              <p className="text-sm leading-6 text-forest-900/80">
                To {destinations.slice(0, 6).map((d) => d.name).join(', ')}
                {destinations.length > 6 ? ' and more' : ''}
              </p>
              <p className="text-xs leading-5 text-forest-900/70" data-testid="airport-v2-route-caveat">
                {coverage.sparse ? 'A small sample — not' : 'Not'} {code}’s full network.
                {officialSite && (
                  <>
                    {' '}Full list:{' '}
                    <ExternalLink href={officialSite.url} className="[overflow-wrap:anywhere]">
                      {officialHost}
                    </ExternalLink>
                  </>
                )}
              </p>
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
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Fact label="IATA code" value={code} />
                <Fact label="ICAO code" value={icao} source={!airport.icao && info.icao ? 'OurAirports' : undefined} />
                <Fact label="City" value={city} source={!airport.city && info.city ? 'OurAirports' : undefined} />
                <Fact label="Country" value={country} source={!airport.country && info.country ? 'OurAirports' : undefined} />
                <Fact label="Region" value={airport.region} />
                <Fact label="Time zone" value={airport.timezone} />
                <Fact label="Coordinates" value={coordText} source={coordinates?.source === 'ourairports' ? 'OurAirports' : undefined} />
                <Fact
                  label="Official website"
                  value={officialHost}
                  source={officialSite ? officialSourceName : undefined}
                  href={officialSite?.url}
                  external
                />
              </dl>
              <p className="text-sm text-forest-900/75">
                Codes, region and time zone come from the Originfacts airport record
                {recordDate ? ` (last updated ${recordDate})` : ''}. Fields marked otherwise come from the dataset named
                on them. None are verified by hand against {name}’s own pages.
              </p>
            </Shell>

            {hasFacts && <FactsSection name={name} code={code} e={e} oaDate={oaDate} wdDate={wdDate} />}

            {e.runways.length > 0 && <RunwaysSection code={code} e={e} oaDate={oaDate} />}

            {hasFares && e.fares && <DestinationsSection code={code} name={name} fares={e.fares} date={faresDate} hasRoutes={hasRoutes} />}

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
                  {coverage.shownNote ? ' shows' : ' tracks'} from {code}. {coverage.caveat} This is not a complete list
                  of airlines at {name}.
                </p>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {airlines.map((a) => (
                    <li key={a.slug}>
                      <Link
                        href={`/airlines/${a.slug}`}
                        className="group flex h-full items-center gap-4 rounded-[0.3rem] border border-forest-900/10 bg-[#fbfcff] px-4 py-3 transition hover:border-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
                      >
                        <span className="flex h-16 w-32 flex-none items-center justify-center">
                          {a.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.logoUrl} alt="" className="max-h-16 max-w-full object-contain" loading="lazy" />
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
                <CeasedNote airlines={p.ceasedAirlines} />
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
                  {coverage.shownNote
                    ? `Originfacts tracks ${coverage.tracked} routes from ${code} so far; the ${routes.length} shown here are listed`
                    : `${routes.length === 1 ? 'The route' : `The ${routes.length} routes`} Originfacts tracks from ${code} so far, listed`}{' '}
                  with the distance and estimated flight time in each route record. {coverage.caveat} Check live schedules
                  with the airline.
                </p>
                {officialSite && (
                  <p className="text-sm text-forest-900/85" data-testid="airport-v2-full-network-link">
                    <span className="font-semibold text-forest-950">Full list of destinations: </span>
                    <ExternalLink href={officialSite.url} className="[overflow-wrap:anywhere]">
                      {officialHost}
                    </ExternalLink>{' '}
                    <span className="text-forest-900/70">(the airport’s official site)</span>
                  </p>
                )}
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                {airlines.length === 0 && <CeasedNote airlines={p.ceasedAirlines} />}
              </Shell>
            ) : (
              <Shell id="routes" title={`Routes from ${code}`} tone="muted" badge={<Badge tone="pending">No route records yet</Badge>}>
                <p className="text-[15px] leading-7 text-forest-900/80">
                  Originfacts does not track any routes from {code} yet, so no route records are listed here.
                  {hasFares ? ' Destinations with nonstop fares are listed under Airlines and destinations above.' : ''} Check
                  current schedules with the airlines or {officialSite ? 'the airport’s own site' : 'the airport'}.
                </p>
              </Shell>
            )}

            {e.hubs.length > 0 && <HubsSection code={code} hubs={e.hubs} qid={e.qid} date={wdDate} />}

            {e.cityCentre && <GettingThereSection name={name} code={code} city={e.cityCentre} coordSource={coordinates?.source ?? 'record'} />}

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

            {e.climate && <ClimateSection code={code} climate={e.climate} />}

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
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
                {officialSite && (
                  <SourceRow what="Official website" date={officialSite.source === 'wikidata' ? wdDate : oaDate}>
                    {officialSite.source === 'wikidata' && p.wikidataUrl ? (
                      <ExternalLink href={p.wikidataUrl}>Wikidata record (official website property)</ExternalLink>
                    ) : (
                      <ExternalLink href="https://ourairports.com/data/">OurAirports</ExternalLink>
                    )}
                  </SourceRow>
                )}
                {(e.runways.length > 0 || e.typeLabel || e.elevationFt != null || coordinates?.source === 'ourairports') && src.ourairports && (
                  <SourceRow what={['Coordinates', e.runways.length ? 'runways' : null, e.typeLabel ? 'type' : null, e.elevationFt != null ? 'elevation' : null].filter(Boolean).join(', ')} date={oaDate}>
                    <ExternalLink href="https://ourairports.com/data/">OurAirports</ExternalLink> — public domain
                  </SourceRow>
                )}
                {e.qid && src.wikidata && (e.opened || e.operators.length || e.owners.length || e.patronage || e.hubs.length) && (
                  <SourceRow what="Opening, operator, passengers, hubs" date={wdDate}>
                    <ExternalLink href={wikidataUrl(e.qid)}>Wikidata item {e.qid}</ExternalLink> — CC0
                  </SourceRow>
                )}
                {hasFares && (
                  <SourceRow what="Nonstop destinations, airlines on fares" date={faresDate}>
                    Travelpayouts Data API (Aviasales fare cache) — fares found, not a complete or live schedule
                  </SourceRow>
                )}
                {e.climate && (
                  <SourceRow what="Climate" date={e.climate.period}>
                    <ExternalLink href="https://power.larc.nasa.gov/">NASA POWER</ExternalLink> daily data (MERRA-2 reanalysis), averaged by
                    Originfacts
                  </SourceRow>
                )}
                {e.cityCentre && (
                  <SourceRow what="Distance to city centre" date={null}>
                    Calculated from airport coordinates and the{' '}
                    {e.cityCentre.source === 'osm' ? (
                      <ExternalLink href={`https://www.openstreetmap.org/${e.cityCentre.ref}`}>OpenStreetMap</ExternalLink>
                    ) : (
                      <ExternalLink href={wikidataUrl(e.cityCentre.ref)}>Wikidata</ExternalLink>
                    )}{' '}
                    city-centre point
                  </SourceRow>
                )}
                {hasRoutes && (
                  <SourceRow what="Airlines and routes" date={routesDate}>
                    Originfacts route records — the routes we track, not a full schedule
                  </SourceRow>
                )}
                {p.ceasedAirlines.length > 0 && (
                  <SourceRow what="Airlines left out" date={null}>
                    Wikidata “dissolved, abolished or demolished date” (P576) for each carrier
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

function CeasedNote({ airlines }: { airlines: AirportV2CeasedAirline[] }) {
  if (!airlines.length) return null;
  return (
    <p className="text-sm leading-6 text-forest-900/75" data-testid="airport-v2-ceased-note">
      Left out because Wikidata records {airlines.length === 1 ? 'it' : 'them'} as no longer operating:{' '}
      {airlines.map((a, i) => (
        <span key={a.slug}>
          {i > 0 && (i === airlines.length - 1 ? ' and ' : ', ')}
          <Link href={`/airlines/${a.slug}`} className="text-primary-emphasis underline-offset-2 hover:underline">
            {a.name}
          </Link>{' '}
          (ceased {formatCeasedOn(a.ceasedOn)},{' '}
          <ExternalLink href={a.wikidata}>Wikidata</ExternalLink>)
        </span>
      ))}
      .
    </p>
  );
}

function SourceRow({ what, date, children }: { what: string; date: string | null; children: ReactNode }) {
  return (
    <li className="grid grid-cols-1 gap-1 px-4 py-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)_9rem] sm:gap-4">
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


/* ================================================================== *
 * Enrichment sections (data/airport-enrichment). Each renders only when
 * its data exists, and every value names its dataset.
 * ================================================================== */

type View = AirportEnrichmentView;

function listProse(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function introTopics(e: View, hasRoutes: boolean, hasSite: boolean): string {
  const t = [
    'Codes',
    'location',
    e.runways.length ? 'runways' : null,
    e.fares?.destinationCount ? 'nonstop destinations' : null,
    e.climate ? 'climate' : null,
    hasRoutes ? 'the airlines and routes in Originfacts’ route records' : null,
    !hasRoutes && !e.runways.length && !e.fares && hasSite ? 'official website' : null,
  ].filter(Boolean) as string[];
  return listProse(t);
}

function runwayCaption(runways: View['runways']): string {
  const r = runways[0];
  if (!r) return '';
  const what = runways.length === 1 ? 'The runway' : 'Longest';
  return `${what}${r.ident ? ` ${r.ident}` : ''}: ${metres(r.lengthFt).toLocaleString('en-US')} m${r.surface ? `, ${r.surface}` : ''}`;
}

function SourceChip({ children }: { children: ReactNode }) {
  return <dd className="mt-1 text-xs text-forest-900/70">{children}</dd>;
}

function DataFact({ label, value, source }: { label: string; value: ReactNode; source: ReactNode }) {
  return (
    <div className="rounded-[0.3rem] border border-forest-900/10 bg-[#fbfcff] p-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-forest-900/75">{label}</dt>
      <dd className="mt-1.5 text-[15px] font-semibold leading-6 text-forest-950 [overflow-wrap:anywhere]">{value}</dd>
      <SourceChip>{source}</SourceChip>
    </div>
  );
}

function FactsSection({ name, code, e, oaDate, wdDate }: { name: string; code: string; e: View; oaDate: string | null; wdDate: string | null }) {
  const wd = (extra?: ReactNode) => (
    <>
      Per{' '}
      {e.qid ? <ExternalLink href={wikidataUrl(e.qid)}>Wikidata</ExternalLink> : 'Wikidata'}
      {wdDate ? ` (retrieved ${wdDate})` : ''}
      {extra}
    </>
  );
  const oa = `From OurAirports${oaDate ? ` (${oaDate})` : ''}`;
  const named = e.namedAfter.filter((n) => !n.label.toLowerCase().includes(name.toLowerCase()));
  const nearest = e.nearestScheduled[0];
  return (
    <Shell id="facts" title={`${code} airport facts`} badge={<Badge tone="data">OurAirports · Wikidata</Badge>}>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {e.typeLabel && <DataFact label="Size class" value={e.typeLabel} source={`${oa}; OurAirports’ own classification`} />}
        {e.elevationFt != null && (
          <DataFact
            label="Elevation"
            value={e.elevationFt < 0 ? `${formatElevation(Math.abs(e.elevationFt))} below sea level` : formatElevation(e.elevationFt)}
            source={oa}
          />
        )}
        {e.opened && (
          <DataFact
            label={e.opened.prop === 'P1619' ? 'Opened' : 'Inception'}
            value={formatOpened(e.opened)}
            source={wd(e.opened.prop === 'P1619' ? ' — date of official opening' : ' — inception date')}
          />
        )}
        {e.operators.length > 0 && <DataFact label="Operator" value={e.operators.map((o) => o.label).join(', ')} source={wd()} />}
        {e.owners.length > 0 && <DataFact label="Owner" value={e.owners.map((o) => o.label).join(', ')} source={wd()} />}
        {e.patronage && (
          <DataFact
            label={`Passengers, ${e.patronage.year}`}
            value={formatPassengers(e.patronage.value)}
            source={wd(
              e.patronage.refUrl ? (
                <>
                  , citing <ExternalLink href={e.patronage.refUrl}>{hostOf(e.patronage.refUrl)}</ExternalLink>
                </>
              ) : (
                ' — no reference given there'
              ),
            )}
          />
        )}
        {named.length > 0 && <DataFact label="Named after" value={named.map((n) => n.label).join(', ')} source={wd()} />}
        {nearest && (
          <DataFact
            label="Nearest airport with scheduled flights"
            value={
              <>
                {nearest.href ? (
                  <Link href={nearest.href} className="text-primary-emphasis underline-offset-2 hover:underline">
                    {nearest.name}
                  </Link>
                ) : (
                  nearest.name
                )}{' '}
                <span className="font-mono text-sm text-forest-900/75">{nearest.iata}</span> · {nearest.km.toLocaleString('en-US')} km
              </>
            }
            source="OurAirports scheduled-service flag; straight-line distance calculated"
          />
        )}
      </dl>
    </Shell>
  );
}

function RunwaysSection({ code, e, oaDate }: { code: string; e: View; oaDate: string | null }) {
  const lit = e.runways.filter((r) => r.lighted).length;
  return (
    <Shell
      id="runways"
      title={`Runways at ${code}`}
      badge={<Badge tone="data">OurAirports{oaDate ? ` · ${oaDate}` : ''}</Badge>}
      source={
        <p className="text-sm text-forest-900/75">
          Source: <ExternalLink href="https://ourairports.com/data/">OurAirports</ExternalLink> runways data (public domain)
          {oaDate ? `, retrieved ${oaDate}` : ''}. Not an aeronautical source — not for navigation.
        </p>
      }
    >
      <p className="text-[15px] leading-7 text-forest-900/85">
        {e.runways.length === 1 ? 'One open runway' : `${e.runways.length} open runways`}
        {lit ? `, ${lit === e.runways.length ? (lit === 1 ? 'lit' : 'all lit') : `${lit} lit`}` : ''}. {runwayCaption(e.runways)}.
        {e.closedRunways > 0 ? ` OurAirports also lists ${e.closedRunways} closed ${e.closedRunways === 1 ? 'runway' : 'runways'}, not shown.` : ''}
      </p>
      <div className="overflow-hidden rounded-[0.3rem] border border-forest-900/10">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Runways at {code}: length, width, surface and lighting</caption>
          <thead className="bg-forest-50/60 text-xs uppercase tracking-wider text-forest-900/75">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-semibold">Runway</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Length</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Width</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Surface</th>
              <th scope="col" className="hidden px-3 py-2.5 font-semibold sm:table-cell">Lighting</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-900/10">
            {e.runways.map((r, i) => (
              <tr key={`${r.ident}-${i}`}>
                <th scope="row" className="px-3 py-2.5 font-mono font-semibold text-forest-950">{r.ident ?? '—'}</th>
                <td className="px-3 py-2.5 text-forest-950">
                  <span className="block font-semibold">{metres(r.lengthFt).toLocaleString('en-US')} m</span>
                  <span className="block text-xs text-forest-900/70">{r.lengthFt.toLocaleString('en-US')} ft</span>
                </td>
                <td className="px-3 py-2.5 text-forest-950">{r.widthFt ? `${metres(r.widthFt)} m` : '—'}</td>
                <td className="px-3 py-2.5 text-forest-950">{r.surface ?? r.surfaceRaw ?? '—'}</td>
                <td className="hidden px-3 py-2.5 text-forest-950 sm:table-cell">{r.lighted ? 'Lit' : 'Not listed as lit'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function DestinationsSection({
  code,
  name,
  fares,
  date,
  hasRoutes,
}: {
  code: string;
  name: string;
  fares: NonNullable<View['fares']>;
  date: string | null;
  hasRoutes: boolean;
}) {
  const linked = fares.groups.some((g) => g.destinations.some((d) => d.routeHref));
  return (
    <Shell
      id="destinations"
      title={`Airlines and destinations from ${code}`}
      badge={<Badge tone="data">Travelpayouts{date ? ` · ${date}` : ''}</Badge>}
      source={
        <p className="text-sm text-forest-900/75" data-testid="airport-v2-fares-caveat">
          Source: Travelpayouts fare data{date ? `, ${date}` : ''} — destinations where travellers found a nonstop fare from {code}{' '}
          in the days before that date. Not a complete or live schedule.
        </p>
      }
    >
      <p className="text-[15px] leading-7 text-forest-900/85">
        Nonstop fares from {code} to {fares.destinationCount} {fares.destinationCount === 1 ? 'destination' : 'destinations'}
        {fares.countryCount > 1 ? ` in ${fares.countryCount} countries` : ''}, on {fares.airlines.length}{' '}
        {fares.airlines.length === 1 ? 'airline' : 'airlines'}.
        {hasRoutes ? ' Originfacts’ own route records for ' + code + ' are listed separately below.' : ''}
      </p>

      <div>
        <h3 className="text-base leading-snug text-forest-950">Airlines named on the fares</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {fares.airlines.map((a) => (
            <li key={a.code} className="inline-flex items-center gap-2 rounded-full border border-forest-900/15 bg-white px-3 py-1.5 text-sm">
              <span className="font-mono text-xs font-semibold text-forest-900/70">{a.code}</span>
              {a.href ? (
                <Link href={a.href} className="font-medium text-primary-emphasis underline-offset-2 hover:underline">
                  {a.name}
                </Link>
              ) : (
                <span className="font-medium text-forest-950">{a.name}</span>
              )}
              <span className="text-xs text-forest-900/70">
                {a.destinations} {a.destinations === 1 ? 'destination' : 'destinations'}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs leading-5 text-forest-900/70">
          The airline on a fare can be the seller of a codeshare flown by a partner. Linked names are matched to Originfacts airline
          pages by code and name; others are shown as the fare data names them.
        </p>
      </div>

      <div>
        <h3 className="text-base leading-snug text-forest-950">Destinations by country</h3>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
          {fares.groups.map((g) => (
            <div key={g.country} className="min-w-0">
              <dt className="text-sm font-semibold text-forest-950">
                {g.country} <span className="font-normal text-forest-900/70">({g.destinations.length})</span>
              </dt>
              <dd className="text-sm leading-6 text-forest-900/85">
                {g.destinations.map((d, i) => (
                  <span key={d.code}>
                    {i > 0 && ', '}
                    {d.routeHref ? (
                      <Link href={d.routeHref} className="text-primary-emphasis underline-offset-2 hover:underline">
                        {d.name}
                      </Link>
                    ) : (
                      d.name
                    )}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        {linked && <p className="mt-3 text-xs leading-5 text-forest-900/70">Linked destinations also have an Originfacts route record from {code}.</p>}
      </div>
      <p className="text-sm text-forest-900/75">Check schedules with the airline or {name} before you book.</p>
    </Shell>
  );
}

function HubsSection({ code, hubs, qid, date }: { code: string; hubs: View['hubs']; qid: string | null; date: string | null }) {
  return (
    <Shell
      id="hubs"
      title={`Airlines with a hub at ${code}`}
      badge={<Badge tone="data">Wikidata{date ? ` · ${date}` : ''}</Badge>}
      source={
        <p className="text-sm text-forest-900/75">
          Per {qid ? <ExternalLink href={wikidataUrl(qid)}>Wikidata</ExternalLink> : 'Wikidata'}
          {date ? ` (retrieved ${date})` : ''}: airlines whose “airline hub” property names {code}, with no end date and not recorded
          as dissolved. Community-edited; hubs change.
        </p>
      }
    >
      <ul className="flex flex-wrap gap-2">
        {hubs.map((h) => (
          <li key={h.qid} className="inline-flex items-center gap-2 rounded-full border border-forest-900/15 bg-white px-3 py-1.5 text-sm">
            {h.iata && <span className="font-mono text-xs font-semibold text-forest-900/70">{h.iata}</span>}
            {h.href ? (
              <Link href={h.href} className="font-medium text-primary-emphasis underline-offset-2 hover:underline">
                {h.label}
              </Link>
            ) : (
              <ExternalLink href={wikidataUrl(h.qid)} className="font-medium">
                {h.label}
              </ExternalLink>
            )}
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function GettingThereSection({
  name,
  code,
  city,
  coordSource,
}: {
  name: string;
  code: string;
  city: NonNullable<View['cityCentre']>;
  coordSource: 'record' | 'ourairports';
}) {
  return (
    <Shell id="getting-there" title={`Where ${code} is`} badge={<Badge tone="data">Calculated</Badge>}>
      <p className="text-2xl font-bold text-forest-950">
        {formatKm(city.km)} <span className="text-lg font-semibold">{compassWords(city.compass)}</span>
      </p>
      <p className="text-[15px] leading-7 text-forest-900/85">
        {name} lies {formatKm(city.km)} {compassWords(city.compass)} of {city.name} city centre in a straight line. Road distance is
        longer; transport options are not yet verified (see terminals and transport below).
      </p>
      <p className="text-sm text-forest-900/75">
        Calculated from the airport coordinates ({coordSource === 'ourairports' ? 'OurAirports' : 'Originfacts airport record'}) and the{' '}
        {city.source === 'osm' ? (
          <ExternalLink href={`https://www.openstreetmap.org/${city.ref}`}>OpenStreetMap</ExternalLink>
        ) : (
          <ExternalLink href={wikidataUrl(city.ref)}>Wikidata</ExternalLink>
        )}{' '}
        city-centre point.
      </p>
    </Shell>
  );
}

function ClimateSection({ code, climate }: { code: string; climate: NonNullable<View['climate']> }) {
  const lo = Math.min(...climate.months.map((m) => m.lo));
  const hi = Math.max(...climate.months.map((m) => m.hi));
  const span = Math.max(hi - lo, 1);
  const s = climate.summary;
  return (
    <Shell
      id="climate"
      title={`Climate at ${code}, month by month`}
      badge={<Badge tone="data">NASA POWER · {climate.period}</Badge>}
      source={
        <p className="text-sm text-forest-900/75">
          Source: <ExternalLink href="https://power.larc.nasa.gov/">NASA POWER</ExternalLink> daily values for {climate.period} at{' '}
          {climate.lat.toFixed(2)}°, {climate.lon.toFixed(2)}° (MERRA-2 reanalysis grid, about 50 km cells), averaged by Originfacts.
          Modelled, not airport weather-station readings.
        </p>
      }
    >
      <p className="text-[15px] leading-7 text-forest-900/85">
        Warmest: {s.warmest.month} (average high {Math.round(s.warmest.hi)}°C). Coolest: {s.coolest.month} ({Math.round(s.coolest.hi)}°C
        high, {Math.round(s.coolest.lo)}°C low).
        {s.wettest && s.driest ? ` Wettest: ${s.wettest.month} (${s.wettest.mm} mm); driest: ${s.driest.month} (${s.driest.mm} mm).` : ''}
      </p>
      <div className="overflow-hidden rounded-[0.3rem] border border-forest-900/10">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Average daily high and low temperature and average monthly precipitation at {code}, {climate.period}
          </caption>
          <thead className="bg-forest-50/60 text-xs uppercase tracking-wider text-forest-900/75">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Month</th>
              <th scope="col" className="px-3 py-2 font-semibold">High</th>
              <th scope="col" className="px-3 py-2 font-semibold">Low</th>
              <th scope="col" className="hidden w-2/5 px-3 py-2 font-semibold sm:table-cell">
                <span className="sr-only">Temperature range</span>
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">Rain</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-900/10">
            {climate.months.map((m) => (
              <tr key={m.month}>
                <th scope="row" className="px-3 py-1.5 font-medium text-forest-950">{m.month}</th>
                <td className="px-3 py-1.5 font-semibold text-forest-950">{Math.round(m.hi)}°C</td>
                <td className="px-3 py-1.5 text-forest-900/85">{Math.round(m.lo)}°C</td>
                <td className="hidden px-3 py-1.5 sm:table-cell" aria-hidden>
                  <span className="relative block h-2 rounded-full bg-forest-900/5">
                    <span
                      className="absolute inset-y-0 rounded-full bg-primary-emphasis/70"
                      style={{ left: `${((m.lo - lo) / span) * 100}%`, width: `${Math.max(((m.hi - m.lo) / span) * 100, 2)}%` }}
                    />
                  </span>
                </td>
                <td className="px-3 py-1.5 text-forest-900/85">{m.mm == null ? '—' : `${m.mm} mm`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
