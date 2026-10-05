import Image from 'next/image';
import Link from 'next/link';
import type { CategoryCard } from './search';

/* Shared by the server page and the client browser: no server-only imports. */

export function CardMeta({ card, className = '' }: { card: CategoryCard; className?: string }) {
  const parts = [
    card.date ? (
      <time key="d" dateTime={card.dateIso ?? undefined}>
        {card.date}
      </time>
    ) : null,
    card.readingMinutes ? <span key="r">{card.readingMinutes} min read</span> : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <p className={`flex flex-wrap items-center gap-x-2 text-xs font-semibold uppercase tracking-wider text-forest-900/55 ${className}`}>
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-forest-900/30" />}
          {p}
        </span>
      ))}
    </p>
  );
}

function DestinationLabel({ card }: { card: CategoryCard }) {
  const d = card.destinations[0];
  if (!d) return null;
  return <span className="text-xs font-bold uppercase tracking-widest text-primary-emphasis">{d.name}</span>;
}

function Cover({
  card,
  className,
  sizes,
  priority = false,
}: {
  card: CategoryCard;
  className: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-[0.3rem] bg-forest-100 ${className}`}>
      {card.image ? (
        <Image
          src={card.image}
          alt={card.imageAlt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-primary-hover to-primary-pressed" />
      )}
    </div>
  );
}

/** The newest article, large. */
export function LeadStory({ card }: { card: CategoryCard }) {
  return (
    <article className="group min-w-0" data-testid={`category-v2-lead-${card.slug}`}>
      <Link href={`/articles/${card.slug}`} className="block">
        <Cover card={card} className="aspect-[16/10]" sizes="(min-width: 1024px) 760px, 100vw" priority />
        <div className="mt-5">
          <DestinationLabel card={card} />
          <h2 className="mt-2 text-3xl font-bold leading-tight text-forest-950 transition group-hover:text-primary-emphasis sm:text-4xl">
            {card.title}
          </h2>
          {card.excerpt && (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-forest-900/75 sm:text-lg">{card.excerpt}</p>
          )}
          <CardMeta card={card} className="mt-4" />
        </div>
      </Link>
    </article>
  );
}

/** Image-left row, used beside the lead story. */
export function SecondaryStory({ card }: { card: CategoryCard }) {
  return (
    <article className="group min-w-0" data-testid={`category-v2-secondary-${card.slug}`}>
      <Link href={`/articles/${card.slug}`} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 sm:gap-5 lg:grid-cols-1">
        <Cover card={card} className="aspect-[4/3] lg:aspect-[16/9]" sizes="(min-width: 1024px) 480px, 40vw" />
        <div className="min-w-0">
          <DestinationLabel card={card} />
          <h3 className="mt-1 text-lg font-bold leading-snug text-forest-950 transition group-hover:text-primary-emphasis sm:text-xl">
            {card.title}
          </h3>
          {card.excerpt && (
            <div className="mt-2 hidden sm:block">
              <p className="line-clamp-2 text-sm leading-relaxed text-forest-900/70">{card.excerpt}</p>
            </div>
          )}
          <CardMeta card={card} className="mt-2" />
        </div>
      </Link>
    </article>
  );
}

/** Grid card for the full listing. */
export function GridCard({ card }: { card: CategoryCard }) {
  return (
    <article className="group flex h-full min-w-0 flex-col" data-testid={`category-v2-card-${card.slug}`}>
      <Link href={`/articles/${card.slug}`} className="flex h-full flex-col">
        <Cover card={card} className="aspect-[16/10]" sizes="(min-width: 1280px) 420px, (min-width: 640px) 45vw, 100vw" />
        <div className="mt-4 flex flex-1 flex-col">
          <DestinationLabel card={card} />
          <h3 className="mt-1 text-lg font-bold leading-snug text-forest-950 transition group-hover:text-primary-emphasis sm:text-xl">
            {card.title}
          </h3>
          {card.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-forest-900/70">{card.excerpt}</p>}
          <CardMeta card={card} className="mt-auto pt-3" />
        </div>
      </Link>
    </article>
  );
}
