import ComparisonTable from '@/components/ComparisonTable';
import { JsonLd } from '@/components/SeoBlocks';
import { faqJsonLd } from '@/lib/entity-seo';

const CHECKS = [
  {
    title: 'Cabin bag allowance',
    text:
      'Carry-on size and weight limits are a frequent reason for a fee at the gate. Check the maximum dimensions and weight for your cabin, and whether the cheapest fare includes a cabin bag at all.',
  },
  {
    title: 'Checked baggage',
    text:
      'Allowances are set per piece or by total weight, and they differ by cabin and fare. Compare the allowance with what you plan to pack before you pay for the ticket.',
  },
  {
    title: 'What the cheapest fare includes',
    text:
      'The lowest fare can leave out seat selection and carry stricter change and cancellation terms. Look at these first if your plans might move.',
  },
  {
    title: 'Delays and cancellations',
    text:
      'What you are offered, such as care, rebooking or a refund, depends on the airline’s policy and the rules where you fly. Find the airline’s published policy before you need it.',
  },
  {
    title: 'Check-in and airport cut-offs',
    text:
      'Online check-in windows and airport cut-off times differ by airline, and between domestic and international flights. Missing a cut-off can cost you your seat.',
  },
  {
    title: 'Cabins, seating and support',
    text:
      'Seat options, whether seats are reserved or assigned at random, and family seating all vary by carrier. Note the contact channels and conditions of carriage too, so you know where to go if something changes.',
  },
];

/**
 * The explainer under the /airlines directory. Everything here is general
 * guidance or computed from the directory; the per-airline facts live on the
 * airline guides, so nothing below states a figure for a specific carrier.
 */
export default function AirlineCompareGuide({
  airlineCount,
  countryCount,
  verifiedCount,
}: {
  airlineCount: number;
  countryCount: number;
  verifiedCount: number;
}) {
  const faqs = [
    {
      q: 'How do I compare airlines before I book?',
      a: 'Look up each airline, then compare the same things for your fare: cabin and checked bag allowance, what the cheapest fare includes, change and cancellation terms, and the check-in cut-off. Add any bag and seat charges to the fare to see the real price of each option.',
    },
    {
      q: 'Where can I find an airline’s baggage allowance?',
      a: 'On the airline’s guide here (see its Carry-on and Checked baggage sections) and on the airline’s own website for your fare. Allowances can change by fare and route, so confirm them on your booking before you pack.',
    },
    {
      q: 'What is an IATA airline code?',
      a: 'A two-character code that identifies an airline in timetables, tickets and booking systems, for example QF for Qantas and SQ for Singapore Airlines. Searching by code helps when airlines have similar names or a regional subsidiary.',
    },
    {
      q: 'Is the airline on my ticket always the one flying?',
      a: 'Not always. On a codeshare flight one airline sells the ticket and another operates the aircraft. Check your booking confirmation for the operating airline and read its policies, because they can differ from those of the airline that sold the ticket.',
    },
    {
      q: 'What should I do if my flight is delayed or cancelled?',
      a: 'Contact the airline first and check its published policy. Your rights depend on the airline and on the rules where you fly. Keep your booking reference and receipts for any costs. Where an airline’s guide has a delays and cancellations section, it summarises the airline’s own policy.',
    },
    {
      q: 'How many airlines does this directory list?',
      a: `${airlineCount.toLocaleString()} airlines from ${countryCount.toLocaleString()} countries, searchable by name, IATA code, country or city. ${verifiedCount.toLocaleString()} of them have verified policy facts on their guide.`,
    },
  ];

  return (
    <section className="border-t border-forest-900/15 bg-paper" aria-labelledby="airlines-guide-heading" data-testid="airlines-about">
      <JsonLd data={faqJsonLd(faqs)} />
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-forest-900/55">Before you book</p>
          <h2 id="airlines-guide-heading" className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
            How to compare airlines before you book
          </h2>
          <p className="mt-4 text-base leading-relaxed text-forest-900/75">
            The fare on a results page is only part of the price. Bags, seats, changes and what happens when a flight
            is delayed are set by the airline, and they differ a lot from one carrier to the next. Look up the airline
            first, then check these six things. Each airline guide on Originfacts covers them in one place, and where a
            guide shows a value it is sourced to the airline&rsquo;s own pages or a named regulator.
          </p>
        </div>

        <ol className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {CHECKS.map((c, i) => (
            <li key={c.title} className="border-t-2 border-forest-950 pt-4">
              <p className="font-mono text-xs font-bold text-forest-900/50">0{i + 1}</p>
              <h3 className="mt-2 text-lg font-bold leading-snug">{c.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-forest-900/70">{c.text}</p>
            </li>
          ))}
        </ol>

        <h3 className="mt-14 text-xl font-bold leading-snug sm:text-2xl">What usually differs by type of airline</h3>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-forest-900/70">
          A starting point, not a promise: policies vary by airline, route and fare, so confirm them for your booking.
        </p>
        <ComparisonTable
          className="mb-0 mt-5"
          caption="Typical differences by airline type"
          head={['Airline type', 'Often included in the base fare', 'Often priced separately', 'Check before you book']}
          rows={[
            ['Scheduled', 'A cabin bag, and a checked bag on many long-haul fares', 'Seat selection and flexible fares on some tickets', 'Bag allowance and change terms for your fare'],
            ['Low-cost', 'A seat and a small personal item', 'Larger cabin bags, checked bags, seat selection and changes', 'The total price once bags and seats are added'],
            ['Regional', 'Varies by airline', 'Varies; some flights are sold under a partner’s code', 'Who operates the flight, and any aircraft-related bag limits'],
            ['Charter', 'Set by the operator or tour provider', 'Bags and transfers can be booking-specific', 'Your booking conditions'],
          ]}
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
          <div className="min-w-0">
            <h3 className="text-xl font-bold leading-snug sm:text-2xl">Airline questions, answered</h3>
            <p className="mt-3 text-base leading-relaxed text-forest-900/70">
              Quick answers on comparing carriers, codes and what to do when a trip changes.
            </p>
          </div>
          <div className="min-w-0 divide-y divide-forest-900/10 border-y border-forest-900/15">
            {faqs.map((f, i) => (
              <details key={f.q} className="group" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 text-base font-bold leading-snug text-forest-950 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis [&::-webkit-details-marker]:hidden">
                  <h4 className="text-base leading-snug">{f.q}</h4>
                  <span aria-hidden="true" className="mt-0.5 text-xl font-light leading-none text-forest-900/50 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="pb-5 pr-8 text-base leading-relaxed text-forest-900/80">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
