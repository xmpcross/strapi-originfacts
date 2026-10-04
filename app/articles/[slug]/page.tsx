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
import AdSlot from '@/components/AdSlot';
import ShareButtons from '@/components/ShareButtons';
import BlogSidebar from '@/components/BlogSidebar';
import RelatedPostsSlider from '@/components/RelatedPostsSlider';
import { SECTIONS } from '@/lib/sections';
import { DEFAULT_OG_IMAGE, faqJsonLd, howToJsonLd, normalizeFaqs, normalizeSteps } from '@/lib/entity-seo';
import { JsonLd, FaqSection, HowToSteps } from '@/components/SeoBlocks';
import KeyFacts from '@/components/KeyFacts';
import { buildMetaDescription, warnIfLong } from '@/lib/seo';
import type { Metadata } from 'next';

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) return { title: 'Not found' };
  const ogImg = mediaUrl(a.ogImage ?? a.coverImage ?? null);
  warnIfLong(`/articles/${a.slug}`, { title: a.seoTitle || a.title, description: a.seoDescription || a.excerpt });
  const description = buildMetaDescription([a.seoDescription, a.excerpt]);
  return {
    title: a.seoTitle || a.title,
    description,
    alternates: { canonical: `/articles/${a.slug}` },
    openGraph: {
      title: a.seoTitle || a.title,
      description,
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

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const rawHtml = await marked.parse(article.content || '', { async: true });
  const html = interleaveGallery(rawHtml, article.gallery, article.title);
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
  // Structured FAQ component entries (faq.item, sorted by `order`) take
  // precedence over the legacy `faqs` json field. Both shapes flow through
  // normalizeFaqs, so FaqSection and faqJsonLd stay a single source.
  const componentFaqs = (article.faqItems ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const faqs = componentFaqs.length ? normalizeFaqs(componentFaqs) : normalizeFaqs(article.faqs);
  const steps = normalizeSteps(article.steps);

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.seoDescription || article.excerpt,
    image: articleImage ? [articleImage] : undefined,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    // A byline only becomes schema.org Person when it is a real person's
    // name. House/team bylines ("FXN Studio Editorial") are an Organization —
    // asserting them as Person is a machine-readable falsehood.
    author: article.author?.name
      ? /editorial|studio|team|staff|desk|newsroom/i.test(article.author.name)
        ? { '@type': 'Organization', name: article.author.name }
        : { '@type': 'Person', name: article.author.name }
      : { '@type': 'Organization', name: 'Originfacts' },
    publisher: {
      '@type': 'Organization',
      name: 'Originfacts',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.originfacts.com/brand/logo/logo.svg',
      },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
    url: articleUrl,
    articleSection: article.category?.name,
    keywords: article.seoKeywords,
  };

  // A filled steps field flags this post as a HowTo: emit HowTo JSON-LD
  // INSTEAD of Article (never both on one page), with the visible numbered
  // steps rendered below the body via <HowToSteps />.
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo ?? articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
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
              {article.excerpt && (
                <p className="mt-5 text-base text-ink/75 sm:text-lg">{article.excerpt}</p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-widest text-forest-800/70">
                {date && <time dateTime={article.publishedAt}>{date}</time>}
                {date && article.readingTimeMinutes ? (
                  <span aria-hidden className="text-forest-900/40">·</span>
                ) : null}
                {article.readingTimeMinutes ? (
                  <span>{article.readingTimeMinutes} min read</span>
                ) : null}
              </div>
              {article.author && (
                <div className="mt-6 flex items-center gap-3 text-sm text-forest-900/80">
                  {mediaUrl(article.author.avatar ?? null) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrl(article.author.avatar ?? null)!}
                      alt={article.author.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  )}
                  <span>
                    by <strong className="text-forest-900">{article.author.name}</strong>
                  </span>
                </div>
              )}
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
                />
              </div>
            )}

            <KeyFacts tldr={article.tldr} keyFacts={article.keyFacts} />

            <div
              className="prose-article"
              data-testid="article-body"
              dangerouslySetInnerHTML={{ __html: html }}
            />

            <HowToSteps steps={steps} />

            <AdSlot slot="0000000000" className="mt-12" />

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
