import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllAuthors, DEFAULT_AUTHOR_SLUG } from '@/lib/authors';
import { articleIndex, bylineSlug, personJsonLdAsShown, statsFor } from '@/lib/author-directory';
import { JsonLd } from '@/components/SeoBlocks';
import AuthorAvatar from '@/components/authors/AuthorAvatar';
import AuthorDirectoryCard from '@/components/authors/AuthorDirectoryCard';
import Kicker from '@/components/authors/Kicker';
import { clampDescription } from '@/lib/seo';
import { SITE_URL } from '@/lib/entity-seo';
import { absoluteUrl, breadcrumbJsonLd } from '@/lib/jsonld';

const DESCRIPTION =
  'Who writes and reviews Originfacts: author profiles, what each author covers, and how AI-assisted drafting and human editorial review work on this site.';

export const metadata: Metadata = {
  // Absolute: the layout template would append "· Originfacts" a second time.
  title: { absolute: 'Originfacts Authors: Who Writes and Reviews Our Travel Guides' },
  description: clampDescription(DESCRIPTION),
  alternates: { canonical: '/authors' },
};

/*
 * How authorship works. Every sentence here restates what the site already
 * says elsewhere (lib/faq.ts, content/pages/methodology.md, the About page);
 * add nothing here that the methodology does not say first.
 */
function authorshipSteps(defaultAuthor: { name: string; role: string } | null) {
  return [
    {
      title: 'AI-assisted drafting',
      text: "Many articles are drafted with a large language model (currently Anthropic's Claude), which is given a brief, editorial guidelines and structured prompts.",
    },
    {
      title: 'Human editorial review',
      text: 'Our methodology requires published content to be reviewed and fact-checked by human editors. No automated output is published without human review.',
    },
    {
      title: 'A named byline',
      text: defaultAuthor
        ? `Every article carries a byline linking to its author's profile on this page. An article with no other author assigned is bylined ${defaultAuthor.name}, ${defaultAuthor.role}.`
        : "Every article carries a byline linking to its author's profile on this page.",
    },
    {
      title: 'Corrections',
      text: 'Facts that change often (prices, routes, visa rules, fees) are the most likely to go out of date. Report an error to contact@originfacts.com and it is corrected or removed.',
    },
  ];
}

export default async function AuthorsIndexPage() {
  const [authors, articles] = await Promise.all([getAllAuthors(), articleIndex()]);
  const entries = authors.map((author) => ({ author, stats: statsFor(author.slug, articles) }));

  // Counted, not typed: only articles bylined to someone listed on this page.
  const listedSlugs = new Set(authors.map((a) => a.slug));
  const bylined = articles.filter((a) => listedSlugs.has(bylineSlug(a)));
  const categories = new Set(bylined.map((a) => a.category?.slug).filter(Boolean));
  const stats = [
    { value: authors.length, label: authors.length === 1 ? 'named author' : 'named authors' },
    { value: bylined.length, label: 'articles with a named byline' },
    { value: categories.size, label: 'categories covered' },
  ].filter((s) => s.value > 0);

  const defaultAuthor = authors.find((a) => a.slug === DEFAULT_AUTHOR_SLUG) ?? null;
  const steps = authorshipSteps(defaultAuthor ? { name: defaultAuthor.name, role: defaultAuthor.jobTitle.toLowerCase() } : null);

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Originfacts Authors',
    url: absoluteUrl('/authors'),
    description: DESCRIPTION,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: authors.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/authors/${a.slug}`,
        item: { '@id': `${SITE_URL}/authors/${a.slug}#person` },
      })),
    },
  };

  return (
    <article className="overflow-x-clip" data-testid="authors-page">
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Authors', url: '/authors' }])} />
      {authors.map((author) => (
        <JsonLd key={author.slug} data={personJsonLdAsShown(author)} />
      ))}

      {/* ---------------- Hero ---------------- */}
      <header className="mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16" data-testid="authors-hero">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
          <div className="min-w-0">
            <p className="eyebrow-tag">Authors</p>
            <h1 className="mt-5 text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">
              Who writes and reviews Originfacts
            </h1>
            <p className="mt-6 text-xl font-semibold leading-snug text-forest-900 sm:text-2xl">
              Every article on Originfacts carries a byline. This page is where those bylines lead.
            </p>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-forest-900/75">
              Names, photos, roles and bios below come from the author profiles in our CMS, and every count is taken
              from the published articles themselves. Many articles are drafted with AI assistance; our methodology
              requires human editors to review and fact-check what is published.
            </p>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold" data-testid="authors-trust-links">
              <li>
                <Link href="/methodology" className="text-primary-emphasis underline-offset-2 hover:underline">
                  Editorial methodology →
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-forest-950 underline-offset-2 hover:underline">
                  About Originfacts →
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-forest-950 underline-offset-2 hover:underline">
                  Report a correction →
                </Link>
              </li>
            </ul>
          </div>

          {/* Masthead: the listed authors at a glance. */}
          <nav
            aria-label="Authors on this page"
            className="min-w-0 rounded-[0.3rem] bg-forest-950 p-6 text-white sm:p-8"
            data-testid="authors-masthead"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-white/60">Masthead</p>
            <ul className="mt-5 divide-y divide-white/15">
              {entries.map(({ author, stats: s }, i) => (
                <li key={author.slug} className="py-4 first:pt-0 last:pb-0">
                  <a href={`#${author.slug}`} className="group flex min-w-0 items-center gap-4">
                    <AuthorAvatar author={author} size={64} priority={i === 0} className="ring-2 ring-white/20" />
                    <span className="min-w-0">
                      <span className="block text-xl font-bold leading-tight text-white group-hover:underline">
                        {author.name}
                      </span>
                      <span className="block text-sm text-white/70">{author.jobTitle}</span>
                      {s.articleCount > 0 && (
                        <span className="mt-1 block text-xs font-bold uppercase tracking-wider text-sand-300">
                          {s.articleCount} article{s.articleCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      {/* ---------------- Numbers ---------------- */}
      {stats.length > 0 && (
        <section aria-label="Authorship in numbers" className="border-y border-forest-900/15 bg-paper" data-testid="authors-stats">
          <dl className="mx-auto grid max-w-7xl grid-cols-1 gap-x-4 gap-y-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
            {stats.map((s) => (
              <div key={s.label} className="flex min-w-0 flex-col-reverse border-l-2 border-primary-emphasis pl-4">
                <dt className="mt-2 text-xs font-bold uppercase tracking-widest text-forest-900/60">{s.label}</dt>
                <dd className="text-4xl font-bold leading-none text-forest-950 sm:text-5xl">{s.value.toLocaleString('en-GB')}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* ---------------- 01 The authors ---------------- */}
        <section className="py-16 sm:py-20" aria-labelledby="authors-list" data-testid="authors-list">
          <div className="max-w-3xl">
            <Kicker n="01" label="The authors" />
            <h2 id="authors-list" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
              Who is behind the bylines?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-forest-900/75 sm:text-lg">
              Each profile shows what the author has published here: the categories they write in and their most
              recent articles.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-6">
            {entries.map(({ author, stats: s }, i) => (
              <div key={author.slug} id={author.slug} className="min-w-0 scroll-mt-24">
                <AuthorDirectoryCard author={author} stats={s} priority={i === 0} />
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- 02 How authorship works ---------------- */}
        <section className="border-t border-forest-900/15 py-16 sm:py-20" aria-labelledby="authors-process" data-testid="authors-process">
          <div className="max-w-3xl">
            <Kicker n="02" label="How authorship works" />
            <h2 id="authors-process" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
              How does an article get its byline?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-forest-900/75 sm:text-lg">
              Originfacts uses AI-assisted research and drafting to produce many of its articles. Here is what that
              means for the name at the top of the page.
            </p>
          </div>

          <ol className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {steps.map((step, i) => (
              <li key={step.title} className="min-w-0 border-t-2 border-forest-950 pt-4">
                <p className="font-mono text-xs font-bold text-forest-900/50">0{i + 1}</p>
                <h3 className="mt-2 text-lg font-bold leading-snug text-forest-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-forest-900/75">{step.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16">
            <blockquote className="border-l-4 border-primary-emphasis pl-5">
              <p className="text-xl font-bold leading-snug text-forest-950 sm:text-2xl">
                “We use AI as a tool to research and structure content faster, not as a way to publish without human
                judgement.”
              </p>
            </blockquote>
            <p className="text-base leading-relaxed text-forest-900/80">
              Ranked and “best of” articles are editorial selections compiled from published fare and route data and
              official airline and hotel policies, then reviewed by a named editor. They are not the result of
              hands-on product testing.
            </p>
          </div>
        </section>

        {/* ---------------- 03 Standards ---------------- */}
        <section className="border-t border-forest-900/15 py-16 sm:py-20" aria-labelledby="authors-more" data-testid="authors-more">
          <Kicker n="03" label="Standards" />
          <h2 id="authors-more" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
            Where can you check our standards?
          </h2>
          <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            <li className="min-w-0">
              <Link
                href="/methodology"
                className="group flex h-full flex-col rounded-[0.3rem] bg-forest-950 p-6 text-white transition hover:bg-forest-900 sm:p-8"
              >
                <span className="text-xs font-bold uppercase tracking-widest text-sand-300">Methodology</span>
                <span className="mt-3 text-2xl font-bold leading-tight text-white">How we research and verify</span>
                <span className="mt-3 text-sm leading-relaxed text-white/75">
                  Sources, fact-checking, AI use and human review, and how we rank and label what we publish.
                </span>
                <span className="mt-auto pt-6 text-sm font-semibold text-white group-hover:underline">Read the methodology →</span>
              </Link>
            </li>
            <li className="min-w-0">
              <Link
                href="/about"
                className="group flex h-full flex-col rounded-[0.3rem] bg-sand-100 p-6 transition hover:bg-sand-200 sm:p-8"
              >
                <span className="text-xs font-bold uppercase tracking-widest text-forest-900/60">About</span>
                <span className="mt-3 text-2xl font-bold leading-tight text-forest-950">Who operates Originfacts</span>
                <span className="mt-3 text-sm leading-relaxed text-forest-900/75">
                  What the site covers, how it earns revenue and the business behind it.
                </span>
                <span className="mt-auto pt-6 text-sm font-semibold text-primary-emphasis group-hover:underline">About Originfacts →</span>
              </Link>
            </li>
            <li className="min-w-0">
              <Link
                href="/contact"
                className="group flex h-full flex-col rounded-[0.3rem] border-2 border-forest-950 p-6 transition hover:bg-paper sm:p-8"
              >
                <span className="text-xs font-bold uppercase tracking-widest text-forest-900/60">Corrections</span>
                <span className="mt-3 text-2xl font-bold leading-tight text-forest-950">Spotted an error?</span>
                <span className="mt-3 text-sm leading-relaxed text-forest-900/75">
                  Tell us what is inaccurate, out of date or misleading, and it is corrected or removed.
                </span>
                <span className="mt-auto pt-6 text-sm font-semibold text-primary-emphasis group-hover:underline">Contact us →</span>
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </article>
  );
}
