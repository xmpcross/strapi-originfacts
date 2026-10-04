import { redirect } from 'next/navigation';
import Script from 'next/script';
import PopularDestinationsBlock from '@/components/PopularDestinationsBlock';
import SearchByDestinationBlock from '@/components/SearchByDestinationBlock';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { faqJsonLd } from '@/lib/entity-seo';
import TpwlLoader from '@/components/TpwlLoader';
import AirlineResultsFilter from '@/components/AirlineResultsFilter';
import ComparisonTable from '@/components/ComparisonTable';

export const metadata = {
  title: 'Cheap flight search',
  description:
    'Compare cheap flights from hundreds of airlines and travel sites, check flexible dates, browse popular routes, and plan hotels near your trip.',
  alternates: { canonical: '/flight-search' },
};

const BOOKING_FAQ: { q: string; a: string }[] = [
  {
    q: 'How do I find the cheapest flights with Originfacts?',
    a: 'Start with your departure airport, destination, travel dates and passenger count. Originfacts sends the search to our flight-search partner so you can compare live airline and online travel agency fares in one place. For the lowest total price, check nearby dates, compare one-stop options against non-stop flights, and review baggage fees before you click through to book.',
  },
  {
    q: 'Do you earn a commission when I book through Originfacts?',
    a: 'Yes. Some flight, hotel and travel links on Originfacts are affiliate links. If you complete a booking after clicking one of those links, we may earn a commission at no extra cost to you. Sponsored links are marked where they appear, and the final booking, payment, ticket rules and customer support remain with the airline or travel seller.',
  },
  {
    q: 'Are the prices I see the same as on the airline’s own website?',
    a: 'The search results are intended to show live fares from airlines and travel agencies, but prices can change while seats are being checked. Always confirm the final fare, taxes, baggage allowance, seat fees and refund rules on the booking page before paying. The cheapest headline fare is not always the cheapest finished trip.',
  },
  {
    q: 'When is the cheapest time to book a flight?',
    a: 'For many domestic and short-haul routes, fares are often strongest when you compare 1 to 3 months ahead. Long-haul trips usually reward a wider window, often 2 to 6 months before departure. Route demand, school holidays, major events and airline sales matter more than any single magic booking day.',
  },
  {
    q: 'Are last-minute flights cheaper?',
    a: 'Usually no. Last-minute seats can be expensive because airlines know business and urgent travellers have less flexibility. Bargains still appear on routes with spare capacity, late schedule changes or seasonal dips, but it is safer to compare early and watch a few date combinations than to rely on a final-week discount.',
  },
  {
    q: 'How can being flexible with my dates save money?',
    a: 'Airfares can change sharply from one day to the next. Moving the outbound or return date by 24 to 48 hours can avoid peak departures, weekend demand or sold-out fare buckets. If your plans allow it, compare midweek departures, early morning flights, late-night arrivals and one-stop routes before choosing.',
  },
  {
    q: 'Why does the price change while I’m searching?',
    a: 'Flight prices are dynamic. Airlines and agencies update availability, fare classes, taxes and seat inventory throughout the day, and a fare can disappear while another traveller is booking it. Refresh the search before paying, and treat the checkout page as the final source for the current price.',
  },
  {
    q: 'Does Originfacts actually book my flight?',
    a: 'No. Originfacts helps you compare routes, fares and travel context, then sends you to the airline or travel seller to complete the booking. Your ticket, payment confirmation, schedule changes, refunds, seat assignments, baggage purchases and loyalty credit are handled by the company that sells the fare.',
  },
];

type ProTip = { n: number; title: string; tagline: string; image?: string };

const PRO_TIPS: ProTip[] = [
  {
    n: 1,
    title: 'Use flexible dates',
    tagline: 'Compare nearby days before you choose the final fare.',
    image: '/illustrations/flexible-dates.svg',
  },
  {
    n: 2,
    title: 'Scan the whole month',
    tagline: 'Look for fare drops outside Friday and Sunday peaks.',
    image: '/illustrations/search-month.svg',
  },
  {
    n: 3,
    title: 'Compare one-stop routes',
    tagline: 'A connection can beat non-stop pricing on busy routes.',
    image: '/illustrations/consider-one-stop.svg',
  },
  {
    n: 4,
    title: 'Check the final seller',
    tagline: 'Know who handles changes, baggage and refunds.',
    image: '/illustrations/book-direct.svg',
  },
];

// "YYYY-MM-DD" → "DDMM" (TPWL search-segment date encoding).
function isoToDDMM(iso?: string): string {
  if (!iso || iso.length < 10) return '';
  return `${iso.slice(8, 10)}${iso.slice(5, 7)}`;
}

// Pass-through landing for explore-card click-throughs. When called with
// ?origin=PER&destination=KUL&depart=YYYY-MM-DD&return=YYYY-MM-DD&pax=1 we
// rewrite to ?flightSearch=PER<DDMM>KUL<DDMM><pax> on this same page — the
// embedded TPWL SDK reads that param and renders the results in-page, so
// visitors never leave originfacts.com for the white-label host. Hitting the
// page with no params shows the on-site search widget below as before.
export default async function FlightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]);
  const origin = pick('origin');
  const destination = pick('destination');
  if (origin && destination) {
    const depart = pick('depart');
    const ret = pick('return');
    const paxRaw = pick('pax');
    const paxNum = paxRaw ? Number(paxRaw) : 1;
    const pax = Number.isFinite(paxNum) && paxNum > 0 ? paxNum : 1;
    const segment = `${origin.toUpperCase()}${isoToDDMM(depart)}${destination.toUpperCase()}${isoToDDMM(ret)}${pax}`;
    const airline = pick('airline');
    const an = pick('an');
    redirect(
      `/flight-search?flightSearch=${segment}` +
        (airline ? `&airline=${airline.toUpperCase()}${an ? `&an=${encodeURIComponent(an)}` : ''}` : ''),
    );
  }

  return (
    <>
      {/* Fare-search utility, not a listing of entity cards, so it gets
          BreadcrumbList only — there is no server-rendered card set for a
          CollectionPage/ItemList to describe. */}
      <JsonLd data={breadcrumbJsonLd([{ name: 'Flight Search', url: '/flight-search' }])} />
      {/* The booking FAQ below is rendered visibly further down the page —
          FAQPage schema mirrors that exact Q&A set. */}
      <JsonLd data={faqJsonLd(BOOKING_FAQ)} />
      <TpwlLoader />

      {/* TPWL renders the search form and result list in their containers below. */}

      <Script id="flight-search-state" strategy="afterInteractive">
        {`(function () {
  function update() {
    var hasParam = new URLSearchParams(window.location.search).has("flightSearch");
    document.documentElement.classList.toggle("flight-search-active", hasParam);
  }
  update();
  window.addEventListener("popstate", update);
  window.addEventListener("urlchange", update);
})();`}
      </Script>

      <div data-testid="fly-page">
        <div data-testid="fs-search-section" className="bg-gradient-to-b from-white via-white to-[#edf4ff]">
          <div className="fs-search-band mx-auto max-w-7xl px-6 pb-16 pt-14 lg:pt-16">
            <div data-testid="flight-search-hero" className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
              <header className="max-w-4xl">
                <h1 className="editorial-h max-w-4xl text-[clamp(2rem,3vw,3rem)] font-bold leading-[1.08] text-forest-900">
                  Compare cheap flights before you book
                </h1>
                <p className="mt-4 text-base text-forest-900/80 max-w-3xl leading-relaxed">
                  Finding cheap flights requires scanning real-time fare data across major carriers and independent booking channels before selecting your itinerary. Originfacts aggregates live airfares from over 500 airlines, allowing you to instantly compare route options, evaluate flexible date drops, review baggage inclusions, and access verified direct provider links for maximum savings without hidden fees.
                </p>
              </header>
              <aside className="relative hidden h-[168px] overflow-hidden rounded-[18px] bg-forest-900 shadow-lg lg:block" aria-label="Travel inspiration">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/generated/airports/airport-enu-hero.jpg" alt="Traveler overlooking a destination" className="h-full w-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-r from-forest-950/80 via-forest-950/20 to-transparent" />
                <p className="absolute bottom-5 left-5 max-w-[220px] text-xl font-bold leading-tight text-white">Find the fare that matches the trip, not just the headline price.</p>
              </aside>
            </div>

            <div className="tpwl-search-wrap mt-10">
              <div id="tpwl-search" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 pb-16">
        <div className="mt-12">
          <AirlineResultsFilter />
          <div id="tpwl-tickets" />
        </div>

        <PopularDestinationsBlock />

        {/* ---------- How to find a cheap flight ---------- */}
        <section className="mt-20" data-testid="travel-pros">
          <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">
            How to compare cheap flights well
          </h2>
          <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRO_TIPS.map((tip) => (
              <li
                key={tip.n}
                className="flex flex-col rounded-[4px] bg-white p-6 shadow-sm ring-1 ring-forest-900/10 transition-shadow hover:shadow-md"
              >
                <h3 className="text-base font-bold text-forest-900">{tip.title}</h3>
                <p className="mt-1 text-sm text-ink/75">{tip.tagline}</p>
                {tip.image ? (
                  <div className="mt-4 flex flex-1 items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tip.image}
                      alt={tip.title}
                      loading="lazy"
                      className="h-40 w-auto object-contain"
                    />
                  </div>
                ) : (
                  <span
                    aria-hidden
                    className="mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary-emphasis/10 text-base font-bold text-primary-emphasis"
                  >
                    {tip.n}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>

        <SearchByDestinationBlock />

        <div className="mt-16">
          <ComparisonTable
            caption="Flight Ticket Fares vs Inclusion Comparison Matrix"
            head={['Fare Category', 'Seat Selection', 'Cabin Baggage', 'Checked Luggage', 'Changes & Cancellations']}
            rows={[
              ['Basic Economy', 'Random assignment at check-in', '1 Personal Item (Under-seat)', 'Fee required', 'Non-refundable / Fee applies'],
              ['Standard Economy', 'Standard seat choice', '1 Personal Item + 1 Overhead Bag (7kg)', '1 Bag included (23kg)', 'Changes allowed with fee'],
              ['Flexi Economy', 'Free seat selection', '1 Personal Item + 1 Overhead Bag (7kg)', '1-2 Bags included (23kg)', 'Free changes / Refundable credit'],
              ['Business Class', 'Priority seat selection / Lay-flat', '2 Overhead Bags + Personal Item', '2-3 Bags included (32kg)', 'Fully refundable / Free changes'],
            ]}
          />
        </div>

        {/* ---------- Booking flights with Originfacts (FAQ) ---------- */}
        <section className="mt-20" data-testid="booking-faq">
          <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">
            How does booking flights with Originfacts work?
          </h2>
          <p className="mt-2 max-w-4xl text-[1rem] text-ink/75">
            Use these notes before you leave the search page. They explain how live fares work, why prices change, and what Originfacts does after you choose a flight.
          </p>
          <div className="mt-6 grid gap-x-12 sm:grid-cols-1 lg:grid-cols-2">
            {BOOKING_FAQ.map((item) => (
              <details key={item.q} className="group border-b border-forest-900/10">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[1rem] font-semibold text-forest-900 transition hover:text-primary-emphasis">
                  <span>{item.q}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4 shrink-0 text-forest-900/40 transition-transform group-open:rotate-180"
                    aria-hidden
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <div className="pb-5 pr-8 text-[1rem] leading-relaxed text-ink/75">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </section>
        </div>
      </div>
    </>
  );
}
