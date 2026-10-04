import { redirect } from 'next/navigation';
import Script from 'next/script';
import PopularDestinationsBlock from '@/components/PopularDestinationsBlock';
import SearchByDestinationBlock from '@/components/SearchByDestinationBlock';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { faqJsonLd } from '@/lib/entity-seo';
import TpwlLoader from '@/components/TpwlLoader';
import AirlineResultsFilter from '@/components/AirlineResultsFilter';

export const metadata = {
  title: 'Flight Search',
  description: 'Search hundreds of airlines in one place. Powered by our travel partners.',
  alternates: { canonical: '/flight-search' },
};

const BOOKING_FAQ: { q: string; a: string }[] = [
  {
    q: 'How do I find the cheapest flights with Originfacts?',
    a: 'Enter your origin, destination, and dates in the search box above. Originfacts compares fares from hundreds of airlines and online travel agencies through our partner Travelpayouts and surfaces the lowest price for each route — usually within a few seconds. For the absolute cheapest fares, leave the dates flexible and use the calendar view to spot which day of the week is least expensive.',
  },
  {
    q: 'Do you earn a commission when I book through Originfacts?',
    a: 'Yes. Originfacts is an affiliate of Travelpayouts and earns a small commission when you complete a booking via one of our search links — at no extra cost to you. It’s how we keep the blog independently funded and the search free to use. See our Affiliate Disclosure for the full details.',
  },
  {
    q: 'Are the prices I see the same as on the airline’s own website?',
    a: 'In the vast majority of cases, yes — our partner pulls live fares straight from the airlines and OTAs, so the headline price you see is the price you pay before optional extras like seat selection or checked bags. Always confirm the final total on the booking page before paying.',
  },
  {
    q: 'When is the cheapest time to book a flight?',
    a: 'For short-haul, booking 1–3 months ahead usually gets the best fare. For long-haul, 2–6 months ahead is the sweet spot. Tuesday and Wednesday departures tend to be cheaper than Friday and Sunday, and flying outside school holidays makes a much bigger difference than booking time.',
  },
  {
    q: 'Are last-minute flights cheaper?',
    a: 'Rarely. The old "wait until the day before" trick mostly stopped working a decade ago — airlines now use dynamic pricing that raises fares as seats fill up. Last-minute bargains do exist on routes with surplus capacity, but they’re the exception, not the rule.',
  },
  {
    q: 'How can being flexible with my dates save money?',
    a: 'Shifting a return by one or two days can cut the total by 20–40% on popular routes. Use the “whole month” or “cheapest month” view in the search widget above to see prices laid out day-by-day — the cheapest fare is often hiding mid-week, just outside the dates you originally picked.',
  },
  {
    q: 'Why does the price change while I’m searching?',
    a: 'Fares are pulled live every time you load a result, and airlines adjust them constantly based on demand, seat availability, and competitor pricing. If you see a good fare, lock it in — it can move within minutes.',
  },
  {
    q: 'Does Originfacts actually book my flight?',
    a: 'No. Originfacts is a travel blog with a metasearch widget — once you find a fare you like, you complete the booking directly on the airline or OTA website. That means your ticket, payment, and any changes or refunds are handled by them, not us, and you keep any loyalty miles or status credits.',
  },
];

type ProTip = { n: number; title: string; tagline: string; image?: string };

const PRO_TIPS: ProTip[] = [
  {
    n: 1,
    title: 'Flexible of Dates',
    tagline: 'Shift a day or two, you could save 20–40%.',
    image: '/illustrations/flexible-dates.svg',
  },
  {
    n: 2,
    title: 'Search the Whole Month',
    tagline: 'One click reveals the cheapest day to fly.',
    image: '/illustrations/search-month.svg',
  },
  {
    n: 3,
    title: 'One Stop',
    tagline: 'Layovers often beat non-stop by 30–50%.',
    image: '/illustrations/consider-one-stop.svg',
  },
  {
    n: 4,
    title: 'Book Direct',
    tagline: 'Skip the OTA, deal straight with the airline.',
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

      {/* TPWL loader now lives in app/layout.tsx so the SDK is available
          site-wide. The two `<div id="tpwl-search">` / `<div id="tpwl-tickets">`
          containers below are what tells main.js where to render. */}

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
        <div className="bg-[#f0f3f5]">
          <div className="fs-search-band mx-auto max-w-7xl px-6 pb-14 pt-16">
            <header className="max-w-3xl" data-testid="flight-search-hero">
              <h1 className="editorial-h text-[2.5rem] font-bold tracking-[-1px] text-forest-900">
                Compare every airline. In one search.
              </h1>
              <p className="mt-[5px] text-lg font-normal text-ink/75">
                Live fares from hundreds of carriers and online travel agencies, ranked by total
                price. We don&apos;t sell the ticket — we just help you find the cheapest one.
              </p>
            </header>

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
            How to find a cheap flight
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

        {/* ---------- Booking flights with Originfacts (FAQ) ---------- */}
        <section className="mt-20" data-testid="booking-faq">
          <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">
            Booking flights with Originfacts
          </h2>
          <p className="mt-2 max-w-4xl text-[1rem] text-ink/75">
            Quick answers to the questions readers ask us most about searching, booking,
            and saving on flights.
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
