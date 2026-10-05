import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { clampDescription } from '@/lib/seo';
import { JsonLd } from '@/components/SeoBlocks';
import { ORG_ID, organizationJsonLd, absoluteUrl, breadcrumbJsonLd } from '@/lib/jsonld';
import { listArticles, mediaUrl, type StrapiArticle } from '@/lib/strapi';
import { SITE_PHOTOS, type SitePhoto } from '@/lib/site-photos';
import { LEGAL_DOCS } from '@/lib/legal';

// The page pulls article counts and latest-article covers from Strapi, so it
// re-renders hourly instead of freezing whatever the CMS returned at build.
export const revalidate = 3600;

export const metadata: Metadata = {
  // Absolute: the layout template would append "· Originfacts" a second time.
  title: { absolute: 'About Originfacts: Travel Facts, Guides & Flight Search' },
  description: clampDescription(
    'Originfacts is an independent travel site with destination, airline and airport guides, flight search and hotels. Learn how Originfacts works.',
  ),
  alternates: { canonical: '/about' },
};

const aboutPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About Originfacts',
  url: absoluteUrl('/about'),
  // Full Organization node is emitted alongside so the @id resolves on-page.
  about: { '@id': ORG_ID },
  mainEntity: { '@id': ORG_ID },
};

/* ------------------------------------------------------------------ */
/* Imagery: real, credited Unsplash photographs (lib/site-photos.ts).  */
/* These replaced the AI-generated CMS destination heroes.            */
/* ------------------------------------------------------------------ */

type Photo = SitePhoto;

/* ------------------------------------------------------------------ */
/* Copy (from the previous content/pages/about.md, restructured).     */
/* ------------------------------------------------------------------ */

type Coverage = {
  key: string;
  title: string;
  text: string;
  href: string;
  // Article category slug in Strapi; directories (airlines, airports) have none.
  category?: string;
  // Decorative mark for directory cards, which have no cover image.
  glyph?: string;
};

const COVERAGE: Coverage[] = [
  {
    key: 'destinations',
    title: 'Destinations',
    text: 'Origin stories, cultural facts, and on-the-ground travel guides for cities, regions, and countries.',
    href: '/category/destinations',
    category: 'destinations',
  },
  {
    key: 'flights',
    title: 'Flights',
    text: 'Cheap flight tactics, route comparisons, booking timing, and current fare information.',
    href: '/category/flights',
    category: 'flights',
  },
  {
    key: 'hotels',
    title: 'Hotels',
    text: 'Neighbourhood-level guidance, value picks, boutique stays, and where to actually stay — not just the highest-bid ad.',
    href: '/category/hotels',
    category: 'hotels',
  },
  {
    key: 'airlines',
    title: 'Airlines',
    text: 'Fleet, cabin, route, and reliability information for major carriers around the world.',
    href: '/airlines',
    glyph: '✈',
  },
  {
    key: 'airports',
    title: 'Airports',
    text: "Practical guides to international hubs, transfer airports, and the airports you'll actually pass through.",
    href: '/airports',
    glyph: '⇄',
  },
  {
    key: 'travel-tips',
    title: 'Travel tips',
    text: 'Visa basics, packing, connectivity, money, and the small operational details that make trips smoother.',
    href: '/category/travel-tips',
    category: 'travel-tips',
  },
];

const COMPARISON = [
  { feature: 'Airline facts', us: "Linked to the airline's own published pages", them: 'Often unsourced' },
  { feature: 'Transparency', us: 'Named legal entity, AI use disclosed', them: 'Anonymous publishing' },
  { feature: 'Origin context', us: 'Cultural, historical & local geographic facts', them: 'Pure booking CTA funnel' },
  { feature: 'Commercial disclosure', us: 'Explicit affiliate network & revenue transparency', them: 'Hidden or undisclosed sponsor tags' },
];

// Travelpayouts: flight search. Takeads: Booking.com, Agoda, Trip.com, Kiwi.com,
// CheapOair, Qatar Airways and others. GetYourGuide: direct partner.
const AFFILIATE_NETWORKS = ['Travelpayouts', 'Takeads', 'GetYourGuide'];

const NOT_A_PROVIDER = [
  'sell travel bookings',
  'take payments',
  'issue tickets',
  'operate hotels or airlines',
  'rent vehicles',
  'provide tours',
  'process refunds',
  'handle cancellations',
];

const CHECK_BEFORE_BOOKING = [
  'Final prices',
  'Taxes',
  'Fees',
  'Cancellation rules',
  'Refund terms',
  'Baggage rules',
  'Deposit requirements',
];

const RANKING_WORDS = ['cheap', 'cheapest', 'best', 'popular', 'recommended'];

const APPROACH = [
  {
    title: 'Origin-first context',
    text: 'Every destination has a story. Before we write about how to get there or where to stay, we try to understand what the place actually is — geography, history, culture, the small facts that travellers remember long after the flight home.',
  },
  {
    title: 'Kept current',
    text: 'Travel content goes stale fast. We focus on current routes, current pricing patterns, current visa rules, and current travel realities — and we revisit content as conditions change.',
  },
  {
    title: 'Written for readers everywhere',
    text: 'Originfacts is built for readers around the world. Our content is currently published in English.',
  },
  {
    title: 'Always improving',
    text: "Originfacts is a custom-built, independently operated website. We're continuously improving content quality, comparison features, accessibility, performance, and transparency.",
  },
];

const PROCESS = [
  {
    title: 'Topic selection',
    text: 'Topics come from a planned list, based on traveller search behaviour, current routes, seasonal demand and destinations we want to cover in depth.',
  },
  {
    title: 'Research and drafting',
    text: "We use large language models (currently Anthropic's Claude) as a research and drafting assistant. The model is given a brief, a set of editorial guidelines, and structured prompts, and produces an initial draft.",
  },
  {
    title: 'Image generation',
    text: 'Cover and gallery images are produced with generative image models (currently Fal.ai FLUX). Real photographs are used where licensing permits. AI-generated images illustrate an article; they are not meant to show a specific hotel, aircraft, price or person.',
  },
  {
    title: 'Corrections',
    text: 'Facts that change often (prices, routes, visa rules, fees) are the most likely to go out of date, so check them with the provider before booking. Report an error to contact@originfacts.com and it is corrected or removed.',
  },
  {
    title: 'Updating',
    text: 'Travel facts move quickly. We revisit and update articles as conditions, prices, routes, and policies change.',
  },
];

// Terms, Privacy, Cookie, Affiliate Disclosure, Disclaimer, Legal Notice.
const LEGAL_LINK_SLUGS = ['terms', 'privacy', 'cookies', 'affiliate-disclosure', 'disclaimer', 'contact'];

/* ------------------------------------------------------------------ */

async function categorySnapshot(category: string) {
  try {
    const res = await listArticles({ category, pageSize: 1 });
    return { total: res.meta?.pagination?.total ?? 0, latest: (res.data[0] ?? null) as StrapiArticle | null };
  } catch {
    return { total: 0, latest: null };
  }
}

export default async function AboutPage() {
  const [articleTotal, snapshots] = await Promise.all([
    listArticles({ pageSize: 1 })
      .then((r) => r.meta?.pagination?.total ?? 0)
      .catch(() => 0),
    Promise.all(COVERAGE.map((c) => (c.category ? categorySnapshot(c.category) : Promise.resolve(null)))),
  ]);

  const legalLinks = LEGAL_DOCS.filter((d) => LEGAL_LINK_SLUGS.includes(d.slug));

  // Each photo sits in a slot that matches its orientation: the portrait
  // Wat Arun shot fills the tall hero tile, and the wide Fuji panorama gets
  // the full-width band (in the tall tile it was mostly sky).
  const heroMain = SITE_PHOTOS['thailand'];
  const heroSideA = SITE_PHOTOS['germany'];
  const heroSideB = SITE_PHOTOS['united-kingdom'];
  const storyPhoto = SITE_PHOTOS['singapore'];
  const bandPhoto = SITE_PHOTOS['japan'];
  const howPhoto = SITE_PHOTOS['united-states'];
  const approachA = SITE_PHOTOS['south-korea'];
  const approachB = SITE_PHOTOS['australia'];

  // Every number here is counted, not typed: articles from Strapi, the rest
  // from the lists this page renders.
  const stats = [
    articleTotal > 0 ? { value: articleTotal.toLocaleString('en-GB'), label: 'published articles' } : null,
    { value: String(COVERAGE.length), label: 'areas of travel coverage' },
    { value: String(PROCESS.length), label: 'steps from topic to published article' },
    { value: String(AFFILIATE_NETWORKS.length), label: 'affiliate partners, named below' },
  ].filter((s): s is { value: string; label: string } => s !== null);

  return (
    <article className="overflow-x-clip" data-testid="about-page">
      <JsonLd data={organizationJsonLd({ withContactPoint: true })} />
      <JsonLd data={aboutPageJsonLd} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'About', url: '/about' }])} />

      {/* ---------------- Hero ---------------- */}
      <header className="mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16" data-testid="about-hero">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14">
          <div className="min-w-0">
            <p className="eyebrow-tag">About</p>
            <h1 className="mt-5 text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">
              About Originfacts
            </h1>
            <p className="mt-6 text-xl font-semibold leading-snug text-forest-900 sm:text-2xl">
              The facts of origins — the stories, cultures, histories and quiet details behind the places people travel
              to — paired with the travel information you actually need to plan a trip.
            </p>
            <p className="mt-5 text-base leading-relaxed text-forest-900/75">
              Originfacts is an independent travel website that pairs the facts behind destinations with practical
              guides to flights, airports, airlines and hotels, so you can understand a place and plan the trip in one
              place.
            </p>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold" data-testid="about-trust-links">
              <li>
                <a href="mailto:contact@originfacts.com" className="text-primary-emphasis underline-offset-2 hover:underline">
                  contact@originfacts.com
                </a>
              </li>
              <li>
                <Link href="/methodology" className="text-forest-950 underline-offset-2 hover:underline">
                  Editorial methodology &amp; standards →
                </Link>
              </li>
              <li>
                <Link href="/authors" className="text-forest-950 underline-offset-2 hover:underline">
                  Our authors →
                </Link>
              </li>
            </ul>
          </div>

          {heroMain && (
            <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3" data-testid="about-hero-mosaic">
              <PhotoTile
                photo={heroMain}
                className="col-span-2 row-span-2 aspect-[4/5]"
                priority
                sizes="(min-width: 1024px) 520px, 66vw"
              />
              {heroSideA && <PhotoTile photo={heroSideA} className="h-full" priority sizes="(min-width: 1024px) 260px, 33vw" />}
              {heroSideB && <PhotoTile photo={heroSideB} className="h-full" priority sizes="(min-width: 1024px) 260px, 33vw" />}
            </div>
          )}
        </div>
      </header>

      {/* ---------------- Numbers ---------------- */}
      <section aria-label="Originfacts in numbers" className="border-y border-forest-900/15 bg-paper" data-testid="about-stats">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex min-w-0 flex-col-reverse border-l-2 border-primary-emphasis pl-4">
              <dt className="mt-2 text-xs font-bold uppercase tracking-widest text-forest-900/60">{s.label}</dt>
              <dd className="text-4xl font-bold leading-none text-forest-950 sm:text-5xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* ---------------- 01 Story ---------------- */}
        <section
          className="grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16"
          aria-labelledby="about-story"
          data-testid="about-story"
        >
          <div className="min-w-0">
            <Kicker n="01" label="The story" />
            <h2 id="about-story" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
              What is the story behind Originfacts?
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-forest-900/80 sm:text-lg">
              <p>
                The name says it. <strong className="text-forest-950">Originfacts</strong> is a travel blog about the{' '}
                <em>facts of origins</em> — the stories, cultures, histories and quiet details behind the destinations
                people travel to.
              </p>
              <p>
                We start with the place itself: how a city took shape, why a region cooks the way it does, what a route
                once was before it became a flight number. Then we connect that context to today — current flight
                options, hotels worth booking, airlines to know, airports to use, and destinations worth your time.
              </p>
              <p>
                Originfacts is operated by <strong className="text-forest-950">FXN Holdings</strong> and is
                available to readers around the world.
              </p>
            </div>
            <PullQuote>Most travel sites stop at the booking funnel. We don&apos;t. We start with the place itself.</PullQuote>
          </div>
          {storyPhoto && (
            <figure className="relative min-w-0">
              <div aria-hidden className="absolute -bottom-4 -left-4 hidden h-2/3 w-2/3 rounded-[0.3rem] bg-sand-200 sm:block" />
              <PhotoTile photo={storyPhoto} className="aspect-[5/4] lg:aspect-square" sizes="(min-width: 1024px) 680px, 100vw" />
              <Caption photo={storyPhoto} />
            </figure>
          )}
        </section>

        {/* ---------------- 02 Coverage ---------------- */}
        <section className="border-t border-forest-900/15 py-16 sm:py-20" aria-labelledby="about-coverage" data-testid="about-coverage">
          <div className="max-w-3xl">
            <Kicker n="02" label="Coverage" />
            <h2 id="about-coverage" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
              What will you find on Originfacts?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-forest-900/75 sm:text-lg">
              A mix of editorial travel writing and practical travel research, organised around the things travellers
              actually search for.
            </p>
          </div>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COVERAGE.map((c, i) => {
              const snap = snapshots[i];
              const latest = snap?.latest ?? null;
              const cover = latest ? mediaUrl(latest.coverImage ?? null) : null;
              return (
                <li key={c.key} className="min-w-0">
                  <Link
                    href={c.href}
                    className={`group flex h-full flex-col overflow-hidden rounded-[0.3rem] border transition ${
                      cover
                        ? 'border-forest-900/10 bg-white hover:border-primary-emphasis/40 hover:shadow-md'
                        : 'border-forest-950 bg-forest-950 text-white hover:bg-forest-900'
                    }`}
                    data-testid={`about-coverage-${c.key}`}
                  >
                    {cover && latest && (
                      <div className="relative aspect-[16/9] overflow-hidden bg-forest-100">
                        <Image
                          src={cover}
                          alt={`Cover image of our latest ${c.title.toLowerCase()} article, “${latest.title}”`}
                          fill
                          sizes="(min-width: 1024px) 460px, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    )}
                    {!cover && (
                      <span
                        aria-hidden
                        className="pointer-events-none flex flex-1 items-end justify-end px-5 pt-8 text-[7rem] font-bold leading-none text-white/10 transition group-hover:text-white/20"
                      >
                        {c.glyph}
                      </span>
                    )}
                    <div className={`flex flex-col p-5 ${cover ? 'flex-1' : 'order-first'}`}>
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className={`text-xl font-bold leading-tight ${cover ? 'text-forest-950' : '!text-white'}`}>{c.title}</h3>
                        {snap && snap.total > 0 ? (
                          <span
                            className={`shrink-0 text-xs font-bold uppercase tracking-wider ${cover ? 'text-primary-emphasis' : 'text-sand-300'}`}
                          >
                            {snap.total} article{snap.total === 1 ? '' : 's'}
                          </span>
                        ) : !c.category ? (
                          <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-sand-300">Directory</span>
                        ) : null}
                      </div>
                      <p className={`mt-2 text-sm leading-relaxed ${cover ? 'text-forest-900/75' : 'text-white/80'}`}>{c.text}</p>
                      <span className={`mt-auto pt-4 text-sm font-semibold ${cover ? 'text-primary-emphasis' : 'text-white'}`}>
                        Explore {c.title.toLowerCase()} →
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Comparison: a grid that stacks on phones instead of a table that overflows. */}
          <div className="mt-16" data-testid="about-comparison">
            <h3 className="text-2xl font-bold leading-tight text-forest-950">Originfacts vs typical travel aggregators</h3>
            <div className="mt-6 overflow-hidden rounded-[0.3rem] border border-forest-900/15">
              <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)] bg-forest-950 text-xs font-bold uppercase tracking-widest text-white sm:grid">
                <span className="px-5 py-3">Standard</span>
                <span className="px-5 py-3">Originfacts methodology</span>
                <span className="px-5 py-3 text-white/70">Typical travel aggregators</span>
              </div>
              <dl>
                {COMPARISON.map((row, i) => (
                  <div
                    key={row.feature}
                    className={`grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)] sm:gap-0 sm:p-0 ${
                      i > 0 ? 'border-t border-forest-900/10' : ''
                    }`}
                  >
                    <dt className="text-sm font-bold text-forest-950 sm:px-5 sm:py-4">{row.feature}</dt>
                    <dd className="flex gap-2 text-sm text-forest-900 sm:bg-primary-hover/50 sm:px-5 sm:py-4">
                      <span aria-hidden className="font-bold text-success-emphasis">✓</span>
                      <span>
                        <span className="sr-only">Originfacts: </span>
                        {row.us}
                      </span>
                    </dd>
                    <dd className="flex gap-2 text-sm text-forest-900/60 sm:px-5 sm:py-4">
                      <span aria-hidden className="font-bold text-forest-900/40">✕</span>
                      <span>
                        <span className="sr-only">Typical travel aggregators: </span>
                        {row.them}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>
      </div>

      {/* ---------------- Full-bleed image band ---------------- */}
      {bandPhoto && (
        <section className="relative isolate overflow-hidden bg-forest-950" aria-label="Our editorial bias" data-testid="about-band">
          <Image src={bandPhoto.src} alt={bandPhoto.alt} fill sizes="100vw" className="-z-10 object-cover opacity-60" style={{ objectPosition: bandPhoto.focus ?? 'center' }} loading="lazy" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-forest-950/90 via-forest-950/60 to-forest-950/20" />
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
            <blockquote className="max-w-3xl">
              <p className="text-2xl font-bold leading-snug text-white sm:text-4xl">
                “Across every category, our editorial bias is toward facts: where something comes from, why it works the
                way it does today, and what that means for someone planning a trip right now.”
              </p>
            </blockquote>
            <Link
              href={`/destinations/${bandPhoto.slug}`}
              className="mt-8 inline-block text-xs font-bold uppercase tracking-widest text-white/70 hover:text-white"
            >
              Pictured: {bandPhoto.name} →
            </Link>
            <PhotoCredit photo={bandPhoto} className="mt-2 block text-xs text-white/60" linkClassName="hover:text-white" />
          </div>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* ---------------- 03 How it works + revenue ---------------- */}
        <section
          className="grid gap-10 py-16 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
          aria-labelledby="about-how"
          data-testid="about-how"
        >
          {howPhoto && (
            <figure className="order-2 min-w-0 lg:order-1">
              <PhotoTile photo={howPhoto} className="aspect-[4/3] lg:aspect-[3/4]" sizes="(min-width: 1024px) 560px, 100vw" />
              <Caption photo={howPhoto} />
            </figure>
          )}
          <div className="order-1 min-w-0 lg:order-2">
            <Kicker n="03" label="How it works" />
            <h2 id="about-how" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
              How does Originfacts work?
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-forest-900/80">
              <p>
                Originfacts is a travel information and affiliate aggregation website. We publish editorial content
                alongside live or recent data from third-party travel providers, including flight search partners, hotel
                inventory partners, and other affiliate networks.
              </p>
              <p>
                When you click a link on Originfacts, you may be taken to a third-party travel website — a booking
                platform, airline, hotel, car rental provider, or tour operator — to complete a booking or purchase.
                Your booking is made directly with the third-party provider you choose.
              </p>
            </div>

            <p className="mt-8 text-xs font-bold uppercase tracking-widest text-forest-900/60">What we don&apos;t do</p>
            <ul className="mt-3 flex flex-wrap gap-2" data-testid="about-not-provider" aria-label="Originfacts does not">
              {NOT_A_PROVIDER.map((item) => (
                <li key={item} className="rounded-full border border-forest-900/15 bg-white px-3 py-1.5 text-sm text-forest-900/80">
                  <span aria-hidden className="mr-1.5 text-terracotta-600">
                    ✕
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-10 rounded-[0.3rem] bg-sand-100 p-6 sm:p-8" data-testid="about-revenue">
              <h3 className="text-xl font-bold leading-snug text-forest-950 sm:text-2xl">How does Originfacts earn revenue?</h3>
              <p className="mt-3 text-base leading-relaxed text-forest-900/80">
                Originfacts may earn an affiliate commission when readers click links on our website and later make a
                booking or purchase through a third-party provider. This usually does not increase the price you pay.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-forest-900/60">Our affiliate partners</span>
                {AFFILIATE_NETWORKS.map((n) => (
                  <span key={n} className="rounded-[0.2rem] bg-forest-950 px-3 py-1 text-sm font-bold text-white">
                    {n}
                  </span>
                ))}
              </div>
              <p className="mt-5 text-sm leading-relaxed text-forest-900/70">
                Affiliate relationships may influence which travel links, offers, widgets, or providers appear in our
                content. We aim to keep these relationships clear and transparent — see our{' '}
                <Link
                  href="/legal/affiliate-disclosure"
                  className="font-semibold text-primary-emphasis underline-offset-2 hover:underline"
                >
                  affiliate disclosure
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        {/* ---------------- 04 Prices & rankings ---------------- */}
        <section className="border-t border-forest-900/15 py-16 sm:py-20" aria-labelledby="about-prices" data-testid="about-prices">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="min-w-0">
              <Kicker n="04" label="Prices & rankings" />
              <h2 id="about-prices" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
                How are flight prices, availability, and rankings determined?
              </h2>
              <p className="mt-6 text-base leading-relaxed text-forest-900/80">
                Travel prices and availability change quickly. Prices shown on Originfacts may be live, estimated, cached,
                promotional, currency-converted, or based on provider data at the time of search.
              </p>
              <p className="mt-4 text-base leading-loose text-forest-900/80">
                Words like{' '}
                {RANKING_WORDS.map((w, i) => (
                  <span key={w}>
                    <em className="rounded-[0.2rem] bg-primary-hover px-1.5 py-0.5 font-semibold not-italic text-primary-emphasis">{w}</em>
                    {i < RANKING_WORDS.length - 2 ? ', ' : i === RANKING_WORDS.length - 2 ? ' or ' : ''}
                  </span>
                ))}{' '}
                are based on available data, user search criteria, provider information, affiliate feeds, editorial
                judgment, or commercial relationships where applicable. Originfacts may not compare every provider or
                every available travel option in the market.
              </p>
            </div>
            <div className="min-w-0 self-start rounded-[0.3rem] border-2 border-forest-950 p-6 sm:p-8" data-testid="about-checklist">
              <p className="text-xs font-bold uppercase tracking-widest text-forest-900/60">
                Before booking, check on the provider&apos;s website
              </p>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {CHECK_BEFORE_BOOKING.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-base font-semibold text-forest-950">
                    <span
                      aria-hidden
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-emphasis text-xs text-white"
                    >
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm leading-relaxed text-forest-900/70">…and any other conditions that apply to your booking.</p>
            </div>
          </div>
        </section>

        {/* ---------------- 05 Editorial approach ---------------- */}
        <section className="border-t border-forest-900/15 py-16 sm:py-20" aria-labelledby="about-approach" data-testid="about-approach">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
            <div className="min-w-0">
              <Kicker n="05" label="Approach" />
              <h2 id="about-approach" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
                What is our editorial approach?
              </h2>
              <div className="mt-8 grid gap-8 sm:grid-cols-2">
                {APPROACH.map((a, i) => (
                  <div key={a.title} className="min-w-0 border-t-2 border-forest-950 pt-4">
                    <p className="font-mono text-xs font-bold text-forest-900/50">0{i + 1}</p>
                    <h3 className="mt-2 text-lg font-bold leading-snug text-forest-950">{a.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-forest-900/75">{a.text}</p>
                  </div>
                ))}
              </div>
            </div>
            {(approachA || approachB) && (
              <div className="grid min-w-0 grid-cols-2 gap-3 self-start" data-testid="about-approach-mosaic">
                {approachA && (
                  <figure className="min-w-0">
                    <PhotoTile photo={approachA} className="aspect-[3/4]" sizes="(min-width: 1024px) 280px, 50vw" />
                    <Caption photo={approachA} />
                  </figure>
                )}
                {approachB && (
                  <figure className="mt-10 min-w-0">
                    <PhotoTile photo={approachB} className="aspect-[3/4]" sizes="(min-width: 1024px) 280px, 50vw" />
                    <Caption photo={approachB} />
                  </figure>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ---------------- 06 Content production ---------------- */}
        <section className="border-t border-forest-900/15 py-16 sm:py-20" aria-labelledby="about-process" data-testid="about-process">
          <div className="max-w-3xl">
            <Kicker n="06" label="Process" />
            <h2 id="about-process" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
              How is our content produced?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-forest-900/75 sm:text-lg">
              Originfacts uses AI-assisted research and drafting to produce many of its articles. Here is how a piece
              comes together.
            </p>
          </div>

          <ol className="relative mt-12 grid gap-8 lg:grid-cols-5 lg:gap-6">
            <span aria-hidden className="absolute left-5 top-0 h-full w-px bg-forest-900/15 lg:left-0 lg:top-5 lg:h-px lg:w-full" />
            {PROCESS.map((step, i) => (
              <li key={step.title} className="relative min-w-0 pl-16 lg:pl-0 lg:pt-16">
                <span className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary-emphasis text-sm font-bold text-white ring-4 ring-white">
                  {i + 1}
                </span>
                <h3 className="text-lg font-bold leading-snug text-forest-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-forest-900/75">{step.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16">
            <PullQuote className="">
              We use AI as a tool to research and structure content faster, not as a way to publish without human
              judgement.
            </PullQuote>
            <p className="text-base leading-relaxed text-forest-900/80">
              If you ever spot something inaccurate, out of date, or misleading, please tell us at{' '}
              <a
                href="mailto:contact@originfacts.com"
                className="break-words font-semibold text-primary-emphasis underline-offset-2 hover:underline"
              >
                contact@originfacts.com
              </a>{' '}
              and we&apos;ll fix or remove it.
            </p>
          </div>
        </section>

        {/* ---------------- Before booking + operator ---------------- */}
        <section className="grid gap-6 pb-20 lg:grid-cols-2" aria-label="Before you book, and who operates Originfacts">
          <div
            className="min-w-0 rounded-[0.3rem] border-l-4 border-secondary-emphasis bg-secondary p-6 sm:p-8"
            data-testid="about-before-booking"
          >
            <h2 className="text-2xl font-bold leading-tight text-forest-950">What should readers keep in mind before booking?</h2>
            <p className="mt-4 text-base leading-relaxed text-forest-900/80">
              Originfacts provides travel information and affiliate links only. We are not a travel agent, airline, hotel,
              car rental company, tour operator, insurer, payment processor, or booking provider. Before booking or
              travelling, verify all important information with the relevant third-party provider and official sources.
            </p>
          </div>

          <div className="min-w-0 rounded-[0.3rem] bg-forest-950 p-6 text-white sm:p-8" data-testid="about-operator">
            <h2 className="text-2xl font-bold leading-tight !text-white">Who operates Originfacts?</h2>
            <dl className="mt-5 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-y-3">
              <OperatorRow label="Business">
                <span className="font-semibold">FXN Holdings</span>
              </OperatorRow>
              <OperatorRow label="ABN">53 274 423 748</OperatorRow>
              <OperatorRow label="Mailing address">PO Box 500, WEST PERTH WA 6872, Australia</OperatorRow>
              <OperatorRow label="Website">www.originfacts.com</OperatorRow>
              <OperatorRow label="Originfacts email">
                <a href="mailto:contact@originfacts.com" className="underline-offset-2 hover:underline">
                  contact@originfacts.com
                </a>
              </OperatorRow>
              <OperatorRow label="Company support">
                <a href="mailto:support@fxnholdings.com" className="underline-offset-2 hover:underline">
                  support@fxnholdings.com
                </a>
              </OperatorRow>
            </dl>
            <nav aria-label="Policies" className="mt-6 border-t border-white/15 pt-5">
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/80">
                {legalLinks.map((d) => (
                  <li key={d.slug}>
                    <Link href={`/legal/${d.slug}`} className="underline-offset-2 hover:text-white hover:underline">
                      {d.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </section>
      </div>
      <PhotoCredits photos={[heroMain, heroSideA, heroSideB, storyPhoto, bandPhoto, howPhoto, approachA, approachB]} />
    </article>
  );
}

/* ------------------------------------------------------------------ */

function Kicker({ n, label }: { n: string; label: string }) {
  return (
    <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-primary-emphasis">
      <span className="font-mono text-forest-900/45">{n}</span>
      <span aria-hidden className="h-px w-8 bg-primary-emphasis/40" />
      {label}
    </p>
  );
}

function PullQuote({ children, className = 'mt-8' }: { children: React.ReactNode; className?: string }) {
  return (
    <blockquote className={`border-l-4 border-primary-emphasis pl-5 ${className}`}>
      <p className="text-xl font-bold leading-snug text-forest-950 sm:text-2xl">“{children}”</p>
    </blockquote>
  );
}

function OperatorRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="mt-3 text-xs font-bold uppercase tracking-wider text-white/55 sm:mt-0 sm:pt-0.5">{label}</dt>
      <dd className="break-words">{children}</dd>
    </>
  );
}

function PhotoTile({
  photo,
  className = '',
  sizes,
  priority = false,
}: {
  photo: Photo;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative min-w-0 overflow-hidden rounded-[0.3rem] bg-forest-100 ${className}`}>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}

function Caption({ photo }: { photo: Photo }) {
  return (
    <figcaption className="mt-3 text-xs font-semibold uppercase tracking-widest text-forest-900/55">
      <Link href={`/destinations/${photo.slug}`} className="hover:text-primary-emphasis">
        {photo.name} guide →
      </Link>
      <PhotoCredit
        photo={photo}
        className="mt-1 block text-[0.7rem] font-normal normal-case tracking-normal text-forest-900/55"
        linkClassName="underline-offset-2 hover:text-primary-emphasis hover:underline"
      />
    </figcaption>
  );
}

/** "Photo: Name / Unsplash", linked to the photographer and the photo page. */
function PhotoCredit({ photo, className, linkClassName }: { photo: Photo; className: string; linkClassName: string }) {
  return (
    <span className={className}>
      Photo:{' '}
      <a href={photo.photographerUrl} rel="noopener" className={linkClassName}>
        {photo.photographer}
      </a>{' '}
      /{' '}
      <a href={photo.sourceUrl} rel="noopener" className={linkClassName}>
        Unsplash
      </a>
    </span>
  );
}

/** One discreet line crediting every photograph on the page, including the uncaptioned hero tiles. */
function PhotoCredits({ photos }: { photos: Photo[] }) {
  return (
    <aside aria-label="Photo credits" className="mx-auto max-w-7xl px-4 pb-10 sm:px-6" data-testid="about-photo-credits">
      <p className="border-t border-forest-900/15 pt-5 text-xs leading-relaxed text-forest-900/55">
        <span className="font-semibold">Photo credits</span> (real photographs, Unsplash License):{' '}
        {photos.map((p, i) => (
          <span key={p.slug}>
            {i > 0 && ' · '}
            {p.place} by{' '}
            <a href={p.photographerUrl} rel="noopener" className="underline-offset-2 hover:text-primary-emphasis hover:underline">
              {p.photographer}
            </a>{' '}
            on{' '}
            <a href={p.sourceUrl} rel="noopener" className="underline-offset-2 hover:text-primary-emphasis hover:underline">
              Unsplash
            </a>
          </span>
        ))}
      </p>
    </aside>
  );
}
