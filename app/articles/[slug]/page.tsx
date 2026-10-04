import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { marked } from 'marked';
import Link from 'next/link';
import {
  getAdjacentArticles,
  getArticle,
  listArticles,
  listSidebarArticles,
  listSidebarCategoryTiles,
  mediaUrl,
} from '@/lib/strapi';
import ArticleCard from '@/components/ArticleCard';
import ShareButtons from '@/components/ShareButtons';
import BlogSidebar from '@/components/BlogSidebar';
import RelatedPostsSlider from '@/components/RelatedPostsSlider';
import { SECTIONS } from '@/lib/sections';
import { DEFAULT_OG_IMAGE, articleBlogPostingJsonLd, faqJsonLd, howToJsonLd, normalizeFaqs, normalizeSteps } from '@/lib/entity-seo';
import { JsonLd, FaqSection, HowToSteps } from '@/components/SeoBlocks';
import KeyFacts from '@/components/KeyFacts';
import TakeadsTravelOffers from '@/components/TakeadsTravelOffers';
import AuthorCard from '@/components/AuthorCard';
import { resolveAuthor, authorPersonJsonLd } from '@/lib/authors';
import { buildMetaDescription, compactTitle, warnIfLong } from '@/lib/seo';
import TableOfContents from '@/components/TableOfContents';
import { injectHeadingIdsAndExtractToc } from '@/lib/toc';
import type { Metadata } from 'next';

export const revalidate = 60;

// An empty list opts the route into on-demand ISR: each page renders on its
// first request and is then cached and revalidated, instead of rendering on
// every request (it was served `private, no-store`).
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) return { title: 'Not found' };
  const ogImg = mediaUrl(a.ogImage ?? a.coverImage ?? null);
  const metaTitle = compactTitle(a.seoTitle || a.title);
  const metaDescription = buildMetaDescription([a.seoDescription, a.excerpt]);
  warnIfLong(`/articles/${a.slug}`, { title: metaTitle, description: metaDescription });
  return {
    title: metaTitle,
    description: metaDescription,
    alternates: { canonical: `/articles/${a.slug}` },
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      type: 'article',
      publishedTime: a.publishedAt,
      modifiedTime: a.updatedAt,
      authors: a.author ? [a.author.name] : undefined,
      // This openGraph block replaces the root layout's, so the sitewide
      // default image must be restated here for articles without a cover.
      images: [{ url: ogImg || DEFAULT_OG_IMAGE }],
      url: `/articles/${a.slug}`,
    },
    // Root layout sets an explicit default twitter image, which would otherwise
    // beat the article cover (X only falls back to og:image when twitter:image
    // is absent entirely).
    twitter: { card: 'summary_large_image', images: [ogImg || DEFAULT_OG_IMAGE] },
  };
}

/**
 * Insert gallery images into the rendered article HTML at evenly-spaced
 * paragraph boundaries instead of dumping them all at the bottom. Falls
 * back to appending the leftover images if there aren't enough paragraphs
 * to interleave evenly.
 */
function interleaveGallery(
  html: string,
  gallery: NonNullable<Awaited<ReturnType<typeof getArticle>>>['gallery'],
  fallbackAlt: string,
): string {
  if (!gallery || gallery.length === 0) return html;

  // Split on closing </p> while preserving the tag with each chunk.
  const rawParts = html.split('</p>');
  const chunks = rawParts.map((p, i, arr) => (i < arr.length - 1 ? `${p}</p>` : p));
  const nonEmpty = chunks.filter((c) => c.trim());
  if (nonEmpty.length === 0) {
    // No paragraphs to interleave with — just append all images at the end.
    return html + gallery.map((img) => renderInlineImg(img, fallbackAlt)).join('');
  }

  // Evenly spread N images across (paragraphCount + 1) gaps.
  const step = Math.max(1, Math.floor(nonEmpty.length / (gallery.length + 1)));
  const out: string[] = [];
  let nextGalleryIdx = 0;

  nonEmpty.forEach((chunk, i) => {
    out.push(chunk);
    if (nextGalleryIdx < gallery.length && (i + 1) % step === 0) {
      out.push(renderInlineImg(gallery[nextGalleryIdx], fallbackAlt));
      nextGalleryIdx += 1;
    }
  });

  // Stragglers (gallery longer than paragraph slots) — append at the end.
  while (nextGalleryIdx < gallery.length) {
    out.push(renderInlineImg(gallery[nextGalleryIdx], fallbackAlt));
    nextGalleryIdx += 1;
  }
  return out.join('');
}

function renderInlineImg(
  img: NonNullable<NonNullable<Awaited<ReturnType<typeof getArticle>>>['gallery']>[number],
  fallbackAlt: string,
): string {
  const url = mediaUrl(img);
  if (!url) return '';
  const alt = (img.alternativeText || fallbackAlt).replace(/"/g, '&quot;');
  return `<figure class="article-inline-image my-8"><img src="${url}" alt="${alt}" class="aspect-[16/9] w-full rounded-lg object-cover" loading="lazy" /></figure>`;
}

function demoteBodyH1(html: string): string {
  return html.replace(/<h1(\s[^>]*)?>/gi, '<h2$1>').replace(/<\/h1>/gi, '</h2>');
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const rawHtml = demoteBodyH1(await marked.parse(unescapeNewlines(article.content || ''), { async: true }));
  const html = interleaveGallery(rawHtml, article.gallery, article.title);
  const { html: processedHtml, toc } = injectHeadingIdsAndExtractToc(html);
  const hero = mediaUrl(article.coverImage ?? null);
  const date = article.publishedAt ? format(new Date(article.publishedAt), 'd MMMM yyyy') : '';

  // Related by category + sidebar + prev/next post by publishedAt
  const [relatedRes, sidebar, categoryTiles, adjacent] = await Promise.all([
    article.category
      ? listArticles({ category: article.category.slug, pageSize: 12 }).catch(() => ({ data: [] as Awaited<ReturnType<typeof listArticles>>['data'] }))
      : Promise.resolve({ data: [] as Awaited<ReturnType<typeof listArticles>>['data'] }),
    listSidebarArticles(5).catch(() => ({ recent: [], popular: [] })),
    listSidebarCategoryTiles(
      SECTIONS.filter((s) => s.slug !== 'destinations').map((s) => s.slug),
    ).catch(() => []),
    getAdjacentArticles(article.publishedAt, article.id).catch(() => ({ prev: null, next: null })),
  ]);
  const related = relatedRes.data.filter((x) => x.id !== article.id).slice(0, 8);

  const articleUrl = `https://www.originfacts.com/articles/${article.slug}`;
  const articleImage = mediaUrl(article.ogImage ?? article.coverImage ?? null);
  const faqs = normalizeFaqs(article.faqs);
  const steps = normalizeSteps(article.steps);
  const authorProfile = resolveAuthor(article.author?.slug || article.author?.name);
  const authorPersonSchema = authorPersonJsonLd(authorProfile);

  const articleJsonLd = articleBlogPostingJsonLd({
    headline: article.title,
    description: article.seoDescription || article.excerpt,
    image: articleImage,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    authorNameOrSlug: authorProfile.slug,
    categoryName: article.category?.name,
    keywords: article.seoKeywords,
    type: 'BlogPosting',
    url: articleUrl,
  });

  const howTo = howToJsonLd({
    name: article.title,
    description: article.seoDescription || article.excerpt,
    url: articleUrl,
    image: articleImage,
    steps,
  });

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.originfacts.com/' },
      ...(article.category
        ? [{
            '@type': 'ListItem',
            position: 2,
            name: article.category.name,
            item: `https://www.originfacts.com/category/${article.category.slug}`,
          }]
        : []),
      {
        '@type': 'ListItem',
        position: article.category ? 3 : 2,
        name: article.title,
        item: articleUrl,
      },
    ],
  };

  return (
    <article data-testid="article-page">
      <JsonLd data={authorPersonSchema} />
      <JsonLd data={articleJsonLd} />
      {howTo && <JsonLd data={howTo} />}
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd(faqs)} />

      {/* Body — single 2-column layout: breadcrumb + title + featured image
          + body live in column 1 alongside BlogSidebar in column 2
          (frenify single post pattern). */}
      <div className="mx-auto max-w-7xl px-6 pt-8 pb-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0" data-testid="article-main">
            <nav
              aria-label="Breadcrumb"
              className="mb-6 border-y border-forest-900/15 py-2"
              data-testid="breadcrumb"
            >
              <ol
                itemScope
                itemType="https://schema.org/BreadcrumbList"
                className="flex flex-wrap items-center gap-x-3 gap-y-1 font-urbanist text-[12px] font-bold uppercase tracking-widest"
              >
                <li
                  itemProp="itemListElement"
                  itemScope
                  itemType="https://schema.org/ListItem"
                  className="flex items-center gap-3"
                >
                  <Link
                    href="/"
                    itemProp="item"
                    className="text-forest-950 transition hover:text-primary-emphasis"
                  >
                    <span itemProp="name">Home</span>
                  </Link>
                  <meta itemProp="position" content="1" />
                  <span aria-hidden className="text-forest-900/35">/</span>
                </li>
                {article.category && (
                  <li
                    itemProp="itemListElement"
                    itemScope
                    itemType="https://schema.org/ListItem"
                    className="flex items-center gap-3"
                  >
                    <Link
                      href={`/category/${article.category.slug}`}
                      itemProp="item"
                      className="text-forest-950 transition hover:text-primary-emphasis"
                    >
                      <span itemProp="name">{article.category.name}</span>
                    </Link>
                    <meta itemProp="position" content="2" />
                    <span aria-hidden className="text-forest-900/35">/</span>
                  </li>
                )}
                <li
                  itemProp="itemListElement"
                  itemScope
                  itemType="https://schema.org/ListItem"
                  aria-current="page"
                  className="truncate text-forest-900/55"
                >
                  <span itemProp="name">{article.title}</span>
                  <meta itemProp="position" content={article.category ? '3' : '2'} />
                </li>
              </ol>
            </nav>

            <header className="mb-8">
              <h1
                className="editorial-h text-[clamp(1.5rem,2vw+1rem,2rem)] font-bold leading-tight text-forest-900"
                data-testid="article-title"
              >
                {article.title}
              </h1>
              {article.excerpt ? (
                <p className="mt-5 text-base text-ink/75 sm:text-lg">{article.excerpt}</p>
              ) : null}
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-widest text-forest-800/70">
                {date && <time dateTime={article.publishedAt}>{date}</time>}
                {date && article.readingTimeMinutes ? (
                  <span aria-hidden className="text-forest-900/40">·</span>
                ) : null}
                {article.readingTimeMinutes ? (
                  <span>{article.readingTimeMinutes} min read</span>
                ) : null}
              </div>
              <div className="mt-6">
                <AuthorCard author={authorProfile} compact />
              </div>
            </header>

            <div className="mb-6">
              <ShareButtons title={article.title} slug={article.slug} />
            </div>

            {hero && (
              <div className="mb-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hero}
                  alt={article.coverImage?.alternativeText || article.title}
                  className="aspect-[16/9] w-full rounded-[0.3rem] object-cover"
                  fetchPriority="high"
                />
              </div>
            )}

            <KeyFacts tldr={article.tldr} keyFacts={article.keyFacts} />

            <TakeadsTravelOffers
              articleSlug={article.slug}
              title={article.title}
              category={article.category?.name}
            />

            <TableOfContents items={toc} />

            <div
              className="prose-article"
              data-testid="article-body"
              dangerouslySetInnerHTML={{ __html: processedHtml }}
            />

            <HowToSteps steps={steps} />


            {article.category?.slug === 'hotels' && <BookingHotelBanner articleSlug={article.slug} />}
            {article.category?.slug === 'flights' && <FlightBookingBanners articleSlug={article.slug} />}

            <AuthorCard author={authorProfile} />

            <CommentsSection slug={article.slug} />

            {(adjacent.prev || adjacent.next) && (
              <AdjacentPostsNav prev={adjacent.prev} next={adjacent.next} />
            )}

            {article.destinations && article.destinations.length > 0 && (
              <div className="mt-12 border-t border-forest-900/10 pt-8">
                <h3 className="editorial-h text-sm uppercase tracking-widest text-forest-800/70">Places in this story</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {article.destinations.map((d) => (
                    <Link key={d.id} href={`/destinations/${d.slug}`} className="chip hover:bg-forest-800/10">
                      {d.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {article.tags && article.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {article.tags.map((t) => (
                  <span key={t.id} className="rounded-full border border-forest-900/15 px-3 py-1 text-xs text-forest-900/70">
                    #{t.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <BlogSidebar
            popularPosts={sidebar.popular}
            recentPosts={sidebar.recent}
            categoryTiles={categoryTiles}
          />
        </div>
      </div>

      {/* Editor-managed FAQs (Strapi json field). FaqSection + faqJsonLd both
          no-op when the normalised list is empty (< 2 real Q&As). */}
      <FaqSection faqs={faqs} />

      {related.length > 0 && (
        <section
          className="border-t border-forest-900/10 bg-forest-900/[0.02]"
          data-testid="related-section"
        >
          <div className="mx-auto max-w-7xl px-6 py-16">
            <h2 className="editorial-h text-2xl font-bold text-forest-900 sm:text-3xl">
              Related Posts
            </h2>
            <div className="mt-8">
              <RelatedPostsSlider articles={related} />
            </div>
          </div>
        </section>
      )}
    </article>
  );
}

function BookingHotelBanner({ articleSlug }: { articleSlug: string }) {
  const href = `https://tatrck.com/h/0Hu30_OZ0V7N?model=cpc&s=${encodeURIComponent(
    `originfacts_article_${articleSlug}_booking_com_banner`,
  )}`;

  return (
    <aside
      className="mt-12 overflow-hidden rounded-[0.4rem] border border-[#003b95]/15 bg-gradient-to-r from-[#003b95] via-[#0057b8] to-[#febb02] p-[1px]"
      data-testid="booking-hotel-banner"
      aria-label="Sponsored Booking.com hotel offer"
    >
      <div className="flex flex-col gap-4 rounded-[0.35rem] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-urbanist text-[10px] font-bold uppercase tracking-[0.2em] text-[#003b95]/70">
            Sponsored · Booking.com
          </p>
          <p className="mt-1 font-urbanist text-lg font-bold leading-snug text-forest-950">
            Compare stays for your next trip
          </p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-forest-900/65">
            Search hotels, apartments and flexible stays before you lock in the final itinerary.
          </p>
        </div>
        <a
          href={href}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center rounded-[0.3rem] bg-[#003b95] px-5 py-2.5 font-urbanist text-sm font-bold text-white shadow-sm transition hover:bg-[#002f78]"
        >
          Search Booking.com <span aria-hidden className="ml-2">→</span>
        </a>
      </div>
    </aside>
  );
}

function FlightBookingBanners({ articleSlug }: { articleSlug: string }) {
  const offers = [
    {
      name: 'Kiwi.com',
      href: `https://tatrck.com/h/0Hu30_OZ0bgZ?model=cpa&s=${encodeURIComponent(
        `originfacts_article_${articleSlug}_kiwi_com_banner`,
      )}`,
      title: 'Check flexible flight combinations',
      description: 'Compare one-way, return and self-transfer options when price or routing matters most.',
      cta: 'Search Kiwi.com',
      theme: 'from-[#00a991] via-[#00bfa5] to-[#d7fff7]',
      button: 'bg-[#007f71] hover:bg-[#006b60]',
      label: 'text-[#007f71]/75',
    },
    {
      name: 'Trip.com',
      href: `https://www.trip.com/?utm_source=originfacts&utm_medium=affiliate_banner&utm_campaign=${encodeURIComponent(
        `article_${articleSlug}_trip_com_banner`,
      )}`,
      title: 'Compare flights with global trip tools',
      description: 'Look across fares, baggage choices and travel extras before choosing the ticket.',
      cta: 'Search Trip.com',
      theme: 'from-[#1d4ed8] via-[#2563eb] to-[#bcd7ff]',
      button: 'bg-[#1d4ed8] hover:bg-[#1e40af]',
      label: 'text-[#1d4ed8]/75',
    },
  ];

  return (
    <aside
      className="mt-12 grid gap-4 sm:grid-cols-2"
      data-testid="flight-affiliate-banners"
      aria-label="Sponsored flight booking offers"
    >
      {offers.map((offer) => (
        <div
          key={offer.name}
          className={`overflow-hidden rounded-[0.4rem] border border-forest-900/10 bg-gradient-to-r ${offer.theme} p-[1px]`}
          data-testid={`flight-affiliate-banner-${offer.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
        >
          <div className="flex h-full flex-col justify-between gap-4 rounded-[0.35rem] bg-white px-5 py-4">
            <div>
              <p className={`font-urbanist text-[10px] font-bold uppercase tracking-[0.2em] ${offer.label}`}>
                Sponsored · {offer.name}
              </p>
              <p className="mt-1 font-urbanist text-lg font-bold leading-snug text-forest-950">
                {offer.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-forest-900/65">
                {offer.description}
              </p>
            </div>
            <a
              href={offer.href}
              target="_blank"
              rel="sponsored nofollow noopener noreferrer"
              className={`inline-flex w-fit items-center justify-center rounded-[0.3rem] px-5 py-2.5 font-urbanist text-sm font-bold text-white shadow-sm transition ${offer.button}`}
            >
              {offer.cta} <span aria-hidden className="ml-2">→</span>
            </a>
          </div>
        </div>
      ))}
    </aside>
  );
}

function CommentsSection({ slug }: { slug: string }) {
  return (
    <section
      className="mt-12 border-t border-forest-900/10 pt-10"
      data-testid="comments-section"
      aria-labelledby="comments-heading"
    >
      <header>
        <h2
          id="comments-heading"
          className="editorial-h text-2xl font-bold text-forest-900 sm:text-3xl"
        >
          Leave a Reply
        </h2>
        <p className="mt-2 text-sm text-ink/65">
          Your email address will not be published. Required fields are marked{' '}
          <span className="text-primary-emphasis">*</span>
        </p>
      </header>

      <form
        action={`/api/comments/${slug}`}
        method="post"
        className="mt-8 grid gap-5"
        data-testid="comments-form"
      >
        <div className="grid gap-2">
          <label
            htmlFor="comment-body"
            className="text-[11px] font-bold uppercase tracking-widest text-forest-900"
          >
            Comment <span className="text-primary-emphasis">*</span>
          </label>
          <textarea
            id="comment-body"
            name="comment"
            rows={6}
            required
            className="w-full rounded-[0.3rem] border border-forest-900/15 bg-white px-4 py-3 text-sm text-forest-950 placeholder:text-forest-900/45 focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/20"
            placeholder="Share your thoughts on this story…"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div className="grid gap-2">
            <label
              htmlFor="comment-name"
              className="text-[11px] font-bold uppercase tracking-widest text-forest-900"
            >
              Name <span className="text-primary-emphasis">*</span>
            </label>
            <input
              id="comment-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              className="h-11 w-full rounded-[0.3rem] border border-forest-900/15 bg-white px-3 text-sm text-forest-950 focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/20"
            />
          </div>
          <div className="grid gap-2">
            <label
              htmlFor="comment-email"
              className="text-[11px] font-bold uppercase tracking-widest text-forest-900"
            >
              Email <span className="text-primary-emphasis">*</span>
            </label>
            <input
              id="comment-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-11 w-full rounded-[0.3rem] border border-forest-900/15 bg-white px-3 text-sm text-forest-950 focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/20"
            />
          </div>
          <div className="grid gap-2">
            <label
              htmlFor="comment-website"
              className="text-[11px] font-bold uppercase tracking-widest text-forest-900"
            >
              Website
            </label>
            <input
              id="comment-website"
              name="website"
              type="url"
              autoComplete="url"
              className="h-11 w-full rounded-[0.3rem] border border-forest-900/15 bg-white px-3 text-sm text-forest-950 focus:border-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary-emphasis/20"
            />
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-ink/75">
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            className="mt-1 h-4 w-4 rounded border-forest-900/30 text-primary-emphasis focus:ring-primary-emphasis"
          />
          <span>Save my name, email, and website in this browser for the next time I comment.</span>
        </label>

        <div>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-[0.3rem] bg-forest-900 px-6 font-urbanist text-sm font-bold uppercase tracking-wider text-white transition hover:bg-primary-emphasis"
          >
            Post Comment
          </button>
        </div>
      </form>
    </section>
  );
}

function AdjacentPostsNav({
  prev,
  next,
}: {
  prev: Awaited<ReturnType<typeof getAdjacentArticles>>['prev'];
  next: Awaited<ReturnType<typeof getAdjacentArticles>>['next'];
}) {
  return (
    <div
      className="mt-14 grid grid-cols-1 overflow-hidden rounded border border-forest-900/15 sm:grid-cols-2"
      data-testid="adjacent-posts"
    >
      {prev && <AdjacentPostCard direction="previous" article={prev} />}
      {!prev && next && <div className="hidden sm:block" />}
      {next && <AdjacentPostCard direction="next" article={next} />}
    </div>
  );
}

function AdjacentPostCard({
  direction,
  article,
}: {
  direction: 'previous' | 'next';
  article: NonNullable<Awaited<ReturnType<typeof getAdjacentArticles>>['prev']>;
}) {
  const img = mediaUrl(article.coverImage ?? null);
  const category = article.category?.name?.toUpperCase();
  const relative = article.publishedAt ? format(new Date(article.publishedAt), 'd MMM yyyy') : '';
  const isNext = direction === 'next';
  const label = isNext ? 'NEXT POST' : 'PREVIOUS POST';

  return (
    <Link
      href={`/articles/${article.slug}`}
      className={`group flex flex-col gap-4 p-5 sm:p-6 ${isNext ? 'sm:border-l sm:border-forest-900/15' : ''}`}
      data-testid={`adjacent-${direction}`}
    >
      <div
        className={`flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-forest-900 ${
          isNext ? 'justify-end' : ''
        }`}
      >
        {!isNext && <span aria-hidden className="h-px w-10 bg-forest-900/25" />}
        {isNext && <span>{label}</span>}
        {!isNext && <span>{label}</span>}
        {isNext && <span aria-hidden className="h-px w-10 bg-forest-900/25" />}
      </div>

      <div
        className={`grid items-center gap-4 ${
          isNext
            ? 'grid-cols-[minmax(0,1fr)_80px] text-right'
            : 'grid-cols-[80px_minmax(0,1fr)]'
        }`}
      >
        {!isNext && (
          <div className="overflow-hidden rounded bg-forest-900/5">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt={article.coverImage?.alternativeText || article.title}
                className="aspect-square h-full w-full object-cover transition duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="aspect-square bg-gradient-to-br from-primary-hover to-primary-pressed" />
            )}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-primary-emphasis">
            {category && <span>{category}</span>}
            {category && relative && (
              <span aria-hidden className="mx-2 text-forest-900/40">✱</span>
            )}
            {relative && <span className="text-forest-900/55">{relative}</span>}
          </div>
          <h3 className="mt-2 line-clamp-2 font-urbanist text-lg font-bold leading-snug text-forest-950 transition group-hover:text-primary-emphasis sm:text-xl">
            {article.title}
          </h3>
        </div>
        {isNext && (
          <div className="overflow-hidden rounded bg-forest-900/5">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt={article.coverImage?.alternativeText || article.title}
                className="aspect-square h-full w-full object-cover transition duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="aspect-square bg-gradient-to-br from-primary-hover to-primary-pressed" />
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

/**
 * Some CMS entries were saved with escaped newlines ("\\n\\n## Heading"), so
 * marked saw one long line and put the whole article inside a single heading.
 * Only content that carries an escaped paragraph break is touched.
 */
function unescapeNewlines(content: string): string {
  return content.includes('\\n\\n') ? content.replace(/(?:\\r)?\\n/g, '\n') : content;
}
