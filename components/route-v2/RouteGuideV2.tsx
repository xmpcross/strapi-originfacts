import Link from 'next/link';
import type { ReactNode } from 'react';
import PriceCalendar from '@/components/PriceCalendar';
import ScheduleWidget from '@/components/ScheduleWidget';
import TpConsentGate from '@/components/TpConsentGate';
import { Cite, MonthFaresTable, SeenFlightsTable, formatFetched } from '@/components/route-guide/RouteGuideBlocks';
import type { GuideParagraph, GuideSection, GuideSource } from '@/lib/route-guide';
import type { MonthFare, RouteFarePrices, RouteFares } from '@/lib/route-fares';
import type { AirlineHighlight, RouteAirportFacts, RouteClimate, TimeDifference, ZoneInfo } from '@/lib/route-v2';
import { formatMinutes, joinNames } from '@/lib/route-v2';
import type { Faq } from '@/lib/entity-seo';
import SectionNav, { type NavItem, type NavStatus } from './SectionNav';
import { FarePrice, FarePriceProvider } from './FarePrices';
import SourcesDisclosure from './SourcesDisclosure';

/**
 * Flight-route page, v2 layout — a sibling of the airline and airport v2 pages
 * (components/airline-v2, components/airport-v2). The default for every route
 * (lib/route-template-v2.ts, which also holds the rollback switch).
 *
 * Data is not fetched here. The page route computes everything once (route
 * record, credible carriers, airline fact-file highlights, the sourced route
 * guide if there is one, live fare data, related route records) and passes it
 * in; this component only decides how to show it.
 *
 * Rules the layout follows:
 *   - every figure names its source; live fare data carries its fetch time;
 *   - carriers come from lib/route-carriers.ts (operableCarriers), narrowed to
 *     the airlines a cited source confirms when the route has a guide;
 *   - airline baggage and check-in highlights are `official` fact-file fields
 *     only, each with its source page and date — otherwise "not yet verified";
 *   - airport facts and the destination climate come from the open-data
 *     snapshots in data/airport-enrichment, named with their retrieval date;
 *     the climate is labelled as modelled (NASA POWER reanalysis);
 *   - prices print in the visitor's header currency, client-side
 *     (FarePrices.tsx); the server HTML holds a neutral placeholder, never a
 *     currency symbol;
 *   - cited prose carries footnote numbers into the Sources block; sections
 *     with footnotes carry no extra "cited sources" pill;
 *   - derived values (time difference, distance check) say how they were
 *     derived; the flight time says whether it is fare data or an estimate;
 *   - the CMS `about` prose and CMS images are not shown: unsourced, generated;
 *   - partner widgets stay behind the advertising-consent gate and are labelled
 *     as partner-provided and indicative;
 *   - the FAQ is passed in by the route, the same list it marks up as FAQPage.
 */

export type RouteV2Airport = {
  iata: string;
  icao?: string | null;
  name: string;
  city?: string | null;
  country?: string | null;
  href: string;
  zone: ZoneInfo | null;
  coordinates: string | null;
  /** Official website from the Wikidata-sourced links file, if listed. */
  officialSite: string | null;
  recordDate: string | null;
  /** Key facts from OurAirports / Wikidata, when the snapshots have the airport. */
  facts: RouteAirportFacts | null;
};

export type RouteV2Airline = {
  slug: string;
  name: string;
  iataCode?: string | null;
  logoUrl?: string | null;
  searchUrl: string;
  highlights: AirlineHighlight[];
};

export type RouteV2Link = {
  slug: string;
  originIata: string;
  destinationIata: string;
  fromName: string;
  toName: string;
  distanceKm?: number | null;
  durationMinutes?: number | null;
};

export type RouteGuideV2Props = {
  slug: string;
  origin: RouteV2Airport;
  destination: RouteV2Airport;
  fromName: string;
  toName: string;
  /** Present when content/route-guides/<slug>.json exists and loaded. */
  guide: {
    intro: GuideParagraph;
    sections: GuideSection[];
    sources: GuideSource[];
    verifiedAt: string;
    /** Sources confirming the listed airlines fly the route with their own aircraft. */
    operatorSources: string[];
  } | null;
  order: Map<string, number>;
  airlines: RouteV2Airline[];
  /** What the airline list rests on. */
  airlinesBasis: 'sourced' | 'fares' | 'records';
  distance: { km: number; computedKm: number | null; agrees: boolean } | null;
  /** Fare-data gate-to-gate range if there is fare data, else the record's estimate. */
  flightTime: { text: string; basis: 'fares' | 'estimate' } | null;
  timeDiff: TimeDifference | null;
  fares: RouteFares | null;
  /** The USD prices from `fares`, for the client price cells (other currencies are fetched). */
  usdPrices: RouteFarePrices | null;
  /** Destination monthly climate (NASA POWER, modelled), when the snapshot has it. */
  climate: RouteClimate | null;
  carrierNames: Record<string, string>;
  cheapestMonth: MonthFare | null;
  routeRecordDate: string | null;
  returnRoute: RouteV2Link | null;
  fromOrigin: RouteV2Link[];
  toDestination: RouteV2Link[];
  searchUrl: string;
  partnerHref: string;
  faqs: Faq[];
};

const WRAP = 'mx-auto max-w-7xl px-4 sm:px-6';
const SECTION = 'scroll-mt-[6.5rem]';

function formatDay(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function RouteGuideV2(p: RouteGuideV2Props) {
  const { origin, destination, guide, order, airlines, fares, faqs } = p;
  const o = origin.iata;
  const d = destination.iata;
  const fetched = fares ? formatFetched(fares.fetchedAt) : null;
  const hasFlights = !!fares && fares.flights.length > 0;
  const hasMonths = !!fares && fares.months.length > 0;
  const airportsSection = guide?.sections.find((s) => s.id === 'airports') ?? null;
  const gettingThere = guide?.sections.find((s) => s.id === 'getting-there') ?? null;
  const otherSections = guide?.sections.filter((s) => s.id !== 'airports' && s.id !== 'getting-there') ?? [];
  const hasRelated = !!p.returnRoute || p.fromOrigin.length > 0 || p.toDestination.length > 0;
  const airlinesStatus: NavStatus = airlines.length === 0 ? 'pending' : p.airlinesBasis === 'sourced' ? 'sourced' : p.airlinesBasis === 'fares' ? 'live' : 'data';
  const airlinesLabel = p.airlinesBasis === 'records' ? 'Airlines on this route' : 'Nonstop airlines';

  const navItems: NavItem[] = [
    { id: 'airlines', label: airlines.length ? `${airlinesLabel} (${airlines.length})` : airlinesLabel, status: airlinesStatus },
    ...(hasFlights ? [{ id: 'nonstop-flights', label: 'Flights seen in searches', status: 'live' as const }] : []),
    ...(hasMonths ? [{ id: 'fares-by-month', label: 'Lowest fares by month', status: 'live' as const }] : []),
    { id: 'prices', label: 'Fare calendar & schedule', status: 'live' },
    { id: 'airports', label: `The airports: ${o} & ${d}`, status: airportsSection ? 'sourced' : 'data' },
    ...(p.climate ? [{ id: 'climate', label: `Weather in ${p.toName}`, status: 'data' as const }] : []),
    { id: 'getting-there', label: 'Getting to & from the airports', status: gettingThere ? 'sourced' : 'pending' },
    ...otherSections.map((s) => ({ id: s.id, label: navLabel(s.id, s.heading), status: 'sourced' as const })),
    ...(hasRelated ? [{ id: 'related-routes', label: 'Return & related routes', status: 'data' as const }] : []),
    ...(faqs.length ? [{ id: 'faq', label: 'FAQ', status: 'none' as const }] : []),
    { id: 'sources', label: 'Sources', status: 'none' },
  ];

  return (
    <FarePriceProvider slug={p.slug} usd={p.usdPrices}>
    <div className="bg-[#fbfcff]" data-testid={`route-v2-page-${p.slug}`} data-template="v2">
      {/* ---------------------------------------------------------- header */}
      <header className="border-b border-forest-900/10 bg-white">
        <div className={`${WRAP} pb-8 pt-6 lg:pb-10`}>
          <nav aria-label="Breadcrumb" className="text-sm text-forest-900/75">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li className="flex items-center gap-1.5">
                <Link href="/flight-routes" className="hover:text-primary-emphasis hover:underline">
                  Flight routes
                </Link>
                <span aria-hidden>/</span>
              </li>
              <li aria-current="page" className="font-medium text-forest-950">
                {o} → {d}
              </li>
            </ol>
          </nav>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-primary-emphasis">Flight route</p>
          <h1 className="mt-1 text-3xl leading-tight sm:text-4xl">
            Flights from {p.fromName} <span className="whitespace-nowrap">({o})</span> to {p.toName}{' '}
            <span className="whitespace-nowrap">({d})</span>
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-forest-900/80" data-testid="route-v2-intro">
            {guide ? (
              <>
                {guide.intro.text}
                <Cite ids={guide.intro.sources} order={order} />
              </>
            ) : (
              <>
                Distance, flight time and the airlines in Originfacts’ route record for {p.fromName} to {p.toName}, the two
                airports, and partner fare tools. Each figure shows where it came from.
              </>
            )}
          </p>

          {/* Route strip: the two airports, linked to their guides. */}
          <div className="mt-7 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]" data-testid="route-v2-strip">
            <AirportEnd airport={origin} role="From" />
            <div className="flex items-center justify-center gap-3 px-2 py-1 text-forest-900/70 sm:flex-col sm:gap-1.5">
              <PlaneIcon className="h-6 w-6 rotate-90 text-primary-emphasis max-sm:rotate-180" />
              <span className="text-center text-sm">
                {p.distance && <span className="block font-semibold text-forest-950">{p.distance.km.toLocaleString('en-US')} km</span>}
                {p.flightTime && (
                  <span className="block text-xs">
                    {p.flightTime.basis === 'estimate' ? `~${p.flightTime.text} est.` : `${p.flightTime.text} in fare data`}
                  </span>
                )}
              </span>
            </div>
            <AirportEnd airport={destination} role="To" />
          </div>

          {airlines.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2" data-testid="route-v2-header-airlines">
              <span className="mr-1 text-sm font-semibold text-forest-950">
                {p.airlinesBasis === 'records' ? 'In our route record:' : 'Flown nonstop by:'}
              </span>
              {airlines.map((a) => (
                <Link
                  key={a.slug}
                  href={`/airlines/${a.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-forest-900/15 bg-white py-1 pl-2 pr-3 text-sm font-medium text-forest-950 transition hover:border-primary-emphasis hover:text-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
                >
                  <LogoMark airline={a} size="sm" />
                  {a.name}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <a
              href={p.searchUrl}
              target="_blank"
              rel="sponsored nofollow noopener"
              className="inline-flex items-center justify-center gap-2 rounded-[0.3rem] bg-forest-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
              data-testid="route-search-cta"
            >
              Find flights {o} → {d}
              <span aria-hidden>→</span>
            </a>
            <p className="text-xs text-forest-900/70">Opens our flight-search partner. We may earn a commission when you book, at no cost to you.</p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-forest-900/75" data-testid="route-v2-ledger">
            {guide && (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-600" />
                Route facts checked {formatDay(guide.verifiedAt)}
              </span>
            )}
            {fetched && (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2 w-2 rounded-full bg-sky-500" />
                Fare data fetched {fetched}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-primary-emphasis" />
              Route record{p.routeRecordDate ? `, updated ${p.routeRecordDate}` : ''}
            </span>
            <a href="#sources" className="text-primary-emphasis underline-offset-2 hover:underline">
              Where this comes from
            </a>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------- at a glance */}
      <section aria-labelledby="glance-title" className={`${WRAP} pt-8`} data-testid="route-v2-glance">
        <h2 id="glance-title" className="text-xl sm:text-2xl">
          {o} → {d} at a glance
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Tile title="Distance" source={p.distance?.agrees ? 'Route record · checked against coordinates' : 'Route record'}>
            {p.distance ? (
              <>
                <Big>{p.distance.km.toLocaleString('en-US')} km</Big>
                <Sub>
                  {p.distance.agrees
                    ? `About ${Math.round(p.distance.km * 0.621371).toLocaleString('en-US')} miles: the great-circle distance between the two airports’ coordinates.`
                    : `${Math.round(p.distance.km * 0.621371).toLocaleString('en-US')} miles, as given in the route record.`}
                </Sub>
              </>
            ) : (
              <Gap>Not in the route record.</Gap>
            )}
          </Tile>

          <Tile
            title="Flight time"
            source={p.flightTime?.basis === 'fares' ? `Aviasales fare data · ${fetched}` : 'Route record estimate'}
            section={hasFlights ? 'nonstop-flights' : undefined}
            linkText="See flights"
          >
            {p.flightTime ? (
              <>
                <Big>{p.flightTime.basis === 'estimate' ? `~${p.flightTime.text}` : p.flightTime.text}</Big>
                <Sub>
                  {p.flightTime.basis === 'fares'
                    ? 'Gate-to-gate times of the nonstop flights in recent fare searches.'
                    : 'An estimate, not a timetable. The airline’s schedule gives the actual time.'}
                </Sub>
              </>
            ) : (
              <Gap>Not yet known.</Gap>
            )}
          </Tile>

          <Tile title="Time difference" source="Calculated from IANA time zones" section="airports" linkText="Time zones">
            {p.timeDiff && origin.zone && destination.zone ? (
              <>
                <Big>{p.timeDiff.minutes === 0 ? 'None' : p.timeDiff.text}</Big>
                <Sub>
                  {p.timeDiff.minutes === 0
                    ? `${o} and ${d} are both on ${origin.zone.label} today.`
                    : `${p.toName} is ${p.timeDiff.text.replace(/^[+−]/, '')} ${p.timeDiff.minutes > 0 ? 'ahead of' : 'behind'} ${p.fromName} today.`}{' '}
                  {o}: {origin.zone.zone} ({origin.zone.label}) · {d}: {destination.zone.zone} ({destination.zone.label})
                </Sub>
              </>
            ) : (
              <Gap>Time zone missing from an airport record.</Gap>
            )}
          </Tile>

          <Tile
            title={p.airlinesBasis === 'records' ? 'Airlines in route record' : 'Nonstop airlines'}
            source={p.airlinesBasis === 'sourced' ? 'Cited sources' : p.airlinesBasis === 'fares' ? 'Aviasales fare data' : 'Originfacts route record'}
            section="airlines"
            linkText="See airlines"
          >
            {airlines.length > 0 ? (
              <>
                <Big>{airlines.length}</Big>
                <Sub>{joinNames(airlines.map((a) => a.name))}</Sub>
              </>
            ) : (
              <Gap>None in our records yet.</Gap>
            )}
          </Tile>

          {p.cheapestMonth && (
            <Tile title="Lowest fare in recent searches" source={`Aviasales fare data · ${fetched}`} section="fares-by-month" linkText="By month">
              <Big>
                <FarePrice kind="month" k={p.cheapestMonth.month} />
              </Big>
              <Sub>
                One way, nonstop, {formatMonth(p.cheapestMonth.month)}, in the currency chosen in the site header. A cached search
                result, not a quote: check the live price.
              </Sub>
            </Tile>
          )}

          {p.returnRoute && (
            <Tile title="Return route" source="Originfacts route record" section="related-routes" linkText="Related routes">
              <Link
                href={`/flight-routes/${p.returnRoute.slug}`}
                className="block text-xl font-bold text-primary-emphasis underline-offset-2 hover:underline"
              >
                {p.returnRoute.originIata} → {p.returnRoute.destinationIata}
              </Link>
              <Sub>
                Flights from {p.returnRoute.fromName} back to {p.returnRoute.toName}.
              </Sub>
            </Tile>
          )}
        </ul>
      </section>

      {/* ---------------------------------------------------------- body */}
      <div className={`${WRAP} pb-16 pt-8 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10`}>
        <aside className="hidden lg:block">
          <SectionNav items={navItems} />
        </aside>

        <div className="min-w-0">
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
            {/* ------------------------------------------------ airlines */}
            {airlines.length > 0 ? (
              <Shell
                id="airlines"
                title={p.airlinesBasis === 'records' ? `Airlines on the ${o}–${d} route` : `Airlines flying ${o} → ${d} nonstop`}
                badge={
                  p.airlinesBasis === 'sourced' ? undefined : p.airlinesBasis === 'fares' ? (
                    <Badge tone="live">Fare data · {fetched}</Badge>
                  ) : (
                    <Badge tone="data">Route record{p.routeRecordDate ? ` · ${p.routeRecordDate}` : ''}</Badge>
                  )
                }
              >
                <p className="text-[15px] leading-7 text-forest-900/85">
                  {p.airlinesBasis === 'sourced' && guide ? (
                    <>
                      {joinNames(airlines.map((a) => a.name))} {airlines.length === 1 ? 'flies' : 'fly'} {p.fromName}–{p.toName} nonstop with
                      their own aircraft.
                      <Cite ids={guide.operatorSources} order={order} /> Other airlines can sell seats on these flights under their own flight
                      numbers (codeshares); those are not listed here.
                    </>
                  ) : p.airlinesBasis === 'fares' ? (
                    <>
                      Nonstop {p.fromName}–{p.toName} flights in recent fare data are sold under {joinNames(airlines.map((a) => a.name))} flight
                      numbers. Other airlines can sell seats on these flights under their own flight numbers (codeshares); those are not listed
                      here.
                    </>
                  ) : (
                    <>
                      The airlines Originfacts’ route record lists for {o}–{d}, after leaving out carriers listed only through a recycled
                      airline code or as a codeshare. It is not a full schedule and does not say which airlines fly nonstop; check
                      current flights with the airline.
                    </>
                  )}
                </p>
                <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="route-v2-airline-cards">
                  {airlines.map((a) => (
                    <AirlineCard key={a.slug} airline={a} />
                  ))}
                </ul>
                <p className="text-sm leading-6 text-forest-900/75">
                  Baggage and check-in rules are each airline’s general rules, read from its own site on the date shown. They are
                  not specific to this route, and your fare type can change them: check your booking.
                </p>
              </Shell>
            ) : (
              <Shell id="airlines" title={`Airlines on the ${o}–${d} route`} tone="muted" badge={<Badge tone="pending">None in our records</Badge>}>
                <p className="text-[15px] leading-7 text-forest-900/80" data-testid="route-no-carriers">
                  No airlines in our record yet. Use the fare calendar and schedule below, or search the route with our partner, to see
                  who sells flights between {o} and {d}.
                </p>
              </Shell>
            )}

            {/* ------------------------------------------------ flights seen */}
            {hasFlights && fares && (
              <Shell
                id="nonstop-flights"
                title={`Nonstop flights seen in recent searches`}
                badge={<Badge tone="live">Fare data · {fetched}</Badge>}
              >
                <p className="text-[15px] leading-7 text-forest-900/85">
                  {fares.flights.length} nonstop flight{fares.flights.length === 1 ? '' : 's'} from {o} to {d} appeared in recent fare
                  searches, sold under {joinNames(fares.airlines.map((a) => p.carrierNames[a] || a))} flight numbers
                  {fares.duration
                    ? `, with flight times of ${fares.duration.min === fares.duration.max ? fares.duration.min : `${fares.duration.min}–${fares.duration.max}`} minutes`
                    : ''}
                  .
                </p>
                <SeenFlightsTable flights={fares.flights} fares={fares} originIata={o} destinationIata={d} names={p.carrierNames} />
              </Shell>
            )}

            {/* ------------------------------------------------ fares by month */}
            {hasMonths && fares && (
              <Shell id="fares-by-month" title={`Lowest ${o}–${d} fares by month`} badge={<Badge tone="live">Fare data · {fetched}</Badge>}>
                <MonthFaresTable months={fares.months} fares={fares} names={p.carrierNames} />
              </Shell>
            )}

            {/* ------------------------------------------------ partner tools */}
            <Shell
              id="prices"
              title={`Fare calendar and schedule for ${o} → ${d}`}
              badge={<Badge tone="partner">Partner tools · indicative</Badge>}
            >
              <p className="text-[15px] leading-7 text-forest-900/85">
                Two tools from Aviasales, our flight-search partner. They load only if you allow advertising cookies. Prices in
                them come from recent searches and are indicative, not quotes; the fare on the booking page can differ. The schedule
                shows flights in the partner’s data, including codeshares sold by other airlines.
              </p>
              <div data-testid="route-price-calendar">
                <h3 id="cheapest-dates" className={`${SECTION} text-base font-semibold text-forest-950`}>
                  Fare calendar
                </h3>
                <div className="mt-2 rounded-[0.3rem] border border-forest-900/10 bg-paper p-2">
                  {/* Min-heights = the widget's rendered height per width (Playwright, Oct 2026). */}
                  <TpConsentGate
                    tool="price calendar"
                    partnerHref={p.partnerHref}
                    className="min-h-[400px] min-[440px]:min-h-[450px] sm:min-h-[560px] xl:min-h-[487px]"
                  >
                    <PriceCalendar origin={o} destination={d} />
                  </TpConsentGate>
                </div>
              </div>
              <div data-testid="route-schedule">
                <h3 id="schedule" className={`${SECTION} text-base font-semibold text-forest-950`}>
                  Flight schedule
                </h3>
                <div className="mt-2 rounded-[0.3rem] border border-forest-900/10 bg-white p-2">
                  <TpConsentGate
                    tool="flight schedule"
                    partnerHref={p.partnerHref}
                    className="min-h-[1079px] sm:min-h-[670px] min-[880px]:min-h-[710px]"
                  >
                    <ScheduleWidget origin={o} destination={d} />
                  </TpConsentGate>
                </div>
              </div>
            </Shell>

            {/* ------------------------------------------------ airports */}
            <Shell
              id="airports"
              title={`The airports: ${origin.name} and ${destination.name}`}
              badge={<Badge tone="data">{origin.facts || destination.facts ? 'Airport records · OurAirports · Wikidata' : 'Airport records'}</Badge>}
            >
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <AirportCard airport={origin} role="Departure" />
                <AirportCard airport={destination} role="Arrival" />
              </ul>
              {airportsSection && (
                <div className="space-y-3 text-[15px] leading-7 text-forest-900/85" data-testid="route-v2-airports-cited">
                  {airportsSection.paragraphs.map((para, i) => (
                    <p key={i}>
                      {para.text}
                      <Cite ids={para.sources} order={order} />
                    </p>
                  ))}
                </div>
              )}
              <p className="text-sm leading-6 text-forest-900/75">
                Each airport guide lists the airport’s codes, location and time zone, any other routes and airlines Originfacts
                tracks from {o} or {d}, current weather and nearby airports, and where to check terminal and transport details.
              </p>
            </Shell>

            {/* ------------------------------------------------ destination climate */}
            {p.climate && <ClimateSection climate={p.climate} toName={p.toName} airport={destination} />}

            {/* ------------------------------------------------ getting there */}
            {gettingThere ? (
              <Shell id="getting-there" title={gettingThere.heading}>
                <CitedParagraphs paragraphs={gettingThere.paragraphs} order={order} />
              </Shell>
            ) : (
              <Shell
                id="getting-there"
                title={`Getting to and from ${o} and ${d}`}
                tone="muted"
                badge={<Badge tone="pending">Not yet verified</Badge>}
              >
                <p className="text-[15px] leading-7 text-forest-900/80">
                  Ground transport, terminals and parking at either airport have not been checked against the airports’ own pages
                  yet, so none are listed here.
                </p>
                {(origin.officialSite || destination.officialSite) && (
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-semibold text-forest-950">Check directly:</span>
                    {origin.officialSite && <ExternalLink href={origin.officialSite}>{host(origin.officialSite)}</ExternalLink>}
                    {destination.officialSite && <ExternalLink href={destination.officialSite}>{host(destination.officialSite)}</ExternalLink>}
                  </p>
                )}
              </Shell>
            )}

            {/* ------------------------------------------------ other cited sections (route history…) */}
            {otherSections.map((s) => (
              <Shell key={s.id} id={s.id} title={s.heading}>
                <CitedParagraphs paragraphs={s.paragraphs} order={order} />
              </Shell>
            ))}

            {/* ------------------------------------------------ related routes */}
            {hasRelated && (
              <Shell
                id="related-routes"
                title="Return and related routes"
                badge={<Badge tone="data">Route records</Badge>}
                source={
                  <p className="text-sm text-forest-900/75">
                    Other routes in Originfacts’ route records that share an airport with this one. Distances and flight times are each
                    record’s own; times are estimates.
                  </p>
                }
              >
                {p.returnRoute && (
                  <RouteGroup title="Return route" routes={[p.returnRoute]} testid="route-v2-return" />
                )}
                {p.fromOrigin.length > 0 && <RouteGroup title={`Other routes from ${o}`} routes={p.fromOrigin} />}
                {p.toDestination.length > 0 && <RouteGroup title={`Other routes to ${d}`} routes={p.toDestination} />}
              </Shell>
            )}

            {/* ------------------------------------------------ faq */}
            {faqs.length > 0 && (
              <Shell id="faq" title={`${p.fromName} to ${p.toName}: common questions`}>
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
              <SourcesDisclosure
                summary={
                  guide && guide.sources.length > 0
                    ? `Where each part of this page comes from, and the ${guide.sources.filter((s) => order.has(s.id)).length} numbered sources`
                    : 'Where each part of this page comes from'
                }
              >
              <ul className="divide-y divide-forest-900/10 rounded-[0.3rem] border border-forest-900/10" aria-label="Where each part of this page comes from" data-testid="route-sources">
                <li aria-hidden className="hidden bg-forest-50/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-forest-900/75 sm:grid sm:grid-cols-[11rem_minmax(0,1fr)_10rem] sm:gap-4">
                  <span>What</span>
                  <span>Source</span>
                  <span>Date</span>
                </li>
                {guide && (
                  <SourceRow what="Route history, airlines, airports" date={formatDay(guide.verifiedAt)}>
                    The numbered sources below, each checked on the date shown
                  </SourceRow>
                )}
                <SourceRow what={p.flightTime?.basis === 'estimate' ? 'Distance, flight-time estimate' : 'Distance'} date={p.routeRecordDate}>
                  Originfacts route record{p.distance?.agrees ? ', checked against the great-circle distance between the airport coordinates' : ''}
                </SourceRow>
                <SourceRow what={p.airlinesBasis === 'records' ? 'Airlines' : 'Airline names, logos'} date={p.routeRecordDate}>
                  Originfacts route record, leaving out carriers listed only through a recycled airline code or as a codeshare
                  {p.airlinesBasis === 'sourced' ? ', and narrowed to the airlines the cited sources confirm' : p.airlinesBasis === 'fares' ? ', and narrowed to the airlines in the fare data' : ''}
                </SourceRow>
                <SourceRow what="Baggage and check-in" date={highlightDates(airlines)}>
                  Each airline’s own pages, via the Originfacts airline fact files; only checked values are shown
                </SourceRow>
                {fares && (
                  <SourceRow what="Flights seen, fares by month, flight time" date={fetched}>
                    Travelpayouts Data API (Aviasales searches): cached search results, not quotes or a full timetable
                  </SourceRow>
                )}
                <SourceRow what="Airport codes, time zones" date={[...new Set([origin.recordDate, destination.recordDate].filter(Boolean))].join(' · ') || null}>
                  Originfacts airport records
                </SourceRow>
                <SourceRow what="Time difference" date="Today">
                  Calculated from each airport’s IANA time zone, with daylight saving applied for today’s date
                </SourceRow>
                {(origin.officialSite || destination.officialSite) && (
                  <SourceRow what="Airport websites" date={null}>
                    Wikidata (official website property)
                  </SourceRow>
                )}
                {(origin.facts?.ourairportsRetrieved || destination.facts?.ourairportsRetrieved) && (
                  <SourceRow what="Airport size class, runways" date={formatDay((origin.facts?.ourairportsRetrieved || destination.facts?.ourairportsRetrieved) as string)}>
                    <ExternalLink href="https://ourairports.com/data/">OurAirports</ExternalLink> open data (public domain); the size
                    class is OurAirports’ own, not an official category
                  </SourceRow>
                )}
                {(origin.facts?.wikidataRetrieved || destination.facts?.wikidataRetrieved) && (
                  <SourceRow what="Airport opened, operator, passengers" date={formatDay((origin.facts?.wikidataRetrieved || destination.facts?.wikidataRetrieved) as string)}>
                    Wikidata (CC0), each airport’s own item; passenger figures are the latest year recorded there, with its reference
                    where Wikidata gives one
                  </SourceRow>
                )}
                {p.climate && (
                  <SourceRow what={`Weather in ${p.toName}`} date={p.climate.period}>
                    <ExternalLink href="https://power.larc.nasa.gov/">NASA POWER</ExternalLink> daily data (MERRA-2 reanalysis),
                    averaged by month by Originfacts. Modelled, not weather-station readings
                  </SourceRow>
                )}
                {fares && (
                  <SourceRow what="Fare prices" date={fetched}>
                    Travelpayouts Data API, asked in the currency chosen in the site header (Travelpayouts converts); shown after the
                    page loads
                  </SourceRow>
                )}
                <SourceRow what="Fare calendar, schedule" date="Live">
                  Aviasales widgets, loaded with advertising consent
                </SourceRow>
              </ul>

              {guide && guide.sources.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-forest-950">Cited sources</h3>
                  <p className="mt-1 text-sm text-forest-900/75">
                    Route facts checked against these sources on {formatDay(guide.verifiedAt)}. Fares, flights and flight times come from
                    live search data and are dated where they appear.
                  </p>
                  <ol className="mt-3 space-y-2 text-sm text-forest-900/85">
                    {[...guide.sources]
                      .filter((s) => order.has(s.id))
                      .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
                      .map((s) => (
                        <li key={s.id} id={`source-${s.id}`} className="flex scroll-mt-28 gap-2">
                          <span className="w-7 shrink-0 font-semibold text-forest-900/60">[{order.get(s.id)}]</span>
                          <span className="min-w-0 [overflow-wrap:anywhere]">
                            <a href={s.url} target="_blank" rel="noopener" className="font-semibold text-primary-emphasis hover:underline">
                              {s.title}
                            </a>
                            {' — '}
                            {s.publisher}
                            {s.published && <>, {s.published}</>}
                          </span>
                        </li>
                      ))}
                  </ol>
                </div>
              )}
              </SourcesDisclosure>
              <p className="text-sm leading-6 text-forest-900/75">
                Schedules, fares and airline rules change. Confirm with the airline before you travel.
              </p>
            </Shell>
          </div>
        </div>
      </div>
    </div>
    </FarePriceProvider>
  );
}

/* ================================================================== *
 * Pieces
 * ================================================================== */

/** Short nav labels for guide sections whose headings are full questions. */
const NAV_LABELS: Record<string, string> = { 'route-history': 'Route history' };

function navLabel(id: string, heading: string): string {
  if (NAV_LABELS[id]) return NAV_LABELS[id];
  return heading.length > 42 ? `${heading.slice(0, 40).replace(/\s+\S*$/, '')}…` : heading;
}

function highlightDates(airlines: RouteV2Airline[]): string | null {
  const dates = airlines
    .flatMap((a) => a.highlights.flatMap((h) => h.values.map((v) => v.verifiedAt)))
    .sort();
  if (!dates.length) return 'None checked yet';
  const first = formatDay(dates[0]);
  const last = formatDay(dates[dates.length - 1]);
  return first === last ? first : `${first} – ${last}`;
}

function AirportEnd({ airport, role }: { airport: RouteV2Airport; role: 'From' | 'To' }) {
  return (
    <Link
      href={airport.href}
      className="group flex min-w-0 items-center gap-4 rounded-[0.3rem] border border-forest-900/10 bg-[#fbfcff] p-4 transition hover:border-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
    >
      <span className="flex h-14 w-14 flex-none items-center justify-center rounded-[0.3rem] bg-forest-950 font-mono text-lg font-bold tracking-wider text-white">
        <span className="sr-only">IATA code </span>
        {airport.iata}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-forest-900/70">{role}</span>
        <span className="block text-lg font-semibold leading-snug text-forest-950 group-hover:text-primary-emphasis">
          {airport.city || airport.name}
        </span>
        <span className="block text-sm text-forest-900/75">
          {airport.name}
          {airport.country ? `, ${airport.country}` : ''}
        </span>
      </span>
    </Link>
  );
}

function AirportCard({ airport, role }: { airport: RouteV2Airport; role: string }) {
  const f = airport.facts;
  const factRows: { label: string; value: ReactNode }[] = f
    ? [
        { label: 'Size class', value: f.typeLabel },
        {
          label: 'Runways',
          value: f.runwayCount
            ? `${f.runwayCount}${f.longestRunway ? `${f.runwayCount === 1 ? ': ' : ', longest '}${f.longestRunway.metres.toLocaleString('en-US')} m${f.longestRunway.ident ? ` (${f.longestRunway.ident})` : ''}` : ''}`
            : null,
        },
        { label: f.opened?.official === false ? 'Inception' : 'Opened', value: f.opened?.text ?? null },
        { label: 'Operator', value: f.operators.length ? f.operators.join(', ') : null },
        {
          label: 'Passengers',
          value: f.passengers ? (
            <>
              {f.passengers.text} <span className="font-normal text-forest-900/75">in {f.passengers.year}</span>
            </>
          ) : null,
        },
      ].filter((r) => r.value)
    : [];
  const wdFacts = !!f && !!(f.opened || f.operators.length || f.passengers);
  const oaFacts = !!f && !!(f.typeLabel || f.runwayCount);
  const rows: { label: string; value: ReactNode }[] = [
    { label: 'Codes', value: airport.icao ? `${airport.iata} · ${airport.icao} (IATA · ICAO)` : `${airport.iata} (IATA)` },
    { label: 'Serves', value: [...new Set([airport.city, airport.country].filter(Boolean))].join(', ') || null },
    { label: 'Time zone', value: airport.zone ? `${airport.zone.zone} (${airport.zone.label} today)` : null },
    { label: 'Coordinates', value: airport.coordinates },
    {
      label: 'Website',
      value: airport.officialSite ? <ExternalLink href={airport.officialSite}>{host(airport.officialSite)}</ExternalLink> : null,
    },
  ].filter((r) => r.value);
  return (
    <li className="flex flex-col rounded-[0.3rem] border border-forest-900/10 bg-[#fbfcff] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-forest-900/70">{role}</p>
      <h3 className="mt-1 flex flex-wrap items-center gap-2 text-lg leading-snug text-forest-950">
        {airport.name}
        <span className="rounded-[0.3rem] bg-forest-950 px-1.5 py-0.5 font-mono text-xs font-bold tracking-wider text-white">{airport.iata}</span>
      </h3>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
            <dt className="text-forest-900/70">{r.label}</dt>
            <dd className="font-medium text-forest-950 [overflow-wrap:anywhere]">{r.value}</dd>
          </div>
        ))}
      </dl>
      {factRows.length > 0 && f && (
        <div className="mt-3 border-t border-forest-900/10 pt-3" data-testid={`route-v2-airport-facts-${airport.iata.toLowerCase()}`}>
          <dl className="space-y-2 text-sm">
            {factRows.map((r) => (
              <div key={r.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                <dt className="text-forest-900/70">{r.label}</dt>
                <dd className="font-medium text-forest-950 [overflow-wrap:anywhere]">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs leading-5 text-forest-900/70">
            {oaFacts && <>Size class, runways: OurAirports{f.ourairportsRetrieved ? `, ${formatDay(f.ourairportsRetrieved)}` : ''}. </>}
            {wdFacts && (
              <>
                {[f.opened ? (f.opened.official ? 'Opened' : 'Inception') : null, f.operators.length ? 'operator' : null, f.passengers ? 'passengers' : null]
                  .filter(Boolean)
                  .join(', ')
                  .replace(/^./, (c) => c.toUpperCase())}
                : {f.qid ? <ExternalLink href={`https://www.wikidata.org/wiki/${f.qid}`}>Wikidata</ExternalLink> : 'Wikidata'}
                {f.wikidataRetrieved ? `, ${formatDay(f.wikidataRetrieved)}` : ''}
                {f.passengers?.refUrl ? (
                  <>
                    {' '}(passengers citing <ExternalLink href={f.passengers.refUrl}>{host(f.passengers.refUrl)}</ExternalLink>)
                  </>
                ) : null}
                .
              </>
            )}
          </p>
        </div>
      )}
      <div className="mt-auto pt-4">
        <Link href={airport.href} className="text-sm font-semibold text-primary-emphasis underline-offset-2 hover:underline">
          {airport.city || airport.iata} airport guide <span aria-hidden>→</span>
        </Link>
      </div>
    </li>
  );
}

function ClimateSection({ climate, toName, airport }: { climate: RouteClimate; toName: string; airport: RouteV2Airport }) {
  const now = climate.months[climate.current];
  const longMonth = new Date(Date.UTC(2000, climate.current, 1)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  return (
    <Shell
      id="climate"
      title={`Weather in ${toName}: average high, low and rain by month`}
      badge={<Badge tone="data">NASA POWER · modelled · {climate.period}</Badge>}
      source={
        <p className="text-sm text-forest-900/75">
          Averages of <ExternalLink href="https://power.larc.nasa.gov/">NASA POWER</ExternalLink> daily values for {climate.period} at{' '}
          {climate.lat.toFixed(2)}°, {climate.lon.toFixed(2)}° near {airport.iata} (MERRA-2 reanalysis grid, about 50 km cells), worked out by
          Originfacts. Modelled, not weather-station readings or a forecast.
        </p>
      }
    >
      <p className="text-[15px] leading-7 text-forest-900/85" data-testid="route-v2-climate-now">
        In {longMonth}, {toName} averages a daily high of {Math.round(now.hi)}°C and a low of {Math.round(now.lo)}°C
        {now.mm != null ? `, with about ${Math.round(now.mm)} mm of rain over the month` : ''}.
      </p>
      <div className="overflow-hidden rounded-[0.3rem] border border-forest-900/10">
        <table className="w-full text-left text-sm" data-testid="route-v2-climate">
          <caption className="sr-only">
            Average daily high and low temperature and average monthly rain near {airport.iata}, {climate.period}
          </caption>
          <thead className="bg-forest-50/60 text-xs uppercase tracking-wider text-forest-900/75">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Month</th>
              <th scope="col" className="px-3 py-2 font-semibold">High</th>
              <th scope="col" className="px-3 py-2 font-semibold">Low</th>
              <th scope="col" className="px-3 py-2 font-semibold">Rain</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-900/10">
            {climate.months.map((m, i) => (
              <tr key={m.month} className={i === climate.current ? 'bg-sky-50' : undefined}>
                <th scope="row" className="px-3 py-1.5 font-medium text-forest-950">
                  {m.month}
                  {i === climate.current && <span className="ml-2 text-xs font-normal text-sky-900">this month</span>}
                </th>
                <td className="px-3 py-1.5 font-semibold tabular-nums text-forest-950">{Math.round(m.hi)}°C</td>
                <td className="px-3 py-1.5 tabular-nums text-forest-900/85">{Math.round(m.lo)}°C</td>
                <td className="px-3 py-1.5 tabular-nums text-forest-900/85">{m.mm == null ? '—' : `${Math.round(m.mm)} mm`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm leading-6 text-forest-900/75">
        <Link href={airport.href} className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
          {airport.city || airport.iata} airport guide <span aria-hidden>→</span>
        </Link>
      </p>
    </Shell>
  );
}

function AirlineCard({ airline: a }: { airline: RouteV2Airline }) {
  const checked = a.highlights.filter((h) => h.values.length > 0);
  return (
    <li className="flex flex-col rounded-[0.3rem] border border-forest-900/10 bg-[#fbfcff] p-4" data-testid={`route-v2-airline-${a.slug}`}>
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-24 flex-none items-center justify-center rounded-[0.3rem] bg-white">
          <LogoMark airline={a} size="lg" />
        </span>
        <span className="min-w-0">
          <Link href={`/airlines/${a.slug}`} className="block text-lg font-semibold leading-snug text-forest-950 hover:text-primary-emphasis">
            {a.name}
          </Link>
          {a.iataCode && <span className="mt-0.5 block font-mono text-xs text-forest-900/70">{a.iataCode}</span>}
        </span>
      </div>

      <dl className="mt-4 divide-y divide-forest-900/10 rounded-[0.3rem] border border-forest-900/10 bg-white">
        {a.highlights.map((h) => (
          <div key={h.id} className="px-3 py-2.5">
            <dt className="text-xs font-semibold uppercase tracking-wider text-forest-900/70">{h.title}</dt>
            {h.values.length > 0 ? (
              h.values.map((v) => (
                <dd key={`${v.qualifier}${v.value}`} className="mt-1">
                  <span className="block text-[15px] font-semibold leading-6 text-forest-950">
                    {v.qualifier && <span className="font-normal text-forest-900/75">{v.qualifier}: </span>}
                    {v.value}
                  </span>
                  <span className="mt-0.5 inline-flex flex-wrap items-center gap-1 text-xs text-emerald-800">
                    <CheckIcon />
                    <ExternalLink href={v.sourceUrl} className="text-emerald-800">
                      {host(v.sourceUrl)}
                    </ExternalLink>
                    <span>· checked {formatDay(v.verifiedAt)}</span>
                  </span>
                </dd>
              ))
            ) : (
              <dd className="mt-1 inline-flex items-center gap-1.5 text-sm text-forest-900/75">
                <span aria-hidden className="h-2 w-2 rounded-full border border-slate-500" />
                Not yet verified
              </dd>
            )}
          </div>
        ))}
      </dl>

      <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/airlines/${a.slug}`} className="text-sm font-semibold text-primary-emphasis underline-offset-2 hover:underline">
          {checked.length ? `${a.name} guide` : `What we know about ${a.name}`} <span aria-hidden>→</span>
        </Link>
        <a
          href={a.searchUrl}
          target="_blank"
          rel="sponsored nofollow noopener"
          className="inline-flex items-center justify-center rounded-[0.3rem] border border-forest-900/20 bg-white px-3 py-2 text-xs font-semibold text-forest-950 transition hover:border-primary-emphasis hover:text-primary-emphasis"
        >
          Search {a.name} fares <span aria-hidden className="ml-1">→</span>
        </a>
      </div>
    </li>
  );
}

function LogoMark({ airline: a, size }: { airline: RouteV2Airline; size: 'sm' | 'lg' }) {
  if (a.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={a.logoUrl}
        alt=""
        loading="lazy"
        className={size === 'sm' ? 'h-6 w-12 object-contain' : 'max-h-12 max-w-full object-contain'}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center rounded-full bg-forest-900/5 font-mono font-bold text-forest-900/70 ${size === 'sm' ? 'h-6 w-12 text-[10px]' : 'h-10 w-10 text-xs'}`}
    >
      {(a.iataCode || a.name).slice(0, 3).toUpperCase()}
    </span>
  );
}

function RouteGroup({ title, routes, testid }: { title: string; routes: RouteV2Link[]; testid?: string }) {
  return (
    <div data-testid={testid}>
      <h3 className="text-base font-semibold text-forest-950">{title}</h3>
      <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {routes.map((r) => (
          <li key={r.slug}>
            <Link
              href={`/flight-routes/${r.slug}`}
              className="group flex h-full items-center justify-between gap-4 rounded-[0.3rem] border border-forest-900/10 bg-[#fbfcff] px-4 py-3.5 transition hover:border-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
            >
              <span className="min-w-0">
                <span className="block font-mono text-xs font-semibold tracking-wider text-forest-900/70">
                  {r.originIata} → {r.destinationIata}
                </span>
                <span className="mt-1 block font-semibold text-forest-950 group-hover:text-primary-emphasis">
                  {r.fromName} to {r.toName}
                </span>
              </span>
              {(r.distanceKm || r.durationMinutes) && (
                <span className="flex-none text-right text-sm text-forest-900/75">
                  {r.distanceKm ? <span className="block font-semibold text-forest-950">{r.distanceKm.toLocaleString('en-US')} km</span> : null}
                  {r.durationMinutes ? <span className="block">~{formatMinutes(r.durationMinutes)} est.</span> : null}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CitedParagraphs({ paragraphs, order }: { paragraphs: GuideParagraph[]; order: Map<string, number> }) {
  return (
    <div className="space-y-3 text-[15px] leading-7 text-forest-900/85">
      {paragraphs.map((para, i) => (
        <p key={i}>
          {para.text}
          <Cite ids={para.sources} order={order} />
        </p>
      ))}
    </div>
  );
}

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
      data-testid={`route-v2-section-${id}`}
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

function Big({ children }: { children: ReactNode }) {
  return <p className="text-2xl font-bold leading-tight text-forest-950">{children}</p>;
}

function Sub({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-forest-900/80">{children}</p>;
}

function Gap({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-sm text-forest-900/75">
      <span aria-hidden className="h-2 w-2 rounded-full border border-slate-500" />
      {children}
    </p>
  );
}

function SourceRow({ what, date, children }: { what: string; date: string | null; children: ReactNode }) {
  return (
    <li className="grid grid-cols-1 gap-1 px-4 py-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)_10rem] sm:gap-4">
      <span className="font-medium text-forest-950">{what}</span>
      <span className="min-w-0 text-forest-900/85 [overflow-wrap:anywhere]">{children}</span>
      <span className="text-forest-900/75">{date ?? '—'}</span>
    </li>
  );
}

type BadgeTone = 'sourced' | 'data' | 'live' | 'partner' | 'pending';

function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  const cls: Record<BadgeTone, string> = {
    sourced: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    data: 'border-forest-200 bg-forest-50 text-forest-800',
    live: 'border-sky-200 bg-sky-50 text-sky-900',
    partner: 'border-sky-200 bg-white text-sky-900',
    pending: 'border-slate-300 bg-white text-slate-700',
  };
  const dot: Record<BadgeTone, string> = {
    sourced: 'bg-emerald-600',
    data: 'bg-primary-emphasis',
    live: 'bg-sky-500',
    partner: 'bg-sky-500',
    pending: 'border border-slate-500',
  };
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cls[tone]}`}>
      <span aria-hidden className={`h-2 w-2 flex-none rounded-full ${dot[tone]}`} />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

function ExternalLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`text-primary-emphasis underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-emphasis ${className}`}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m3.5 8.5 3 3 6-7" />
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
