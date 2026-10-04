import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  listArticles,
  listCountriesBySlugs,
  listDestinationArticles,
  listSidebarArticles,
  listSidebarCategoryTiles,
  mediaUrl,
  type StrapiArticle,
} from '@/lib/strapi';
import { ORG_ID, organizationJsonLd } from '@/lib/jsonld';

const FEATURED_COUNTRY_SLUGS = [
  'japan',
  'singapore',
  'germany',
  'south-korea',
  'thailand',
  'australia',
  'united-states',
  'united-kingdom',
];
import { SECTIONS } from '@/lib/sections';
import FeaturedCountries from '@/components/FeaturedCountries';
import SectionDescription from '@/components/SectionDescription';
import BlogSidebar from '@/components/BlogSidebar';
import AdBanner from '@/components/AdBanner';
import SubscribeBlock from '@/components/SubscribeBlock';
import TagsBar from '@/components/TagsBar';

export const revalidate = 60;

export default async function HomePage() {
  const [perSection, countries, sidebar, categoryTiles] = await Promise.all([
    Promise.all(
      SECTIONS.map((s) => {
        const pageSize = s.slug === 'travel-tips' ? 8 : s.slug === 'flights' ? 6 : 5;
        const articles =
          s.slug === 'destinations'
            ? listDestinationArticles({ pageSize })
            : listArticles({ category: s.slug, pageSize });

        return articles.then((r) => r.data).catch(() => []);
      }),
    ),
    listCountriesBySlugs(FEATURED_COUNTRY_SLUGS).catch(() => []),
    listSidebarArticles(5).catch(() => ({ recent: [], popular: [] })),
    listSidebarCategoryTiles(
      SECTIONS.filter((s) => s.slug !== 'destinations').map((s) => s.slug),
    ).catch(() => []),
  ]);

  const bySection = Object.fromEntries(SECTIONS.map((s, i) => [s.slug, perSection[i] as StrapiArticle[]]));

  // Latest across all categories, de-duped (same article can live in multiple sections)
  const latest: StrapiArticle[] = [];
  const seenIds = new Set<number>();
  for (const a of perSection.flat().sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )) {
    if (seenIds.has(a.id)) continue;
    seenIds.add(a.id);
    latest.push(a);
  }
  const hero = latest[0];
  const side = latest.slice(1, 13);

  // Shared Organization node (lib/jsonld.ts) — same @id everywhere the brand
  // entity appears (home, about, contact) so engines see one consistent org.
  const orgJsonLd = organizationJsonLd();

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Originfacts',
    url: 'https://www.originfacts.com',
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://www.originfacts.com/articles?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <div data-testid="home-page">
      {/* The page's single H1 — describes the site, not the lead story.
          Visually hidden so the designed hero layout is untouched. */}
      <h1 className="sr-only">Originfacts — The facts behind every place worth visiting</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />

      <TagsBar />

      <Hero hero={hero} side={side} />

      <SubscribeBlock />

      <FeaturedCountries countries={countries} />

      {SECTIONS.filter((s) => s.slug !== 'destinations').flatMap((s) => {
        const posts = bySection[s.slug] ?? [];
        const sectionEl = posts.length === 0
          ? <EmptySection key={s.slug} section={s} />
          : (
              <EditorialSection
                key={s.slug}
                section={s}
                posts={posts}
                sidebarRecent={sidebar.recent}
                sidebarPopular={sidebar.popular}
                sidebarCategoryTiles={categoryTiles}
              />
            );
        return s.slug === 'flights'
          ? [sectionEl, <AdBanner key="ad-after-flights" testId="home-ad-banner" />]
          : [sectionEl];
      })}
    </div>
  );
}

/* ---------- HERO ---------- */

function Hero({ hero, side }: { hero?: StrapiArticle; side: StrapiArticle[] }) {
  if (!hero) return null;

  const [leftTop, leftBottom, centerWide, rightTop, rightBottom, summaryOne, summaryTwo, ...miniList] = side;

  return (
    <section className="mx-auto max-w-7xl px-6 py-8" data-testid="home-hero">
      <div className="grid gap-5 lg:grid-cols-[minmax(210px,0.78fr)_minmax(360px,1.55fr)_minmax(240px,0.82fr)]">
        <div
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1"
          data-testid="home-hero-col-1"
        >
          {leftTop && <HeroCompactStory article={leftTop} />}
          {leftBottom && <HeroCompactStory article={leftBottom} />}
          <div
            className="hidden overflow-hidden rounded-[0.3rem] bg-white p-2 lg:block"
            data-testid="home-hero-left-ad"
          >
            <p className="pt-1 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-forest-900/45">
              Advertisement
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/placeholder-ad-300x540.svg"
              alt="Advertisement placeholder"
              width={300}
              height={540}
              className="mx-auto mt-2"
              data-testid="home-hero-left-ad-banner"
            />
          </div>
        </div>

        <div className="grid gap-4" data-testid="home-hero-col-2">
          <HeroOverlayStory article={hero} priority size="large" />
          {centerWide && <HeroOverlayStory article={centerWide} size="wide" />}
          {(summaryOne || summaryTwo) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {summaryOne && <HeroTextStory article={summaryOne} />}
              {summaryTwo && <HeroTextStory article={summaryTwo} />}
            </div>
          )}
        </div>

        <div
          className="grid gap-4 self-start sm:grid-cols-2 lg:grid-cols-1"
          data-testid="home-hero-col-3"
        >
          {rightTop && <HeroOverlayStory article={rightTop} size="small" />}
          {rightBottom && <HeroOverlayStory article={rightBottom} size="small" />}
          {miniList.length > 0 && (
            <div className="divide-y divide-forest-900/15 sm:col-span-2 lg:col-span-1">
              {miniList.slice(0, 5).map((article) => (
                <HeroMiniStory key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CategoryLabel({ article, light = false }: { article: StrapiArticle; light?: boolean }) {
  const chips: string[] = [];
  if (article.category) chips.push(article.category.name);
  (article.destinations ?? []).forEach((d) => {
    if (!chips.includes(d.name)) chips.push(d.name);
  });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {chips.slice(0, 4).map((name) => (
        <span
          key={name}
          className={`font-urbanist inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${light ? 'text-white' : 'text-primary-emphasis'}`}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-secondary-emphasis" />
          {name}
        </span>
      ))}
    </div>
  );
}

function HeroMeta({ article, hideReadingTime = false }: { article: StrapiArticle; hideReadingTime?: boolean }) {
  return (
    <div className="mt-3 flex items-center gap-3 text-sm">
      {article.author?.name && (
        <span className="font-medium text-forest-900">{article.author.name}</span>
      )}
      {!hideReadingTime && (
        <>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-secondary-emphasis" />
          <span className="text-forest-900/70">{article.readingTimeMinutes ?? 5} min</span>
        </>
      )}
    </div>
  );
}

function HeroCompactStory({ article }: { article: StrapiArticle }) {
  const img = mediaUrl(article.coverImage ?? null);
  return (
    <article className="group" data-testid={`hero-compact-${article.slug}`}>
      <Link href={`/articles/${article.slug}`} className="block overflow-hidden rounded-[0.3rem] bg-forest-900/5">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={article.coverImage?.alternativeText || article.title}
            className="aspect-[1.5/1] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="aspect-[1.5/1] w-full bg-gradient-to-br from-primary-hover to-primary-pressed" />
        )}
      </Link>
      <div className="mt-3">
        <HeroStoryMeta article={article} />
        <Link href={`/articles/${article.slug}`}>
          <h2 className="mt-1 font-urbanist text-base font-extrabold leading-tight text-forest-950 transition group-hover:text-primary-highlight">
            {article.title}
          </h2>
        </Link>
      </div>
    </article>
  );
}

function HeroOverlayStory({
  article,
  priority = false,
  size,
}: {
  article: StrapiArticle;
  priority?: boolean;
  size: 'large' | 'wide' | 'small';
}) {
  const img = mediaUrl(article.coverImage ?? null);
  const aspect = size === 'large' ? 'aspect-[1/1.04]' : size === 'wide' ? 'aspect-[1.82/1]' : 'aspect-[1.23/1]';
  const titleSize = size === 'large' ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg';

  return (
    <article className="group" data-testid={`hero-overlay-${article.slug}`}>
      <Link href={`/articles/${article.slug}`} className={`relative block overflow-hidden rounded-[0.3rem] bg-forest-900 ${aspect}`}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={article.coverImage?.alternativeText || article.title}
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            fetchPriority={priority ? 'high' : undefined}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-hover to-primary-pressed" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/5" />
        <div className="absolute inset-x-4 bottom-4 text-white sm:inset-x-5 sm:bottom-5">
          <HeroStoryMeta article={article} light />
          {/* Always h2: the page's single h1 is the site masthead heading —
              an article title must not be the homepage's H1. Same classes,
              so the visual design is unchanged. */}
          <h2 className={`mt-2 font-urbanist font-extrabold leading-[1.05] text-white ${titleSize}`}>
            {article.title}
          </h2>
        </div>
      </Link>
    </article>
  );
}

function HeroTextStory({ article }: { article: StrapiArticle }) {
  return (
    <article className="group" data-testid={`hero-text-${article.slug}`}>
      <HeroStoryMeta article={article} />
      <Link href={`/articles/${article.slug}`}>
        <h2 className="mt-1 font-urbanist text-base font-extrabold leading-tight text-forest-950 transition group-hover:text-primary-highlight">
          {article.title}
        </h2>
      </Link>
      {article.excerpt && (
        <p className="mt-2 line-clamp-3 text-sm leading-5 text-ink/65">
          {article.excerpt}
        </p>
      )}
    </article>
  );
}

function HeroMiniStory({ article }: { article: StrapiArticle }) {
  const img = mediaUrl(article.coverImage ?? null);
  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group grid grid-cols-[80px_minmax(0,1fr)] items-center gap-3 py-3 first:pt-0 last:pb-0"
      data-testid={`hero-mini-${article.slug}`}
    >
      <div className="overflow-hidden rounded-[0.3rem] bg-forest-900/5">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={article.coverImage?.alternativeText || article.title}
            className="aspect-square h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="aspect-square bg-gradient-to-br from-primary-hover to-primary-pressed" />
        )}
      </div>
      <div className="min-w-0">
        <HeroStoryMeta article={article} />
        <h2 className="mt-1 line-clamp-2 font-urbanist text-sm font-bold leading-snug text-forest-950 transition group-hover:text-primary-highlight">
          {article.title}
        </h2>
      </div>
    </Link>
  );
}

function HeroStoryMeta({ article, light = false }: { article: StrapiArticle; light?: boolean }) {
  const category = article.category?.name ?? 'Travel';
  const relative = article.publishedAt
    ? formatDistanceToNowStrict(new Date(article.publishedAt), { addSuffix: true })
    : null;
  return (
    <div className={`font-urbanist text-[10px] font-extrabold uppercase tracking-wide ${light ? 'text-white/85' : 'text-primary-emphasis'}`}>
      <span>{category}</span>
      {relative && (
        <>
          <span
            aria-hidden
            className={`mx-1.5 inline-block translate-y-[-1px] ${light ? 'text-white/55' : 'text-forest-900/40'}`}
          >
            ✱
          </span>
          <span className={light ? 'text-white/80' : 'text-forest-900/55'}>{relative}</span>
        </>
      )}
    </div>
  );
}

type Section = (typeof SECTIONS)[number];

function EmptySection({ section }: { section: Section }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16" data-testid={`section-${section.slug}-empty`}>
      <EditorialSectionHeader section={section} />
      <div className="mt-8 rounded-3xl border border-dashed border-forest-900/15 p-12 text-center">
        <p className="font-light text-forest-900/60">No stories in {section.title} yet — publish your first one in the CMS.</p>
      </div>
    </section>
  );
}

/* ---------- Editorial section — feature + stacked list ---------- */

function EditorialSection({
  section,
  posts,
  sidebarRecent = [],
  sidebarPopular = [],
  sidebarCategoryTiles = [],
}: {
  section: Section;
  posts: StrapiArticle[];
  sidebarRecent?: StrapiArticle[];
  sidebarPopular?: StrapiArticle[];
  sidebarCategoryTiles?: { slug: string; name: string; count: number; image: string | null }[];
}) {
  if (section.slug === 'flights') {
    return <FlightsSection section={section} posts={posts} />;
  }
  if (section.slug === 'travel-tips') {
    return (
      <TravelTipsSection
        section={section}
        posts={posts}
        sidebarRecent={sidebarRecent}
        sidebarPopular={sidebarPopular}
        sidebarCategoryTiles={sidebarCategoryTiles}
      />
    );
  }

  const [feature, ...rest] = posts;
  const list = rest.slice(0, 4);
  // Hotels section flips the layout: compact list on the LEFT, feature image on the RIGHT.
  const reverse = section.slug === 'hotels';
  const gridCols = reverse
    ? 'lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1fr)]'
    : 'lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]';

  const featureEl = <FeatureArticle article={feature} />;
  const listEl = (
    <div className="divide-y divide-forest-900/12 border-y border-forest-900/12">
      {list.map((post) => (
        <CompactArticleRow key={post.id} article={post} />
      ))}
    </div>
  );

  return (
    <section className="py-20" data-testid={`section-${section.slug}`}>
      <div className="mx-auto max-w-7xl px-6">
        <EditorialSectionHeader section={section} />
        <div className={`mt-10 grid gap-[15px] ${gridCols}`}>
          {reverse ? listEl : featureEl}
          {reverse ? featureEl : listEl}
        </div>
      </div>
    </section>
  );
}

function FlightsSection({ section, posts }: { section: Section; posts: StrapiArticle[] }) {
  const [feature, firstSide, secondSide, ...rest] = posts;
  const list = rest.slice(0, 3);

  return (
    <section className="py-20" data-testid={`section-${section.slug}`}>
      <div className="mx-auto max-w-7xl px-6">
        <EditorialSectionHeader section={section} />
        <div className="mt-10 grid gap-[15px] lg:grid-cols-[minmax(0,1.05fr)_minmax(460px,1fr)]">
          <FlightFeatureArticle article={feature} />
          <div className="divide-y divide-forest-900/15 border-y border-forest-900/15 lg:border-t-0">
            {firstSide && <FlightSideArticle article={firstSide} />}
            {secondSide && <FlightSideArticle article={secondSide} reverse />}
            {list.map((post) => (
              <FlightListArticle key={post.id} article={post} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FlightFeatureArticle({ article }: { article: StrapiArticle }) {
  const img = mediaUrl(article.coverImage ?? null);
  const [highlight, rest] = splitTitleLead(article.title);

  return (
    <article className="group" data-testid={`flights-feature-${article.slug}`}>
      <Link href={`/articles/${article.slug}`} className="block overflow-hidden rounded-[0.3rem] bg-forest-900/5">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={article.coverImage?.alternativeText || article.title}
            className="aspect-[1.08/1] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="aspect-[1.08/1] w-full bg-gradient-to-br from-primary-hover to-primary-pressed" />
        )}
      </Link>
      <div className="mt-4">
        <FlightMetaLine article={article} />
        <Link href={`/articles/${article.slug}`}>
          <h3 className="mt-2 font-urbanist text-2xl font-extrabold leading-[1.08] text-forest-950 transition group-hover:text-primary-highlight sm:text-3xl">
            <span className="mr-2 inline-block -skew-x-6 bg-[#ffd21e] px-2 py-0.5 italic text-black">
              {highlight}
            </span>
            {rest}
          </h3>
        </Link>
        {article.excerpt && (
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65 sm:text-base">
            {article.excerpt}
          </p>
        )}
      </div>
    </article>
  );
}

function FlightSideArticle({ article, reverse = false }: { article: StrapiArticle; reverse?: boolean }) {
  const img = mediaUrl(article.coverImage ?? null);
  const imageEl = (
    <Link href={`/articles/${article.slug}`} className="block overflow-hidden rounded-[0.3rem] bg-forest-900/5">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={article.coverImage?.alternativeText || article.title}
          className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="aspect-[4/3] w-full bg-gradient-to-br from-primary-hover to-primary-pressed" />
      )}
    </Link>
  );
  const textEl = (
    <div className={reverse ? 'text-left sm:text-right' : 'text-left'}>
      <FlightMetaLine article={article} />
      <Link href={`/articles/${article.slug}`}>
        <h3 className="mt-2 font-urbanist text-lg font-extrabold leading-tight text-forest-950 transition group-hover:text-primary-highlight sm:text-xl">
          {article.title}
        </h3>
      </Link>
    </div>
  );

  return (
    <article className="group grid gap-5 py-6 sm:grid-cols-2 sm:items-center" data-testid={`flights-side-${article.slug}`}>
      {reverse ? textEl : imageEl}
      {reverse ? imageEl : textEl}
    </article>
  );
}

function FlightListArticle({ article }: { article: StrapiArticle }) {
  return (
    <article className="group py-6" data-testid={`flights-list-${article.slug}`}>
      <FlightMetaLine article={article} />
      <Link href={`/articles/${article.slug}`}>
        <h3 className="mt-2 font-urbanist text-lg font-extrabold leading-tight text-forest-950 transition group-hover:text-primary-highlight sm:text-xl">
          {article.title}
        </h3>
      </Link>
    </article>
  );
}

function FlightMetaLine({ article }: { article: StrapiArticle }) {
  const category = article.category?.name ?? 'Flights';
  return (
    <div className="font-urbanist text-[11px] font-extrabold uppercase tracking-wide text-forest-900/60">
      {category}
      <span className="mx-1.5 text-forest-900/35">~</span>
      <span>{article.readingTimeMinutes ?? 5} min read</span>
    </div>
  );
}

/* ---------- Travel Tips section — 2-column masonry à la frenify/mow ---------- */

function TravelTipsSection({
  section,
  posts,
  sidebarRecent = [],
  sidebarPopular = [],
  sidebarCategoryTiles = [],
}: {
  section: Section;
  posts: StrapiArticle[];
  sidebarRecent?: StrapiArticle[];
  sidebarPopular?: StrapiArticle[];
  sidebarCategoryTiles?: { slug: string; name: string; count: number; image: string | null }[];
}) {
  return (
    <section className="py-20" data-testid={`section-${section.slug}`}>
      <div className="mx-auto max-w-7xl px-6">
        <EditorialSectionHeader section={section} />
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_280px] lg:gap-14">
          <div className="grid items-start gap-[15px] sm:grid-cols-2">
            {posts.map((post, i) => (
              <TravelTipCard
                key={post.id}
                article={post}
                imageAspect={i % 2 === 0 ? 'aspect-[16/9]' : 'aspect-[40/27]'}
              />
            ))}
          </div>
          <BlogSidebar
            popularPosts={sidebarPopular}
            recentPosts={sidebarRecent}
            categoryTiles={sidebarCategoryTiles}
          />
        </div>
      </div>
    </section>
  );
}

function TravelTipCard({
  article,
  imageAspect = 'aspect-[3/2]',
}: {
  article: StrapiArticle;
  imageAspect?: string;
}) {
  const img = mediaUrl(article.coverImage ?? null);
  const category = article.category?.name;
  const relative = article.publishedAt
    ? formatDistanceToNowStrict(new Date(article.publishedAt), { addSuffix: true })
    : null;

  return (
    <article className="group flex flex-col" data-testid={`travel-tips-card-${article.slug}`}>
      <Link
        href={`/articles/${article.slug}`}
        className="block overflow-hidden rounded-[0.3rem] bg-forest-900/5"
        aria-label={article.title}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={article.coverImage?.alternativeText || article.title}
            className={`${imageAspect} w-full object-cover transition duration-500 group-hover:scale-[1.02]`}
            loading="lazy"
          />
        ) : (
          <div className={`${imageAspect} w-full bg-gradient-to-br from-primary-hover to-primary-pressed`} />
        )}
      </Link>
      <div className="mt-5 flex flex-1 flex-col">
        <div className="font-urbanist text-[11px] font-bold uppercase tracking-wider text-primary-emphasis">
          {category && <span>{category}</span>}
          {category && relative && (
            <span aria-hidden className="mx-2 text-forest-900/40">✱</span>
          )}
          {relative && <span className="text-forest-900/55">{relative}</span>}
        </div>
        <Link href={`/articles/${article.slug}`}>
          <h3 className="mt-2 font-urbanist text-xl font-bold leading-snug text-forest-950 transition group-hover:text-primary-highlight">
            {article.title}
          </h3>
        </Link>
        {article.excerpt && (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-ink/70 sm:text-base">
            {article.excerpt}
          </p>
        )}
        <div className="mt-5">
          <Link
            href={`/articles/${article.slug}`}
            className="inline-flex items-center gap-2 rounded-full border border-forest-900/15 bg-white px-4 py-2 font-urbanist text-[11px] font-bold uppercase tracking-widest text-forest-900 transition hover:border-primary-emphasis hover:text-primary-emphasis"
          >
            Read More
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-forest-900 text-white transition group-hover:bg-primary-emphasis">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
                aria-hidden
              >
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}

function splitTitleLead(title: string) {
  const words = title.trim().split(/\s+/);
  if (words.length <= 2) return [title, ''];
  return [words.slice(0, 2).join(' '), words.slice(2).join(' ')];
}

function EditorialSectionHeader({ section }: { section: Section }) {
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="font-urbanist text-2xl font-bold leading-tight text-forest-900 sm:text-3xl">
          {section.title}
        </h2>
        <Link
          href={`/category/${section.slug}`}
          className="inline-flex w-fit items-center justify-center rounded-[0.3rem] border border-forest-900 px-4 py-2 font-urbanist text-xs font-bold uppercase tracking-wider text-forest-900 transition hover:bg-primary-emphasis hover:text-white"
          data-testid={`section-all-${section.slug}`}
        >
          See all
        </Link>
      </div>
      <SectionDescription
        text={section.description}
        testId={`section-readmore-${section.slug}`}
      />
    </div>
  );
}

function FeatureArticle({ article }: { article: StrapiArticle }) {
  const img = mediaUrl(article.coverImage ?? null);
  return (
    <article className="group" data-testid={`feature-article-${article.slug}`}>
      <Link href={`/articles/${article.slug}`} className="block overflow-hidden rounded-[0.3rem] bg-forest-900/5">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={article.coverImage?.alternativeText || article.title}
          className="aspect-[16/11] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="aspect-[16/11] w-full bg-gradient-to-br from-primary-hover to-primary-pressed" />
      )}
      </Link>
      <div className="mt-5">
        <CategoryLabel article={article} />
        <Link href={`/articles/${article.slug}`}>
          <h3 className="font-urbanist mt-3 text-xl font-bold leading-tight text-forest-900 transition group-hover:text-primary-highlight sm:text-2xl">
            {article.title}
          </h3>
        </Link>
        {article.excerpt && (
          <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-6 text-ink/75 sm:text-base">
            {article.excerpt}
          </p>
        )}
        <ArticleMeta article={article} />
      </div>
    </article>
  );
}

function CompactArticleRow({ article }: { article: StrapiArticle }) {
  const img = mediaUrl(article.coverImage ?? null);
  return (
    <article className="group py-6" data-testid={`compact-article-${article.slug}`}>
      <Link href={`/articles/${article.slug}`} className="grid grid-cols-[92px_minmax(0,1fr)] gap-5 sm:grid-cols-[112px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-[0.3rem] bg-forest-900/5">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={article.coverImage?.alternativeText || article.title}
              className="aspect-square h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="aspect-square bg-gradient-to-br from-primary-hover to-primary-pressed" />
          )}
        </div>
        <div className="min-w-0">
          <CategoryLabel article={article} />
          <h3 className="mt-2 line-clamp-2 font-urbanist text-base font-bold leading-snug text-forest-900 transition group-hover:text-primary-highlight sm:text-lg">
            {article.title}
          </h3>
          <ArticleMeta article={article} compact />
        </div>
      </Link>
    </article>
  );
}

function ArticleMeta({ article, compact = false }: { article: StrapiArticle; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm text-forest-900/75 ${compact ? 'mt-3' : 'mt-4'}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-emphasis font-urbanist text-sm font-bold text-primary-emphasis">
        {(article.author?.name || 'O').slice(0, 1).toUpperCase()}
      </span>
      {article.author?.name && <span>{article.author.name}</span>}
      {article.author?.name && <span className="text-forest-900/35">|</span>}
      <span>{article.readingTimeMinutes ?? 5} min read</span>
    </div>
  );
}
