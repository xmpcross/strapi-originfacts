import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllAuthors, authorPersonJsonLd } from '@/lib/authors';
import AuthorCard from '@/components/AuthorCard';
import { JsonLd } from '@/components/SeoBlocks';
import { clampDescription } from '@/lib/seo';
import { absoluteUrl, breadcrumbJsonLd } from '@/lib/jsonld';

export const metadata: Metadata = {
  title: 'Editorial Authors & Travel Experts | Originfacts',
  description: clampDescription(
    'Meet the editorial authors, aviation researchers, and travel specialists behind Originfacts. Discover bios, expertise, and published travel guides.',
  ),
  alternates: { canonical: '/authors' },
};

const authorsIndexJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Editorial Authors & Travel Experts | Originfacts',
  url: absoluteUrl('/authors'),
  description:
    'Meet the editorial authors, aviation researchers, and travel specialists behind Originfacts. Discover bios, expertise, and published travel guides.',
};

export default function AuthorsIndexPage() {
  const authors = getAllAuthors();

  return (
    <article className="mx-auto max-w-7xl px-6 py-16" data-testid="authors-page">
      <JsonLd data={authorsIndexJsonLd} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Authors', url: '/authors' }])} />
      {authors.map((author) => (
        <JsonLd key={author.slug} data={authorPersonJsonLd(author)} />
      ))}

      <header className="max-w-3xl">
        <p className="chip">Editorial Team</p>
        <h1 className="editorial-h mt-5 text-3xl font-bold leading-tight text-forest-900 sm:text-4xl">
          Authors &amp; Travel Experts
        </h1>
        <p className="mt-3 text-lg font-light text-forest-900/75">
          Originfacts ensures high editorial authority by requiring all published flight analysis, destination guides, and airport reviews to be written and verified by named domain specialists. Our team of experienced travel journalists, aviation analysts, and cultural researchers combines primary data inspection with on-the-ground investigations to deliver transparent, unbiased travel guidance.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-forest-900/10 bg-forest-50/60 p-5 text-sm text-forest-900">
        <span className="font-semibold">Editorial Policy:</span>
        <span className="text-forest-900/80">Zero anonymous publishing. All guides are fact-verified against primary sources.</span>
        <span className="text-forest-900/40">•</span>
        <Link href="/methodology" className="underline hover:text-forest-700 font-semibold">
          Read Our Methodology
        </Link>
      </div>

      <div className="mt-12 space-y-6">
        {authors.map((author) => (
          <AuthorCard key={author.slug} author={author} />
        ))}
      </div>
    </article>
  );
}
