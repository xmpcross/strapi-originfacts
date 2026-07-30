import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getAirport,
  listRoutesFromAirport,
  listAirportsByCountryCode,
  mediaUrl,
} from '@/lib/strapi';
import { airportInfoAddress, getAirportInfoByCode } from '@/lib/airport-info';
import {
  DEFAULT_OG_IMAGE,
  SITE_URL,
  airportIsSubstantive,
  airportIntro,
  airportFaqs,
  airportJsonLd,
  faqJsonLd,
  robotsFor,
  summariseRoutes,
  AIRPORTS_INDEXABLE,
} from '@/lib/entity-seo';
import { getAirportWeather, weatherLabel } from '@/lib/open-meteo';
import { JsonLd, FaqSection } from '@/components/SeoBlocks';
import { buildMetaDescription } from '@/lib/seo';
import type { Metadata } from 'next';

export const revalidate = 60;

type Props = { params: Promise<{ iata: string }> };

const LOCAL_AIRPORT_HERO_IMAGES: Record<string, string> = {
  ENU: '/generated/airports/airport-enu-hero.jpg',
  PHS: '/generated/airports/airport-phs-hero.jpg',
};

function airportHeroImage(iata: string, cmsImage: ReturnType<typeof mediaUrl>): string | null {
  return cmsImage ?? LOCAL_AIRPORT_HERO_IMAGES[iata.toUpperCase()] ?? null;
}

function absoluteUrl(pathOrUrl: string): string {
  return pathOrUrl.startsWith('http') ? pathOrUrl : `${SITE_URL}${pathOrUrl}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { iata } = await params;
  const a = await getAirport(iata);
  if (!a) return { title: 'Airport not found', robots: { index: false, follow: false } };
  const routes = await listRoutesFromAirport(a.iata, 1).catch(() => []);
  const hero = airportHeroImage(a.iata, mediaUrl(a.heroImage ?? null));
  const description = buildMetaDescription([
    a.about,
    `${a.name} (${a.iata})${a.city ? ` in ${a.city}` : ''}${a.country ? `, ${a.country}` : ''}: codes, location, airlines, top destinations and ground-transfer basics.`,
  ]);
  return {
    title: `${a.name} (${a.iata}) — airport guide`,
    description,
    alternates: { canonical: `${SITE_URL}/airports/${a.iata.toLowerCase()}` },
    openGraph: {
      title: `${a.name} (${a.iata}) — airport guide`,
      description,
      type: 'article',
      url: `${SITE_URL}/airports/${a.iata.toLowerCase()}`,
      images: hero
        ? [{ url: absoluteUrl(hero), width: 1024, height: 576, alt: `${a.name} airport guide` }]
        : [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Originfacts' }],
    },
    twitter: {
      card: 'summary_large_image',
      images: [hero ? absoluteUrl(hero) : DEFAULT_OG_IMAGE],
    },
    robots: robotsFor(AIRPORTS_INDEXABLE && airportIsSubstantive(a, routes.length > 0)),
  };
}

export default async function AirportPage({ params }: Props) {
  const { iata } = await params;
  const airport = await getAirport(iata);
  if (!airport) notFound();

  const [routes, sameCountry] = await Promise.all([
    listRoutesFromAirport(airport.iata, 15).catch(() => []),
    airport.countryCode
      ? listAirportsByCountryCode(airport.countryCode, 30).catch(() => [])
      : Promise.resolve([]),
  ]);
  const airportInfo = await getAirportInfoByCode({ iata: airport.iata, icao: airport.icao });
  const weatherLatitude = airport.latitude ?? airportInfo?.latitude;
  const weatherLongitude = airport.longitude ?? airportInfo?.longitude;
  const airportWeather = await getAirportWeather({
    latitude: weatherLatitude,
    longitude: weatherLongitude,
  });

  const summary = summariseRoutes(routes, 'destination');
  const hero = airportHeroImage(airport.iata, mediaUrl(airport.heroImage ?? null));
  const url = `${SITE_URL}/airports/${airport.iata.toLowerCase()}`;
  const nearby = sameCountry.filter((a) => a.iata && a.iata !== airport.iata).slice(0, 9);
  const faqs = airportFaqs(airport, summary);

  const aboutSections = airport.about ? parseAboutSections(airport.about) : [];
  const infoSection = aboutSections.find((s) => /airport information/i.test(s.heading || ''));
  const proseSections = aboutSections.filter((s) => s !== infoSection);
  const contactRows = infoSection
    ? parseInfoRows(infoSection).filter((r) => !/^(country|region)/i.test(r.label))
    : [];

  const facts: { label: string; value?: string | null }[] = [
    { label: 'IATA code', value: airport.iata },
    { label: 'ICAO code', value: airport.icao || airportInfo?.icao },
    { label: 'City', value: airport.city || airportInfo?.city },
    { label: 'Country', value: airport.country || airportInfo?.country },
    { label: 'Region', value: airport.region },
    {
      label: 'Coordinates',
      value:
        typeof (airport.latitude ?? airportInfo?.latitude) === 'number' &&
        typeof (airport.longitude ?? airportInfo?.longitude) === 'number'
          ? `${(airport.latitude ?? airportInfo?.latitude)!.toFixed(3)}°, ${(airport.longitude ?? airportInfo?.longitude)!.toFixed(3)}°`
          : null,
    },
    { label: 'Time zone', value: airport.timezone },
    { label: 'Address', value: airportInfoAddress(airportInfo) },
    { label: 'Phone', value: airportInfo?.phone },
    { label: 'Website', value: airportInfo?.website },
  ];

  const heroSummary = firstBlurbFromSections(proseSections) || airportIntro(airport, summary);
  const transportSection = proseSections.find((section) => /terminals|runways/i.test(section.heading || ''));
  const narrativeSections = proseSections.filter((section) => !/terminals|runways/i.test(section.heading || ''));
  const airlineCards = dedupeAirlineCards(routes);
  const keyInfoRows = contactRows.filter((row) => /address|postal|phone|website|url/i.test(row.label));
  const quickFacts = [
    { label: 'City served', value: airport.city || airportInfo?.city || airport.name },
    { label: 'Time zone', value: airport.timezone },
    {
      label: 'Coordinates',
      value:
        typeof (airport.latitude ?? airportInfo?.latitude) === 'number' &&
        typeof (airport.longitude ?? airportInfo?.longitude) === 'number'
          ? `${(airport.latitude ?? airportInfo?.latitude)!.toFixed(3)}°, ${(airport.longitude ?? airportInfo?.longitude)!.toFixed(3)}°`
          : null,
    },
    { label: 'Address', value: airportInfoAddress(airportInfo) },
    { label: 'Phone', value: airportInfo?.phone },
    { label: 'Website', value: airportInfo?.website },
  ].filter((item) => item.value);
  const detailFacts = [...facts, ...contactRows].filter(uniqueFactRows).filter((item) => item.value);
  const websiteValue =
    airportInfo?.website || keyInfoRows.find((row) => /website|url/i.test(row.label))?.value || null;
  const mapHref =
    typeof weatherLatitude === 'number' &&
    typeof weatherLongitude === 'number'
      ? `https://www.google.com/maps/search/?api=1&query=${weatherLatitude},${weatherLongitude}`
      : null;
  const sectionLinks = [
    { href: '#overview', label: 'Overview' },
    ...(summary.carriers.length > 0 ? [{ href: '#airlines', label: 'Airlines' }] : []),
    { href: '#routes', label: 'Routes' },
    ...(nearby.length > 0 ? [{ href: '#nearby-airports', label: 'Nearby airports' }] : []),
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <article data-testid={`airport-page-${airport.iata}`}>
      <JsonLd data={airportJsonLd(airport, url)} />
      <JsonLd data={faqJsonLd(faqs)} />

      <div className="mx-auto max-w-7xl px-6 pt-10">
        <nav className="text-xs uppercase tracking-widest text-forest-900/60">
          <Link href="/airports" className="hover:text-forest-900">Airports</Link>
          <span className="mx-2 text-forest-900/30">/</span>
          <span className="text-forest-900/80">{airport.iata}</span>
        </nav>
      </div>

      <header className="relative mx-auto mt-6 max-w-7xl overflow-hidden rounded-[0.3rem] border border-forest-900/10">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt={airport.name} className="h-[360px] w-full object-cover sm:h-[420px]" />
        ) : (
          <div className="h-[300px] w-full bg-gradient-to-br from-forest-950 via-forest-900 to-forest-700 sm:h-[380px]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-6 text-sand-100 sm:px-8 sm:pb-8">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] opacity-80">
            <span>{airport.region}</span>
            {airport.country && <span>· {airport.country}</span>}
            {airport.timezone && <span>· {airport.timezone}</span>}
          </div>
          <h1 className="editorial-h mt-3 max-w-4xl text-3xl font-bold leading-tight text-white sm:text-5xl">
            {airport.name}
          </h1>
          <p className="mt-4 w-full text-sm font-light leading-relaxed text-sand-100/90 sm:text-base">
            {heroSummary}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 font-mono text-xs">
            <span className="rounded-[0.3rem] bg-sand-100 px-3 py-1.5 font-bold tracking-wider text-forest-950">
              IATA · {airport.iata}
            </span>
            {airport.icao && (
              <span className="rounded-[0.3rem] border border-sand-100/30 bg-forest-950/35 px-3 py-1.5 font-bold tracking-wider">
                ICAO · {airport.icao}
              </span>
            )}
            {airport.city && <span className="opacity-80">Serving {airport.city}</span>}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {websiteValue && (
              <a
                href={normaliseUrl(websiteValue)}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center rounded-[0.3rem] bg-sand-100 px-4 py-2 text-sm font-semibold text-forest-950 transition hover:bg-white"
              >
                Official website
              </a>
            )}
            {mapHref && (
              <a
                href={mapHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-[0.3rem] border border-sand-100/35 bg-forest-950/35 px-4 py-2 text-sm font-semibold text-sand-100 transition hover:bg-forest-950/50"
              >
                View map
              </a>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto mt-6 max-w-7xl px-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {quickFacts.map((fact) => (
            <div
              key={fact.label}
              className="rounded-[0.3rem] border border-forest-900/10 bg-white/85 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              <div className="text-[11px] uppercase tracking-[0.2em] text-forest-900/55">{fact.label}</div>
              <div className="mt-2 text-sm font-semibold leading-relaxed text-forest-900">
                <FactValue label={fact.label} value={fact.value || ''} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-7xl px-6">
        <nav className="overflow-x-auto rounded-[0.3rem] border border-forest-900/10 bg-paper/80 p-2">
          <div className="flex min-w-max gap-2">
            {sectionLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-[0.3rem] px-4 py-2 text-sm font-semibold text-forest-900 transition hover:bg-white hover:text-primary-emphasis"
              >
                {link.label}
              </a>
            ))}
          </div>
        </nav>
      </section>

      <section id="overview" className="mx-auto mt-14 max-w-7xl scroll-mt-28 px-6" data-testid="airport-overview">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
          <div>
            <p className="section-eyebrow">
              <span className="inline-block h-px w-8 bg-forest-800/60" />
              About {airport.name}
            </p>
            <div className="mt-5 rounded-[0.3rem] border border-forest-900/10 bg-white/80 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <p className="max-w-3xl text-base font-light leading-8 text-forest-900/85">
                {heroSummary}
              </p>
              {transportSection && (
                <div className="mt-6 rounded-[0.3rem] border border-forest-900/10 bg-paper/70 p-5">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-forest-900/55">
                    Terminals and runway snapshot
                  </div>
                  <div className="prose-article mt-3">{renderProse(transportSection.paragraphs, 999)}</div>
                </div>
              )}
            </div>
            <div className="prose-article mt-8">
              {narrativeSections.length > 0 ? (
                narrativeSections.map((section, i) =>
                  section.heading ? (
                    <div key={i} className="mt-8">
                      <h3 className="font-urbanist text-xl font-bold text-forest-900">{section.heading}</h3>
                      {renderProse(section.paragraphs, i)}
                    </div>
                  ) : (
                    <div key={i}>{renderProse(section.paragraphs, i)}</div>
                  ),
                )
              ) : (
                <p>{airportIntro(airport, summary)}</p>
              )}
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[0.3rem] border border-forest-900/10 bg-forest-900/[0.03] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <h2 className="editorial-h text-lg font-bold text-forest-900">Airport facts</h2>
              <p className="mt-2 text-sm font-light leading-relaxed text-forest-900/70">
                Key reference details for {airport.iata}, including codes, location and contact information.
              </p>
              <dl className="mt-6 divide-y divide-forest-900/10">
                {detailFacts.map((fact) => (
                  <div key={fact.label} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <dt className="max-w-[42%] text-[11px] uppercase tracking-[0.18em] text-forest-900/50">
                      {fact.label}
                    </dt>
                    <dd className="text-right text-sm font-semibold leading-relaxed text-forest-900">
                      <FactValue label={fact.label} value={fact.value || ''} />
                    </dd>
                  </div>
                ))}
              </dl>
              {mapHref && (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex w-full items-center justify-center rounded-[0.3rem] bg-forest-900 px-4 py-3 text-sm font-semibold text-sand-100 transition hover:bg-forest-950"
                >
                  Open airport in maps
                </a>
              )}
            </div>
            {airportWeather?.current && (
              <div className="mt-4 rounded-[0.3rem] border border-forest-900/10 bg-white/85 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="editorial-h text-lg font-bold text-forest-900">Local weather</h2>
                    <p className="mt-2 text-sm font-light leading-relaxed text-forest-900/70">
                      Live conditions around {airport.name}.
                    </p>
                  </div>
                  <span className="rounded-full bg-paper/90 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-forest-900/60">
                    {airportWeather.timezoneAbbreviation || 'Local'}
                  </span>
                </div>
                <div className="mt-5 flex items-end justify-between gap-4 border-b border-forest-900/10 pb-4">
                  <div>
                    <div className="font-urbanist text-4xl font-bold leading-none text-forest-900">
                      {formatTemperature(airportWeather.current.temperature2m)}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-forest-900/80">
                      {weatherLabel(airportWeather.current.weatherCode)}
                    </div>
                  </div>
                  <div className="text-right text-xs uppercase tracking-[0.18em] text-forest-900/45">
                    <div>Updated</div>
                    <div className="mt-1 text-sm font-semibold normal-case tracking-normal text-forest-900/75">
                      {formatWeatherTime(airportWeather.current.time)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <WeatherMetric
                    label="Feels like"
                    value={formatTemperature(airportWeather.current.apparentTemperature)}
                  />
                  <WeatherMetric
                    label="Wind"
                    value={formatWindSpeed(airportWeather.current.windSpeed10m)}
                  />
                  <WeatherMetric
                    label="Today"
                    value={formatDailyRange(
                      airportWeather.daily?.temperature2mMin?.[0],
                      airportWeather.daily?.temperature2mMax?.[0],
                    )}
                  />
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      {airlineCards.length > 0 && (
        <section id="airlines" className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6" data-testid="airport-airlines">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-forest-900/10 pb-3">
            <div>
              <p className="section-eyebrow">
                <span className="inline-block h-px w-8 bg-forest-800/60" />
                Airlines
              </p>
              <h2 className="editorial-h mt-3 text-xl font-bold text-forest-900 lg:text-2xl">
                Airlines flying from {airport.iata}
              </h2>
            </div>
            <span className="text-sm font-light text-forest-900/50">
              {airlineCards.length} carrier{airlineCards.length === 1 ? '' : 's'}
            </span>
          </header>
          <div className="mt-6 overflow-x-auto pb-3">
            <div className="flex min-w-max gap-3">
            {airlineCards.map((airline) => (
              <Link
                key={airline.slug}
                href={`/airlines/${airline.slug}`}
                className="group flex h-[92px] w-[250px] flex-none items-center gap-4 rounded-[0.3rem] border border-forest-900/10 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:-translate-y-0.5 hover:border-forest-900/25 hover:shadow-sm"
              >
                <div className="flex h-14 w-28 flex-none items-center justify-center">
                  {airline.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={airline.logoUrl}
                      alt={`${airline.name} logo`}
                      className="max-h-12 w-full object-contain object-left"
                      loading="lazy"
                    />
                  ) : (
                    <span className="font-mono text-xs font-bold tracking-wider text-forest-900/60">
                      {airline.iataCode || airline.name.slice(0, 3).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="line-clamp-2 font-urbanist text-base font-bold leading-tight text-forest-900 group-hover:text-forest-700">
                    {airline.name}
                  </div>
                  {airline.iataCode && (
                    <div className="mt-1 font-mono text-[11px] tracking-[0.18em] text-forest-900/45">
                      {airline.iataCode}
                    </div>
                  )}
                </div>
              </Link>
            ))}
            </div>
          </div>
        </section>
      )}

      <section id="routes" className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-forest-900/10 pb-3">
          <div>
            <p className="section-eyebrow">
              <span className="inline-block h-px w-8 bg-forest-800/60" />
              Routes
            </p>
            <h2 className="editorial-h mt-3 text-2xl font-bold text-forest-900 lg:text-3xl">
              Top routes from {airport.iata}
            </h2>
          </div>
          <span className="text-sm font-light text-forest-900/50">
            {routes.length} route{routes.length === 1 ? '' : 's'}
          </span>
        </header>
        {routes.length === 0 ? (
          <p className="mt-10 text-forest-900/60">
            No routes tracked from {airport.iata} yet.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((r) => (
              <Link
                key={r.id}
                href={`/flight-routes/${r.slug}`}
                className="group flex items-center justify-between rounded-[0.3rem] border border-forest-900/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm"
              >
                <div>
                  <div className="font-mono text-xs font-bold tracking-wider text-forest-900/70">
                    {r.origin?.iata} → {r.destination?.iata}
                  </div>
                  <div className="mt-2 font-urbanist text-base font-bold text-forest-900 group-hover:text-forest-700">
                    {r.destination?.city || r.destination?.name}
                  </div>
                  <div className="mt-1 text-xs text-forest-900/60">
                    {r.destination?.country}
                  </div>
                </div>
                {r.distanceKm && (
                  <div className="text-right text-xs text-forest-900/50">
                    <div className="font-mono font-bold text-forest-900/70">
                      {r.distanceKm.toLocaleString()} km
                    </div>
                    {r.durationMinutes && <div className="mt-1">{formatDuration(r.durationMinutes)}</div>}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {nearby.length > 0 && (
        <section
          id="nearby-airports"
          className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6"
          data-testid="airport-nearby"
        >
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-forest-900/10 pb-3">
            <div>
              <p className="section-eyebrow">
                <span className="inline-block h-px w-8 bg-forest-800/60" />
                Nearby airports
              </p>
              <h2 className="editorial-h mt-3 text-2xl font-bold text-forest-900 lg:text-3xl">
                Other airports in {airport.country}
              </h2>
            </div>
            <span className="text-sm font-light text-forest-900/50">
              Compare alternate arrival points
            </span>
          </header>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {nearby.map((a) => (
              <Link
                key={a.id}
                href={`/airports/${a.iata.toLowerCase()}`}
                className="group flex items-center gap-3 rounded-[0.3rem] border border-forest-900/10 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:border-forest-900/30"
              >
                <span className="flex-none rounded-[0.3rem] bg-forest-900 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-sand-100">
                  {a.iata}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-urbanist text-sm font-bold text-forest-900 group-hover:text-forest-700">
                    {a.city || a.name}
                  </div>
                  <div className="truncate text-xs text-forest-900/60">{a.name}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div id="faq" className="scroll-mt-28">
        <FaqSection faqs={faqs} title={`${airport.name} — frequently asked questions`} />
      </div>

      <div className="pb-20" />
    </article>
  );
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

type AboutSection = { heading: string | null; paragraphs: string[] };

function parseAboutSections(about: string): AboutSection[] {
  const sections: AboutSection[] = [];
  let current: AboutSection = { heading: null, paragraphs: [] };
  for (const block of about.split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const headingMatch = trimmed.match(/^##\s+(.+)$/m);
    if (headingMatch && trimmed.startsWith('##')) {
      if (current.heading || current.paragraphs.length) sections.push(current);
      current = { heading: headingMatch[1].trim(), paragraphs: [] };
      const remainder = trimmed.replace(/^##\s+.+\n?/, '').trim();
      if (remainder) current.paragraphs.push(remainder);
    } else {
      current.paragraphs.push(trimmed);
    }
  }
  if (current.heading || current.paragraphs.length) sections.push(current);
  return sections;
}

function firstBlurbFromSections(sections: AboutSection[]): string | null {
  for (const section of sections) {
    for (const paragraph of section.paragraphs) {
      const cleaned = paragraph
        .split('\n')
        .map((line) => line.replace(/^[-*]\s+/, '').trim())
        .filter(Boolean)
        .join(' ');
      if (cleaned) return cleaned;
    }
  }
  return null;
}

function renderProse(paragraphs: string[], si: number): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  paragraphs.forEach((para, pi) => {
    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean);
    let text: string[] = [];
    let bullets: string[] = [];

    const flushText = () => {
      if (text.length) {
        out.push(<p key={`p-${si}-${pi}-${out.length}`} className="mt-3">{text.join(' ')}</p>);
        text = [];
      }
    };

    const flushBullets = () => {
      if (bullets.length) {
        out.push(
          <ul key={`u-${si}-${pi}-${out.length}`} className="mt-3 list-disc space-y-1.5 pl-5 text-forest-900/85">
            {bullets.map((b, bi) => <li key={bi}>{b}</li>)}
          </ul>,
        );
        bullets = [];
      }
    };

    for (const line of lines) {
      const bulletMatch = line.match(/^[-*]\s+(.*)$/);
      if (bulletMatch) {
        flushText();
        bullets.push(bulletMatch[1]);
      } else {
        flushBullets();
        text.push(line);
      }
    }

    flushText();
    flushBullets();
  });
  return out;
}

function parseInfoRows(section: AboutSection): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const para of section.paragraphs) {
    for (const line of para.split('\n')) {
      const match = line.trim().match(/^\*\*(.+?):\*\*\s*(.+?)\s*$/);
      if (match) rows.push({ label: match[1].trim(), value: match[2].trim() });
    }
  }
  return rows;
}

function uniqueFactRows(
  row: { label: string; value?: string | null },
  index: number,
  rows: { label: string; value?: string | null }[],
) {
  return rows.findIndex((item) => item.label.toLowerCase() === row.label.toLowerCase()) === index;
}

function dedupeAirlineCards(routes: Awaited<ReturnType<typeof listRoutesFromAirport>>) {
  const seen = new Map<string, { slug: string; name: string; iataCode?: string; logoUrl?: string | null }>();
  for (const route of routes) {
    for (const carrier of route.carriers ?? []) {
      if (!carrier?.slug || !carrier.name || seen.has(carrier.slug)) continue;
      seen.set(carrier.slug, {
        slug: carrier.slug,
        name: carrier.name,
        iataCode: carrier.iataCode,
        logoUrl: mediaUrl(carrier.logo ?? null),
      });
    }
  }
  return [...seen.values()];
}

function normaliseUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function isWikipediaUrl(url: string): boolean {
  try {
    return /(^|\.)wikipedia\.org$/i.test(new URL(url).hostname);
  } catch {
    return /wikipedia\.org/i.test(url);
  }
}

function FactValue({ label, value }: { label: string; value: string }) {
  if (!value) return <span className="text-forest-900/30">—</span>;
  return <ContactValue label={label} value={value} />;
}

function ContactValue({ label, value }: { label: string; value: string }) {
  const isUrl = /^https?:\/\//i.test(value) || /website|url/i.test(label);
  const isPhone = /phone|tel/i.test(label);

  if (isUrl) {
    const href = normaliseUrl(value);
    if (isWikipediaUrl(href)) {
      return null;
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="break-all text-forest-700 underline-offset-2 hover:underline"
      >
        {value.replace(/^https?:\/\//, '').replace(/\/$/, '')}
      </a>
    );
  }

  if (isPhone) {
    return (
      <a href={`tel:${value.replace(/[^0-9+]/g, '')}`} className="text-forest-700 underline-offset-2 hover:underline">
        {value}
      </a>
    );
  }

  return <>{value}</>;
}

function WeatherMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.3rem] border border-forest-900/10 bg-paper/60 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-forest-900/45">{label}</div>
      <div className="mt-1 text-sm font-semibold text-forest-900">{value}</div>
    </div>
  );
}

function formatTemperature(value?: number): string {
  return typeof value === 'number' ? `${Math.round(value)}°C` : '—';
}

function formatWindSpeed(value?: number): string {
  return typeof value === 'number' ? `${Math.round(value)} km/h` : '—';
}

function formatDailyRange(min?: number, max?: number): string {
  if (typeof min !== 'number' || typeof max !== 'number') return '—';
  return `${Math.round(min)}° / ${Math.round(max)}°`;
}

function formatWeatherTime(value?: string): string {
  if (!value) return 'Now';
  const match = value.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : value;
}
