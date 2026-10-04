import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAirline, listAirlinesByCountry, listRoutesByCarrier, mediaUrl } from '@/lib/strapi';
import RouteNetwork from '@/components/RouteNetwork';
import { getRouteFacts } from '@/lib/route-facts';
import {
  SITE_URL,
  DEFAULT_OG_IMAGE,
  airlineIsSubstantive,
  airlineIntro,
  airlineAbout,
  airlineExpectations,
  airlineFaqs,
  airlineJsonLd,
  faqJsonLd,
  robotsFor,
  summariseRoutes,
} from '@/lib/entity-seo';
import { JsonLd, FaqSection } from '@/components/SeoBlocks';
import { getFlySfoAirlineProfile } from '@/lib/flysfo-airline';
import { breadcrumbJsonLd, absoluteUrl } from '@/lib/jsonld';
import { buildMetaDescription, programmaticTitle } from '@/lib/seo';
import { countRoutesByCarrier } from '@/lib/counts';
import AirlineReviews from '@/components/AirlineReviews';
import AirlineFlightSearch from '@/components/AirlineFlightSearch';
import AboutParagraphs from '@/components/AboutParagraphs';
import type { Metadata } from 'next';

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getAirline(slug);
  if (!a) return { title: 'Not found' };
  const routes = await listRoutesByCarrier(slug, 1).catch(() => []);
  const description = buildMetaDescription([a.shortDescription, a.about, airlineIntro(a)]);
  const url = `${SITE_URL}/airlines/${a.slug}`;
  const logo = a.logo && a.logo.url ? a.logo : null;
  const title = programmaticTitle(
    a.iataCode ? `${a.name} (${a.iataCode})` : a.name,
    'Routes, Hubs & Fleet',
  );
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: 'article',
      url,
      images: logo
        ? [{
            url: absoluteUrl(mediaUrl(logo)!),
            width: logo.width ?? 512,
            height: logo.height ?? 512,
            alt: `${a.name} logo`,
          }]
        : [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Originfacts' }],
    },
    twitter: {
      card: 'summary_large_image',
      images: [logo ? absoluteUrl(mediaUrl(logo)!) : DEFAULT_OG_IMAGE],
    },
    robots: robotsFor(airlineIsSubstantive(a, routes.length > 0)),
  };
}

export default async function AirlinePage({ params }: Props) {
  const { slug } = await params;
  const airline = await getAirline(slug);
  if (!airline) notFound();

  const [routes, routeTotal, flySfoProfile, countryAirlines] = await Promise.all([
    listRoutesByCarrier(slug, 15).catch(() => []),
    countRoutesByCarrier(slug).catch(() => 0),
    getFlySfoAirlineProfile(airline).catch(() => null),
    airline.country ? listAirlinesByCountry(airline.country, 12).catch(() => []) : Promise.resolve([]),
  ]);
  const logo = mediaUrl(airline.logo ?? null);
  const summary = summariseRoutes(routes, 'destination');
  // Dataset total, not the 15-route sample — copy builders assert this count.
  if (routeTotal > 0) summary.routeTotal = routeTotal;
  const url = `${SITE_URL}/airlines/${airline.slug}`;
  const intro = airlineIntro(airline, summary);
  const relatedAirlines = countryAirlines.filter((c) => c.slug !== airline.slug).slice(0, 6);

  // Network stats derived from the tracked route list.
  const routesWithDistance = routes.filter((r) => typeof r.distanceKm === 'number' && r.distanceKm! > 0);
  const longestRoute = routesWithDistance.length
    ? routesWithDistance.reduce((a, b) => ((a.distanceKm ?? 0) >= (b.distanceKm ?? 0) ? a : b))
    : null;
  const avgKm = routesWithDistance.length
    ? Math.round(routesWithDistance.reduce((sum, r) => sum + (r.distanceKm ?? 0), 0) / routesWithDistance.length)
    : null;
  const routeLabel = (r: (typeof routes)[number]) =>
    `${r.origin?.city || r.origin?.name || r.origin?.iata} to ${r.destination?.city || r.destination?.name || r.destination?.iata}`;

  // Most frequent departure airports across the tracked routes.
  const originCounts = new Map<string, number>();
  for (const r of routes) {
    const label = r.origin?.name || r.origin?.city;
    if (label) originCounts.set(label, (originCounts.get(label) ?? 0) + 1);
  }
  const topOrigins = [...originCounts.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 4)
    .map(([label]) => label);
  const websiteValue = airline.website || flySfoProfile?.website || null;
  const websiteHref = websiteValue ? normaliseUrl(websiteValue) : null;
  const customerPhone = airline.phone || flySfoProfile?.generalPhone || null;
  const baggagePhone = flySfoProfile?.baggagePhone || null;
  const alliance = flySfoProfile?.alliance || null;
  const expectations = airlineExpectations(airline, alliance);

  // Prefer the CMS-stored about (5 AI-written paragraphs) rendered directly;
  // fall back to the derived airlineAbout() wrapper for un-enriched airlines.
  const storedAboutParas = String(airline.about || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const aboutParas =
    storedAboutParas.length >= 3
      ? storedAboutParas
      : airlineAbout(airline, summary, {
          alliance,
          longestRouteSentence: longestRoute
            ? `Its longest tracked sector is ${routeLabel(longestRoute)} at ${longestRoute.distanceKm!.toLocaleString()} km${longestRoute.durationMinutes ? ` (around ${formatDuration(longestRoute.durationMinutes)} in the air)` : ''}.`
            : undefined,
        });

  const keyDestinations = Array.isArray(airline.keyDestinations)
    ? airline.keyDestinations.filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
    : [];
  const hubCity = airline.city || null;
  const hubLabel = airline.airport || airline.city || null;
  // Full route-network facts from TravelPayouts data (only populated airlines
  // render the section; currently Qantas / QF).
  const routeFacts = getRouteFacts(airline.iataCode);
  const frequentFlyerProgram = airline.frequentFlyerProgram?.trim() || null;
  const goodToKnowCards = Array.isArray(airline.goodToKnow)
    ? airline.goodToKnow.filter((c): c is { title: string; body: string } => Boolean(c?.title && c?.body))
    : [];

  // Prefer CMS-stored FAQs (8 AI-written Q&As); else derive from data.
  const storedFaqs = Array.isArray(airline.faqs)
    ? airline.faqs.filter((f): f is { q: string; a: string } => Boolean(f?.q && f?.a))
    : [];
  const faqs = storedFaqs.length >= 4 ? [...storedFaqs] : airlineFaqs(airline, summary, { alliance, topOrigins });
  if (storedFaqs.length < 4 && longestRoute) {
    faqs.push({
      q: `What is the longest ${airline.name} route?`,
      a: `Among the routes Originfacts tracks, the longest ${airline.name} sector is ${routeLabel(longestRoute)} at ${longestRoute.distanceKm!.toLocaleString()} km${longestRoute.durationMinutes ? ` (around ${formatDuration(longestRoute.durationMinutes)} in the air)` : ''}.`,
    });
  }
  // Each airline gets its own stable FAQ order: a Fisher-Yates shuffle seeded
  // from the slug, so the order differs between pages but never flickers
  // between rebuilds of the same page.
  seededShuffle(faqs, airline.slug);
  const heroFacts = [
    { label: 'Country', value: airline.country },
    { label: 'Region', value: airline.region },
    { label: 'Type', value: airline.type },
    { label: 'Alliance', value: alliance },
    { label: 'Popular routes', value: routes.length ? String(routes.length) : undefined },
  ].filter((fact) => fact.value);

  return (
    <article data-testid={`airline-page-${slug}`}>
      <JsonLd data={airlineJsonLd(airline, url)} />
      <JsonLd data={faqJsonLd(faqs)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Airlines', url: '/airlines' },
          { name: airline.name, url: `/airlines/${airline.slug}` },
        ])}
      />
      {/* Breadcrumb */}
      <div className="mx-auto max-w-6xl px-6 pt-10">
        <nav className="text-xs uppercase tracking-widest text-forest-900/60">
          <Link href="/airlines" className="hover:text-forest-900">Airlines</Link>
          <span className="mx-2 text-forest-900/30">/</span>
          <span className="text-forest-900/80">{airline.name}</span>
        </nav>
      </div>

      {/* Hero */}
      <header className="mx-auto mt-6 max-w-6xl px-6">
        <div className="overflow-hidden rounded-[0.3rem] border-0 bg-gradient-to-br from-white via-forest-50/45 to-sand-50">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] lg:px-8 lg:py-10">
            <div className="flex flex-col gap-5">
              {/* Status pill + region · country (top row, matching the reference) */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {airline.type && (
                  <span className="inline-flex items-center rounded-full bg-[#e8effb] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3d6bc9]">
                    {airline.type}
                  </span>
                )}
                {(airline.region || airline.country) && (
                  <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-forest-900/45">
                    {[airline.region, airline.country].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>

              {/* Logo + title on one line */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-auto max-w-[150px] flex-none items-center sm:h-14">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt={airline.name} className="h-full w-auto object-contain" />
                  ) : (
                    <span className="font-urbanist text-2xl font-bold text-forest-900/60">
                      {(airline.iataCode || airline.name).slice(0, 3).toUpperCase()}
                    </span>
                  )}
                </div>
                <h1 className="editorial-h text-3xl font-bold leading-tight text-forest-900 sm:text-[2.5rem]">
                  {airline.name}
                </h1>
              </div>

              {/* Description */}
              <p className="max-w-3xl text-sm font-light leading-7 text-forest-900/82 sm:text-base">
                {airline.shortDescription?.trim() || intro}
              </p>

              <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                {airline.iataCode && (
                  <span className="rounded-[0.3rem] bg-forest-900 px-3 py-1.5 font-bold tracking-wider text-sand-100">
                    IATA · {airline.iataCode}
                  </span>
                )}
                {airline.icaoCode && (
                  <span className="rounded-[0.3rem] border border-forest-900/20 bg-white/80 px-3 py-1.5 font-bold tracking-wider text-forest-900">
                    ICAO · {airline.icaoCode}
                  </span>
                )}
                {customerPhone && (
                  <span className="rounded-[0.3rem] border border-forest-900/10 bg-white/80 px-3 py-1.5 text-forest-900/80">
                    Customer service · {customerPhone}
                  </span>
                )}
                {alliance && (
                  <span className="rounded-[0.3rem] border border-forest-900/10 bg-white/80 px-3 py-1.5 text-forest-900/80">
                    Alliance · {alliance}
                  </span>
                )}
              </div>
            </div>

            <aside className="rounded-[0.3rem] border border-forest-900/10 bg-white/85 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] lg:p-6">
              <h2 className="text-[11px] uppercase tracking-[0.2em] text-forest-900/55">Airline snapshot</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {heroFacts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-[11px] uppercase tracking-[0.2em] text-forest-900/45">{fact.label}</dt>
                    <dd className="mt-1 text-sm font-semibold text-forest-900">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </div>
      </header>

      {/* Flight search — full-width, below the hero */}
      <div className="mx-auto mt-8 w-[1170px] max-w-full px-6" data-testid="airline-flight-search-wrap">
        <AirlineFlightSearch />
      </div>

      {/* About + Details — two columns: details (30%) on the left, about (60%) offset to the right */}
      <section className="mx-auto mt-14 max-w-6xl px-6 pb-20" data-testid="airline-about">
        <div className="grid gap-10 lg:grid-cols-[3fr_6fr]">
          <aside className="rounded-[0.3rem] border border-forest-900/10 bg-forest-900/[0.02] p-6 lg:self-start">
            <h3 className="editorial-h text-xs font-bold uppercase tracking-wider text-forest-900/60">
              Details
            </h3>
            <dl className="mt-5 space-y-4">
              <InfoRow label="IATA Code" value={airline.iataCode} mono />
              <InfoRow label="ICAO Code" value={airline.icaoCode} mono />
              <InfoRow label="Legal Name" value={airline.legalName} />
              <InfoRow label="Country" value={airline.country} />
              <InfoRow label="Region" value={airline.region} />
              <InfoRow label="Alliance" value={alliance} />
              <InfoRow
                label="Frequent Flyer"
                value={
                  frequentFlyerProgram ? (
                    airline.frequentFlyerUrl ? (
                      <a
                        href={airline.frequentFlyerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-forest-700 underline-offset-2 hover:underline"
                      >
                        {frequentFlyerProgram}
                      </a>
                    ) : (
                      frequentFlyerProgram
                    )
                  ) : undefined
                }
              />
              <InfoRow label="Address" value={airline.address} multiline />
              <InfoRow label="Customer Service" value={customerPhone} phone />
              <InfoRow label="Baggage Service" value={baggagePhone} phone />
              <InfoRow
                label="Website"
                value={
                  websiteHref ? (
                    <a
                      href={websiteHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-forest-700 underline-offset-2 hover:underline"
                    >
                      {websiteHref.replace(/^https?:\/\//, '')}
                    </a>
                  ) : undefined
                }
              />
            </dl>
          </aside>

          <div className="lg:pl-6">
            <p className="eyebrow-tag">
              <span className="inline-block h-px w-8 bg-forest-800/60" />
              About {airline.name}
            </p>
            <div className="mt-4">
              <AboutParagraphs paragraphs={aboutParas} />
            </div>
          </div>
        </div>
      </section>

      {/* Flying with X — what to expect. Prefer the stored goodToKnow cards
          (AI-written, ≥4) with title+body; fall back to the derived
          expectations paragraphs. */}
      {(goodToKnowCards.length > 0 || expectations.length > 0) && (
        <section className="mx-auto max-w-6xl px-6 pb-20" data-testid="airline-expectations">
          <p className="eyebrow-tag">
            <span className="inline-block h-px w-8 bg-forest-800/60" />
            Good to know
          </p>
          <h2 className="editorial-h mt-3 text-2xl font-bold text-forest-900 lg:text-3xl">
            Flying with {airline.name} — what to expect
          </h2>
          {goodToKnowCards.length > 0 ? (
            <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {goodToKnowCards.map((card, i) => (
                <div key={i} className="flex gap-4" data-testid={`gtk-card-${i}`}>
                  <span
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-forest-900 font-urbanist text-sm font-bold text-sand-100"
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-urbanist text-base font-bold text-forest-900">{card.title}</h3>
                    <p className="mt-1.5 text-sm font-light leading-7 text-forest-900/78">{card.body}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div
            className={`mt-6 grid gap-4 ${
              expectations.length >= 3 ? 'lg:grid-cols-3' : expectations.length === 2 ? 'lg:grid-cols-2' : ''
            }`}
          >
            {expectations.map((para, i) => (
              <div
                key={i}
                className="rounded-[0.3rem] border border-forest-900/10 bg-white/85 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              >
                <p className="text-sm font-light leading-7 text-forest-900/82">{para}</p>
              </div>
            ))}
          </div>
          )}
        </section>
      )}


      {/* Full route network (TravelPayouts data) — where the airline flies,
          hubs and fleet. Distinct from the tracked route cards below. */}
      {routeFacts && <RouteNetwork facts={routeFacts} airlineName={airline.name} />}

      {/* Popular routes operated by this airline */}
      {routes.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-20" data-testid="airline-routes">
          <header className="flex flex-col gap-3 border-b border-forest-900/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow-tag">
                <span className="inline-block h-px w-8 bg-forest-800/60" />
                Route network
              </p>
              <h2 className="editorial-h mt-3 text-2xl font-bold text-forest-900 lg:text-3xl">
                Popular routes operated by {airline.name}
              </h2>
            </div>
            <span className="text-sm font-light text-forest-900/50">
              {routes.length} route{routes.length === 1 ? '' : 's'}
            </span>
          </header>

          {/* Network at a glance — stats derived from the tracked routes */}
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="airline-network-stats">
            <StatTile label="Tracked destinations" value={String(summary.destinationCount)} />
            <StatTile
              label={summary.countryCount === 1 ? 'Country served' : 'Countries served'}
              value={String(summary.countryCount)}
            />
            {longestRoute && (
              <StatTile
                label="Longest tracked route"
                value={`${longestRoute.distanceKm!.toLocaleString()} km`}
                hint={routeLabel(longestRoute)}
              />
            )}
            {avgKm && <StatTile label="Average sector" value={`${avgKm.toLocaleString()} km`} />}
          </div>
          {summary.countryNames.length > 1 && (
            <p className="mt-4 text-sm font-light leading-7 text-forest-900/70">
              Tracked {airline.name} routes touch {summary.countryNames.slice(0, 8).join(', ')}
              {summary.countryNames.length > 8 ? ` and ${summary.countryNames.length - 8} more countries` : ''}.
            </p>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((r) => (
              <RouteCard
                key={r.id}
                href={`/flight-routes/${r.slug}`}
                testId={`airline-route-${r.slug}`}
                logo={logo}
                airlineName={airline.name}
                originCode={r.origin?.iata}
                destCode={r.destination?.iata}
                originCity={r.origin?.city || r.origin?.name}
                destCity={r.destination?.city || r.destination?.name}
                duration={r.durationMinutes ? formatDuration(r.durationMinutes) : undefined}
                distanceKm={r.distanceKm ?? undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* Popular routes — fallback from generated key destinations when there
          are no tracked routes (hub → each destination). */}
      {routes.length === 0 && keyDestinations.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-20" data-testid="airline-routes">
          <header className="border-b border-forest-900/10 pb-4">
            <p className="eyebrow-tag">
              <span className="inline-block h-px w-8 bg-forest-800/60" />
              Route network
            </p>
            <h2 className="editorial-h mt-3 text-2xl font-bold text-forest-900 lg:text-3xl">
              Popular routes operated by {airline.name}
            </h2>
            <p className="mt-3 text-sm font-light text-forest-900/60">
              {hubLabel
                ? `Notable destinations served from ${airline.name}'s hub at ${hubLabel}.`
                : `Notable destinations on ${airline.name}'s network.`}
            </p>
          </header>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {keyDestinations.map((dest) => (
              <RouteCard
                key={dest}
                testId={`airline-route-${dest.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                logo={logo}
                airlineName={airline.name}
                originCode={airline.iataCode || undefined}
                originCity={hubCity || undefined}
                destCity={dest}
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-forest-900/50">
            Destination list is indicative of {airline.name}'s network; see the airline's official
            route map for its complete, current schedule.
          </p>
        </section>
      )}

      {/* Historical traveller reviews (unified review store, Skytrax archive seed) */}
      <AirlineReviews slug={airline.slug} name={airline.name} />

      {/* Related airlines from the same country — internal discovery links */}
      {relatedAirlines.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-20" data-testid="airline-related">
          <p className="eyebrow-tag">
            <span className="inline-block h-px w-8 bg-forest-800/60" />
            More from {airline.country}
          </p>
          <h2 className="editorial-h mt-3 text-2xl font-bold text-forest-900 lg:text-3xl">
            Other airlines based in {airline.country}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedAirlines.map((rel) => {
              const relLogo = mediaUrl(rel.logo ?? null);
              return (
                <Link
                  key={rel.slug}
                  href={`/airlines/${rel.slug}`}
                  className="group flex items-center gap-4 rounded-[0.3rem] border border-forest-900/10 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm"
                  data-testid={`airline-related-${rel.slug}`}
                >
                  <span className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-[0.3rem] bg-white">
                    {relLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={relLogo} alt={rel.name} className="h-full w-full object-contain" />
                    ) : (
                      <span className="font-urbanist text-lg font-bold text-forest-900/60">
                        {(rel.iataCode || rel.name).slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-urbanist text-base font-bold text-forest-900 group-hover:text-forest-700">
                      {rel.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-forest-900/60">
                      {[rel.iataCode, rel.type].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <FaqSection faqs={faqs} title={`${airline.name} — frequently asked questions`} eyebrowClassName="eyebrow-tag" />
    </article>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[0.3rem] border border-forest-900/10 bg-white/85 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="text-[11px] uppercase tracking-[0.2em] text-forest-900/50">{label}</div>
      <div className="mt-2 font-urbanist text-2xl font-bold text-forest-900">{value}</div>
      {hint && <div className="mt-1 truncate text-xs text-forest-900/60">{hint}</div>}
    </div>
  );
}

/**
 * Route card styled like a flight-listing card: airline logo on the left, the
 * airport-code route prominent, city pair below, and a duration / "direct"
 * badge on the right. Renders as a link when `href` is provided.
 */
function RouteCard({
  href,
  testId,
  logo,
  airlineName,
  originCode,
  destCode,
  originCity,
  destCity,
  duration,
  distanceKm,
}: {
  href?: string;
  testId: string;
  logo: string | null;
  airlineName: string;
  originCode?: string;
  destCode?: string;
  originCity?: string;
  destCity?: string;
  duration?: string;
  distanceKm?: number;
}) {
  const routeCodes = [originCode, destCode].filter(Boolean).join(' - ');
  const cityPair = [originCity, destCity].filter(Boolean).join(' → ');

  const inner = (
    <>
      <span className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-[0.3rem] bg-white">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={airlineName} className="h-full w-full object-contain" />
        ) : (
          <span className="font-urbanist text-lg font-bold text-forest-900/60">
            {airlineName.slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-urbanist text-lg font-bold tracking-wide text-forest-900 group-hover:text-forest-700">
          {routeCodes || destCity}
        </span>
        {cityPair && <span className="mt-0.5 block truncate text-xs text-forest-900/60">{cityPair}</span>}
      </span>
      <span className="flex-none text-right">
        {duration && <span className="block font-urbanist text-sm font-bold text-forest-900">{duration}</span>}
        <span className="block text-xs text-forest-900/50">
          {distanceKm ? `${distanceKm.toLocaleString()} km` : 'direct'}
        </span>
      </span>
    </>
  );

  const cls =
    'group flex items-center gap-4 rounded-[0.3rem] border border-forest-900/10 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm';

  return href ? (
    <Link href={href} className={cls} data-testid={testId}>
      {inner}
    </Link>
  ) : (
    <div className={cls} data-testid={testId}>
      {inner}
    </div>
  );
}

/** Deterministic in-place shuffle — xorshift PRNG seeded from a string. */
function seededShuffle<T>(arr: T[], seed: string): void {
  let s = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    s = Math.imul(s ^ seed.charCodeAt(i), 16777619) >>> 0;
  }
  const rand = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function InfoRow({
  label,
  value,
  mono = false,
  multiline = false,
  phone = false,
}: {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
  multiline?: boolean;
  phone?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-forest-900/50">{label}</dt>
      <dd
        className={
          'mt-1 text-sm text-forest-900 ' +
          (mono ? 'font-mono font-bold tracking-wider ' : 'font-light ') +
          (multiline ? 'whitespace-pre-wrap ' : '')
        }
      >
        {phone && typeof value === 'string' ? (
          <a href={`tel:${value.replace(/[^0-9+]/g, '')}`} className="text-forest-700 underline-offset-2 hover:underline">
            {value}
          </a>
        ) : (
          value ?? <span className="text-forest-900/30">—</span>
        )}
      </dd>
    </div>
  );
}

function normaliseUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
