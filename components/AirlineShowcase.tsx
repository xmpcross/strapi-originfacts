import Link from 'next/link';
import type { StrapiAirline, StrapiRoute } from '@/lib/strapi';
import type { RouteFacts } from '@/lib/route-facts';
import type { RouteSummary } from '@/lib/entity-seo';
import { airlineJsonLd, faqJsonLd } from '@/lib/entity-seo';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { JsonLd, FaqSection } from '@/components/SeoBlocks';
import { mediaUrl } from '@/lib/strapi';
import RouteNetwork from '@/components/RouteNetwork';
import AirlineReviews from '@/components/AirlineReviews';
import AirlineFlightSearch from '@/components/AirlineFlightSearch';
import AboutParagraphs from '@/components/AboutParagraphs';

/**
 * AirlineShowcase — redesigned airline profile page.
 *
 * Currently gated to /airlines/aircalin only (see app/airlines/[slug]/page.tsx);
 * every other airline keeps the original layout. Content, headings, JSON-LD and
 * metadata are identical to the original page so the redesign carries no SEO
 * risk — only the presentation differs:
 *  - full-bleed forest-950 hero with a glassy snapshot card and a stats band
 *  - sticky in-page section nav (anchor links)
 *  - About gains a proper h2; the details list becomes a sticky boarding-card
 *  - Good-to-know sits on a tinted full-bleed band
 */

export type AirlineShowcaseProps = {
  airline: StrapiAirline;
  url: string;
  logo: string | null;
  intro: string;
  aboutParas: string[];
  expectations: string[];
  goodToKnowCards: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
  routes: StrapiRoute[];
  routeFacts: RouteFacts | null;
  relatedAirlines: StrapiAirline[];
  summary: RouteSummary;
  longestRoute: StrapiRoute | null;
  avgKm: number | null;
  customerPhone: string | null;
  baggagePhone: string | null;
  alliance: string | null;
  websiteHref: string | null;
  keyDestinations: string[];
  hubCity: string | null;
  hubLabel: string | null;
  frequentFlyerProgram: string | null;
};

export default function AirlineShowcase({
  airline,
  url,
  logo,
  intro,
  aboutParas,
  expectations,
  goodToKnowCards,
  faqs,
  routes,
  routeFacts,
  relatedAirlines,
  summary,
  longestRoute,
  avgKm,
  customerPhone,
  baggagePhone,
  alliance,
  websiteHref,
  keyDestinations,
  hubCity,
  hubLabel,
  frequentFlyerProgram,
}: AirlineShowcaseProps) {
  const routeLabel = (r: StrapiRoute) =>
    `${r.origin?.city || r.origin?.name || r.origin?.iata} to ${r.destination?.city || r.destination?.name || r.destination?.iata}`;

  // Hero stats — prefer the full TravelPayouts network facts; fall back to the
  // stats derived from tracked routes.
  const heroStats: { label: string; value: string; hint?: string }[] = routeFacts
    ? [
        { label: 'Routes operated', value: String(routeFacts.routeCount) },
        { label: 'Destinations', value: String(routeFacts.destinationCount) },
        { label: routeFacts.countryCount === 1 ? 'Country served' : 'Countries served', value: String(routeFacts.countryCount) },
        ...(routeFacts.longestRoute
          ? [{
              label: 'Longest route',
              value: `${routeFacts.longestRoute.km.toLocaleString()} km`,
              hint: `${routeFacts.longestRoute.fromIata} → ${routeFacts.longestRoute.toIata}`,
            }]
          : []),
      ]
    : [
        ...(summary.destinationCount ? [{ label: 'Tracked destinations', value: String(summary.destinationCount) }] : []),
        ...(summary.countryCount
          ? [{ label: summary.countryCount === 1 ? 'Country served' : 'Countries served', value: String(summary.countryCount) }]
          : []),
        ...(longestRoute
          ? [{ label: 'Longest tracked route', value: `${longestRoute.distanceKm!.toLocaleString()} km`, hint: routeLabel(longestRoute) }]
          : []),
        ...(avgKm ? [{ label: 'Average sector', value: `${avgKm.toLocaleString()} km` }] : []),
      ];

  const hasGoodToKnow = goodToKnowCards.length > 0 || expectations.length > 0;
  const hasRoutes = routes.length > 0 || keyDestinations.length > 0;
  const sectionLinks = [
    { href: '#about', label: 'Overview' },
    ...(hasGoodToKnow ? [{ href: '#good-to-know', label: 'Good to know' }] : []),
    ...(routeFacts ? [{ href: '#network', label: 'Network' }] : []),
    ...(hasRoutes ? [{ href: '#routes', label: 'Routes' }] : []),
    { href: '#faqs', label: 'FAQs' },
  ];

  return (
    <article data-testid={`airline-page-${airline.slug}`}>
      <JsonLd data={airlineJsonLd(airline, url)} />
      <JsonLd data={faqJsonLd(faqs)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Airlines', url: '/airlines' },
          { name: airline.name, url: `/airlines/${airline.slug}` },
        ])}
      />

      {/* ---------- Hero — full-bleed dark band ---------- */}
      <header className="relative isolate overflow-hidden bg-forest-950 text-white">
        {/* Decorative glows — purely visual, sit behind the content */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 right-[-8%] h-[26rem] w-[26rem] rounded-full bg-forest-500/25 blur-[110px]" />
          <div className="absolute bottom-[-40%] left-[-6%] h-[24rem] w-[24rem] rounded-full bg-sand-400/10 blur-[110px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pt-8 lg:pt-10">
          <nav className="text-xs uppercase tracking-widest text-white/50">
            <Link href="/airlines" className="transition hover:text-white">Airlines</Link>
            <span className="mx-2 text-white/25">/</span>
            <span className="text-white/80">{airline.name}</span>
          </nav>

          <div className="grid gap-10 pb-10 pt-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)] lg:pb-12">
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {airline.type && (
                  <span className="inline-flex items-center rounded-full bg-sand-300 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-forest-950">
                    {airline.type}
                  </span>
                )}
                {(airline.region || airline.country) && (
                  <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
                    {[airline.region, airline.country].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-5">
                <div className="flex h-16 w-auto max-w-[170px] flex-none items-center rounded-[0.3rem] bg-white px-3 py-2 sm:h-[4.5rem]">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt={airline.name} className="h-full w-auto object-contain" />
                  ) : (
                    <span className="font-urbanist text-2xl font-bold text-forest-900">
                      {(airline.iataCode || airline.name).slice(0, 3).toUpperCase()}
                    </span>
                  )}
                </div>
                <h1 className="editorial-h text-3xl font-bold leading-tight text-white sm:text-[2.75rem]">
                  {airline.name}
                </h1>
              </div>

              <p className="max-w-3xl text-sm font-light leading-7 text-white/75 sm:text-base">
                {airline.shortDescription?.trim() || intro}
              </p>

              <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                {airline.iataCode && (
                  <span className="rounded-[0.3rem] bg-sand-300 px-3 py-1.5 font-bold tracking-wider text-forest-950">
                    IATA · {airline.iataCode}
                  </span>
                )}
                {airline.icaoCode && (
                  <span className="rounded-[0.3rem] border border-white/25 px-3 py-1.5 font-bold tracking-wider text-white">
                    ICAO · {airline.icaoCode}
                  </span>
                )}
                {alliance && (
                  <span className="rounded-[0.3rem] border border-white/15 bg-white/10 px-3 py-1.5 text-white/85">
                    Alliance · {alliance}
                  </span>
                )}
                {frequentFlyerProgram && (
                  <span className="rounded-[0.3rem] border border-white/15 bg-white/10 px-3 py-1.5 text-white/85">
                    Loyalty · {frequentFlyerProgram}
                  </span>
                )}
              </div>
            </div>

            <aside className="self-start rounded-[0.3rem] border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm lg:p-6">
              <h2 className="text-[11px] uppercase tracking-[0.2em] text-sand-200">Airline snapshot</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  { label: 'Country', value: airline.country },
                  { label: 'Region', value: airline.region },
                  { label: 'Main hub', value: hubLabel },
                  { label: 'Alliance', value: alliance },
                  { label: 'Frequent flyer', value: frequentFlyerProgram },
                ]
                  .filter((f) => f.value)
                  .map((fact) => (
                    <div key={fact.label}>
                      <dt className="text-[11px] uppercase tracking-[0.2em] text-white/40">{fact.label}</dt>
                      <dd className="mt-1 text-sm font-semibold text-white">{fact.value}</dd>
                    </div>
                  ))}
              </dl>
              {websiteHref && (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-[0.3rem] bg-sand-300 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-forest-950 transition hover:bg-sand-200"
                >
                  Visit {websiteHref.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              )}
            </aside>
          </div>
        </div>

        {/* Stats band — anchors the hero, echoes a departures board */}
        {heroStats.length > 0 && (
          <div className="relative border-t border-white/10 bg-white/[0.03]">
            <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-white/10 px-6 lg:grid-cols-4">
              {heroStats.slice(0, 4).map((stat) => (
                <div key={stat.label} className="px-4 py-5 first:pl-0 lg:py-6">
                  <div className="font-urbanist text-2xl font-bold text-sand-200 lg:text-3xl">{stat.value}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/45">{stat.label}</div>
                  {stat.hint && <div className="mt-0.5 truncate font-mono text-xs text-white/55">{stat.hint}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ---------- Sticky section nav ---------- */}
      <nav
        aria-label="Page sections"
        className="sticky top-0 z-40 border-b border-forest-900/10 bg-white/90 backdrop-blur"
        data-testid="airline-section-nav"
      >
        <div className="no-scrollbar mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-6">
          {sectionLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap border-b-2 border-transparent px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-forest-900/55 transition hover:border-sand-300 hover:text-forest-900"
            >
              {link.label}
            </a>
          ))}
          {airline.iataCode && (
            <span className="ms-auto hidden flex-none font-mono text-xs font-bold tracking-wider text-forest-900/35 sm:block">
              {[airline.iataCode, airline.icaoCode].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </nav>

      {/* ---------- Flight search ---------- */}
      <div className="mx-auto mt-8 w-[1170px] max-w-full px-6" data-testid="airline-flight-search-wrap">
        <AirlineFlightSearch />
      </div>

      {/* ---------- About + details ---------- */}
      <section id="about" className="mx-auto mt-14 max-w-6xl scroll-mt-16 px-6 pb-20" data-testid="airline-about">
        <div className="grid gap-10 lg:grid-cols-[6fr_3fr]">
          <div>
            <p className="eyebrow-tag">
              <span className="inline-block h-px w-8 bg-forest-800/60" />
              Airline profile
            </p>
            <h2 className="editorial-h mt-3 text-2xl font-bold text-forest-900 lg:text-3xl">
              About {airline.name}
            </h2>
            <div className="mt-5">
              <AboutParagraphs paragraphs={aboutParas} />
            </div>
          </div>

          <aside className="self-start overflow-hidden rounded-[0.3rem] border border-forest-900/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] lg:sticky lg:top-16">
            <div className="flex items-center justify-between bg-forest-950 px-5 py-3.5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-sand-100">Airline details</h3>
              {(airline.iataCode || airline.icaoCode) && (
                <span className="font-mono text-[11px] font-bold tracking-wider text-sand-300">
                  {[airline.iataCode, airline.icaoCode].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
            <dl className="divide-y divide-forest-900/[0.06] px-5">
              <DetailRow label="Legal name" value={airline.legalName} />
              <DetailRow label="Country" value={airline.country} />
              <DetailRow label="Region" value={airline.region} />
              <DetailRow label="Main hub" value={hubLabel} />
              <DetailRow label="Alliance" value={alliance} />
              <DetailRow
                label="Frequent flyer"
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
              <DetailRow label="Customer service" value={customerPhone} phone />
              <DetailRow label="Baggage service" value={baggagePhone} phone />
              <DetailRow
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
              <DetailRow label="Address" value={airline.address} multiline />
            </dl>
          </aside>
        </div>
      </section>

      {/* ---------- Good to know — tinted full-bleed band ---------- */}
      {hasGoodToKnow && (
        <section id="good-to-know" className="scroll-mt-16 bg-forest-50/70" data-testid="airline-expectations">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className="eyebrow-tag">
              <span className="inline-block h-px w-8 bg-forest-800/60" />
              Good to know
            </p>
            <h2 className="editorial-h mt-3 text-2xl font-bold text-forest-900 lg:text-3xl">
              Flying with {airline.name} — what to expect
            </h2>
            {goodToKnowCards.length > 0 ? (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {goodToKnowCards.map((card, i) => (
                  <div
                    key={i}
                    className="rounded-[0.3rem] border border-forest-900/10 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                    data-testid={`gtk-card-${i}`}
                  >
                    <span
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-forest-950 font-urbanist text-sm font-bold text-sand-200"
                      aria-hidden
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="mt-4 font-urbanist text-base font-bold text-forest-900">{card.title}</h3>
                    <p className="mt-1.5 text-sm font-light leading-7 text-forest-900/78">{card.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={`mt-8 grid gap-5 ${
                  expectations.length >= 3 ? 'lg:grid-cols-3' : expectations.length === 2 ? 'lg:grid-cols-2' : ''
                }`}
              >
                {expectations.map((para, i) => (
                  <div
                    key={i}
                    className="rounded-[0.3rem] border border-forest-900/10 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                  >
                    <p className="text-sm font-light leading-7 text-forest-900/82">{para}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---------- Full route network (TravelPayouts facts) ---------- */}
      {routeFacts && (
        <div id="network" className="scroll-mt-16">
          <RouteNetwork facts={routeFacts} airlineName={airline.name} />
        </div>
      )}

      {/* ---------- Popular routes — tracked routes, else key destinations ---------- */}
      {routes.length > 0 && (
        <section id="routes" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-16" data-testid="airline-routes">
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
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((r) => (
              <ShowcaseRouteCard
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

      {routes.length === 0 && keyDestinations.length > 0 && (
        <section id="routes" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-16" data-testid="airline-routes">
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
              <ShowcaseRouteCard
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

      {/* ---------- Historical traveller reviews ---------- */}
      <AirlineReviews slug={airline.slug} name={airline.name} />

      {/* ---------- Related airlines ---------- */}
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

      <div id="faqs" className="scroll-mt-16">
        <FaqSection faqs={faqs} title={`${airline.name} — frequently asked questions`} eyebrowClassName="eyebrow-tag" />
      </div>
    </article>
  );
}

function DetailRow({
  label,
  value,
  multiline = false,
  phone = false,
}: {
  label: string;
  value?: React.ReactNode;
  multiline?: boolean;
  phone?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="flex-none text-[11px] uppercase tracking-widest text-forest-900/50">{label}</dt>
      <dd className={`min-w-0 text-right text-sm font-semibold text-forest-900 ${multiline ? 'whitespace-pre-wrap' : ''}`}>
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

function ShowcaseRouteCard({
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
      <span className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-[0.3rem] bg-white">
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

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
