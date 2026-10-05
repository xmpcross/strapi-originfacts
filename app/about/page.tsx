import { marked } from 'marked';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { readPageMarkdown } from '@/lib/pages';
import { clampDescription } from '@/lib/seo';
import { JsonLd } from '@/components/SeoBlocks';
import { ORG_ID, organizationJsonLd, absoluteUrl, breadcrumbJsonLd } from '@/lib/jsonld';
import { getAllAuthors, authorPersonJsonLd } from '@/lib/authors';
import AuthorCard from '@/components/AuthorCard';
import { injectHeadingIdsAndExtractToc } from '@/lib/toc';

export const metadata: Metadata = {
  // Absolute: the layout template would append "· Originfacts" a second time.
  title: { absolute: 'About Originfacts: Travel Facts, Guides & Flight Search' },
  description: clampDescription(
    'Originfacts is an independent travel site with destination, airline and airport guides, flight search and hotels. Learn how Originfacts works.',
  ),
  alternates: { canonical: '/about' },
};

const aboutPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About Originfacts',
  url: absoluteUrl('/about'),
  // Full Organization node is emitted alongside so the @id resolves on-page.
  about: { '@id': ORG_ID },
  mainEntity: { '@id': ORG_ID },
};

export default async function AboutPage() {
  const md = await readPageMarkdown('about');
  if (!md) notFound();

  const rawHtml = await marked.parse(md, { async: true });
  // Heading ids are kept for links to sections; the page shows no table of contents.
  const { html: processedHtml } = injectHeadingIdsAndExtractToc(rawHtml);
  const authors = await getAllAuthors();

  return (
    <article className="mx-auto max-w-7xl px-6 py-16" data-testid="about-page">
      <JsonLd data={organizationJsonLd({ withContactPoint: true })} />
      <JsonLd data={aboutPageJsonLd} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'About', url: '/about' }])} />
      {authors.map((author) => (
        <JsonLd key={author.slug} data={authorPersonJsonLd(author)} />
      ))}

      <header className="max-w-3xl">
        <p className="chip">About</p>
        <h1 className="editorial-h mt-5 text-3xl font-bold leading-tight text-forest-900 sm:text-4xl">
          About Originfacts
        </h1>
        <p className="mt-3 text-lg font-light text-forest-900/75">
          Originfacts is an independent travel website that pairs the facts behind destinations with practical guides to
          flights, airports, airlines and hotels, so you can understand a place and plan the trip in one place.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-forest-900/10 bg-forest-50/60 p-5 text-sm text-forest-900">
        <span className="font-semibold">Trust &amp; Contact:</span>
        <a href="mailto:contact@originfacts.com" className="font-bold underline hover:text-forest-700">
          contact@originfacts.com
        </a>
        <span className="text-forest-900/40">•</span>
        <Link href="/authors" className="underline hover:text-forest-700 font-semibold">
          Meet Our Editorial Authors
        </Link>
        <span className="text-forest-900/40">•</span>
        <Link href="/methodology" className="underline hover:text-forest-700">
          Editorial Methodology &amp; Standards
        </Link>
      </div>

      <div
        className="prose-article mt-10 max-w-none"
        data-testid="about-body"
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />

      <section className="mt-16 border-t border-forest-900/10 pt-12">
        <h2 className="editorial-h text-2xl font-bold text-forest-950 sm:text-3xl">
          Who writes for Originfacts?
        </h2>
        <p className="mt-2 text-sm text-forest-900/70">
          Originfacts articles are published under named bylines. Each author profile lists the author&apos;s role and
          published articles.
        </p>

        <div className="mt-8 grid gap-6">
          {authors.map((author) => (
            <AuthorCard key={author.slug} author={author} />
          ))}
        </div>
      </section>
    </article>
  );
}
