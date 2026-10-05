import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import { getAllAuthors, getAuthorBySlug } from '@/lib/authors';
import { articleIndex, bylineSlug, hasPhoto, personJsonLdAsShown, statsFor } from '@/lib/author-directory';
import ArticleCard from '@/components/ArticleCard';
import AuthorAvatar from '@/components/authors/AuthorAvatar';
import Kicker from '@/components/authors/Kicker';
import { JsonLd } from '@/components/SeoBlocks';
import { clampDescription } from '@/lib/seo';
import { absoluteUrl, breadcrumbJsonLd } from '@/lib/jsonld';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) return { title: 'Author Not Found' };

  const metaTitle = `${author.name} — ${author.jobTitle}`;
  const metaDescription = clampDescription(author.bio);

  // Authors with no published article stay reachable but out of the index.
  const listed = (await getAllAuthors()).some((a) => a.slug === author.slug);
  return {
    title: metaTitle,
    description: metaDescription,
    alternates: { canonical: `/authors/${author.slug}` },
    ...(listed ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      type: 'profile',
      // Only a real CMS photo; never the generic placeholder as a person's picture.
      ...(hasPhoto(author) ? { images: [{ url: absoluteUrl(author.avatar) }] } : {}),
      url: `/authors/${author.slug}`,
    },
  };
}

export async function generateStaticParams() {
  return (await getAllAuthors()).map((a) => ({ slug: a.slug }));
}

export default async function AuthorProfilePage({ params }: Props) {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) notFound();

  const articles = await articleIndex();
  // An article with no CMS author is bylined DEFAULT_AUTHOR_SLUG. No fallback
  // to the site's latest articles for an author with none: that attributed
  // other people's work to them. An author with nothing published shows nothing.
  const authoredArticles = articles.filter((a) => bylineSlug(a) === author.slug);
  const stats = statsFor(author.slug, articles);
  const paragraphs = (author.longBio || author.bio).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const links = [
    author.socials?.website ? { label: 'Website', href: author.socials.website } : null,
    author.socials?.linkedin ? { label: 'LinkedIn', href: author.socials.linkedin } : null,
    author.socials?.x ? { label: 'X / Twitter', href: author.socials.x } : null,
  ].filter((l): l is { label: string; href: string } => l !== null);

  return (
    <article className="overflow-x-clip" data-testid="author-profile-page">
      <JsonLd data={personJsonLdAsShown(author)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Authors', url: '/authors' },
          { name: author.name, url: `/authors/${author.slug}` },
        ])}
      />

      <header className="mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16" data-testid="author-hero">
        <nav aria-label="Breadcrumb" className="text-xs font-bold uppercase tracking-widest text-forest-900/55">
          <Link href="/authors" className="hover:text-primary-emphasis">
            ← All authors
          </Link>
        </nav>
        <div className="mt-8 grid items-center gap-10 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-14">
          <AuthorAvatar author={author} size={176} priority className="ring-8 ring-sand-100" />
          <div className="min-w-0">
            <p className="eyebrow-tag">{author.jobTitle}</p>
            <h1 className="mt-5 text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">
              {author.name}
            </h1>
            <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-forest-900/80 sm:text-lg">
              {paragraphs.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </div>
            {author.expertise.length > 0 && (
              <p className="mt-5 text-sm text-forest-900/70">
                <span className="font-semibold text-forest-950">Areas listed in profile:</span>{' '}
                {author.expertise.join(', ')}
              </p>
            )}
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
              {links.map((l) => (
                <li key={l.label}>
                  <a href={l.href} rel="noopener me" className="text-forest-950 underline-offset-2 hover:underline">
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <Link href="/methodology" className="text-primary-emphasis underline-offset-2 hover:underline">
                  Editorial methodology →
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </header>

      {stats.articleCount > 0 && (
        <section aria-label={`${author.name} in numbers`} className="border-y border-forest-900/15 bg-paper" data-testid="author-stats">
          <dl className="mx-auto grid max-w-7xl grid-cols-1 gap-x-4 gap-y-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
            <Stat value={stats.articleCount.toLocaleString('en-GB')} label="articles bylined" />
            <Stat value={String(stats.categories.length)} label="categories covered" />
            {stats.latestPublishedAt && (
              <Stat value={format(new Date(stats.latestPublishedAt), 'd MMM yyyy')} label="latest article" />
            )}
          </dl>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <section className="py-16 sm:py-20" aria-labelledby="author-articles" data-testid="author-articles">
          <Kicker n="01" label="Articles" />
          <h2 id="author-articles" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
            Which articles has {author.name} published?
          </h2>
          {stats.categories.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label={`Categories ${author.name} writes in`}>
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
          )}

          {authoredArticles.length > 0 ? (
            <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {authoredArticles.map((art) => (
                <ArticleCard key={art.id} article={art} />
              ))}
            </div>
          ) : (
            <p className="mt-8 text-sm text-forest-900/70">No articles are currently attributed to {author.name}.</p>
          )}
        </section>
      </div>
    </article>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col-reverse border-l-2 border-primary-emphasis pl-4">
      <dt className="mt-2 text-xs font-bold uppercase tracking-widest text-forest-900/60">{label}</dt>
      <dd className="text-4xl font-bold leading-none text-forest-950 sm:text-5xl">{value}</dd>
    </div>
  );
}
