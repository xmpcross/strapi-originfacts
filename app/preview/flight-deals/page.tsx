import type { Metadata } from 'next';
import FlightDealsPreviewClient from './FlightDealsPreviewClient';
import { listRoutes } from '@/lib/strapi';
import { JsonLd } from '@/components/SeoBlocks';
import { faqJsonLd, type Faq } from '@/lib/entity-seo';
import { breadcrumbJsonLd } from '@/lib/jsonld';

export const metadata: Metadata = {
  title: 'Flight Deals — Google Flights Deals (BETA) Preview',
  description: 'Interactive SerpApi Google Flights Deals API preview matching Google Travel layout.',
  robots: { index: false, follow: false },
};

const FLIGHT_DEALS_FAQS: Faq[] = [
  {
    q: 'What are some good flight destinations from Australia?',
    a: 'Popular flight destinations from Australia include London, Tokyo, Singapore, Bali, Sydney, Melbourne, and Bangkok. You can easily compare live fare options across hundreds of airlines using our flight deal engine above.',
  },
  {
    q: 'How can I find last-minute flight deals?',
    a: 'To find last-minute flight deals, keep your travel dates flexible, compare alternative nearby airports, monitor price calendar trends, and look for mid-week departures.',
  },
  {
    q: 'How can I find cheap flights for a weekend getaway?',
    a: 'Filter for short nonstop flights departing Friday evening or Saturday morning and returning Sunday night or Monday morning to get the maximum vacation time for minimum fare.',
  },
  {
    q: 'How can I find flight deals if my travel plans are flexible?',
    a: 'Use our flexible date calendar to view prices across adjacent weeks, allowing you to select the absolute cheapest departure and return days.',
  },
  {
    q: 'How can I find cheap flights from Australia to anywhere?',
    a: 'Enter your departure city (e.g. Perth PER or Sydney SYD) and set your destination to "Where to?" or explore our curated trending flight deals grid.',
  },
  {
    q: 'How can I get flight alerts for my trip?',
    a: 'Enter your email address in our newsletter subscription section above to receive instant price drop notifications whenever airfares drop for your preferred routes.',
  },
];

export default async function FlightDealsPreviewPage() {
  const routes = await listRoutes().catch(() => []);
  const breadcrumbs = breadcrumbJsonLd([{ name: 'Flight Deals', url: '/preview/flight-deals' }]);
  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24 text-slate-900" data-testid="flight-deals-preview">
      <JsonLd data={faqJsonLd(FLIGHT_DEALS_FAQS)} />
      <JsonLd data={breadcrumbs} />
      <FlightDealsPreviewClient routes={routes} />
    </div>
  );
}
