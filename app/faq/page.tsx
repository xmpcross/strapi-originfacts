import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/SeoBlocks';
import FaqExplorer from '@/components/FaqExplorer';
import { faqJsonLd } from '@/lib/entity-seo';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { clampDescription } from '@/lib/seo';
import { buildFaqGroups, faqsForSchema, type FaqCounts } from '@/lib/faq';
import { listAirlines, listAirports, listArticles } from '@/lib/strapi';
import { airlineGuideIsPublished, airlineTier } from '@/lib/airline-tier';
import { getRouteFacts } from '@/lib/route-facts';
import { isNonPassengerAirline } from '@/lib/airline-exclusions';

// Counts in the answers come from Strapi, so re-render hourly rather than
// freezing whatever the CMS returned at build time.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Frequently Asked Questions (FAQ)',
  description: clampDescription(
    'Answers about Originfacts: how flight search and prices work, where airline facts come from, affiliate links, corrections, privacy and cookies.',
  ),
  alternates: { canonical: '/faq' },
  robots: { index: true, follow: true },
};

/**
 * Same population as the /airlines directory (app/airlines/page.tsx): passenger
 * carriers only, Tier 1-2 or with a published policy guide. Kept in step with
 * that filter so the FAQ never quotes a different number from the directory.
 */
async function airlineCounts() {
  const all = await listAirlines().catch(() => []);
  const listed = all.filter((a) => {
    if (isNonPassengerAirline(a)) return false;
    const dests = getRouteFacts(a.iataCode)?.destinationCount ?? 0;
    return airlineGuideIsPublished(a.slug) || airlineTier(a, dests > 0) <= 2;
  });
  return {
    airlines: listed.length,
    airlineCountries: new Set(listed.map((a) => a.country).filter(Boolean)).size,
    verifiedAirlineGuides: listed.filter((a) => airlineGuideIsPublished(a.slug)).length,
  };
}

async function faqCounts(): Promise<FaqCounts> {
  const [articles, airports, airlines] = await Promise.all([
    listArticles({ pageSize: 1 })
      .then((r) => r.meta?.pagination?.total ?? 0)
      .catch(() => 0),
    listAirports()
      .then((a) => a.length)
      .catch(() => 0),
    airlineCounts(),
  ]);
  return { articles, airports, ...airlines };
}

export default async function FaqPage() {
  const counts = await faqCounts();
  const groups = buildFaqGroups(counts);
  const questionCount = groups.reduce((n, g) => n + g.items.length, 0);

  // Every figure is counted, not typed.
  const stats = [
    { value: questionCount, label: 'questions answered' },
    { value: groups.length, label: 'topics' },
    counts.airlines > 0 ? { value: counts.airlines, label: 'airlines in the directory' } : null,
    counts.verifiedAirlineGuides > 0 ? { value: counts.verifiedAirlineGuides, label: 'verified airline guides' } : null,
  ].filter((s): s is { value: number; label: string } => s !== null);

  return (
    <article className="overflow-x-clip" data-testid="faq-page">
      <JsonLd data={faqJsonLd(faqsForSchema(groups))} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'FAQ', url: '/faq' }])} />

      <header className="mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-6 sm:pt-16" data-testid="faq-hero">
        <div className="max-w-3xl">
          <p className="eyebrow-tag">Help &amp; FAQ</p>
          <h1 className="mt-5 text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">
            Frequently asked questions
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-forest-900/80 sm:text-xl">
            Straight answers about how Originfacts works: what our flight search and prices can and can&apos;t tell you,
            where the airline facts come from, how we earn money, and how to reach us.
          </p>
          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold" data-testid="faq-hero-links">
            <li>
              <Link href="/about" className="text-forest-950 underline-offset-2 hover:underline">
                About Originfacts →
              </Link>
            </li>
            <li>
              <Link href="/methodology" className="text-forest-950 underline-offset-2 hover:underline">
                Editorial methodology →
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-primary-emphasis underline-offset-2 hover:underline">
                Contact us →
              </Link>
            </li>
          </ul>
        </div>
      </header>

      <section aria-label="This FAQ in numbers" className="border-y border-forest-900/15 bg-paper" data-testid="faq-stats">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-8 px-4 py-8 sm:px-6 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex min-w-0 flex-col-reverse border-l-2 border-primary-emphasis pl-4">
              <dt className="mt-2 text-xs font-bold uppercase tracking-widest text-forest-900/60">{s.label}</dt>
              <dd className="text-3xl font-bold leading-none text-forest-950 sm:text-4xl">{s.value.toLocaleString('en-GB')}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <FaqExplorer groups={groups} />
      </div>

      <section className="bg-forest-950" aria-labelledby="faq-still-stuck" data-testid="faq-cta">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center">
          <div className="min-w-0">
            <h2 id="faq-still-stuck" className="text-3xl font-bold leading-tight !text-white sm:text-4xl">
              Didn&apos;t find your answer?
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/80">
              Send us the page URL and your question. For a problem with a booking, contact the provider you booked with
              — Originfacts doesn&apos;t handle tickets, payments or refunds.
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-3 lg:justify-end">
            <Link
              href="/contact"
              className="inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-bold text-forest-950 transition hover:bg-sand-100"
            >
              Contact Originfacts
            </Link>
            <a
              href="mailto:contact@originfacts.com"
              className="inline-flex h-12 min-w-0 items-center break-all rounded-full border border-white/30 px-6 text-sm font-bold text-white transition hover:border-white"
            >
              contact@originfacts.com
            </a>
          </div>
        </div>
      </section>
    </article>
  );
}
