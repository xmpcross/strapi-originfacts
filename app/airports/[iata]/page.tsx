import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  getAirport,
  listAirportSlugIndex,
  listRoutesFromAirport,
  listAirportsByCountryCode,
  mediaUrl,
} from '@/lib/strapi';
import type { StrapiAirport } from '@/lib/strapi';
import { airportPath, airportSlug, preferredAirportSlug, slugifyAirportPart } from '@/lib/airport-slugs';
import { airportInfoAddress, getAirportInfoByCode } from '@/lib/airport-info';
import {
  DEFAULT_OG_IMAGE,
  SITE_URL,
  airportIsSubstantive,
  airportIsPublished,
  airportIntro,
  airportFaqs,
  airportJsonLd,
  articleBlogPostingJsonLd,
  faqJsonLd,
  robotsFor,
  summariseRoutes,
  AIRPORTS_INDEXABLE,
} from '@/lib/entity-seo';
import type { RouteSummary } from '@/lib/entity-seo';
import { getAirportWeather, weatherLabel } from '@/lib/open-meteo';
import { JsonLd, FaqSection } from '@/components/SeoBlocks';
import OutboundCitations from '@/components/OutboundCitations';
import ComparisonTable from '@/components/ComparisonTable';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import type { Metadata } from 'next';
import topAirportSources from '@/data/airport-sources/top-100-official-links.json';
import { clampDescription, compactTitle } from '@/lib/seo';

export const revalidate = 60;

type Props = { params: Promise<{ iata: string }> };

type AirportSourceLinks = {
  officialWebsiteUrl?: string | null;
  wikipediaUrl?: string | null;
  wikidataUrl?: string | null;
  sourceNotes?: string | null;
};

const TOP_AIRPORT_SOURCES = topAirportSources as Record<string, AirportSourceLinks>;

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

async function findAirportByCodeOrSlug(
  slugOrCode: string,
  allAirports: Pick<StrapiAirport, 'iata' | 'city' | 'name'>[],
): Promise<StrapiAirport | null> {
  const normalized = slugOrCode.toLowerCase();
  if (/^[a-z]{3}$/.test(normalized)) return getAirport(slugOrCode);

  const slugCounts = new Map<string, number>();
  for (const airport of allAirports) {
    const base = slugifyAirportPart(airport.city || airport.name || airport.iata);
    if (base) slugCounts.set(base, (slugCounts.get(base) || 0) + 1);
  }

  for (const airport of allAirports) {
    const preferredSlug = preferredAirportSlug(airport.iata);
    if (preferredSlug === normalized) return getAirport(airport.iata);

    const base = slugifyAirportPart(airport.city || airport.name || airport.iata);
    const resolvedSlug = slugCounts.get(base)! > 1 ? `${base}-${airport.iata.toLowerCase()}` : base;
    if (resolvedSlug === normalized) return getAirport(airport.iata);
  }

  // Fallback: match by city/name base slug if request omitted the -iata suffix (e.g. /airports/tokyo, /airports/singapore)
  // so the page component can redirect cleanly to its canonical URL rather than returning 404.
  for (const airport of allAirports) {
    const base = slugifyAirportPart(airport.city || airport.name || airport.iata);
    if (base === normalized) return getAirport(airport.iata);
  }

  return getAirport(slugOrCode);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { iata } = await params;
  const allAirports = await listAirportSlugIndex().catch(() => []);
  const a = await findAirportByCodeOrSlug(iata, allAirports);
  if (!a) return { title: 'Airport not found', robots: { index: false, follow: false } };
  const routes = await listRoutesFromAirport(a.iata, 1).catch(() => []);
  const hero = airportHeroImage(a.iata, mediaUrl(a.heroImage ?? null));
  const metaTitle = compactTitle(`${a.name} (${a.iata}) airport guide`);
  const description = clampDescription(
    a.about ||
      `${a.name} (${a.iata})${a.city ? ` in ${a.city}` : ''}${a.country ? `, ${a.country}` : ''}: codes, location, airlines, top destinations, terminal notes and ground-transfer basics.`,
  );
  return {
    title: metaTitle,
    description,
    alternates: { canonical: `${SITE_URL}${airportPath(a, allAirports)}` },
    openGraph: {
      title: metaTitle,
      description,
      type: 'article',
      url: `${SITE_URL}${airportPath(a, allAirports)}`,
      images: hero
        ? [{ url: absoluteUrl(hero), width: 1024, height: 576, alt: `${a.name} airport guide` }]
        : [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Originfacts' }],
    },
    twitter: {
      card: 'summary_large_image',
      images: [hero ? absoluteUrl(hero) : DEFAULT_OG_IMAGE],
    },
    robots: robotsFor((AIRPORTS_INDEXABLE || airportIsPublished(a.iata)) && airportIsSubstantive(a, routes.length > 0)),
  };
}

export default async function AirportPage({ params }: Props) {
  const { iata } = await params;
  const allAirports = await listAirportSlugIndex().catch(() => []);
  const airport = await findAirportByCodeOrSlug(iata, allAirports);
  if (!airport) notFound();
  const canonicalPath = airportPath(airport, allAirports);
  if (iata.toLowerCase() !== airportSlug(airport, allAirports)) redirect(canonicalPath);

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
  const url = `${SITE_URL}${canonicalPath}`;
  const nearby = sameCountry.filter((a) => a.iata && a.iata !== airport.iata).slice(0, 9);
  const faqs = airportFaqs(airport, summary, {
    icao: airportInfo?.icao,
    city: airportInfo?.city,
    country: airportInfo?.country,
    phone: airportInfo?.phone,
    website: airportInfo?.website,
    address: airportInfoAddress(airportInfo),
    nearbyCount: nearby.length,
  });

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
  const narrativeSections = buildAirportNarrativeSections(airport, summary, proseSections, transportSection);
  const airportGuide = buildAirportGuide(airport, summary, transportSection);
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
  const discoveredSourceLinks = TOP_AIRPORT_SOURCES[airport.iata.toUpperCase()];
  const officialPlanningGuide = buildOfficialPlanningGuide(airport, {
    website: discoveredSourceLinks?.officialWebsiteUrl || (websiteValue ? normaliseUrl(websiteValue) : null),
    map: mapHref,
    wikipedia: discoveredSourceLinks?.wikipediaUrl || null,
    wikidata: discoveredSourceLinks?.wikidataUrl || null,
    sourceNotes: discoveredSourceLinks?.sourceNotes || null,
  });
  const sectionLinks = [
    { href: '#overview', label: 'Overview' },
    { href: '#practical-guide', label: 'Practical guide' },
    ...(officialPlanningGuide ? [{ href: '#official-planning', label: 'Official planning' }] : []),
    ...(summary.carriers.length > 0 ? [{ href: '#airlines', label: 'Airlines' }] : []),
    { href: '#routes', label: 'Routes' },
    ...(nearby.length > 0 ? [{ href: '#nearby-airports', label: 'Nearby airports' }] : []),
    { href: '#faq', label: 'FAQ' },
  ];

  const articleSchema = articleBlogPostingJsonLd({
    headline: `${airport.name} (${airport.iata}) Airport Guide`,
    description: airport.about || heroSummary,
    url,
    image: hero,
    authorNameOrSlug: 'elena-rostova',
    categoryName: 'Airports',
    type: 'BlogPosting',
  });

  return (
    <article data-testid={`airport-page-${airport.iata}`}>
      <JsonLd data={articleSchema} />
      <JsonLd data={airportJsonLd(airport, url)} />
      <JsonLd data={faqJsonLd(faqs)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Airports', url: '/airports' },
          { name: `${airport.name} (${airport.iata})`, url: airportPath(airport, [airport]) },
        ])}
      />

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
          <img src={hero} alt={airport.name} className="h-[550px] w-full object-cover" />
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
          <h1 className="editorial-h mt-3 max-w-4xl text-3xl font-bold leading-tight sm:text-5xl" style={{ color: '#ffffff' }}>
            {airport.name}
          </h1>
          <p className="mt-4 w-full text-sm font-light leading-relaxed sm:text-base" style={{ color: '#ffffff' }}>
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
              <h2 className="editorial-h text-lg font-bold text-forest-900">What are key facts about {airport.name} ({airport.iata})?</h2>
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
                    <h2 className="editorial-h text-lg font-bold text-forest-900">What is the local weather at {airport.name}?</h2>
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

      {airportGuide && (
        <section
          id="practical-guide"
          className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6"
          data-testid="airport-practical-guide"
        >
          <div className="rounded-[0.3rem] border border-forest-900/10 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <header className="border-b border-forest-900/10 bg-gradient-to-br from-white via-paper to-sand-100/70 px-6 py-7 lg:px-8">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1fr)]">
                <div>
                <p className="flex items-center gap-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-forest-900/62">
                  <span className="inline-block h-px w-8 bg-forest-800/45" />
                  Practical guide
                </p>
                <h2 className="editorial-h mt-3 max-w-3xl text-2xl font-bold leading-tight text-forest-950 lg:text-3xl">
                  How do you navigate {airport.name} without guesswork?
                </h2>
                <p className="mt-4 max-w-3xl text-sm font-light leading-7 text-forest-900/76">
                  Plan {airport.iata} around the terminal you use, the type of connection you are making and how predictable you need the trip{airport.city ? ` into ${airport.city}` : ''} to be.
                </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {airportGuide.terminals.map((terminal, index) => (
                    <div
                      key={terminal.name}
                      className="relative rounded-[0.3rem] border border-forest-900/10 bg-white/80 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-[0.3rem] bg-forest-900 font-mono text-[11px] font-bold text-sand-100">
                          {index + 1}
                        </span>
                        <div>
                          <div className="font-mono text-xs font-bold tracking-[0.18em] text-forest-950">
                            {terminal.name}
                          </div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-forest-900/55">
                            {terminal.name === 'T1' ? 'International' : terminal.name === 'Plan' ? 'Start here' : terminal.name === 'Check' ? 'Details' : 'Transfer'}
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-3 text-xs leading-5 text-forest-900/68">{terminal.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </header>

            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)] lg:p-8">
              <div
                className="rounded-[0.3rem] border border-forest-900/10 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                style={{ backgroundColor: '#ffffff' }}
              >
                <h3 className="font-urbanist text-xl font-bold text-forest-900">What should you check before leaving for {airport.iata}?</h3>
                <ol className="mt-5 space-y-4 text-sm leading-6">
                  {airportGuide.checklist.map((item, index) => (
                    <li key={item} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-[0.3rem] bg-forest-900 font-mono text-[11px] font-bold text-sand-100">
                        {index + 1}
                      </span>
                      <span className="pt-1 text-forest-900/78">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-[0.3rem] border border-forest-900/10 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-forest-900/50">
                  Start here
                </p>
                <h3 className="mt-2 font-urbanist text-xl font-bold text-forest-900">
                  How do terminal transfers work at {airport.iata}?
                </h3>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {airportGuide.terminals.map((terminal) => (
                    <div key={terminal.name} className="rounded-[0.3rem] bg-forest-900/[0.04] p-4">
                      <div className="font-mono text-xs font-bold tracking-[0.18em] text-forest-900/55">
                        {terminal.name}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-forest-900/78">{terminal.body}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 border-t border-forest-900/10 pt-4 text-sm font-light leading-7 text-forest-900/78">
                  {airportGuide.transferNote}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {airlineCards.length > 0 && (
        <section id="airlines" className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6" data-testid="airport-airlines">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-forest-900/10 pb-3">
            <div>
              <p className="section-eyebrow">
                <span className="inline-block h-px w-8 bg-forest-800/60" />
                Airlines
              </p>
              <h2 className="editorial-h mt-3 text-xl font-bold text-forest-900 lg:text-2xl">
                Which airlines fly from {airport.iata}?
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-light leading-7 text-forest-900/70">
                Compare the carriers connected with {airport.iata}, including airline codes, operating brands and routes currently tracked from this airport.
              </p>
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
            <h2 className="editorial-h mt-3 text-2xl font-bold text-2xl">
              Which top routes depart from {airport.iata}?
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-light leading-7 text-forest-900/70">
              Use these route cards to scan popular destinations, estimated distance and flight time before checking live schedules and fares.
            </p>
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

      {officialPlanningGuide && (
        <section
          id="official-planning"
          className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6"
          data-testid="airport-official-planning"
        >
          <header className="border-b border-forest-900/10 pb-4">
            <p className="section-eyebrow">
              <span className="inline-block h-px w-8 bg-forest-800/60" />
              Official planning details
            </p>
            <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <h2 className="editorial-h text-2xl font-bold text-2xl">
                How do transfers, parking and passenger services work at {airport.iata}?
              </h2>
              <p className="text-sm font-light leading-7 text-forest-900/70">
                A source-linked planning layer for details that can change: terminal transfers, transport costs, parking, lounges and accessibility.
              </p>
            </div>
          </header>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {officialPlanningGuide.cards.map((card) => (
              <article
                key={card.title}
                className="rounded-[0.3rem] border border-forest-900/10 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-urbanist text-lg font-bold leading-snug text-forest-900">{card.title}</h3>
                  <span className="rounded-[0.3rem] bg-forest-900/[0.06] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-forest-900/58">
                    {card.label}
                  </span>
                </div>
                <p className="mt-3 text-sm font-light leading-7 text-forest-900/78">{card.body}</p>
                <a
                  href={card.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-4 inline-flex text-sm font-semibold text-primary-emphasis underline-offset-4 hover:underline"
                >
                  {card.linkText}
                </a>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="overflow-hidden rounded-[0.3rem] border border-forest-900/10 bg-gradient-to-br from-white via-sand-100/70 to-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-forest-900/50">
                    Budget check
                  </p>
                  <h3 className="mt-2 font-urbanist text-xl font-bold text-forest-900">What are key ground costs at {airport.iata}?</h3>
                </div>
                <p className="max-w-sm text-sm font-light leading-6 text-forest-900/68">
                  Prices can change, so use these notes to spot likely cost items before checking the official source.
                </p>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {officialPlanningGuide.costNotes.map((note, index) => (
                  <div
                    key={note.title}
                    className="rounded-[0.3rem] border border-forest-900/10 bg-white/82 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-[0.3rem] bg-forest-900 font-mono text-[11px] font-bold text-sand-100">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-forest-900/60">
                        {note.title}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-forest-900/78">{note.body}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <ComparisonTable
                  caption={`Airport Express Train vs Taxi vs Rideshare: Ground Transport at ${airport.name} (${airport.iata})`}
                  head={['Transit Option', 'Est. Travel Time', 'Typical Cost Range', 'Service Frequency', 'Best For']}
                  rows={[
                    ['Airport Express Train / Rail', '15 - 30 mins', 'Moderate (A$15 - A$25)', 'Every 10 - 15 mins', 'Avoiding road traffic & peak hour speed'],
                    ['Taxi / Licensed Meter Cab', '25 - 45 mins', 'Higher (A$45 - A$75+)', 'Immediate at ranks', 'Door-to-door & heavy luggage'],
                    ['App Rideshare (Uber/Ola)', '25 - 45 mins', 'Variable (A$40 - A$70)', 'On-demand via app', 'Direct hotel transfer'],
                    ['Public Bus / Airport Shuttle', '35 - 60 mins', 'Lowest (A$4 - A$12)', 'Every 20 - 30 mins', 'Budget solo travellers'],
                  ]}
                />
              </div>
            </div>

            <aside
              className="rounded-[0.3rem] border border-forest-900/10 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              style={{ backgroundColor: '#ffffff' }}
            >
              <h3 className="font-urbanist text-xl font-bold text-forest-900">Which official data sources support this guide?</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6">
                {officialPlanningGuide.sources.map((source) => (
                  <li key={source.href}>
                    <a
                      href={source.href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-forest-900/76 underline-offset-4 hover:text-primary-emphasis hover:underline"
                    >
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>
      )}

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
              <h2 className="editorial-h mt-3 text-2xl font-bold text-2xl">
                Which other airports are located in {airport.country}?
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-light leading-7 text-forest-900/70">
                Nearby airport options can help when comparing fares, connection times, ground transport and alternate arrival points in {airport.country || 'the region'}.
              </p>
            </div>
            <span className="text-sm font-light text-forest-900/50">
              Compare alternate arrival points
            </span>
          </header>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {nearby.map((a) => {
              const airportImage = mediaUrl(a.heroImage ?? null);
              return (
                <Link
                  key={a.id}
                  href={airportPath(a, allAirports)}
                  className="group overflow-hidden rounded-[0.3rem] border border-forest-900/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm"
                >
                  <div className="relative h-32 bg-forest-900/[0.06]">
                    {airportImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={airportImage}
                        alt={a.city ? `${a.name} in ${a.city}` : a.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-forest-950 via-forest-800 to-forest-700">
                        <span className="font-mono text-2xl font-bold tracking-[0.2em] text-sand-100">
                          {a.iata}
                        </span>
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-[0.3rem] bg-forest-950/90 px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider text-sand-100">
                      {a.iata}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="truncate font-urbanist text-base font-bold text-forest-900 group-hover:text-forest-700">
                      {a.city || a.name}
                    </div>
                    <div className="mt-1 line-clamp-2 min-h-[2rem] text-xs leading-5 text-forest-900/60">
                      {a.name}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div id="faq" className="scroll-mt-28">
        <FaqSection faqs={faqs} title={`${airport.name} — frequently asked questions`} />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <OutboundCitations category="airports" title={`${airport.name} (${airport.iata}) — Aviation Authorities & Primary Data Sources`} />
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

function buildAirportGuide(
  airport: StrapiAirport,
  summary: RouteSummary,
  transportSection?: AboutSection,
) {
  const code = airport.iata.toUpperCase();
  const city = airport.city || airport.name;
  const country = airport.country ? `, ${airport.country}` : '';
  const trackedNetwork =
    summary.destinationCount > 0
      ? `Originfacts currently tracks ${summary.destinationCount} route${summary.destinationCount === 1 ? '' : 's'} from ${code}${summary.countryCount > 1 ? ` across ${summary.countryCount} countries` : ''}.`
      : `Originfacts is still expanding route coverage from ${code}.`;
  const terminalSummary =
    transportSection?.paragraphs?.[0]
      ?.replace(/\s+/g, ' ')
      .slice(0, 220) ||
    `Use the official airport and airline information for ${code} to confirm the correct terminal, check-in area and transfer process before travel.`;

  return {
    cards: [
      {
        title: 'Best for arrivals',
        body:
          `${airport.name} serves ${city}${country}. Before landing, check the arrival terminal, baggage-claim process and onward transport options so the airport-to-city transfer is part of the plan rather than a last-minute decision.`,
      },
      {
        title: 'Best for connections',
        body:
          `If you are connecting through ${code}, compare the terminals, baggage rules and ticket type. Separate tickets usually need more time because you may have to collect bags, check in again and clear security a second time.`,
      },
      {
        title: `Ground transport${airport.city ? ` into ${airport.city}` : ''}`,
        body:
          `Ground transport times around ${airport.name} can vary by time of day, weather and local traffic. Compare rail, bus, taxi, rideshare and private-transfer options against your luggage, arrival time and final address.`,
      },
      {
        title: 'When to arrive',
        body:
          `For domestic flights from ${code}, leave enough time for baggage drop and security. For international flights, add more room for document checks, passport control and airline cut-off times.`,
      },
      {
        title: 'Route and airline context',
        body:
          `${trackedNetwork} Use the route cards below as a quick map of structured Originfacts coverage, then confirm live schedules and fares because frequencies can change by season.`,
      },
      {
        title: `Who ${code} works best for`,
        body:
          `${code} is most useful when it is the closest or best-connected airport for ${city}. Compare nearby airports when fares, connection times or ground transport costs are meaningfully different.`,
      },
    ],
    terminals: [
      {
        name: 'Plan',
        body: `Confirm whether your flight uses a domestic, international or regional area at ${code}. Airport layouts vary, and terminal assumptions are a common source of missed connections.`,
      },
      {
        name: 'Check',
        body: terminalSummary,
      },
      {
        name: 'Move',
        body: 'Leave extra time when changing terminals, travelling with checked luggage, or arriving during busy morning, evening, holiday or event periods.',
      },
    ],
    transferNote:
      `For ${airport.name}, the safest connection plan is based on the operating airline, the terminal shown on your booking and whether your baggage is checked through. If the itinerary uses separate tickets, choose a larger buffer.`,
    checklist: [
      `Confirm the terminal and operating airline before leaving for ${code}.`,
      'Check baggage cut-off times if you are travelling with checked luggage.',
      'Leave extra time for international processing or terminal changes.',
      'Compare ground transport options against traffic and arrival time.',
      'Recheck the flight status before travelling to the airport.',
    ],
  };
}

function buildAirportNarrativeSections(
  airport: StrapiAirport,
  summary: RouteSummary,
  proseSections: AboutSection[],
  transportSection?: AboutSection,
): AboutSection[] {
  const code = airport.iata.toUpperCase();
  const city = airport.city || airport.name;
  const country = airport.country || 'the surrounding region';
  const routeList = summary.destinationNames.slice(0, 5).join(', ');
  const carrierList = summary.carriers.slice(0, 5).map((carrier) => carrier.name).join(', ');
  const existingOverview = proseSections.find((section) => /overview/i.test(section.heading || ''))?.paragraphs?.[0];
  const existingAirlines = proseSections.find((section) => /airlines/i.test(section.heading || ''))?.paragraphs?.[0];
  const existingTransport = transportSection?.paragraphs?.[0];

  return [
    {
      heading: 'Overview',
      paragraphs: [
        existingOverview ||
          `${airport.name} (${code}) serves ${city}${airport.country ? `, ${airport.country}` : ''} and is an important airport for travellers planning flights in and out of ${country}. Use this page to compare the airport code, location, route coverage, airlines, nearby airports and practical planning details in one place.`,
        `${airport.name} is most useful when its route network, ground transport and terminal setup match the trip you are taking. Before booking, compare the scheduled departure time with the airport location, connection window and any baggage or check-in requirements attached to your airline.`,
      ],
    },
    {
      heading: 'Airlines',
      paragraphs: [
        existingAirlines ||
          (carrierList
            ? `Airlines tracked on routes from ${code} include ${carrierList}${summary.carrierCount > 5 ? ' and others' : ''}. Carrier availability can vary by season, so use the airline list and route cards as a starting point before checking live schedules.`
            : `Originfacts is still expanding airline coverage for ${code}. When comparing flights, check the operating airline, baggage rules, terminal information and connection terms before choosing an itinerary.`),
        `For any airport, the operating airline matters as much as the marketing airline shown in a search result. Codeshares, partner flights and regional affiliates can affect check-in desks, terminal use, baggage handling and support if a flight is delayed or changed.`,
      ],
    },
    {
      heading: 'Terminals and Transfers',
      paragraphs: [
        existingTransport ||
          `${airport.name} may handle domestic, international, regional or mixed operations depending on the airlines and routes available at ${code}. Always confirm the terminal or check-in area with the operating airline before travel.`,
        `Connections through ${code} need more planning when flights are on separate tickets, when checked baggage is involved, or when the itinerary changes between domestic and international processing. Build a wider buffer if you need to collect bags, move between terminals or pass through security again.`,
      ],
    },
    {
      heading: 'Ground Transport and Trip Planning',
      paragraphs: [
        `${airport.name} ground transport should be planned around your arrival time, luggage and final destination. Public transport can be efficient where available, while taxis, rideshare and private transfers may be easier for late arrivals, families or travellers with multiple bags.`,
        routeList
          ? `If you are choosing between airports or routes, compare ${code} against the destinations currently tracked from this airport, including ${routeList}. The best itinerary is not always the cheapest one if it creates a difficult transfer, a tight connection or a long onward journey.`
          : `If you are choosing between airports, compare ${code} against nearby alternatives, total ground-transport cost and the reliability of the connection. A slightly higher fare can be worthwhile when it reduces transfer risk or shortens the total journey.`,
      ],
    },
  ];
}

function buildOfficialPlanningGuide(
  airport: StrapiAirport,
  links: {
    website: string | null;
    map: string | null;
    wikipedia?: string | null;
    wikidata?: string | null;
    sourceNotes?: string | null;
  },
) {
  if (airport.iata.toUpperCase() === 'SYD') return buildSydneyOfficialPlanningGuide(links);

  const code = airport.iata.toUpperCase();
  const city = airport.city || airport.name;
  const officialHref = links.website || links.map || airportPath(airport);
  const sourceLinks = uniqueLinks([
    ...(links.website ? [{ label: `${airport.name} official website`, href: links.website }] : []),
    ...(links.map ? [{ label: `${airport.name} map location`, href: links.map }] : []),
    ...(links.wikipedia ? [{ label: `${airport.name} Wikipedia background`, href: links.wikipedia }] : []),
    ...(links.wikidata ? [{ label: `${airport.name} Wikidata record`, href: links.wikidata }] : []),
  ]);

  return {
    cards: [
      {
        title: 'Terminal transfer links',
        label: 'Transfers',
        body:
          `${airport.name} transfer details can depend on airline, terminal, baggage handling and whether flights are booked on one ticket. Check the operating airline and airport website before relying on a tight connection at ${code}.`,
        href: officialHref,
        linkText: 'Check airport transfer information',
      },
      {
        title: 'Transport fares and local access',
        label: 'Fares',
        body:
          `Transport costs to and from ${city} can vary by public transport, taxi, rideshare, private transfer, tolls and time of day. Confirm current fares before travelling, especially for late arrivals or peak periods.`,
        href: officialHref,
        linkText: 'Review transport information',
      },
      {
        title: 'Parking and pre-booking',
        label: 'Parking',
        body:
          `Parking at ${airport.name} may vary by terminal, short-stay area, long-stay area and online booking rules. Compare official parking options with drop-off, pick-up and ground transport before choosing how to reach the airport.`,
        href: officialHref,
        linkText: 'Review airport parking options',
      },
      {
        title: 'Lounges and eligibility',
        label: 'Lounges',
        body:
          `Lounge availability at ${code} depends on airline, cabin, alliance status, membership or paid-entry rules. Check the operating airline before travel because access rules and opening hours can change.`,
        href: officialHref,
        linkText: 'Check lounge information',
      },
      {
        title: 'Accessibility and assistance',
        label: 'Access',
        body:
          `Passengers needing mobility, sensory, medical or other assistance should confirm airport facilities and arrange airline assistance before travel. Airline-provided help is usually requested through the airline or booking channel.`,
        href: officialHref,
        linkText: 'Review accessibility information',
      },
      {
        title: 'Terminal and parking maps',
        label: 'Maps',
        body:
          `Maps are useful for finding check-in areas, arrivals paths, parking locations and ground transport pick-up points at ${airport.name}. Confirm the terminal before leaving for the airport.`,
        href: links.map || officialHref,
        linkText: 'Open airport map',
      },
    ],
    costNotes: [
      {
        title: 'Transport',
        body:
          `Public transport, taxi, rideshare and private-transfer prices around ${code} can change by time, distance, demand and local fees.`,
      },
      {
        title: 'Parking',
        body:
          'Parking prices often vary by car park, stay length and whether online pre-booking is available.',
      },
      {
        title: 'Extras',
        body:
          'Seat selection, baggage, lounge access, tolls and late-night transport can change the real cost of a trip.',
      },
    ],
    sources:
      sourceLinks.length > 0
        ? sourceLinks
        : [{ label: `${airport.name} airport page`, href: airportPath(airport) }],
  };
}

function buildSydneyOfficialPlanningGuide(links?: {
  website: string | null;
  map: string | null;
  wikipedia?: string | null;
  wikidata?: string | null;
}) {
  return {
    cards: [
      {
        title: 'Terminal transfer links',
        label: 'Transfers',
        body:
          'Sydney Airport separates T1 International from the domestic terminals, so travellers connecting between international and domestic flights should check the current transfer process before booking a tight connection.',
        href: 'https://www.sydneyairport.com.au/info-sheet/get-to-your-next-flight',
        linkText: 'Check terminal transfer guidance',
      },
      {
        title: 'Transport fares and station access',
        label: 'Fares',
        body:
          'Transport for NSW lists airport station access fees in addition to the regular train fare. It also notes separate flat access fees for travel between airport stations, Mascot and Green Square.',
        href: 'https://transportnsw.info/travel-info/airport-travel/getting-to-from-sydney-airport',
        linkText: 'View Transport NSW airport fares',
      },
      {
        title: 'Parking and pre-booking',
        label: 'Parking',
        body:
          'Sydney Airport promotes online pre-booking for official parking and lists car parks within walking distance of terminals or a short bus trip away for Blu Emu. Accessible parking is also covered in official airport guidance.',
        href: 'https://www.sydneyairport.com.au/parkatsyd',
        linkText: 'Review official parking options',
      },
      {
        title: 'Lounges and eligibility',
        label: 'Lounges',
        body:
          'Lounge access depends on airline, cabin, status or paid-entry rules. Sydney Airport lists lounges across T1, T2 and T3, including airline lounges and selected pay-to-use options.',
        href: 'https://www.sydneyairport.com.au/info-sheet/airline-lounges-t1',
        linkText: 'See Sydney Airport lounges',
      },
      {
        title: 'Accessibility and assistance',
        label: 'Access',
        body:
          'Sydney Airport publishes accessible facilities, adult change facility locations and accessible parking information. Airline-provided assistance should be arranged directly with the airline before travel.',
        href: 'https://www.sydneyairport.com.au/assistance',
        linkText: 'Read accessibility assistance details',
      },
      {
        title: 'Terminal and parking maps',
        label: 'Maps',
        body:
          'Official terminal and parking maps are useful for checking check-in areas, arrivals paths, parking locations and transfer movement before arriving at the airport.',
        href: 'https://www.sydneyairport.com.au/info-sheet/maps',
        linkText: 'Open official airport maps',
      },
    ],
    costNotes: [
      {
        title: 'Train access',
        body:
          'Airport station trips include an access fee on top of the normal train fare. Confirm the latest amount before travel because fares can change.',
      },
      {
        title: 'Taxi and rideshare',
        body:
          'Sydney Airport states the CBD is usually about a 20-minute ride and estimates taxi or rideshare at about A$45-A$55 one way, depending on traffic and demand.',
      },
      {
        title: 'Parking',
        body:
          'Official parking prices vary by car park, stay length and whether you pre-book. Sydney Airport advertises savings for online pre-booking.',
      },
    ],
    sources: uniqueLinks([
      {
        label: 'Sydney Airport terminal transfers',
        href: 'https://www.sydneyairport.com.au/info-sheet/get-to-your-next-flight',
      },
      {
        label: 'Sydney Airport transport options',
        href: 'https://www.sydneyairport.com.au/info-sheet/transport-options',
      },
      {
        label: 'Transport NSW airport travel and access fees',
        href: 'https://transportnsw.info/travel-info/airport-travel/getting-to-from-sydney-airport',
      },
      {
        label: 'Sydney Airport parking',
        href: 'https://www.sydneyairport.com.au/parkatsyd',
      },
      {
        label: 'Sydney Airport lounges',
        href: 'https://www.sydneyairport.com.au/info-sheet/airline-lounges-t1',
      },
      {
        label: 'Sydney Airport accessibility assistance',
        href: 'https://www.sydneyairport.com.au/assistance',
      },
      {
        label: 'Sydney Airport maps',
        href: 'https://www.sydneyairport.com.au/info-sheet/maps',
      },
      ...(links?.wikipedia ? [{ label: 'Sydney Airport Wikipedia background', href: links.wikipedia }] : []),
      ...(links?.wikidata ? [{ label: 'Sydney Airport Wikidata record', href: links.wikidata }] : []),
    ]),
  };
}

function uniqueLinks<T extends { href: string }>(links: T[]): T[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = link.href.replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
