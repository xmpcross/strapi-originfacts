import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getRoute, mediaUrl, type StrapiAirline } from '@/lib/strapi';
import { flightSearchUrl } from '@/lib/affiliate';
import { absoluteUrl } from '@/lib/jsonld';
import PriceCalendar from '@/components/PriceCalendar';
import ScheduleWidget from '@/components/ScheduleWidget';
import TpConsentGate from '@/components/TpConsentGate';
import { tpwlPartnerUrl, tpwlSegment } from '@/lib/tpwl-link';
import ExpandableDescription from '@/components/ExpandableDescription';
import { airportPath } from '@/lib/airport-slugs';
import { buildMetaDescription } from '@/lib/seo';
import { operableCarriers } from '@/lib/route-carriers';
import { SITE_URL, DEFAULT_OG_IMAGE, entityWebPageJsonLd, faqJsonLd, type Faq } from '@/lib/entity-seo';
import { resolveAuthor } from '@/lib/authors';
import { JsonLd, FaqSection } from '@/components/SeoBlocks';
import TableOfContents from '@/components/TableOfContents';
import type { TocItem } from '@/lib/toc';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import type { Metadata } from 'next';
import { getRouteGuide, citationOrder } from '@/lib/route-guide';
import { getRouteFares } from '@/lib/route-fares';
import { formatUtcOffset, utcOffsetMinutes } from '@/lib/route-geo';
import {
  airlineName,
  Cite,
  CitedParagraph,
  formatFetched,
  formatFlightRange,
  GuideSectionBlock,
  MonthFaresTable,
  SeenFlightsTable,
  SourcesList,
} from '@/components/route-guide/RouteGuideBlocks';

export const revalidate = 60;

// Route pages are statically generated on demand (ISR, revalidate above).
// Static generation renders generateMetadata into the <head> of the HTML
// response; dynamic rendering would stream the tags into the body for
// JS-capable user agents (Next 15 streaming metadata), leaving curl and
// HTML-only crawlers without a populated head.
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

// "1h 35m" from block minutes; whole hours drop the minute part.
function formatBlockTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await getRoute(slug);
  if (!r || !r.origin || !r.destination) {
    return { title: 'Route not found', robots: { index: false, follow: false } };
  }
  const from = r.origin.city || r.origin.name;
  const to = r.destination.city || r.destination.name;
  const title = `Flights from ${from} to ${to} (${r.origin.iata} → ${r.destination.iata})`;
  const url = `${SITE_URL}/flight-routes/${r.slug}`;

  // Description built only from fields present on the record — distance, block
  // time, tracked-carrier count. Absent fields simply drop their clause; a
  // route with none of them falls back to the editorial about excerpt or a
  // claim-free generic line.
  const facts: string[] = [];
  if (typeof r.distanceKm === 'number' && r.distanceKm > 0) {
    facts.push(`${Math.round(r.distanceKm).toLocaleString('en-US')} km`);
  }
  if (typeof r.durationMinutes === 'number' && r.durationMinutes > 0) {
    facts.push(`around ${formatBlockTime(r.durationMinutes)} block time`);
  }
  const carrierCount = operableCarriers(r).length;
  if (carrierCount > 0) {
    facts.push(`${carrierCount} tracked airline${carrierCount === 1 ? '' : 's'}`);
  }
  const guide = getRouteGuide(slug);
  const description = guide
    ? buildMetaDescription([guide.intro.text])
    : facts.length
    ? `Flights from ${from} (${r.origin.iata}) to ${to} (${r.destination.iata}): ${facts.join(', ')}. Compare live fares and see where to book.`
    : buildMetaDescription([
        r.about,
        `Flights from ${from} (${r.origin.iata}) to ${to} (${r.destination.iata}): carriers, schedules and where to book.`,
      ]);

  const hero = mediaUrl(r.destination.heroImage ?? null);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: 'article',
      url,
      siteName: 'Originfacts',
      images: hero
        ? [{ url: absoluteUrl(hero), width: 1024, height: 576, alt: `Flights from ${from} to ${to}` }]
        : [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Originfacts' }],
    },
    twitter: {
      card: 'summary_large_image',
      images: [hero ? absoluteUrl(hero) : DEFAULT_OG_IMAGE],
    },
  };
}

export default async function RoutePage({ params }: Props) {
  const { slug } = await params;
  const route = await getRoute(slug);
  if (!route || !route.origin || !route.destination) notFound();

  const { origin, destination } = route;
  const carriers = operableCarriers(route);
  const guideForMeta = getRouteGuide(slug);

  // Sourced template: routes with a content/route-guides/<slug>.json file.
  // Live fares (lib/route-fares.ts) are fetched for every route; the fare
  // sections render wherever Travelpayouts has recent nonstop fares.
  const guide = getRouteGuide(slug);
  const fares = await getRouteFares(origin.iata, destination.iata);
  const fareDuration = fares?.duration ? formatFlightRange(fares.duration.min, fares.duration.max) : null;
  const order = guide ? citationOrder(guide) : new Map<string, number>();
  const fromName = origin.city || origin.name;
  const toName = destination.city || destination.name;
  // Nonstop operators: those a source confirms; failing that, those in the fare data.
  const nonstopIatas = guide
    ? guide.operating_airlines.length > 0
      ? guide.operating_airlines.map((a) => a.iata)
      : fares?.airlines ?? []
    : [];
  const shownCarriers = guide ? carriers.filter((c) => c.iataCode && nonstopIatas.includes(c.iataCode)) : carriers;
  const offsetFrom = utcOffsetMinutes(origin.timezone);
  const offsetTo = utcOffsetMinutes(destination.timezone);
  const timeDiff = offsetFrom !== null && offsetTo !== null ? offsetTo - offsetFrom : null;
  const fetchedLabel = fares ? formatFetched(fares.fetchedAt) : '';
  const carrierNames: Record<string, string> = Object.fromEntries(
    (route.carriers ?? []).filter((c) => c.iataCode).map((c) => [c.iataCode as string, c.name]),
  );
  const cheapestMonth = fares && fares.months.length > 0 ? fares.months.reduce((a, b) => (b.price < a.price ? b : a)) : null;
  const title = `Flights from ${origin.city || origin.name} to ${destination.city || destination.name} (${origin.iata} → ${destination.iata})`;
  const description = guideForMeta?.intro.text.slice(0, 200) || route.about?.slice(0, 200) || `Direct and connecting flights from ${origin.city || origin.name} (${origin.iata}) to ${destination.city || destination.name} (${destination.iata}). Carrier comparison, duration, and cheap fare calendar.`;
  const url = `${SITE_URL}/flight-routes/${slug}`;

  const articleSchema = entityWebPageJsonLd({
    name: title,
    description,
    url,
    author: await resolveAuthor(),
    // The route's two airports, by the @id their own pages declare.
    about: [origin, destination].map((a) => ({ '@id': `${SITE_URL}${airportPath(a)}#airport`, '@type': 'Airport', name: a.name, iataCode: a.iata })),
  });

  const routeFaqs: Faq[] = [
    {
      q: `How do I find cheap flights from ${origin.city || origin.name} to ${destination.city || destination.name}?`,
      a: cheapestMonth
        ? `In fares found in recent Aviasales searches (fetched ${fetchedLabel}), the lowest one-way nonstop fare was US$${cheapestMonth.price} in ${new Date(`${cheapestMonth.month}-01T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}. The table of lowest fares by month and the live fare calendar on this page show current prices for other dates.`
        : `Use our live fare calendar above to compare prices across different departure dates. Being flexible by 24–48 hours and comparing one-stop versus nonstop flights often yields the lowest rates.`,
    },
    {
      q: `Which airlines fly from ${origin.city || origin.name} to ${destination.city || destination.name}?`,
      a: carriers.length > 0
        ? `Carriers operating or tracked on this route include ${carriers.map((c) => c.name).join(', ')}.`
        : `Carriers serve this route via direct and one-stop connections between ${origin.iata} and ${destination.iata}.`,
    },
    {
      q: `How long is the flight from ${origin.city || origin.name} (${origin.iata}) to ${destination.city || destination.name} (${destination.iata})?`,
      a: fareDuration
        ? `Nonstop flights in recent fare data are listed at ${fareDuration} gate to gate (Aviasales search data, fetched ${fetchedLabel}). Connecting flights take longer, depending on the stopover.`
        : route.durationMinutes
        ? `Nonstop flight time is approximately ${formatDuration(route.durationMinutes)}. Connecting flights will vary based on layover locations.`
        : `Flight durations vary based on carrier routing, winds, and layovers between ${origin.iata} and ${destination.iata}.`,
    },
    {
      q: `What is the distance between ${origin.city || origin.name} and ${destination.city || destination.name}?`,
      a: route.distanceKm
        ? `The flight distance from ${origin.name} (${origin.iata}) to ${destination.name} (${destination.iata}) is roughly ${route.distanceKm.toLocaleString()} km.`
        : `The route connects ${origin.name} (${origin.iata}) and ${destination.name} (${destination.iata}).`,
    },
  ];

  const guideFaqs: Faq[] = guide
    ? [
        ...(fares?.duration
          ? [{
              q: `How long is the flight from ${fromName} (${origin.iata}) to ${toName} (${destination.iata})?`,
              a: `Nonstop flights in recent fare data are listed at ${fareDuration} gate to gate (Aviasales search data, fetched ${fetchedLabel}).`,
            }]
          : []),
        ...(timeDiff !== null && offsetFrom !== null && offsetTo !== null
          ? [{
              q: `Is there a time difference between ${fromName} and ${toName}?`,
              a: timeDiff === 0
                ? `No. ${origin.country || fromName} and ${destination.country || toName} are both on ${formatUtcOffset(offsetFrom)} today (time zones ${origin.timezone} and ${destination.timezone}), so local time is the same at both ends.`
                : `${toName} is ${Math.abs(timeDiff) / 60} hour${Math.abs(timeDiff) === 60 ? '' : 's'} ${timeDiff > 0 ? 'ahead of' : 'behind'} ${fromName} today (${formatUtcOffset(offsetTo)} vs ${formatUtcOffset(offsetFrom)}).`,
            }]
          : []),
        ...(cheapestMonth
          ? [{
              q: `What is the cheapest month to fly from ${fromName} to ${toName}?`,
              a: `In fares found in recent Aviasales searches (fetched ${fetchedLabel}), the lowest one-way nonstop fare was US$${cheapestMonth.price} in ${new Date(`${cheapestMonth.month}-01T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}, on ${airlineName(cheapestMonth.airline, carrierNames)} ${cheapestMonth.airline} ${cheapestMonth.flightNumber}. Cached search fares change often; check the live price before booking.`,
            }]
          : []),
        ...guide.faqs.map((f) => ({ q: f.q, a: f.a })),
        ...(route.distanceKm
          ? [{
              q: `How far is ${fromName} from ${toName} by air?`,
              a: `About ${Math.round(route.distanceKm).toLocaleString('en-US')} km, the great-circle distance between ${origin.name} and ${destination.name}.`,
            }]
          : []),
      ]
    : [];
  const faqs = guide ? guideFaqs : routeFaqs;

  // TravelPayouts white-label deep link with dates (depart +30d, return +37d, 1 pax).
  const searchUrl = flightSearchUrl({
    origin: origin.iata,
    destination: destination.iata,
    subId: `route:${slug}`,
  });

  return (
    <article data-testid={`route-page-${slug}`}>
      <JsonLd data={articleSchema} />
      <JsonLd data={faqJsonLd(faqs)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Flight Routes', url: '/flight-routes' },
          { name: `${origin.iata} → ${destination.iata}`, url: `/flight-routes/${slug}` },
        ])}
      />
      {/* Hero — origin → destination */}
      <header className="mx-auto mt-10 max-w-7xl px-6">
        <p className="text-xs uppercase tracking-wider text-forest-800/70">
          Route · {origin.iata} → {destination.iata}
        </p>
        <h1 className="editorial-h mt-4 text-[1.875rem] font-bold leading-tight text-forest-900">
          Flights from {origin.city || origin.name} to {destination.city || destination.name}
        </h1>

        {guide ? (
          <CitedParagraph p={guide.intro} order={order} className="mt-4 max-w-4xl text-base leading-relaxed text-forest-900/80" />
        ) : (
        <p className="mt-4 text-base leading-relaxed text-forest-900/80 max-w-4xl">
          {route.about && route.about.split(/\s+/).length >= 40
            ? route.about
            : `Booking flights from ${origin.city || origin.name} (${origin.iata}) to ${destination.city || destination.name} (${destination.iata}) requires comparing direct carrier options, block flight durations, and connection layovers to secure optimal airfares. Our route guide synthesizes real-time airline schedules, seat inclusions, and historical price drops across operating carriers, empowering travelers to select efficient travel dates and book flights confidently.`}
        </p>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-[1fr,auto,1fr] sm:items-center">
          <AirportCard airport={origin} align="left" />
          <div className="flex flex-col items-center justify-center gap-2 text-forest-900/60">
            <svg width="40" height="24" viewBox="0 0 40 24" fill="none" className="text-forest-600 sm:w-16" aria-hidden>
              <path d="M2 12 L38 12 M30 4 L38 12 L30 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {route.distanceKm && (
              <span className="text-xs font-bold tracking-wider text-forest-900/70">
                {route.distanceKm.toLocaleString()} km
              </span>
            )}
          </div>
          <AirportCard airport={destination} align="right" />
        </div>

        {/* Primary CTA — white-label deep link */}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href={searchUrl}
            target="_blank"
            rel="sponsored nofollow noopener"
            className="inline-flex items-center gap-2 rounded-[0.3rem] bg-forest-900 px-6 py-3 text-sm font-bold uppercase tracking-wider text-sand-100 transition hover:bg-forest-800"
            data-testid="route-search-cta"
          >
            Find flights {origin.iata} → {destination.iata} →
          </a>
          <p className="text-xs text-forest-900/50">
            We may earn a commission when you book — at no cost to you.
          </p>
        </div>
      </header>

      {/* Quick facts strip */}
      <section className="mx-auto mt-12 max-w-7xl px-6">
        {guide ? (
          <div className="grid gap-6 rounded-[0.3rem] border border-forest-900/10 bg-forest-900/[0.02] p-6 sm:grid-cols-4" data-testid="route-guide-stats">
            <Stat label="Distance" value={route.distanceKm ? `${route.distanceKm.toLocaleString()} km` : '—'} />
            <Stat
              label="Flight time (fare data)"
              value={fareDuration ?? (route.durationMinutes ? formatDuration(route.durationMinutes) : '—')}
            />
            <Stat label="Time difference" value={timeDiff === null ? '—' : timeDiff === 0 ? 'None' : `${timeDiff > 0 ? '+' : '−'}${Math.abs(timeDiff) / 60}h`} />
            <Stat label="Nonstop airlines" value={nonstopIatas.length.toString()} />
          </div>
        ) : (
        <div className="grid gap-6 rounded-[0.3rem] border border-forest-900/10 bg-forest-900/[0.02] p-6 sm:grid-cols-4">
          <Stat label="Distance" value={route.distanceKm ? `${route.distanceKm.toLocaleString()} km` : '—'} />
          {fareDuration ? (
            <Stat label="Flight time (fare data)" value={fareDuration} />
          ) : (
            <Stat label="Flight time" value={route.durationMinutes ? formatDuration(route.durationMinutes) : '—'} />
          )}
          <Stat label="Carriers tracked" value={carriers.length.toString()} />
          <Stat label="Route" value={`${origin.iata} → ${destination.iata}`} mono />
        </div>
        )}
      </section>

      {/* Table of Contents */}
      <div className="mx-auto max-w-7xl px-6">
        <TableOfContents
          items={guide ? [
            ...(fares && fares.flights.length > 0 ? [{ id: 'nonstop-flights', text: 'Nonstop Flights on This Route' }] : []),
            ...(fares && fares.months.length > 0 ? [{ id: 'fares-by-month', text: 'Lowest Fares by Month' }] : []),
            { id: 'cheapest-dates', text: 'Live Fare Calendar' },
            { id: 'airlines', text: `Nonstop Airlines (${shownCarriers.length})` },
            { id: 'schedule', text: 'Flight Schedule & Timetable' },
            ...guide.sections.map((sec) => ({ id: sec.id, text: sec.heading })),
            { id: 'airport-guides', text: `Airport Guides (${origin.iata} & ${destination.iata})` },
            { id: 'faq', text: 'Frequently Asked Questions' },
            { id: 'sources', text: 'Sources' },
          ] : [
            ...(fares && fares.flights.length > 0 ? [{ id: 'nonstop-flights', text: 'Nonstop Flights on This Route' }] : []),
            ...(fares && fares.months.length > 0 ? [{ id: 'fares-by-month', text: 'Lowest Fares by Month' }] : []),
            { id: 'cheapest-dates', text: `Cheapest Fares & Live Calendar` },
            { id: 'airlines', text: `Operating Airlines (${carriers.length})` },
            { id: 'schedule', text: `Flight Schedule & Timetable` },
            { id: 'airport-guides', text: `Airport Guides (${origin.iata} & ${destination.iata})` },
            { id: 'faq', text: `Frequently Asked Questions` },
          ]}
        />
      </div>

      {fares && fares.flights.length > 0 && (
        <section id="nonstop-flights" className="mx-auto mt-14 max-w-7xl scroll-mt-28 px-6">
          <h2 className="editorial-h border-b border-forest-900/10 pb-3 text-[1.5rem] font-bold text-forest-900">
            Which nonstop flights go from {fromName} to {toName}?
          </h2>
          <p className="mb-5 mt-4 max-w-4xl text-base leading-relaxed text-forest-900/85">
            {fares.flights.length} nonstop flight{fares.flights.length === 1 ? '' : 's'} from {origin.iata} to {destination.iata} appeared in recent fare
            searches, sold under {new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(fares.airlines.map((a) => airlineName(a, carrierNames)))} flight numbers
            {fareDuration ? `, with flight times of ${fareDuration}` : ''}.
          </p>
          <SeenFlightsTable flights={fares.flights} fares={fares} originIata={origin.iata} destinationIata={destination.iata} names={carrierNames} />
        </section>
      )}

      {fares && fares.months.length > 0 && (
        <section id="fares-by-month" className="mx-auto mt-14 max-w-7xl scroll-mt-28 px-6">
          <h2 className="editorial-h border-b border-forest-900/10 pb-3 text-[1.5rem] font-bold text-forest-900">
            What are the lowest {origin.iata}–{destination.iata} fares by month?
          </h2>
          <div className="mt-5">
            <MonthFaresTable months={fares.months} fares={fares} names={carrierNames} />
          </div>
        </section>
      )}

      {/* Live price calendar — TravelPayouts widget */}
      <section id="cheapest-dates" className="mx-auto mt-14 max-w-7xl scroll-mt-28 px-6" data-testid="route-price-calendar">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 id="cheapest-dates-heading" className="editorial-h text-[1.5rem] font-bold text-forest-900">
            When are the cheapest dates to fly from {origin.iata} to {destination.iata}?
          </h2>
          <span className="text-xs font-light text-forest-900/50">
            Live prices · powered by Aviasales
          </span>
        </header>
        <ExpandableDescription
          wordLimit={20}
          className="mb-5 text-base"
          text={`The calendar below pulls live fares from our search partner for ${origin.city || origin.name} (${origin.iata}) → ${destination.city || destination.name} (${destination.iata}). Use the year view to spot the cheapest week to fly, the day-of-week patterns most travellers miss, and any shoulder-season dips worth shifting your trip around. Prices refresh every few hours, so what you see is what your booking page should look like a moment later — click any date to jump straight to the fare on Aviasales.`}
        />
        <div className="rounded-[0.3rem] border border-forest-900/10 bg-paper p-2">
          {/* Min-heights = the widget's rendered height per width (Playwright, Oct 2026). */}
          <TpConsentGate
            tool="price calendar"
            partnerHref={tpwlPartnerUrl(tpwlSegment(origin.iata, destination.iata))}
            className="min-h-[400px] min-[440px]:min-h-[450px] sm:min-h-[560px] xl:min-h-[487px]"
          >
            <PriceCalendar origin={origin.iata} destination={destination.iata} />
          </TpConsentGate>
        </div>
      </section>

      {/* Carriers */}
      {guide && shownCarriers.length > 0 && (
        <section id="airlines" className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6" data-testid="route-guide-airlines">
          <h2 id="airlines-heading" className="editorial-h border-b border-forest-900/10 pb-3 text-[1.5rem] font-bold text-forest-900">
            Which airlines fly nonstop from {origin.iata} to {destination.iata}?
          </h2>
          <p className="mt-4 max-w-4xl text-base leading-relaxed text-forest-900/85">
            {guide.operating_airlines.length > 0 ? (
              <>
                {shownCarriers.map((c) => c.name).join(' and ')} {shownCarriers.length === 1 ? 'flies' : 'fly'} {fromName}–{toName} nonstop with
                their own aircraft.
                <Cite ids={[...new Set(guide.operating_airlines.flatMap((a) => a.sources))]} order={order} />
              </>
            ) : (
              <>
                Nonstop {fromName}–{toName} flights in recent fare data are sold under {shownCarriers.map((c) => c.name).join(' and ')} flight
                numbers.
              </>
            )}
            {' '}Other airlines can sell seats on these flights under their own flight numbers (codeshares); those are not listed here.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shownCarriers.map((c) => (
              <CarrierCard key={c.id} carrier={c} route={slug} origin={origin.iata} destination={destination.iata} />
            ))}
          </div>
        </section>
      )}
      {!guide && carriers.length > 0 && (
        <section id="airlines" className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6">
          <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
            <h2 id="airlines-heading" className="editorial-h text-[1.5rem] font-bold text-forest-900">
              Which airlines operate flights from {origin.iata} to {destination.iata}?
            </h2>
            <span className="text-sm font-light text-forest-900/50">
              {carriers.length} carrier{carriers.length === 1 ? '' : 's'}
            </span>
          </header>
          <ExpandableDescription
            wordLimit={25}
            className="mt-4 text-base"
            text={`The ${carriers.length} carrier${carriers.length === 1 ? '' : 's'} we currently track on the ${origin.city || origin.name}–${destination.city || destination.name} route, from full-service flag carriers to low-cost competitors. Tap any airline for its full profile, baggage rules, fleet context, and a live fare search pre-filtered to that carrier — useful if you're loyal to a frequent-flyer programme, want to compare onboard product on the same dates, or are weighing a cheaper one-stop against a pricier nonstop.`}
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {carriers.map((c) => (
              <CarrierCard key={c.id} carrier={c} route={slug} origin={origin.iata} destination={destination.iata} />
            ))}
          </div>

          {/*
            The direct-vs-connecting table was removed here. Two of its five
            columns were fabricated: "Cabin Bag Allowance" was hardcoded to
            "1 Carry-on (7kg) + Personal Item" for every carrier on every route,
            and the connecting duration was invented as durationMinutes + 150.
            Both were presented as route-specific figures.

            Restore it only from per-carrier allowances and real connection
            timings, not from literals.
          */}
        </section>
      )}
      {(guide ? shownCarriers.length === 0 : carriers.length === 0) && (
        <section id="airlines" className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6" data-testid="route-no-carriers">
          <h2 id="airlines-heading" className="editorial-h border-b border-forest-900/10 pb-3 text-[1.5rem] font-bold text-forest-900">
            Which airlines operate flights from {origin.iata} to {destination.iata}?
          </h2>
          <p className="mt-4 text-base text-forest-900/70">
            No airlines in our record yet.
          </p>
        </section>
      )}

      {/* Live schedule — TravelPayouts widget */}
      <section id="schedule" className="mx-auto mt-14 max-w-7xl scroll-mt-28 px-6" data-testid="route-schedule">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 id="schedule-heading" className="editorial-h text-[1.5rem] font-bold text-forest-900">
            What flight schedules connect {origin.city || origin.name} to {destination.city || destination.name}?
          </h2>
          <span className="text-xs font-light text-forest-900/50">
            Live schedule · powered by Aviasales
          </span>
        </header>
        <ExpandableDescription
          wordLimit={25}
          className="mb-5 text-base"
          text={`Below is the published weekly schedule for nonstop and one-stop services from ${origin.city || origin.name} to ${destination.city || destination.name} — the actual flight numbers, departure and arrival times your booking page will pull from. Use it to plan around departure preferences (early morning vs late evening), see which carriers fly on which weekdays, or pick a connection that lets you sleep in your own bed before a long-haul leg. Click any row to load it directly in the search.`}
        />
        <div className="rounded-[0.3rem] border border-forest-900/10 bg-white p-2">
          <TpConsentGate
            tool="flight schedule"
            partnerHref={tpwlPartnerUrl(tpwlSegment(origin.iata, destination.iata))}
            className="min-h-[1079px] sm:min-h-[670px] min-[880px]:min-h-[710px]"
          >
            <ScheduleWidget origin={origin.iata} destination={destination.iata} />
          </TpConsentGate>
        </div>
      </section>

      {guide && guide.sections.map((sec) => <GuideSectionBlock key={sec.id} section={sec} order={order} />)}

      {/* Airport cross-links */}
      <section id="airport-guides" className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6 pb-20">
        <h2 id="airport-guides-heading" className="editorial-h text-[1.5rem] font-bold text-forest-900">Which airport guides cover {origin.iata} and {destination.iata}?</h2>
        <ExpandableDescription
          wordLimit={25}
          className="mt-4 text-base"
          text={`Quick links to the airport profiles at both ends of the route. Each one lists the airport's codes, location and time zone, any other routes and airlines Originfacts tracks from ${origin.iata} or ${destination.iata}, current weather and nearby airports, and where to check terminal and transport details.`}
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <AirportLink airport={origin} />
          <AirportLink airport={destination} />
        </div>
      </section>

      <FaqSection faqs={faqs} title={`Frequently asked questions about ${origin.city || origin.name} to ${destination.city || destination.name} flights`} />

      {guide && <SourcesList sources={guide.sources} order={order} verifiedAt={guide.verified_at} />}

      <div className="mx-auto max-w-7xl px-6">
      </div>
    </article>
  );
}

function AirportCard({
  airport,
  align,
}: {
  airport: { iata: string; name: string; city?: string; country?: string };
  align: 'left' | 'right';
}) {
  return (
    <div className={'rounded-[0.3rem] border border-forest-900/10 bg-paper p-5 ' + (align === 'right' ? 'sm:text-right' : '')}>
      <div className="text-xs font-bold tracking-wider text-forest-900/60">{airport.iata}</div>
      <div className="mt-1 text-xl font-bold text-forest-900">{airport.city || airport.name}</div>
      <div className="mt-1 text-sm text-forest-900/60">
        {airport.name}
        {airport.country && <span className="block text-xs text-forest-900/50">{airport.country}</span>}
      </div>
    </div>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className={'text-2xl font-bold text-forest-900 lg:text-3xl ' + (mono ? '!text-xl lg:!text-2xl' : '')}>
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-widest text-forest-900/60">{label}</div>
    </div>
  );
}

function CarrierCard({
  carrier,
  origin,
  destination,
  route,
}: {
  carrier: StrapiAirline;
  origin: string;
  destination: string;
  route: string;
}) {
  const logo = mediaUrl(carrier.logo ?? null);
  const carrierSearchUrl = flightSearchUrl({
    origin,
    destination,
    subId: `route:${route}:${carrier.iataCode || carrier.slug}`,
    airline: carrier.iataCode,
  });
  return (
    <div className="rounded-[0.3rem] border border-forest-900/10 bg-paper p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-[0.3rem] bg-forest-900/5">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={carrier.name} className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs font-bold text-forest-900/60">
              {(carrier.iataCode || carrier.name).slice(0, 3).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/airlines/${carrier.slug}`}
            className="block text-base font-bold text-forest-900 hover:text-forest-700"
          >
            {carrier.name}
          </Link>
          {carrier.iataCode && (
            <span className="mt-1 inline-block rounded-[0.3rem] bg-forest-900 px-2 py-0.5 text-[10px] font-bold tracking-wider text-sand-100">
              {carrier.iataCode}
            </span>
          )}
        </div>
      </div>
      <a
        href={carrierSearchUrl}
        target="_blank"
        rel="sponsored nofollow noopener"
        className="mt-4 inline-flex w-full items-center justify-center rounded-[0.3rem] border border-forest-900/20 px-4 py-2 text-xs font-medium uppercase tracking-wider text-forest-900 transition hover:bg-forest-900 hover:text-sand-100"
      >
        Book with {carrier.name} →
      </a>
    </div>
  );
}

function AirportLink({ airport }: { airport: { iata: string; name: string; city?: string } }) {
  return (
    <Link
      href={airportPath(airport)}
      className="group flex items-center justify-between rounded-[0.3rem] border border-forest-900/10 bg-paper p-5 transition hover:border-forest-900/30"
    >
      <div>
        <div className="text-xs font-bold tracking-wider text-forest-900/60">{airport.iata}</div>
        <div className="mt-1 text-base font-bold text-forest-900 group-hover:text-forest-700">
          {airport.city || airport.name}
        </div>
        <div className="mt-1 text-xs text-forest-900/50">Airport guide</div>
      </div>
      <span className="text-2xl text-forest-900/40 transition group-hover:translate-x-1 group-hover:text-forest-600">→</span>
    </Link>
  );
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
