import { marked } from 'marked';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { readPageMarkdown } from '@/lib/pages';
import { clampDescription } from '@/lib/seo';
import { JsonLd } from '@/components/SeoBlocks';
import OutboundCitations from '@/components/OutboundCitations';
import TableOfContents from '@/components/TableOfContents';
import { injectHeadingIdsAndExtractToc } from '@/lib/toc';
import { ORG_ID, organizationJsonLd, absoluteUrl, breadcrumbJsonLd } from '@/lib/jsonld';

export const metadata: Metadata = {
  title: 'Editorial Methodology & Standards | Originfacts',
  description: clampDescription(
    'Discover how Originfacts researches, verifies, and publishes travel guides, flight analysis, and destination facts with strict human editorial oversight and transparency.',
  ),
  alternates: { canonical: '/methodology' },
};

const methodologyPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Editorial Methodology & Standards | Originfacts',
  url: absoluteUrl('/methodology'),
  description:
    'Discover how Originfacts researches, verifies, and publishes travel guides, flight analysis, and destination facts with strict human editorial oversight and transparency.',
  mainEntity: { '@id': ORG_ID },
};

export default async function MethodologyPage() {
  const md = await readPageMarkdown('methodology');
  if (!md) notFound();

  const rawHtml = await marked.parse(md, { async: true });
  const { html: processedHtml, toc } = injectHeadingIdsAndExtractToc(rawHtml);

  return (
    <article className="mx-auto max-w-7xl px-6 py-16" data-testid="methodology-page">
      <JsonLd data={organizationJsonLd({ withContactPoint: true })} />
      <JsonLd data={methodologyPageJsonLd} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Methodology', url: '/methodology' }])} />
      <header className="max-w-3xl">
        <p className="chip">Methodology</p>
        <h1 className="editorial-h mt-5 text-3xl font-bold leading-tight text-forest-900 sm:text-4xl">
          Editorial Methodology &amp; Standards
        </h1>
        {/*
          Rewritten to describe what the pipeline actually does. The previous
          text claimed every article was cross-referenced "directly against
          official civil aviation authorities and carrier documentation" and had
          undergone "rigorous multi-tier verification by named travel domain
          experts". At the time, 96% of airline fact fields carried
          `verified_by: automated_provenance`, and a sample of their citations
          was 54% dead links. A reviewer who checked that claim would find it
          false, which discredits the accurate parts of the site along with it.

          Keep this page describing the process as it is. If the verification
          bar rises, raise the claim to match — not before.
        */}
        <p className="mt-3 text-lg font-light text-forest-900/75">
          Originfacts separates what we have checked from what we have not, and says which is which on the page. Airline baggage and policy figures are published only where a named editor has read them off the carrier&apos;s own documentation; those carry a source link and the date they were checked. Figures our ingest pipeline has collected but nobody has verified are held back rather than shown, because a plausible number presented as a fact is worse than no number.
        </p>
        <p className="mt-3 text-lg font-light text-forest-900/75">
          Travel guides and destination research are written and reviewed by our named editors, who are listed with their areas of focus. Where a page carries commercial links, they are marked as such and never change what we publish or how we rank it. When we get something wrong, tell us and we will correct it and say that we did.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-forest-900/10 bg-forest-50/60 p-5 text-sm text-forest-900">
        <span className="font-semibold">Trust &amp; Contact Channels:</span>
        <a href="mailto:contact@originfacts.com" className="font-bold underline hover:text-forest-700">
          contact@originfacts.com
        </a>
        <span className="text-forest-900/40">•</span>
        <Link href="/about" className="underline hover:text-forest-700">
          About Originfacts
        </Link>
        <span className="text-forest-900/40">•</span>
        <Link href="/contact" className="underline hover:text-forest-700">
          Contact Form
        </Link>
      </div>

      <TableOfContents items={toc} />

      <div
        className="prose-article mt-10 max-w-none"
        data-testid="methodology-body"
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />

      <OutboundCitations title="Primary Regulatory Bodies & Operational Standards" />
    </article>
  );
}
