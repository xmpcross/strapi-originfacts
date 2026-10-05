import Link from 'next/link';
import { format } from 'date-fns';
import type { AuthorProfile } from '@/lib/authors';
import type { AuthorStats } from '@/lib/author-directory';
import AuthorAvatar from './AuthorAvatar';

/**
 * One author on /authors: who they are (CMS name, role, bio), what they cover
 * and how much (counted from their bylined articles), and their latest pieces.
 * Shows nothing the CMS does not hold: no credentials, no invented expertise.
 */
export default function AuthorDirectoryCard({
  author,
  stats,
  priority = false,
}: {
  author: AuthorProfile;
  stats: AuthorStats;
  priority?: boolean;
}) {
  const href = `/authors/${author.slug}`;
  const links = [
    author.socials?.website ? { label: 'Website', href: author.socials.website } : null,
    author.socials?.linkedin ? { label: 'LinkedIn', href: author.socials.linkedin } : null,
    author.socials?.x ? { label: 'X', href: author.socials.x } : null,
  ].filter((l): l is { label: string; href: string } => l !== null);

  return (
    <article
      className="grid min-w-0 grid-cols-1 overflow-hidden rounded-[0.3rem] border border-forest-900/15 bg-white lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
      data-testid={`author-card-${author.slug}`}
      aria-labelledby={`author-${author.slug}-name`}
    >
      <div className="min-w-0 p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Link href={href} className="shrink-0 self-start" aria-hidden tabIndex={-1}>
            <AuthorAvatar author={author} size={112} priority={priority} className="ring-4 ring-sand-100" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-primary-emphasis">{author.jobTitle}</p>
            <h3 id={`author-${author.slug}-name`} className="mt-1 text-3xl font-bold leading-tight text-forest-950">
              <Link href={href} className="hover:text-primary-emphasis">
                {author.name}
              </Link>
            </h3>
            {stats.articleCount > 0 && (
              <p className="mt-1 text-sm text-forest-900/65">
                {stats.articleCount} article{stats.articleCount === 1 ? '' : 's'} bylined
                {stats.latestPublishedAt && (
                  <>
                    {' · latest '}
                    <time dateTime={stats.latestPublishedAt}>
                      {format(new Date(stats.latestPublishedAt), 'd MMM yyyy')}
                    </time>
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        <p className="mt-6 text-base leading-relaxed text-forest-900/80 sm:text-lg">{author.bio}</p>

        {stats.categories.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-widest text-forest-900/60">Writes about</p>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Categories ${author.name} writes in`}>
              {stats.categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="inline-flex items-center gap-2 rounded-full border border-forest-900/15 bg-white px-3 py-1.5 text-sm text-forest-900 transition hover:border-primary-emphasis hover:text-primary-emphasis"
                  >
                    {c.name}
                    <span className="text-xs font-bold text-forest-900/50">{c.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {author.expertise.length > 0 && (
          <p className="mt-5 text-sm text-forest-900/70">
            <span className="font-semibold text-forest-950">Areas listed in profile:</span> {author.expertise.join(', ')}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold">
          <Link href={href} className="text-primary-emphasis underline-offset-2 hover:underline">
            Full profile and all articles →
          </Link>
          {links.map((l) => (
            <a key={l.label} href={l.href} rel="noopener me" className="text-forest-950 underline-offset-2 hover:underline">
              {l.label}
            </a>
          ))}
        </div>
      </div>

      {stats.latest.length > 0 && (
        <div className="min-w-0 border-t border-forest-900/15 bg-paper p-6 sm:p-8 lg:border-l lg:border-t-0">
          <p className="text-xs font-bold uppercase tracking-widest text-forest-900/60">Latest from {author.name}</p>
          <ol className="mt-4 divide-y divide-forest-900/10">
            {stats.latest.map((a, i) => (
              <li key={a.slug} className="flex min-w-0 gap-4 py-4 first:pt-0 last:pb-0">
                <span className="font-mono text-xs font-bold text-forest-900/40">0{i + 1}</span>
                <div className="min-w-0">
                  <Link
                    href={`/articles/${a.slug}`}
                    className="font-bold leading-snug text-forest-950 underline-offset-2 hover:text-primary-emphasis hover:underline"
                  >
                    {a.title}
                  </Link>
                  <p className="mt-1 text-xs uppercase tracking-wider text-forest-900/55">
                    {a.category?.name && <span>{a.category.name}</span>}
                    {a.category?.name && a.publishedAt && ' · '}
                    {a.publishedAt && (
                      <time dateTime={a.publishedAt}>{format(new Date(a.publishedAt), 'd MMM yyyy')}</time>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}
