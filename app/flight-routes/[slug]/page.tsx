import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getRoute, mediaUrl, type StrapiAirline } from '@/lib/strapi';
import { flightSearchUrl } from '@/lib/affiliate';
import { SITE_URL, DEFAULT_OG_IMAGE } from '@/lib/entity-seo';
import { absoluteUrl } from '@/lib/jsonld';
import PriceCalendar from '@/components/PriceCalendar';
import ScheduleWidget from '@/components/ScheduleWidget';
import ExpandableDescription from '@/components/ExpandableDescription';
import type { Metadata } from 'next';

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
  const carrierCount = (r.carriers ?? []).length;
  if (carrierCount > 0) {
    facts.push(`${carrierCount} tracked airline${carrierCount === 1 ? '' : 's'}`);
  }
  const description = facts.length
    ? `Flights from ${from} (${r.origin.iata}) to ${to} (${r.destination.iata}): ${facts.join(', ')}. Compare live fares and see where to book.`
    : r.about?.slice(0, 155) ||
      `Flights from ${from} (${r.origin.iata}) to ${to} (${r.destination.iata}): carriers, schedules and where to book.`;

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
  const carriers = route.carriers ?? [];

  // TravelPayouts white-label deep link with dates (depart +30d, return +37d, 1 pax).
  const searchUrl = flightSearchUrl({
    origin: origin.iata,
    destination: destination.iata,
    subId: `route:${slug}`,
  });

  return (
    <article data-testid={`route-page-${slug}`}>
      {/* Hero — origin → destination */}
      <header className="mx-auto mt-10 max-w-7xl px-6">
        <p className="font-urbanist text-xs uppercase tracking-wider text-forest-800/70">
          Route · {origin.iata} → {destination.iata}
        </p>
        <h1 className="editorial-h mt-4 text-[1.875rem] font-bold leading-tight text-forest-900">
          Flights from {origin.city || origin.name} to {destination.city || destination.name}
        </h1>

        {/* About this route — full container width, full content (no toggle) */}
        {route.about && (
          <div className="prose-article !max-w-none mt-6" data-testid="route-about">
            {route.about.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-[1fr,auto,1fr] sm:items-center">
          <AirportCard airport={origin} align="left" />
          <div className="flex flex-col items-center justify-center gap-2 text-forest-900/60">
            <svg width="40" height="24" viewBox="0 0 40 24" fill="none" className="text-forest-600 sm:w-16" aria-hidden>
              <path d="M2 12 L38 12 M30 4 L38 12 L30 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {route.distanceKm && (
              <span className="font-mono text-xs font-bold tracking-wider text-forest-900/70">
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
            className="inline-flex items-center gap-2 rounded-[0.3rem] bg-forest-900 px-6 py-3 font-urbanist text-sm font-bold uppercase tracking-wider text-sand-100 transition hover:bg-forest-800"
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
        <div className="grid gap-6 rounded-[0.3rem] border border-forest-900/10 bg-forest-900/[0.02] p-6 sm:grid-cols-4">
          <Stat label="Distance" value={route.distanceKm ? `${route.distanceKm.toLocaleString()} km` : '—'} />
          <Stat label="Flight time" value={route.durationMinutes ? formatDuration(route.durationMinutes) : '—'} />
          <Stat label="Carriers tracked" value={carriers.length.toString()} />
          <Stat label="Route" value={`${origin.iata} → ${destination.iata}`} mono />
        </div>
      </section>

      {/* Live price calendar — TravelPayouts widget */}
      <section className="mx-auto mt-14 max-w-7xl px-6" data-testid="route-price-calendar">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">
            Cheapest dates to fly
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
          <PriceCalendar origin={origin.iata} destination={destination.iata} />
        </div>
      </section>

      {/* Carriers */}
      {carriers.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-6">
          <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
            <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">
              Airlines on this route
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
        </section>
      )}

      {/* Live schedule — TravelPayouts widget */}
      <section className="mx-auto mt-14 max-w-7xl px-6" data-testid="route-schedule">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">
            Flights from {origin.city || origin.name} to {destination.city || destination.name}
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
          <ScheduleWidget origin={origin.iata} destination={destination.iata} />
        </div>
      </section>

      {/* Airport cross-links */}
      <section className="mx-auto mt-16 max-w-7xl px-6 pb-20">
        <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">Airport guides</h2>
        <ExpandableDescription
          wordLimit={25}
          className="mt-4 text-base"
          text={`Quick links into the airport profiles at both ends of the route. Each guide covers terminal layout, the airlines that base hubs at ${origin.iata} and ${destination.iata}, the other routes those airports serve, and the ground-transit options most travellers wish they'd read about before landing — the practical context you only really need to know once you've booked, but want to skim before you do.`}
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <AirportLink airport={origin} />
          <AirportLink airport={destination} />
        </div>
      </section>
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
      <div className="font-mono text-xs font-bold tracking-wider text-forest-900/60">{airport.iata}</div>
      <div className="mt-1 font-urbanist text-xl font-bold text-forest-900">{airport.city || airport.name}</div>
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
      <div className={'font-urbanist text-2xl font-bold text-forest-900 lg:text-3xl ' + (mono ? 'font-mono !text-xl lg:!text-2xl' : '')}>
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
            <span className="font-urbanist text-xs font-bold text-forest-900/60">
              {(carrier.iataCode || carrier.name).slice(0, 3).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/airlines/${carrier.slug}`}
            className="block font-urbanist text-base font-bold text-forest-900 hover:text-forest-700"
          >
            {carrier.name}
          </Link>
          {carrier.iataCode && (
            <span className="mt-1 inline-block rounded-[0.3rem] bg-forest-900 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-sand-100">
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
      href={`/airports/${airport.iata.toLowerCase()}`}
      className="group flex items-center justify-between rounded-[0.3rem] border border-forest-900/10 bg-paper p-5 transition hover:border-forest-900/30"
    >
      <div>
        <div className="font-mono text-xs font-bold tracking-wider text-forest-900/60">{airport.iata}</div>
        <div className="mt-1 font-urbanist text-base font-bold text-forest-900 group-hover:text-forest-700">
          {airport.city || airport.name}
        </div>
        <div className="mt-1 text-xs text-forest-900/50">Airport guide</div>
      </div>
      <span className="font-urbanist text-2xl text-forest-900/40 transition group-hover:translate-x-1 group-hover:text-forest-600">→</span>
    </Link>
  );
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
