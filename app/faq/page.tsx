import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd, FaqSection } from '@/components/SeoBlocks';
import OutboundCitations from '@/components/OutboundCitations';
import { faqJsonLd, type Faq } from '@/lib/entity-seo';
import { breadcrumbJsonLd } from '@/lib/jsonld';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions (FAQ) — Originfacts',
  description:
    'Answers to common questions about Originfacts, flight search, live pricing, booking, editorial standards, and affiliate partnerships.',
  alternates: { canonical: '/faq' },
};

const SITE_FAQS: Faq[] = [
  {
    q: 'How do I find the cheapest flights with Originfacts?',
    a: 'Start with your departure airport, destination, travel dates and passenger count in our Flight Search tool. Originfacts queries live airline and online travel agency fares so you can compare prices in one place. For the lowest total price, compare nearby dates, review one-stop options, and check baggage fees before booking.',
  },
  {
    q: 'Does Originfacts handle bookings or payments?',
    a: 'No. Originfacts is an independent travel information and aggregate research platform. We do not sell tickets, process payments, or manage bookings. When you select a flight or hotel, you are redirected to the operating airline, hotel, or booking provider to complete your reservation.',
  },
  {
    q: 'Do you earn a commission when I book through Originfacts?',
    a: 'Yes. Some links on Originfacts are affiliate links (such as Travelpayouts and Stay22). If you complete a booking after clicking one of these links, we may earn a commission at no additional cost to you.',
  },
  {
    q: 'Are the prices shown guaranteed?',
    a: 'Travel prices change rapidly based on seat availability, carrier yield management, taxes, and exchange rates. Before paying, always confirm the final fare, taxes, baggage rules, and cancellation terms directly on the provider booking page.',
  },
  {
    q: 'When is the cheapest time to book a flight?',
    a: 'For short-haul and domestic routes, optimal fares often appear 1 to 3 months before departure. For international long-haul flights, monitoring prices 2 to 6 months in advance provides the best coverage. Midweek departures (Tuesday and Wednesday) also tend to be cheaper than weekend peaks.',
  },
  {
    q: 'What are popular flight destinations from Australia?',
    a: 'Popular destinations for travellers departing Australia (including Perth, Sydney, and Melbourne) include Bali (DPS), Singapore (SIN), Bangkok (BKK), Tokyo (TYO), London (LHR), and Auckland (AKL).',
  },
  {
    q: 'How can I submit content corrections or contact the editorial team?',
    a: 'We welcome factual corrections from readers. Please visit our Contact page or email contact@originfacts.com with the article URL, specific text section, and verifiable source links.',
  },
];

export default function FaqPage() {
  return (
    <article className="mx-auto max-w-7xl px-6 py-16" data-testid="faq-page">
      <JsonLd data={faqJsonLd(SITE_FAQS)} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'FAQ', url: '/faq' }])} />

      <header className="max-w-3xl">
        <p className="chip">Help &amp; FAQ</p>
        <h1 className="editorial-h mt-5 text-3xl font-bold leading-tight text-forest-900 sm:text-4xl">
          Frequently Asked Questions
        </h1>
        <p className="mt-3 text-lg font-light text-forest-900/75">
          Originfacts clarifies modern air travel by providing immediate answers regarding flight comparison engines, direct booking redirects, affiliate disclosure policies, and data verification methods. This comprehensive resource explains how real-time fares are aggregated across carriers, how pricing updates occur, and how travelers can contact our human editorial staff for research inquiries or content corrections.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-forest-900/10 bg-forest-50/60 p-5 text-sm text-forest-900">
        <span className="font-semibold">Quick Links:</span>
        <Link href="/about" className="font-bold underline hover:text-forest-700">
          About Originfacts
        </Link>
        <span className="text-forest-900/40">•</span>
        <Link href="/methodology" className="underline hover:text-forest-700 font-semibold">
          Editorial Methodology
        </Link>
        <span className="text-forest-900/40">•</span>
        <Link href="/contact" className="underline hover:text-forest-700 font-semibold">
          Contact Us
        </Link>
      </div>

      <FaqSection faqs={SITE_FAQS} title="General &amp; Booking Questions" />

      <OutboundCitations title="Primary Civil Aviation & Government Standards" />
    </article>
  );
}
