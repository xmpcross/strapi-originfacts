import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { mediaUrl, type StrapiArticle } from '@/lib/strapi';

function Eyebrow({ article, light = false }: { article: StrapiArticle; light?: boolean }) {
  const category = article.category?.name;
  const relative = article.publishedAt
    ? formatDistanceToNowStrict(new Date(article.publishedAt), { addSuffix: true })
    : null;
  if (!category && !relative) return null;
  return (
    <div
      className={`text-[11px] font-bold uppercase tracking-wider ${
        light ? 'text-white/85' : 'text-primary-emphasis'
      }`}
    >
      {category && <span>{category}</span>}
      {category && relative && (
        <span aria-hidden className={`mx-2 ${light ? 'text-white/55' : 'text-forest-900/40'}`}>
          ✱
        </span>
      )}
      {relative && (
        <span className={light ? 'text-white/80' : 'text-forest-900/55'}>{relative}</span>
      )}
    </div>
  );
}

function CoverImage({
  article,
  aspect,
  priority = false,
}: {
  article: StrapiArticle;
  aspect: string;
  priority?: boolean;
}) {
  const img = mediaUrl(article.coverImage ?? null);
  return (
    <div
      className={`overflow-hidden rounded-[0.3rem] bg-forest-900/5 ${aspect}`}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={article.coverImage?.alternativeText || article.title}
          loading={priority ? 'eager' : 'lazy'}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-forest-800 to-forest-950" />
      )}
    </div>
  );
}

function LargeCard({ article, priority = false }: { article: StrapiArticle; priority?: boolean }) {
  return (
    <article
      className="group flex flex-col"
      data-testid={`category-hero-large-${article.slug}`}
    >
      <Link href={`/articles/${article.slug}`} className="block">
        <CoverImage article={article} aspect="aspect-[5/4]" priority={priority} />
      </Link>
      <div className="mt-4">
        <Eyebrow article={article} />
        <Link href={`/articles/${article.slug}`}>
          <h3 className="mt-2 text-xl font-bold leading-snug text-forest-950 transition group-hover:text-primary-emphasis sm:text-2xl">
            {article.title}
          </h3>
        </Link>
      </div>
    </article>
  );
}

function MediumCard({ article }: { article: StrapiArticle }) {
  return (
    <article
      className="group flex flex-col"
      data-testid={`category-hero-medium-${article.slug}`}
    >
      <Link href={`/articles/${article.slug}`} className="block">
        <CoverImage article={article} aspect="aspect-[16/11]" />
      </Link>
      <div className="mt-3">
        <Eyebrow article={article} />
        <Link href={`/articles/${article.slug}`}>
          <h3 className="mt-2 text-base font-bold leading-snug text-forest-950 transition group-hover:text-primary-emphasis sm:text-lg">
            {article.title}
          </h3>
        </Link>
      </div>
    </article>
  );
}

function MiniRow({ article }: { article: StrapiArticle }) {
  const img = mediaUrl(article.coverImage ?? null);
  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group grid grid-cols-[80px_minmax(0,1fr)] items-center gap-3 py-3 first:pt-0 last:pb-0"
      data-testid={`category-hero-mini-${article.slug}`}
    >
      <div className="overflow-hidden rounded-[0.3rem] bg-forest-900/5">
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
      <div className="min-w-0">
        <Eyebrow article={article} />
        <h4 className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-forest-950 transition group-hover:text-primary-emphasis">
          {article.title}
        </h4>
      </div>
    </Link>
  );
}

function SidebarAd() {
  return (
    <a
      href="/contact"
      aria-label="Advertise with Originfacts"
      className="block overflow-hidden rounded-[0.3rem] bg-gradient-to-br from-[#15172b] via-[#1f2240] to-[#15172b]"
      data-testid="category-hero-ad"
    >
      <p className="px-3 pt-3 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
        Advertisement
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ads/mow-banner-square.jpg"
        alt="Modern blog and magazine theme"
        className="h-[300px] w-[300px] object-cover"
      />
    </a>
  );
}

export default function CategoryHero({ articles }: { articles: StrapiArticle[] }) {
  if (articles.length === 0) return null;

  const col1 = articles.slice(0, 2);
  const col2 = articles.slice(2, 5);
  const col3Mini = articles.slice(5, 9);
  const col3Feature = articles[9];

  return (
    <div
      className="grid gap-8 lg:grid-cols-[1.8fr_1fr_1fr] lg:gap-10"
      data-testid="category-hero"
    >
      {/* Col 1 — two large feature cards */}
      <div className="space-y-8 lg:space-y-10">
        {col1.map((a, i) => (
          <LargeCard key={a.id} article={a} priority={i === 0} />
        ))}
      </div>

      {/* Col 2 — three medium cards */}
      {col2.length > 0 && (
        <div className="space-y-6 lg:space-y-8">
          {col2.map((a) => (
            <MediumCard key={a.id} article={a} />
          ))}
        </div>
      )}

      {/* Col 3 — ad + mini list + feature card */}
      {(col3Mini.length > 0 || col3Feature) && (
        <div className="space-y-6 lg:space-y-8">
          <SidebarAd />
          {col3Mini.length > 0 && (
            <div className="divide-y divide-forest-900/10">
              {col3Mini.map((a) => (
                <MiniRow key={a.id} article={a} />
              ))}
            </div>
          )}
          {col3Feature && <MediumCard article={col3Feature} />}
        </div>
      )}
    </div>
  );
}
