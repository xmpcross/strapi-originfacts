import Image from 'next/image';
import Link from 'next/link';

import { mediaUrl, type StrapiArticle } from '@/lib/strapi';

/**
 * Story cards for the home page. Server components only.
 *
 * Each card is an image link (hidden from assistive tech and the tab order, so
 * keyboard and screen-reader users meet each story once) plus a category link
 * and a title link. Covers come from the CMS only; a story without one gets a
 * plain branded panel at the same aspect ratio, so nothing shifts.
 */

export function shortDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const href = (a: StrapiArticle) => `/articles/${a.slug}`;

function altFor(a: StrapiArticle): string {
  return a.coverImage?.alternativeText?.trim() || `Cover image: ${a.title}`;
}

/** Fixed-ratio cover. `ratio` is a Tailwind aspect class so the box is sized before the image loads. */
export function Cover({
  article,
  ratio,
  sizes,
  priority = false,
  className = '',
}: {
  article: StrapiArticle;
  ratio: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const src = mediaUrl(article.coverImage ?? null);
  return (
    <Link
      href={href(article)}
      tabIndex={-1}
      aria-hidden="true"
      className={`group/cover relative block overflow-hidden rounded-[0.3rem] bg-forest-100 ${ratio} ${className}`}
    >
      {src ? (
        <Image
          src={src}
          alt={altFor(article)}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-500 ease-out group-hover/cover:scale-[1.03] motion-reduce:transition-none"
        />
      ) : (
        <span className="absolute inset-0 flex items-end bg-gradient-to-br from-forest-800 via-forest-900 to-forest-950 p-4">
          <span className="text-xs font-bold uppercase tracking-widest text-sand-300">
            {article.category?.name ?? 'Originfacts'}
          </span>
        </span>
      )}
    </Link>
  );
}

/** Category · date · read time. The category is its own link. */
export function StoryMeta({
  article,
  tone = 'light',
  showCategory = true,
  className = '',
}: {
  article: StrapiArticle;
  tone?: 'light' | 'dark';
  showCategory?: boolean;
  className?: string;
}) {
  const date = shortDate(article.publishedAt);
  const muted = tone === 'dark' ? 'text-white/70' : 'text-forest-900/60';
  const cat = tone === 'dark' ? 'text-sand-300 hover:text-white' : 'text-primary-emphasis hover:text-primary-emphasisHover';
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase tracking-wider ${muted} ${className}`}>
      {showCategory && article.category && (
        <>
          <Link href={`/category/${article.category.slug}`} className={`font-bold underline-offset-2 hover:underline ${cat}`}>
            {article.category.name}
          </Link>
          {(date || article.readingTimeMinutes) && <span aria-hidden="true">·</span>}
        </>
      )}
      {date && <time dateTime={article.publishedAt}>{date}</time>}
      {article.readingTimeMinutes ? (
        <>
          {date && <span aria-hidden="true">·</span>}
          <span>{article.readingTimeMinutes} min read</span>
        </>
      ) : null}
    </p>
  );
}

function TitleLink({ article, className, tone = 'light' }: { article: StrapiArticle; className: string; tone?: 'light' | 'dark' }) {
  return (
    <Link
      href={href(article)}
      className={`rounded-[0.2rem] underline-offset-4 decoration-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
        tone === 'dark' ? 'focus-visible:outline-sand-300' : 'focus-visible:outline-primary-emphasis'
      } ${className}`}
    >
      {article.title}
    </Link>
  );
}

/** The hero's lead story: big cover, big headline, excerpt. */
export function LeadStory({ article }: { article: StrapiArticle }) {
  return (
    <article className="min-w-0" data-testid="home-lead-story">
      <Cover article={article} ratio="aspect-[16/9]" sizes="(min-width: 1420px) 800px, (min-width: 1024px) 56vw, 100vw" priority />
      <StoryMeta article={article} className="mt-5" />
      <h2 className="mt-2 text-[1.75rem] leading-[1.15] sm:text-4xl lg:text-[2.6rem]">
        <TitleLink article={article} className="text-forest-950" />
      </h2>
      {article.excerpt && <p className="mt-3 max-w-2xl text-base leading-relaxed text-forest-900/75 sm:text-lg">{article.excerpt}</p>}
      <Link
        href={href(article)}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary-emphasis underline-offset-4 hover:underline"
        aria-label={`Read the story: ${article.title}`}
      >
        Read the story <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

/**
 * Hero mosaic tile. A row (thumbnail beside the title) on phones, a stacked
 * card from `sm` up.
 */
export function MosaicStory({ article }: { article: StrapiArticle }) {
  return (
    <article className="grid min-w-0 grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-4 sm:block">
      <Cover article={article} ratio="aspect-[4/3] sm:aspect-[16/10]" sizes="(min-width: 1420px) 290px, (min-width: 1024px) 20vw, (min-width: 640px) 45vw, 120px" />
      <div className="min-w-0 sm:mt-3">
        <StoryMeta article={article} />
        <h3 className="mt-1.5 text-base leading-snug sm:text-[1.05rem]">
          <TitleLink article={article} className="line-clamp-3 text-forest-950" />
        </h3>
      </div>
    </article>
  );
}

/** Standard grid card: cover, meta, title, excerpt. */
export function StoryCard({ article }: { article: StrapiArticle }) {
  return (
    // Phones: a thumbnail row, so a run of cards does not become a wall of full-width images.
    <article className="grid min-w-0 grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-4 sm:flex sm:flex-col sm:gap-0">
      <Cover
        article={article}
        ratio="aspect-[4/3] sm:aspect-[16/10]"
        sizes="(min-width: 1420px) 440px, (min-width: 1024px) 31vw, (min-width: 640px) 48vw, 120px"
      />
      <div className="min-w-0">
        <StoryMeta article={article} className="sm:mt-4" />
        <h3 className="mt-1.5 text-base leading-snug sm:text-xl">
          <TitleLink article={article} className="text-forest-950" />
        </h3>
        {article.excerpt && (
          <p className="mt-2 hidden text-sm leading-relaxed text-forest-900/75 sm:line-clamp-3">{article.excerpt}</p>
        )}
      </div>
    </article>
  );
}

/**
 * Wide card for the first slot of a grid: a full-width 16:9 cover with the
 * headline set on it from `md` up (over a navy gradient for contrast), and a
 * normal stacked card on phones, where an overlay would crowd the image.
 */
export function WideStoryCard({ article }: { article: StrapiArticle }) {
  const date = shortDate(article.publishedAt);
  return (
    <article className="relative min-w-0" data-testid="home-wide-story">
      <Cover
        article={article}
        ratio="aspect-[16/10] md:aspect-[16/9]"
        sizes="(min-width: 1420px) 920px, (min-width: 1024px) 66vw, 100vw"
      />
      <div className="mt-4 md:pointer-events-none md:absolute md:inset-x-0 md:bottom-0 md:mt-0 md:rounded-b-[0.3rem] md:bg-gradient-to-t md:from-forest-950 md:via-forest-950/80 md:to-transparent md:px-8 md:pb-7 md:pt-28">
        <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold uppercase tracking-wider text-forest-900/60 md:text-white/80">
          {article.category && (
            <>
              <Link
                href={`/category/${article.category.slug}`}
                className="pointer-events-auto font-bold text-primary-emphasis underline-offset-2 hover:underline md:text-sand-300"
              >
                {article.category.name}
              </Link>
              <span aria-hidden="true">·</span>
            </>
          )}
          {date && <time dateTime={article.publishedAt}>{date}</time>}
          {article.readingTimeMinutes ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{article.readingTimeMinutes} min read</span>
            </>
          ) : null}
        </p>
        <h3 className="mt-2 max-w-3xl text-2xl leading-tight sm:text-[1.75rem] md:!text-white lg:text-[2rem]">
          <Link
            href={href(article)}
            className="pointer-events-auto rounded-[0.2rem] text-forest-950 underline-offset-4 decoration-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis md:text-white md:focus-visible:outline-sand-300"
          >
            {article.title}
          </Link>
        </h3>
        {article.excerpt && (
          <p className="mt-2 line-clamp-3 max-w-2xl text-base leading-relaxed text-forest-900/75 md:line-clamp-2 md:text-white/85">
            {article.excerpt}
          </p>
        )}
      </div>
    </article>
  );
}

/** Compact row: small thumbnail beside the title. */
export function StoryRow({
  article,
  tone = 'light',
  showCategory = false,
}: {
  article: StrapiArticle;
  tone?: 'light' | 'dark';
  showCategory?: boolean;
}) {
  return (
    <article className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
      <Cover article={article} ratio="aspect-[4/3]" sizes="(min-width: 640px) 136px, 104px" />
      <div className="min-w-0">
        <StoryMeta article={article} tone={tone} showCategory={showCategory} />
        <h3 className={`mt-1.5 text-base leading-snug ${tone === 'dark' ? '!text-white' : ''}`}>
          <TitleLink article={article} tone={tone} className={`line-clamp-3 ${tone === 'dark' ? 'text-white' : 'text-forest-950'}`} />
        </h3>
      </div>
    </article>
  );
}

/** Numbered chapter label, as on /about. */
export function Kicker({ n, label, tone = 'light' }: { n: string; label: string; tone?: 'light' | 'dark' }) {
  return (
    <p
      className={`flex items-center gap-3 text-xs font-bold uppercase tracking-widest ${
        tone === 'dark' ? 'text-sand-300' : 'text-primary-emphasis'
      }`}
    >
      <span className={`font-mono ${tone === 'dark' ? 'text-white/55' : 'text-forest-900/45'}`}>{n}</span>
      <span aria-hidden="true" className={`h-px w-8 ${tone === 'dark' ? 'bg-sand-300/50' : 'bg-primary-emphasis/40'}`} />
      {label}
    </p>
  );
}
