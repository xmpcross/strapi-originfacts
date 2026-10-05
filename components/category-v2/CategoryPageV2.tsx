import Image from 'next/image';
import Link from 'next/link';
import BlogSidebar, { type SidebarCategoryTile } from '@/components/BlogSidebar';
import type { StrapiArticle } from '@/lib/strapi';
import CategoryBrowser from './CategoryBrowser';
import { LeadStory, SecondaryStory } from './Cards';
import { categoryStats, destinationChips, toCard } from './view';
import type { CategoryCard } from './search';

/**
 * v2 editorial layout for /category/[slug], gated by
 * lib/category-template-v2.ts. The route still owns data fetching, metadata,
 * canonical and JSON-LD; this component only renders what it is handed.
 *
 *   Hero      name, standfirst, mosaic of recent covers
 *   Numbers   counted from the articles
 *   01 Latest newest article + the next two (page 1 only)
 *   02 All    search, destination chips, the ?page= grid, sidebar
 *   03 More   the other categories with their article counts
 */
export default function CategoryPageV2({
  slug,
  name,
  standfirst,
  page,
  pageCount,
  total,
  articles,
  index,
  navItems,
  sidebar,
  categoryTiles,
}: {
  slug: string;
  name: string;
  standfirst: string | null;
  page: number;
  pageCount: number;
  total: number;
  articles: StrapiArticle[];
  /** Every article in the category (slim), or [] if the index fetch failed. */
  index: StrapiArticle[];
  navItems: { href: string; slug: string; name: string }[];
  sidebar: { recent: StrapiArticle[]; popular: StrapiArticle[] };
  categoryTiles: SidebarCategoryTile[];
}) {
  const pageCards = articles.map(toCard);
  const indexCards = index.map(toCard);
  const stats = categoryStats(total, indexCards);
  const chips = destinationChips(indexCards);

  // Page 1 opens with the three newest articles; deeper pages go straight to the grid.
  const showLead = page === 1 && pageCards.length > 0;
  const lead = showLead ? pageCards[0] : null;
  const secondary = showLead ? pageCards.slice(1, 3) : [];
  const gridCards = showLead ? pageCards.slice(3) : pageCards;

  // Hero mosaic: covers from the category that are not already in the lead block.
  const leadSlugs = new Set([lead, ...secondary].filter(Boolean).map((c) => (c as CategoryCard).slug));
  const mosaic = indexCards.filter((c) => c.image && !leadSlugs.has(c.slug)).slice(0, 3);
  const showMosaic = page === 1 && mosaic.length === 3;

  const otherCategories = categoryTiles.filter((t) => t.slug !== slug && t.count > 0);
  const lower = name.toLowerCase();

  return (
    <div className="overflow-x-clip" data-testid={`category-page-${slug}`} data-template="category-v2">
      {/* ---------------- Hero ---------------- */}
      <header className="mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-6 sm:pt-16" data-testid="category-header">
        <div
          className={`grid items-center gap-10 ${showMosaic ? 'lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14' : ''}`}
        >
          <div className="min-w-0">
            <p className="eyebrow-tag">Category</p>
            <h1 className="mt-5 text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-7xl">
              {name}
            </h1>
            {page > 1 && (
              <p className="mt-3 text-lg font-semibold text-forest-900/55">
                Page {page} of {pageCount}
              </p>
            )}
            {standfirst && (
              <p className="mt-6 max-w-2xl text-xl font-semibold leading-snug text-forest-900 sm:text-2xl" data-testid="category-description">
                {standfirst}
              </p>
            )}
            {total > 0 && (
              <p className="mt-5 text-sm text-forest-900/65" data-testid="category-article-count">
                {total} {total === 1 ? 'article' : 'articles'}, newest first.{' '}
                <Link href="/methodology" className="font-semibold text-forest-950 underline-offset-2 hover:underline">
                  How we research and write →
                </Link>
              </p>
            )}
          </div>

          {showMosaic && (
            <div className="hidden min-w-0 grid-cols-3 gap-2 sm:grid sm:gap-3" data-testid="category-v2-mosaic">
              <MosaicTile card={mosaic[0]} className="col-span-2 row-span-2 aspect-[4/5]" sizes="(min-width: 1024px) 460px, 66vw" />
              <MosaicTile card={mosaic[1]} className="h-full" sizes="(min-width: 1024px) 230px, 33vw" />
              <MosaicTile card={mosaic[2]} className="h-full" sizes="(min-width: 1024px) 230px, 33vw" />
            </div>
          )}
        </div>

        <nav
          className="no-scrollbar mt-10 flex gap-x-7 overflow-x-auto border-y border-forest-900/15 py-4 text-[13px] font-bold uppercase tracking-widest text-forest-950 sm:flex-wrap sm:overflow-visible"
          aria-label="Categories"
          data-testid="category-subnav"
        >
          {navItems.map((item) => (
            <Link
              key={item.slug}
              href={item.href}
              className={`flex-none transition hover:text-primary-emphasis ${item.slug === slug ? 'text-primary-emphasis' : ''}`}
              aria-current={item.slug === slug ? 'page' : undefined}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </header>

      {/* ---------------- Numbers ---------------- */}
      {stats.length > 1 && (
        <section aria-label={`${name} in numbers`} className="border-y border-forest-900/15 bg-paper" data-testid="category-v2-stats">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex min-w-0 flex-col-reverse border-l-2 border-primary-emphasis pl-4">
                <dt className="mt-2 text-xs font-bold uppercase tracking-widest text-forest-900/60">{s.label}</dt>
                <dd className="text-3xl font-bold leading-none text-forest-950 sm:text-4xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* ---------------- 01 Latest ---------------- */}
        {lead && (
          <section className="py-14 sm:py-16" aria-labelledby="category-v2-latest" data-testid="category-v2-latest">
            <Kicker n="01" label="Latest" />
            <h2 id="category-v2-latest" className="sr-only">
              Latest {lower} articles
            </h2>
            <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-12">
              <LeadStory card={lead} />
              {secondary.length > 0 && (
                <div className="grid min-w-0 content-start gap-8 border-t border-forest-900/10 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                  {secondary.map((c) => (
                    <SecondaryStory key={c.slug} card={c} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ---------------- 02 All articles ---------------- */}
        <section
          className={`pb-16 sm:pb-20 ${lead ? 'border-t border-forest-900/15 pt-14 sm:pt-16' : 'pt-12'}`}
          aria-labelledby="category-v2-all"
          data-testid="category-v2-all"
        >
          <Kicker n={lead ? '02' : '01'} label="Archive" />
          <h2 id="category-v2-all" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
            Every article in {name}
          </h2>
          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
            <main className="min-w-0">
              <CategoryBrowser
                categoryName={name}
                slug={slug}
                pageCards={gridCards}
                indexCards={indexCards}
                chips={chips}
                page={page}
                pageCount={pageCount}
                allShownAbove={lead !== null && gridCards.length === 0}
              />
            </main>
            <BlogSidebar
              popularPosts={sidebar.popular}
              recentPosts={sidebar.recent}
              categoryTiles={categoryTiles}
              backToTopHref={`/category/${slug}`}
            />
          </div>
        </section>

        {/* ---------------- 03 More categories ---------------- */}
        {otherCategories.length > 0 && (
          <section className="border-t border-forest-900/15 py-14 sm:py-16" aria-labelledby="category-v2-more" data-testid="category-v2-related">
            <Kicker n={lead ? '03' : '02'} label="Keep reading" />
            <h2 id="category-v2-more" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
              More from Originfacts
            </h2>
            <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {otherCategories.map((t) => (
                <li key={t.slug} className="min-w-0">
                  <Link
                    href={`/category/${t.slug}`}
                    className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-[0.3rem] bg-forest-950 p-5"
                  >
                    {t.image && (
                      <Image
                        src={t.image}
                        alt={`Cover image of the latest ${t.name} article`}
                        fill
                        sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw"
                        loading="lazy"
                        className="object-cover opacity-70 transition duration-500 group-hover:scale-105 group-hover:opacity-80"
                      />
                    )}
                    <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-forest-950/90 via-forest-950/30 to-transparent" />
                    <span className="relative flex w-full items-baseline justify-between gap-3">
                      <span className="text-2xl font-bold leading-tight text-white">{t.name}</span>
                      <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-white/75">
                        {t.count} article{t.count === 1 ? '' : 's'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Kicker({ n, label }: { n: string; label: string }) {
  return (
    <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-primary-emphasis">
      <span className="font-mono text-forest-900/45">{n}</span>
      <span aria-hidden className="h-px w-8 bg-primary-emphasis/40" />
      {label}
    </p>
  );
}

function MosaicTile({ card, className, sizes }: { card: CategoryCard; className: string; sizes: string }) {
  return (
    <Link
      href={`/articles/${card.slug}`}
      className={`group relative block min-w-0 overflow-hidden rounded-[0.3rem] bg-forest-100 ${className}`}
      title={card.title}
    >
      {card.image && (
        <Image src={card.image} alt={card.imageAlt} fill sizes={sizes} priority className="object-cover transition-transform duration-500 group-hover:scale-105" />
      )}
      <span className="sr-only">{card.title}</span>
    </Link>
  );
}
