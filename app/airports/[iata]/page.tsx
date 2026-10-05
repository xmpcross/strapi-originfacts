import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import {
  getAirport,
  listAirportSlugIndex,
  listRoutesFromAirport,
  countRoutesFromAirport,
  listAirports,
  listDestinations,
  listAirlines,
  mediaUrl,
} from '@/lib/strapi';
import type { StrapiAirline, StrapiAirport, StrapiRoute } from '@/lib/strapi';
import { operableCarriers } from '@/lib/route-carriers';
import { airportPath, airportSlug, preferredAirportSlug, slugifyAirportPart } from '@/lib/airport-slugs';
import {
  buildEnrichmentView as buildEnrichmentViewFromData,
  enrichmentMetaFacts,
  getAirportEnrichment,
  type AirportEnrichment,
  type AirportEnrichmentView,
} from '@/lib/airport-enrichment';
import { enrichmentFaqs, type EnrichmentFaqInput } from '@/components/airport-v2/enrichment-faqs';
import {
  DEFAULT_OG_IMAGE,
  SITE_URL,
  airportIsPublished,
  airportIntro,
  airportFaqs,
  airportJsonLd,
  entityWebPageJsonLd,
  faqJsonLd,
  robotsFor,
  summariseRoutes,
  AIRPORTS_INDEXABLE,
} from '@/lib/entity-seo';
import type { RouteSummary } from '@/lib/entity-seo';
import { resolveAuthor } from '@/lib/authors';
import { getAirportWeather } from '@/lib/met-weather';
import { formatLocalTime, MET_ATTRIBUTION, weatherLabel } from '@/lib/met-symbols';
import { JsonLd, FaqSection } from '@/components/SeoBlocks';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import type { Metadata } from 'next';
import topAirportSources from '@/data/airport-sources/top-100-official-links.json';
import { buildMetaDescription, compactTitle } from '@/lib/seo';
import { airportUsesTemplateV2 } from '@/lib/airport-template-v2';
import AirportGuideV2, { formatCoordinates, formatDate, routeVintage } from '@/components/airport-v2/AirportGuideV2';
import { airportGuideV2Faqs } from '@/components/airport-v2/faqs';
import { getAirportGuide } from '@/lib/airport-guide';
import { airportIsIndexable } from '@/lib/airport-index-gate';
import { airportCityPhoto, airportV2MetaDescription, splitCeasedAirlines } from '@/lib/airport-v2';

export const revalidate = 60;

// An empty list opts the route into on-demand ISR: each page renders on its
// first request and is then cached and revalidated, instead of rendering on
// every request (it was served `private, no-store`).
export async function generateStaticParams() {
  return [];
}

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
    const code = airport.iata.toLowerCase();
    // Mirrors airportSlug(): duplicate city slugs and 3-letter city slugs that
    // are not the airport's own code both take an -iata suffix.
    const resolvedSlug =
      slugCounts.get(base)! > 1 || (/^[a-z]{3}$/.test(base) && base !== code) ? `${base}-${code}` : base;
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
  // "X Airport (IATA) guide" — not "X Airport (IATA) airport guide".
  const metaTitle = compactTitle(
    /\b(airport|airfield|aerodrome|airstrip)\b/i.test(a.name) ? `${a.name} (${a.iata}) guide` : `${a.name} Airport (${a.iata}) guide`,
  );
  // v2 pages describe themselves from the fields they show; the CMS `about`
  // text is unsourced and is not shown on them. The older layout keeps its
  // description unchanged.
  const description = airportUsesTemplateV2(airportSlug(a, allAirports))
    ? buildMetaDescription([airportV2MetaDescription(v2MetaInput(a, routes.length > 0, getAirportEnrichment(a.iata)))])
    : buildMetaDescription([
        a.about,
        `${a.name} (${a.iata})${a.city ? ` in ${a.city}` : ''}${a.country ? `, ${a.country}` : ''}: codes, location, airlines, top destinations, terminal notes and ground-transfer basics.`,
      ]);
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
    robots: robotsFor((AIRPORTS_INDEXABLE || airportIsPublished(a.iata)) && airportIsIndexable(a, routes.length > 0)),
  };
}

export default async function AirportPage({ params }: Props) {
  const { iata } = await params;
  const allAirports = await listAirportSlugIndex().catch(() => []);
  const airport = await findAirportByCodeOrSlug(iata, allAirports);
  if (!airport) notFound();
  const canonicalPath = airportPath(airport, allAirports);
  if (iata.toLowerCase() !== airportSlug(airport, allAirports)) permanentRedirect(canonicalPath);

  const [routes, everyAirport, destinations, siteAirlines] = await Promise.all([
    listRoutesFromAirport(airport.iata, 15).catch(() => []),
    listAirports().catch(() => []),
    listDestinations().catch(() => []),
    listAirlines().catch(() => []),
  ]);
  // Fallback identity/location fields from OurAirports (public domain), joined
  // by ICAO (lib/airport-enrichment-joins.mjs). Replaces the paid RapidAPI
  // airport-info lookup; OurAirports has no street address or phone number.
  const enrichment = getAirportEnrichment(airport.iata);
  const oa = enrichment.oa;
  const airportInfo = oa
    ? {
        icao: oa.icao,
        city: oa.municipality,
        country: undefined as string | undefined,
        latitude: oa.lat,
        longitude: oa.lon,
        website: oa.homeLink,
        phone: undefined as string | undefined,
      }
    : null;
  // OurAirports coordinates are precise; the record's are rounded and in some
  // cases point at the city or a predecessor site.
  const weatherLatitude = oa?.lat ?? airport.latitude;
  const weatherLongitude = oa?.lon ?? airport.longitude;
  const airportWeather = await getAirportWeather({
    latitude: weatherLatitude,
    longitude: weatherLongitude,
    elevationFt: oa?.elevationFt,
    timeZone: airport.timezone,
  });

  const summary = summariseRoutes(routes, 'destination');
  const hero = airportHeroImage(airport.iata, mediaUrl(airport.heroImage ?? null));
  const url = `${SITE_URL}${canonicalPath}`;
  const nearby = nearestAirports(airport, everyAirport, 9);
  const countryDestination = destinations.find(
    (d) => d.type === 'country' && d.countryCode && airport.countryCode && d.countryCode.toLowerCase() === airport.countryCode.toLowerCase(),
  );
  const cityDestination = airport.city
    ? destinations.find(
        (d) =>
          d.type === 'city' &&
          d.name.toLowerCase() === airport.city!.toLowerCase() &&
          (!d.countryCode || !airport.countryCode || d.countryCode.toLowerCase() === airport.countryCode.toLowerCase()),
      )
    : undefined;
  const faqs = airportFaqs(airport, summary, {
    icao: airportInfo?.icao,
    city: airportInfo?.city,
    country: airportInfo?.country,
    phone: airportInfo?.phone,
    website: airportInfo?.website,
    address: null,
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
    
    { label: 'Phone', value: airportInfo?.phone },
    { label: 'Website', value: airportInfo?.website },
  ];

  const heroSummary = airportIntro(airport, summary);
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

  const articleSchema = entityWebPageJsonLd({
    name: `${airport.name} (${airport.iata}) Airport Guide`,
    description: airport.about || heroSummary,
    url,
    image: hero,
    author: await resolveAuthor(),
    mainEntity: { '@id': `${url}#airport` },
  });

  const breadcrumbTrail = [
    { name: 'Airports', url: '/airports' },
    ...(countryDestination ? [{ name: countryDestination.name, url: `/destinations/${countryDestination.slug}` }] : []),
    ...(cityDestination ? [{ name: cityDestination.name, url: `/destinations/${cityDestination.slug}` }] : []),
  ];

  // v2 template (lib/airport-template-v2.ts). Same data, robots, canonical and
  // airport/breadcrumb JSON-LD as below. Differs in layout, FAQ (built from the
  // facts the v2 page shows), WebPage description (no CMS `about`), the
  // airline list (ceased carriers left out) and the route-count framing.
  if (airportUsesTemplateV2(airportSlug(airport, allAirports))) {
    // OurAirports coordinates first (precise, ICAO-joined), then the record's.
    const v2Coordinates =
      typeof oa?.lat === 'number' && typeof oa?.lon === 'number'
        ? { lat: oa.lat, lon: oa.lon, source: 'ourairports' as const }
        : typeof airport.latitude === 'number' && typeof airport.longitude === 'number'
          ? { lat: airport.latitude, lon: airport.longitude, source: 'record' as const }
          : null;
    const v2OfficialSite = discoveredSourceLinks?.officialWebsiteUrl
      ? { url: discoveredSourceLinks.officialWebsiteUrl, source: 'wikidata' as const }
      : enrichment.wd?.website
        ? { url: normaliseUrl(enrichment.wd.website), source: 'wikidata' as const }
        : oa?.homeLink
          ? { url: normaliseUrl(oa.homeLink), source: 'ourairports' as const }
          : null;
    // The record's ICAO is unknown to OurAirports (a superseded code): show
    // OurAirports' current code instead, marked with its source.
    const v2Airport = oa?.supersededIcao && oa.icao ? { ...airport, icao: undefined } : airport;
    const v2Info = {
      icao: airportInfo?.icao,
      city: airportInfo?.city,
      country: airportInfo?.country,
    };
    // Carriers Wikidata records as ceased are left out of the list, the counts,
    // the FAQ and its JSON-LD (joined on the route record's airline slug).
    const { operating: v2Airlines, ceased: v2CeasedRaw } = splitCeasedAirlines(airlineCards);
    const v2Ceased = v2CeasedRaw.map((a) => ({
      slug: a.slug,
      name: a.name,
      ceasedOn: a.ceased.ceasedOn,
      wikidata: a.ceased.wikidata.replace(/^http:\/\//i, 'https://'),
    }));
    const v2RouteCount = {
      tracked: routes.length ? await countRoutesFromAirport(airport.iata).catch(() => routes.length) : 0,
      shown: routes.length,
    };
    const v2CityPhoto = airportCityPhoto(cityDestination, (path) => mediaUrl({ url: path }) ?? path);
    const v2Description = airportV2MetaDescription(v2MetaInput(airport, routes.length > 0, enrichment));
    const v2Enrichment = buildEnrichmentView(enrichment, routes, siteAirlines, allAirports);
    const v2WebPageSchema = entityWebPageJsonLd({
      name: `${airport.name} (${airport.iata}) Airport Guide`,
      description: v2Description,
      url,
      // The page shows no airport image (the record's hero is generated); the
      // city photo is used when the page shows one, else the site default.
      image: v2CityPhoto?.src ?? null,
      author: await resolveAuthor(),
      mainEntity: { '@id': `${url}#airport` },
    });
    // Sourced terminals/transport content, where content/airport-guides has a file.
    const airportGuide = getAirportGuide(airport.iata);
    const v2Faqs = airportGuideV2Faqs({
      name: airport.name,
      iata: airport.iata,
      icao: v2Airport.icao || v2Info.icao,
      city: airport.city || v2Info.city,
      country: airport.country || v2Info.country,
      timezone: airport.timezone,
      coordinates: v2Coordinates ? formatCoordinates(v2Coordinates.lat, v2Coordinates.lon) : null,
      coordinatesSource: v2Coordinates?.source,
      officialSite: v2OfficialSite?.url,
      airlines: v2Airlines.map((a) => a.name),
      ceasedAirlines: v2Ceased.map((a) => a.name),
      routeCount: v2RouteCount,
      destinations: summary.destinationNames,
      countryCount: summary.countryCount,
      routeVintage: routeVintage(routes),
    }, [
      ...enrichmentFaqs(enrichmentFaqInput(airport, enrichment, v2Enrichment)),
      ...(airportGuide?.faqs ?? []).map((f) => ({ q: f.q, a: f.a })),
    ]);
    return (
      <>
        <JsonLd data={v2WebPageSchema} />
        <JsonLd data={airportJsonLd(airport, url)} />
        <JsonLd data={faqJsonLd(v2Faqs)} />
        <JsonLd data={breadcrumbJsonLd([...breadcrumbTrail, { name: `${airport.name} (${airport.iata})`, url: canonicalPath }])} />
        <AirportGuideV2
          airport={v2Airport}
          breadcrumb={breadcrumbTrail.map((b) => ({ name: b.name, href: b.url }))}
          routes={routes}
          airlines={v2Airlines}
          ceasedAirlines={v2Ceased}
          routeCount={v2RouteCount}
          cityPhoto={v2CityPhoto}
          countryCount={summary.countryCount}
          info={v2Info}
          officialSite={v2OfficialSite}
          wikipediaUrl={discoveredSourceLinks?.wikipediaUrl || enrichment.wd?.enwiki || oa?.wikipediaLink}
          wikidataUrl={discoveredSourceLinks?.wikidataUrl || (enrichment.wd ? `https://www.wikidata.org/wiki/${enrichment.wd.qid}` : null)}
          enrichment={v2Enrichment}
          coordinates={v2Coordinates}
          mapHref={mapHref}
          weather={airportWeather}
          nearby={nearby.map((a) => ({
            iata: a.iata,
            name: a.name,
            city: a.city,
            country: a.country,
            href: airportPath(a, allAirports),
            distanceKm: a.distanceKm,
          }))}
          faqs={v2Faqs}
          guide={airportGuide}
          related={[
            ...(cityDestination ? [{ label: `${cityDestination.name} travel guide`, href: `/destinations/${cityDestination.slug}` }] : []),
            ...(countryDestination ? [{ label: `${countryDestination.name} travel guide`, href: `/destinations/${countryDestination.slug}` }] : []),
            { label: 'Airport directory', href: '/airports' },
            { label: 'Top 100 airports', href: '/airports/top-100-airports' },
            { label: 'Flight routes', href: '/flight-routes' },
          ]}
        />
      </>
    );
  }

  return (
    <article data-testid={`airport-page-${airport.iata}`}>
      <JsonLd data={articleSchema} />
      <JsonLd data={airportJsonLd(airport, url)} />
      <JsonLd data={faqJsonLd(faqs)} />
      <JsonLd data={breadcrumbJsonLd([...breadcrumbTrail, { name: `${airport.name} (${airport.iata})`, url: canonicalPath }])} />

      <div className="mx-auto max-w-7xl px-6 pt-10">
        <nav className="text-xs uppercase tracking-widest text-forest-900/60">
          <Link href="/airports" className="hover:text-forest-900">Airports</Link>
          {countryDestination && (
            <>
              <span className="mx-2 text-forest-900/30">/</span>
              <Link href={`/destinations/${countryDestination.slug}`} className="hover:text-forest-900">
                {countryDestination.name}
              </Link>
            </>
          )}
          {cityDestination && (
            <>
              <span className="mx-2 text-forest-900/30">/</span>
              <Link href={`/destinations/${cityDestination.slug}`} className="hover:text-forest-900">
                {cityDestination.name}
              </Link>
            </>
          )}
          <span className="mx-2 text-forest-900/30">/</span>
          <span className="text-forest-900/80">{airport.iata}</span>
        </nav>
      </div>

      <header className="relative mx-auto mt-6 max-w-7xl overflow-hidden rounded-[0.3rem] border border-forest-900/10">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt={airport.name} className="h-[550px] w-full object-cover" fetchPriority="high" />
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
          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
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
                      <h3 className="text-xl font-bold text-forest-900">{section.heading}</h3>
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
                    {airportWeather.timeZone ? 'Local' : 'UTC'}
                  </span>
                </div>
                <div className="mt-5 flex items-end justify-between gap-4 border-b border-forest-900/10 pb-4">
                  <div>
                    <div className="text-4xl font-bold leading-none text-forest-900">
                      {formatTemperature(airportWeather.current.airTemperature)}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-forest-900/80">
                      {weatherLabel(airportWeather.current.symbolCode)}
                    </div>
                  </div>
                  <div className="text-right text-xs uppercase tracking-[0.18em] text-forest-900/45">
                    <div>Updated</div>
                    <div className="mt-1 text-sm font-semibold normal-case tracking-normal text-forest-900/75">
                      {formatLocalTime(airportWeather.current.time, airportWeather.timeZone)?.replace(/ (local|UTC)$/, '') ?? 'Now'}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <WeatherMetric
                    label="Humidity"
                    value={
                      typeof airportWeather.current.relativeHumidity === 'number'
                        ? `${Math.round(airportWeather.current.relativeHumidity)}%`
                        : '—'
                    }
                  />
                  <WeatherMetric
                    label="Wind"
                    value={formatWindSpeed(airportWeather.current.windSpeedKmh)}
                  />
                  <WeatherMetric
                    label="Next 24 h"
                    value={formatDailyRange(airportWeather.next24h?.min, airportWeather.next24h?.max)}
                  />
                </div>
                <p className="mt-4 text-xs text-forest-900/60">
                  Weather data from{' '}
                  <a href={MET_ATTRIBUTION.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-forest-900">
                    {MET_ATTRIBUTION.name}
                  </a>{' '}
                  (
                  <a href={MET_ATTRIBUTION.licenceUrl} target="_blank" rel="noopener noreferrer license" className="underline hover:text-forest-900">
                    {MET_ATTRIBUTION.licence}
                  </a>
                  ), wind converted to km/h.
                </p>
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
                <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-forest-900/62">
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
                        <span className="flex h-8 w-8 items-center justify-center rounded-[0.3rem] bg-forest-900 text-[11px] font-bold text-sand-100">
                          {index + 1}
                        </span>
                        <div>
                          <div className="text-xs font-bold tracking-[0.18em] text-forest-950">
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
                <h3 className="text-xl font-bold text-forest-900">What should you check before leaving for {airport.iata}?</h3>
                <ol className="mt-5 space-y-4 text-sm leading-6">
                  {airportGuide.checklist.map((item, index) => (
                    <li key={item} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-[0.3rem] bg-forest-900 text-[11px] font-bold text-sand-100">
                        {index + 1}
                      </span>
                      <span className="pt-1 text-forest-900/78">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-[0.3rem] border border-forest-900/10 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-forest-900/50">
                  Start here
                </p>
                <h3 className="mt-2 text-xl font-bold text-forest-900">
                  How do terminal transfers work at {airport.iata}?
                </h3>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {airportGuide.terminals.map((terminal) => (
                    <div key={terminal.name} className="rounded-[0.3rem] bg-forest-900/[0.04] p-4">
                      <div className="text-xs font-bold tracking-[0.18em] text-forest-900/55">
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
                    <span className="text-xs font-bold tracking-wider text-forest-900/60">
                      {airline.iataCode || airline.name.slice(0, 3).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="line-clamp-2 text-base font-bold leading-tight text-forest-900 group-hover:text-forest-700">
                    {airline.name}
                  </div>
                  {airline.iataCode && (
                    <div className="mt-1 text-[11px] tracking-[0.18em] text-forest-900/45">
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
                  <div className="text-xs font-bold tracking-wider text-forest-900/70">
                    {r.origin?.iata} → {r.destination?.iata}
                  </div>
                  <div className="mt-2 text-base font-bold text-forest-900 group-hover:text-forest-700">
                    {r.destination?.city || r.destination?.name}
                  </div>
                  <div className="mt-1 text-xs text-forest-900/60">
                    {r.destination?.country}
                  </div>
                </div>
                {r.distanceKm && (
                  <div className="text-right text-xs text-forest-900/50">
                    <div className="font-bold text-forest-900/70">
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
                  <h3 className="text-lg font-bold leading-snug text-forest-900">{card.title}</h3>
                  <span className="rounded-[0.3rem] bg-forest-900/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-forest-900/58">
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
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-forest-900/50">
                    Budget check
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-forest-900">What are key ground costs at {airport.iata}?</h3>
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
                      <span className="flex h-8 w-8 items-center justify-center rounded-[0.3rem] bg-forest-900 text-[11px] font-bold text-sand-100">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-900/60">
                        {note.title}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-forest-900/78">{note.body}</p>
                  </div>
                ))}
              </div>

            </div>

            <aside
              className="rounded-[0.3rem] border border-forest-900/10 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              style={{ backgroundColor: '#ffffff' }}
            >
              <h3 className="text-xl font-bold text-forest-900">Which official data sources support this guide?</h3>
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
                        <span className="text-2xl font-bold tracking-[0.2em] text-sand-100">
                          {a.iata}
                        </span>
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-[0.3rem] bg-forest-950/90 px-2.5 py-1 text-[10px] font-bold tracking-wider text-sand-100">
                      {a.iata}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="truncate text-base font-bold text-forest-900 group-hover:text-forest-700">
                      {a.city || a.name}
                    </div>
                    <div className="mt-1 line-clamp-2 min-h-[2rem] text-xs leading-5 text-forest-900/60">
                      {a.name}
                      {a.distanceKm != null && <> · {Math.round(a.distanceKm).toLocaleString('en-US')} km</>}
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
    for (const carrier of operableCarriers(route)) {
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


type NearbyAirport = StrapiAirport & { distanceKm: number | null };

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * The closest airports by great-circle distance, across borders. Replaces the
 * first nine airports of the country alphabetically, which every airport in a
 * country linked to (all 569 US pages linked Aberdeen, Abilene, Adak…), leaving
 * most airports with no inbound link. Falls back to same-country airports when
 * this airport has no coordinates.
 */
function nearestAirports(airport: StrapiAirport, all: StrapiAirport[], limit: number): NearbyAirport[] {
  const others = all.filter((a) => a.iata && a.iata !== airport.iata);
  const { latitude: lat, longitude: lon } = airport;
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return others
      .filter((a) => a.countryCode && a.countryCode === airport.countryCode)
      .slice(0, limit)
      .map((a) => ({ ...a, distanceKm: null }));
  }
  return others
    .filter((a) => typeof a.latitude === 'number' && typeof a.longitude === 'number')
    .map((a) => ({ ...a, distanceKm: distanceKm(lat, lon, a.latitude!, a.longitude!) }))
    .sort((a, b) => a.distanceKm! - b.distanceKm!)
    .slice(0, limit);
}

/* ------------------------------------------------------------------ *
 * Enrichment (data/airport-enrichment, lib/airport-enrichment.ts)
 * ------------------------------------------------------------------ */

function v2MetaInput(a: StrapiAirport, hasRoutes: boolean, e: AirportEnrichment) {
  return {
    name: a.name,
    iata: a.iata,
    icao: (!e.oa?.supersededIcao && a.icao) || e.oa?.icao || a.icao,
    city: a.city || e.oa?.municipality,
    country: a.country,
    hasRoutes,
    facts: enrichmentMetaFacts(e),
    covers: { runways: Boolean(e.oa?.runways?.length), climate: Boolean(e.climate), fares: Boolean(e.fares?.destinations.length) },
  };
}

function buildEnrichmentView(
  e: AirportEnrichment,
  routes: StrapiRoute[],
  siteAirlines: StrapiAirline[],
  allAirports: Pick<StrapiAirport, 'iata' | 'city' | 'name'>[],
): AirportEnrichmentView {
  const routeByDest = new Map<string, string>();
  for (const r of routes) if (r.destination?.iata && r.slug) routeByDest.set(r.destination.iata.toUpperCase(), `/flight-routes/${r.slug}`);
  return buildEnrichmentViewFromData(e, {
    airlines: siteAirlines,
    routeHref: (code) => routeByDest.get(code.toUpperCase()) ?? null,
    // Only airports the site has a page for are linked.
    airportHref: (iata) => {
      const hit = allAirports.find((x) => x.iata?.toUpperCase() === iata.toUpperCase());
      return hit ? airportPath(hit, allAirports) : null;
    },
  });
}

function enrichmentFaqInput(a: StrapiAirport, e: AirportEnrichment, v: AirportEnrichmentView): EnrichmentFaqInput {
  const topCountries = (v.fares?.groups ?? []).map((g) => ({ country: g.country, count: g.destinations.length }));
  return {
    name: a.name,
    iata: a.iata,
    city: a.city,
    runways: v.runways,
    elevationFt: v.elevationFt,
    opened: v.opened,
    operators: v.operators.map((o) => o.label),
    owners: v.owners.map((o) => o.label),
    patronage: v.patronage,
    hubAirlines: v.hubs.map((h) => h.label),
    cityCentre: v.cityCentre,
    climate: v.climate ? { ...v.climate.summary, period: v.climate.period } : null,
    fares: v.fares
      ? { destinations: v.fares.destinationCount, countries: v.fares.countryCount, topCountries, retrieved: formatDate(v.fares.retrieved) ?? v.fares.retrieved }
      : null,
  };
}
