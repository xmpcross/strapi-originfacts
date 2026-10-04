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
import OutboundCitations from '@/components/OutboundCitations';
import TableOfContents from '@/components/TableOfContents';
import { injectHeadingIdsAndExtractToc } from '@/lib/toc';

export const metadata: Metadata = {
  title: 'About Originfacts',
  description: clampDescription(
    'Originfacts is a travel blog about the facts of origins — the cultures, histories, and stories behind destinations — alongside the latest travel info on flights, hotels, airlines, airports, and destinations.',
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
  const { html: processedHtml, toc } = injectHeadingIdsAndExtractToc(rawHtml);
  const authors = getAllAuthors();

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
          Originfacts delivers verified travel intelligence by combining primary aviation data with on-the-ground cultural research across global destinations. Our independent editorial team analyzes real-time flight routes, airport logistics, airline fare structures, and regional travel histories to ensure travelers receive transparent, factual guidance before making booking decisions or planning international itineraries.
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

      <TableOfContents items={toc} />

      <div
        className="prose-article mt-10 max-w-none"
        data-testid="about-body"
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />

      <OutboundCitations title="Official Primary Research & Government Sources" />

      <section className="mt-16 border-t border-forest-900/10 pt-12">
        <h2 className="editorial-h text-2xl font-bold text-forest-950 sm:text-3xl">
          Who are the editorial authors behind Originfacts?
        </h2>
        <p className="mt-2 text-sm text-forest-900/70">
          Every guide and route analysis on Originfacts is produced and verified by named domain specialists.
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
