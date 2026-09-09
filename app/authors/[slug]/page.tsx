import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getAuthorBySlug, AUTHORS, authorPersonJsonLd } from '@/lib/authors';
import { listArticles } from '@/lib/strapi';
import ArticleCard from '@/components/ArticleCard';
import { JsonLd } from '@/components/SeoBlocks';
import { clampDescription } from '@/lib/seo';
import { absoluteUrl, breadcrumbJsonLd } from '@/lib/jsonld';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const author = getAuthorBySlug(slug);
  if (!author) return { title: 'Author Not Found' };

  const metaTitle = `${author.name} — ${author.jobTitle} | Originfacts`;
  const metaDescription = clampDescription(author.bio);

  return {
    title: metaTitle,
    description: metaDescription,
    alternates: { canonical: `/authors/${author.slug}` },
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      type: 'profile',
      images: [{ url: absoluteUrl(author.avatar) }],
      url: `/authors/${author.slug}`,
    },
  };
}

export function generateStaticParams() {
  return Object.keys(AUTHORS).map((slug) => ({ slug }));
}

export default async function AuthorProfilePage({ params }: Props) {
  const { slug } = await params;
  const author = getAuthorBySlug(slug);
  if (!author) notFound();

  // Fetch articles to display authored works
  const allArticlesRes = await listArticles({ pageSize: 50 }).catch(() => ({ data: [] }));
  const articles = allArticlesRes.data;

  // Filter articles associated with author name/slug or fallback to top recent articles
  const authoredArticles = articles.filter(
    (a) => a.author?.slug === author.slug || a.author?.name?.toLowerCase().includes(author.name.split(' ')[0]!.toLowerCase()),
  );
  // No fallback to `articles.slice(0, 6)`. That filled an author with no
  // articles using the site's six most recent ones, under a heading that then
  // read "Which articles has <name> published?" — attributing other people's
  // work to them. An author with nothing published shows nothing.
  const displayedArticles = authoredArticles;

  return (
    <article className="mx-auto max-w-7xl px-6 py-16" data-testid="author-profile-page">
      <JsonLd data={authorPersonJsonLd(author)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Authors', url: '/authors' },
          { name: author.name, url: `/authors/${author.slug}` },
        ])}
      />

      <header className="rounded-2xl border border-forest-900/10 bg-forest-50/60 p-8 sm:p-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-center">
          <Image
            src={author.avatar}
            alt={author.name}
            width={120}
            height={120}
            priority
            className="h-28 w-28 rounded-full object-cover border-4 border-white shadow-md"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-primary-emphasis">
              Verified Editorial Author
            </p>
            <h1 className="editorial-h text-3xl font-bold text-forest-950 sm:text-4xl mt-1">
              {author.name}
            </h1>
            <div className="text-base font-semibold text-forest-900/75 mt-1">{author.jobTitle}</div>
            <p className="mt-4 text-base leading-relaxed text-forest-900/80">
              {author.longBio || author.bio}
            </p>

            {author.expertise && author.expertise.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-forest-900/60">
                  Subject Expertise:
                </span>
                {author.expertise.map((exp) => (
                  <span
                    key={exp}
                    className="rounded-md bg-white px-3 py-1 text-xs font-medium text-forest-900 border border-forest-900/10 shadow-xs"
                  >
                    {exp}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-5 border-t border-forest-900/10 pt-5 text-sm text-forest-900">
              {author.email && (
                <a href={`mailto:${author.email}`} className="font-bold underline hover:text-primary-emphasis">
                  {author.email}
                </a>
              )}
              {author.socials?.x && (
                <a
                  href={author.socials.x}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline hover:text-primary-emphasis"
                >
                  X / Twitter
                </a>
              )}
              {author.socials?.linkedin && (
                <a
                  href={author.socials.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline hover:text-primary-emphasis"
                >
                  LinkedIn Profile
                </a>
              )}
              <Link href="/methodology" className="text-forest-900/70 hover:text-forest-900 underline ml-auto">
                Editorial Methodology &rarr;
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-16">
        <h2 className="editorial-h text-2xl font-bold text-forest-950 sm:text-3xl">
          Which articles has {author.name} published?
        </h2>
        <p className="mt-2 text-sm text-forest-900/70">
          Fact-checked travel guides, flight analysis, and destination research authored or reviewed by {author.name}.
        </p>

        {displayedArticles.length > 0 ? (
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {displayedArticles.map((art) => (
              <ArticleCard key={art.id} article={art} />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-sm text-forest-900/70">
            No articles are currently attributed to {author.name}.
          </p>
        )}
      </section>
    </article>
  );
}
