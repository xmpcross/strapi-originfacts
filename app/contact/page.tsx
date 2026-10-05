import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ContactForm from '@/components/ContactForm';
import { JsonLd } from '@/components/SeoBlocks';
import { ORG_ID, organizationJsonLd, absoluteUrl, breadcrumbJsonLd } from '@/lib/jsonld';
import { SITE_PHOTOS, type SitePhoto } from '@/lib/site-photos';
import { LEGAL_DOCS } from '@/lib/legal';
import { buildFaqGroups } from '@/lib/faq';
import { SUBJECTS, contactHref } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Contact Originfacts',
  description:
    'Get in touch about Originfacts — support, privacy, cookies, accessibility, affiliate enquiries, or user content complaints.',
  alternates: { canonical: '/contact' },
};

const contactPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Contact Originfacts',
  url: absoluteUrl('/contact'),
  description:
    'Get in touch about Originfacts — support, privacy, cookies, accessibility, affiliate enquiries, or user content complaints.',
  // Full Organization node (with ContactPoint) is emitted alongside; this
  // reference keeps both hanging off the same entity id.
  mainEntity: { '@id': ORG_ID },
};

/* Addresses and what each is for, from content/legal/contact.md. */
const CONTACT_EMAIL = 'contact@originfacts.com';
const SUPPORT_EMAIL = 'support@fxnholdings.com';
const EMAILS = [
  { label: 'Website contact', address: CONTACT_EMAIL, use: 'Corrections, feedback and questions about the website.' },
  {
    label: 'Company support',
    address: SUPPORT_EMAIL,
    use: 'Legal notices, content complaints, privacy, cookie and accessibility requests, and affiliate questions.',
  },
];

/* ------------------------------------------------------------------ */
/* Imagery: real, credited Unsplash photographs (lib/site-photos.ts),  */
/* the same set the About page draws from. These replaced the         */
/* AI-generated CMS destination heroes.                               */
/* ------------------------------------------------------------------ */

type Photo = SitePhoto;

/* ------------------------------------------------------------------ */
/* Routing: who can actually help. Wording follows content/legal/      */
/* contact.md and the answers in lib/faq.ts.                          */
/* ------------------------------------------------------------------ */

type FaqLink = { id: string; label: string };

type ProviderRoute = {
  key: string;
  title: string;
  who: string;
  text: string;
  link?: { href: string; label: string };
  faq: FaqLink[];
};

const PROVIDER_ROUTES: ProviderRoute[] = [
  {
    key: 'booking',
    title: 'A booking, payment, refund or cancellation',
    who: 'The provider you booked with',
    text: 'Originfacts does not sell bookings, take payments, issue tickets, process refunds or manage cancellations. If you booked through a link on our site, your contract is with that provider — so questions about a ticket, hotel, rental or tour go to them.',
    faq: [
      { id: 'booking-problems', label: 'Who do I contact about a booking?' },
      { id: 'check-before-booking', label: 'What should I check before I book?' },
    ],
  },
  {
    key: 'airline',
    title: 'Baggage, delays, schedules or compensation',
    who: 'The airline',
    text: "We don't advise on individual claims: the airline's conditions of carriage and the regulator are the places to check what you are entitled to. Where an airline's page has a delays and cancellations section, it links to the airline's own disruption pages — and we only publish an airline phone number that comes from the airline's own website.",
    link: { href: '/airlines', label: 'Find the airline in our directory' },
    faq: [
      { id: 'compensation', label: 'Am I owed compensation?' },
      { id: 'airline-phone-numbers', label: 'Are the airline phone numbers official?' },
    ],
  },
  {
    key: 'price',
    title: 'A price that changed after you clicked through',
    who: 'The provider showing the price',
    text: 'Prices on Originfacts may be live, estimated, cached or currency-converted. Check the final price, taxes, fees and cancellation rules on the provider’s website before you book.',
    faq: [
      { id: 'why-price-changes', label: 'Why is the price different?' },
      { id: 'are-prices-guaranteed', label: 'Are prices guaranteed?' },
    ],
  },
];

type UsRoute = {
  key: string;
  title: string;
  text: string;
  param: Parameters<typeof contactHref>[0];
  email: { address: string; subjectLine?: string };
  faq: FaqLink;
};

const US_ROUTES: UsRoute[] = [
  {
    key: 'correction',
    title: 'Report an error or suggest a correction',
    text: 'Send the page URL, the exact text that looks wrong and a source we can verify. When something is wrong, it is corrected or removed.',
    param: 'correction',
    email: { address: CONTACT_EMAIL },
    faq: { id: 'report-an-error', label: 'Reporting an error' },
  },
  {
    key: 'affiliate',
    title: 'Affiliate, advertising and partnerships',
    text: 'Questions about affiliate links, sponsored placements, travel widgets, hotel search cards, flight partners or other commercial relationships.',
    param: 'affiliate',
    email: { address: SUPPORT_EMAIL },
    faq: { id: 'affiliate-enquiries', label: 'Affiliate enquiries' },
  },
  {
    key: 'privacy',
    title: 'Privacy and cookie requests',
    text: 'Access, correction or deletion of your information, or a cookie or tracking opt-out (choose “Cookie request” in the form). We may need to verify your identity before responding.',
    param: 'privacy',
    email: { address: SUPPORT_EMAIL, subjectLine: 'Privacy Request' },
    faq: { id: 'privacy-request', label: 'Making a privacy request' },
  },
  {
    key: 'legal',
    title: 'Legal notices and content complaints',
    text: 'Legal notices, copyright complaints, illegal-content or fake-review reports, and complaints about misleading information or user content.',
    param: 'legal',
    email: { address: SUPPORT_EMAIL },
    faq: { id: 'legal-notice', label: 'Sending a legal notice' },
  },
  {
    key: 'accessibility',
    title: 'Accessibility feedback',
    text: 'Tell us the page URL, what you were trying to do and the device, browser or assistive technology you used. You can also ask for information in a different format.',
    param: 'accessibility',
    email: { address: SUPPORT_EMAIL, subjectLine: 'Accessibility Feedback' },
    faq: { id: 'accessibility', label: 'Reporting an accessibility problem' },
  },
  {
    key: 'support',
    title: 'Anything else about Originfacts',
    text: 'General questions about the site and how it works. For a broken page or feature, choose “Website issue” in the form.',
    param: 'support',
    email: { address: CONTACT_EMAIL },
    faq: { id: 'how-to-contact', label: 'How to contact us' },
  },
];

// From content/legal/contact.md, "Legal notices and content complaints".
const WHAT_TO_INCLUDE = [
  'Your name and contact details',
  'The URL or location of the relevant content',
  'A clear description of the issue',
  'Supporting evidence, where available',
  'The action you are asking for',
];

const SOCIAL = [
  { label: 'X', href: 'https://x.com/realoriginfacts' },
  { label: 'Facebook', href: 'https://www.facebook.com/originfacts/' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/143027896/' },
  { label: 'Instagram', href: 'https://www.instagram.com/originfacts/' },
  { label: 'Reddit', href: 'https://www.reddit.com/r/Originfacts/' },
];

// Questions surfaced at the foot of the page; the question text is read from lib/faq.ts.
const FAQ_PICKS = [
  'does-originfacts-sell-tickets',
  'booking-problems',
  'compensation',
  'why-price-changes',
  'report-an-error',
  'privacy-request',
  'cookie-choices',
  'do-you-earn-commission',
];

/* ------------------------------------------------------------------ */

export default async function ContactPage() {

  const heroMain = SITE_PHOTOS['singapore'];
  const heroSideA = SITE_PHOTOS['south-korea'];
  const heroSideB = SITE_PHOTOS['australia'];
  // Wide band: the landscape Fuji panorama (the portrait Wat Arun shot showed
  // only its spire here).
  const bandPhoto = SITE_PHOTOS['japan'];

  // Question text comes from the same data as /faq, so these links cannot drift
  // from it. The counts only decide whether the "how many airlines" question
  // exists (it does whenever the directory has airlines); its text isn't used.
  const faqGroups = buildFaqGroups({ articles: 0, airlines: 1, airlineCountries: 0, verifiedAirlineGuides: 0, airports: 0 });
  const faqQuestions = new Map(faqGroups.flatMap((g) => g.items.map((it) => [it.id, it.q] as const)));
  const faqPicks = FAQ_PICKS.flatMap((id) => {
    const q = faqQuestions.get(id);
    return q ? [{ id, q }] : [];
  });

  // Every number here is counted from what the page renders, not typed.
  const stats = [
    { value: PROVIDER_ROUTES.length + US_ROUTES.length, label: 'kinds of request, routed below' },
    { value: SUBJECTS.length, label: 'subjects to choose from in the form' },
    { value: EMAILS.length, label: 'email addresses, each with its own job' },
    { value: faqQuestions.size, label: 'answers in our FAQ' },
  ];

  return (
    <article className="overflow-x-clip" data-testid="contact-page">
      <JsonLd data={organizationJsonLd({ withContactPoint: true })} />
      <JsonLd data={contactPageJsonLd} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Contact', url: '/contact' }])} />

      {/* ---------------- Hero ---------------- */}
      <header className="mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16" data-testid="contact-hero">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14">
          <div className="min-w-0">
            <p className="eyebrow-tag">Contact</p>
            <h1 className="mt-5 text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">
              Contact Originfacts
            </h1>
            <p className="mt-6 text-xl font-semibold leading-snug text-forest-900 sm:text-2xl">
              Spotted an error, have a partnership idea, or need to make a privacy or accessibility request? This is the
              place.
            </p>
            <p className="mt-5 text-base leading-relaxed text-forest-900/75">
              Originfacts is a travel information site, not a booking agent. If your question is about a ticket, hotel,
              rental or tour you have booked, the company you booked with is the one that can help — the guide below
              shows where each kind of request should go.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#who-to-contact"
                className="inline-flex h-12 items-center rounded-full bg-forest-950 px-6 text-sm font-bold text-white transition hover:bg-forest-800"
              >
                Who should I contact? ↓
              </a>
              <a
                href="#contact-form"
                className="inline-flex h-12 items-center rounded-full border border-forest-900/25 px-6 text-sm font-bold text-forest-950 transition hover:border-forest-950"
              >
                Go to the form
              </a>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold" data-testid="contact-hero-links">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-emphasis underline-offset-2 hover:underline">
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <Link href="/faq" className="text-forest-950 underline-offset-2 hover:underline">
                  Read the FAQ →
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-forest-950 underline-offset-2 hover:underline">
                  About Originfacts →
                </Link>
              </li>
            </ul>
          </div>

          {heroMain && (
            <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3" data-testid="contact-hero-mosaic">
              <PhotoTile
                photo={heroMain}
                className="col-span-2 row-span-2 aspect-[4/5]"
                priority
                sizes="(min-width: 1024px) 420px, 66vw"
              />
              {heroSideA && <PhotoTile photo={heroSideA} className="h-full" priority sizes="(min-width: 1024px) 210px, 33vw" />}
              {heroSideB && <PhotoTile photo={heroSideB} className="h-full" priority sizes="(min-width: 1024px) 210px, 33vw" />}
            </div>
          )}
        </div>
      </header>

      {/* ---------------- Numbers ---------------- */}
      <section aria-label="This page in numbers" className="border-y border-forest-900/15 bg-paper" data-testid="contact-stats">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex min-w-0 flex-col-reverse border-l-2 border-primary-emphasis pl-4">
              <dt className="mt-2 text-xs font-bold uppercase tracking-widest text-forest-900/60">{s.label}</dt>
              <dd className="text-4xl font-bold leading-none text-forest-950 sm:text-5xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* ---------------- 01 Who to contact ---------------- */}
        <section
          className="scroll-mt-24 py-16 sm:py-20"
          id="who-to-contact"
          aria-labelledby="contact-routes"
          data-testid="contact-routes"
        >
          <div className="max-w-3xl">
            <Kicker n="01" label="Start here" />
            <h2 id="contact-routes" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
              Who should you contact?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-forest-900/75 sm:text-lg">
              Many questions are really for an airline, a hotel or a booking site. Find yours below to reach the people
              who can act on it.
            </p>
          </div>

          <h3 className="mt-12 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-terracotta-600">
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-full bg-terracotta-600 text-[11px] text-white"
            >
              ✕
            </span>
            Not us — contact the provider
          </h3>
          <ul className="mt-5 grid gap-4 lg:grid-cols-3" data-testid="contact-provider-routes">
            {PROVIDER_ROUTES.map((r) => (
              <li
                key={r.key}
                className="flex min-w-0 flex-col rounded-[0.3rem] border-l-4 border-secondary-emphasis bg-secondary p-6"
                data-testid={`contact-route-${r.key}`}
              >
                <p className="text-xs font-bold uppercase tracking-widest text-forest-900/60">{r.title}</p>
                <p className="mt-2 text-2xl font-bold leading-tight text-forest-950">{r.who}</p>
                <p className="mt-3 text-sm leading-relaxed text-forest-900/80">{r.text}</p>
                <div className="mt-auto pt-5">
                  {r.link && (
                    <Link
                      href={r.link.href}
                      className="mb-3 inline-flex text-sm font-bold text-primary-emphasis underline-offset-2 hover:underline"
                    >
                      {r.link.label} →
                    </Link>
                  )}
                  <ul className="flex flex-wrap gap-2" aria-label="Related FAQ answers">
                    {r.faq.map((f) => (
                      <li key={f.id} className="min-w-0">
                        <Link
                          href={`/faq#${f.id}`}
                          className="inline-flex rounded-full border border-forest-900/15 bg-white px-3 py-1.5 text-xs font-semibold text-forest-900/85 transition hover:border-primary-emphasis hover:text-primary-emphasis"
                        >
                          FAQ: {f.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>

          <h3 className="mt-14 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-success-emphasis">
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-full bg-success-emphasis text-[11px] text-white"
            >
              ✓
            </span>
            Contact Originfacts
          </h3>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="contact-us-routes">
            {US_ROUTES.map((r, i) => (
              <li
                key={r.key}
                className="flex min-w-0 flex-col rounded-[0.3rem] border border-forest-900/15 bg-white p-6 transition hover:border-primary-emphasis/40 hover:shadow-md"
                data-testid={`contact-route-${r.key}`}
              >
                <p className="font-mono text-xs font-bold text-forest-900/45">{String(i + 1).padStart(2, '0')}</p>
                <h4 className="mt-2 text-lg font-bold leading-snug text-forest-950">{r.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-forest-900/75">{r.text}</p>
                <div className="mt-auto space-y-3 pt-5">
                  <Link
                    href={contactHref(r.param)}
                    className="inline-flex h-10 items-center rounded-full bg-forest-950 px-5 text-sm font-bold text-white transition hover:bg-forest-800"
                    data-testid={`contact-route-${r.key}-cta`}
                  >
                    Use the form<span className="sr-only">: {r.title}</span>
                    <span aria-hidden className="ml-1.5">
                      →
                    </span>
                  </Link>
                  <p className="text-xs leading-relaxed text-forest-900/70">
                    or email{' '}
                    <a
                      href={`mailto:${r.email.address}${r.email.subjectLine ? `?subject=${encodeURIComponent(r.email.subjectLine)}` : ''}`}
                      className="break-words font-semibold text-primary-emphasis underline-offset-2 hover:underline"
                    >
                      {r.email.address}
                    </a>
                    {r.email.subjectLine && <> with the subject line “{r.email.subjectLine}”</>}
                  </p>
                  <Link
                    href={`/faq#${r.faq.id}`}
                    className="block text-xs font-semibold text-forest-900/70 underline-offset-2 hover:text-primary-emphasis hover:underline"
                  >
                    FAQ: {r.faq.label} →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ---------------- Full-bleed image band ---------------- */}
      {bandPhoto && (
        <section className="relative isolate overflow-hidden bg-forest-950" aria-label="Your booking" data-testid="contact-band">
          <Image src={bandPhoto.src} alt={bandPhoto.alt} fill sizes="100vw" className="-z-10 object-cover opacity-60" style={{ objectPosition: bandPhoto.focus ?? 'center' }} loading="lazy" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-forest-950/90 via-forest-950/60 to-forest-950/20" />
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
            <blockquote className="max-w-3xl">
              <p className="text-2xl font-bold leading-snug text-white sm:text-4xl">
                “If you book or buy through a third-party provider, your contract is with that provider.”
              </p>
            </blockquote>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/80">
              From our{' '}
              <Link href="/legal/contact" className="font-semibold text-white underline underline-offset-2">
                Legal Notice
              </Link>
              . We can correct what is on our pages; a booking can only be changed by the company that holds it.
            </p>
            <Link
              href={`/destinations/${bandPhoto.slug}`}
              className="mt-8 inline-block text-xs font-bold uppercase tracking-widest text-white/70 hover:text-white"
            >
              Pictured: {bandPhoto.name} →
            </Link>
            <PhotoCredit photo={bandPhoto} className="mt-2 block text-xs text-white/60" linkClassName="hover:text-white" />
          </div>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* ---------------- 02 Form ---------------- */}
        <section
          id="contact-form"
          className="grid scroll-mt-24 gap-10 py-16 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
          aria-labelledby="contact-form-heading"
          data-testid="contact-form-section"
        >
          <div className="min-w-0">
            <Kicker n="02" label="Write to us" />
            <h2 id="contact-form-heading" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
              How can you send us a message?
            </h2>
            <p className="mt-6 text-base leading-relaxed text-forest-900/80">
              Use the form, or email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                {CONTACT_EMAIL}
              </a>
              . We aim to review messages within a reasonable time; requests that need identity verification,
              investigation or legal review may take longer.
            </p>

            <div className="mt-8 rounded-[0.3rem] border-2 border-forest-950 p-6" data-testid="contact-include">
              <p className="text-xs font-bold uppercase tracking-widest text-forest-900/60">A useful message includes</p>
              <ol className="mt-4 space-y-3">
                {WHAT_TO_INCLUDE.map((item, i) => (
                  <li key={item} className="flex items-start gap-3 text-sm font-semibold text-forest-950">
                    <span
                      aria-hidden
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-emphasis text-xs text-white"
                    >
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{item}</span>
                  </li>
                ))}
              </ol>
            </div>

            <PullQuote>Clear source links help us update pages faster.</PullQuote>
            <p className="mt-4 text-sm leading-relaxed text-forest-900/70">
              Airport, airline, hotel and destination details can change quickly. How we check and correct them is set
              out in our{' '}
              <Link href="/methodology" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                Editorial Methodology &amp; Data Standards
              </Link>
              .
            </p>
          </div>

          <ContactForm />
        </section>

        {/* ---------------- 03 Other ways ---------------- */}
        <section className="border-t border-forest-900/15 py-16 sm:py-20" aria-labelledby="contact-other" data-testid="contact-other">
          <div className="max-w-3xl">
            <Kicker n="03" label="Other ways" />
            <h2 id="contact-other" className="mt-3 text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
              Where else can you reach Originfacts?
            </h2>
          </div>

          <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            <div className="min-w-0 border-t-2 border-forest-950 pt-4">
              <h3 className="font-mono text-xs font-bold uppercase text-forest-900/50">Email</h3>
              <dl className="mt-3 space-y-5 text-sm">
                {EMAILS.map((e) => (
                  <div key={e.address}>
                    <dt className="text-xs font-bold uppercase tracking-wider text-forest-900/60">{e.label}</dt>
                    <dd className="mt-1">
                      <a
                        href={`mailto:${e.address}`}
                        className="break-words text-lg font-bold text-forest-950 hover:text-primary-emphasis"
                      >
                        {e.address}
                      </a>
                      <span className="mt-1 block text-forest-900/70">{e.use}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="min-w-0 border-t-2 border-forest-950 pt-4">
              <h3 className="font-mono text-xs font-bold uppercase text-forest-900/50">Post</h3>
              <address className="mt-3 text-base not-italic leading-relaxed text-forest-950">
                FXN Holdings
                <br />
                PO Box 500
                <br />
                WEST PERTH WA 6872
                <br />
                Australia
              </address>
            </div>

            <div className="min-w-0 border-t-2 border-forest-950 pt-4">
              <h3 className="font-mono text-xs font-bold uppercase text-forest-900/50">Follow</h3>
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Originfacts on social media">
                {SOCIAL.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Originfacts on ${s.label} (opens in a new tab)`}
                      className="inline-flex rounded-full border border-forest-900/20 px-3 py-1.5 text-sm font-semibold text-forest-950 transition hover:border-primary-emphasis hover:text-primary-emphasis"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href="/feed.xml"
                    className="inline-flex rounded-full border border-forest-900/20 px-3 py-1.5 text-sm font-semibold text-forest-950 transition hover:border-primary-emphasis hover:text-primary-emphasis"
                  >
                    RSS feed
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ---------------- FAQ + operator ---------------- */}
        <section className="grid gap-6 pb-20 lg:grid-cols-2" aria-label="Common questions, and who operates Originfacts">
          <div className="min-w-0 rounded-[0.3rem] bg-sand-100 p-6 sm:p-8" data-testid="contact-faq">
            <h2 className="text-2xl font-bold leading-tight text-forest-950">Is your question already answered?</h2>
            <p className="mt-3 text-sm leading-relaxed text-forest-900/75">
              Our FAQ has {faqQuestions.size} answers about bookings, prices, airline data, corrections and privacy. These
              come up most often.
            </p>
            <ul className="mt-5 divide-y divide-forest-900/10 border-y border-forest-900/10">
              {faqPicks.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/faq#${f.id}`}
                    className="flex items-center justify-between gap-4 py-3 text-sm font-semibold text-forest-950 hover:text-primary-emphasis"
                  >
                    <span className="min-w-0">{f.q}</span>
                    <span aria-hidden className="shrink-0 text-primary-emphasis">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold">
              <Link href="/faq" className="text-primary-emphasis underline-offset-2 hover:underline">
                All FAQ answers →
              </Link>
              <Link href="/about" className="text-forest-950 underline-offset-2 hover:underline">
                About Originfacts →
              </Link>
            </div>
          </div>

          <div className="min-w-0 rounded-[0.3rem] bg-forest-950 p-6 text-white sm:p-8" data-testid="contact-operator">
            <h2 className="text-2xl font-bold leading-tight !text-white">Who operates Originfacts?</h2>
            <dl className="mt-5 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-y-3">
              <OperatorRow label="Business">
                <span className="font-semibold">FXN Holdings</span>
              </OperatorRow>
              <OperatorRow label="ABN">53 274 423 748</OperatorRow>
              <OperatorRow label="Mailing address">PO Box 500, WEST PERTH WA 6872, Australia</OperatorRow>
              <OperatorRow label="Website">www.originfacts.com</OperatorRow>
            </dl>
            <nav aria-label="Policies" className="mt-6 border-t border-white/15 pt-5">
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/80">
                {LEGAL_DOCS.map((d) => (
                  <li key={d.slug}>
                    <Link href={`/legal/${d.slug}`} className="underline-offset-2 hover:text-white hover:underline">
                      {d.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </section>
      </div>
      <PhotoCredits photos={[heroMain, heroSideA, heroSideB, bandPhoto]} />
    </article>
  );
}

/* ------------------------------------------------------------------ */

function Kicker({ n, label }: { n: string; label: string }) {
  return (
    <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-primary-emphasis">
      <span className="font-mono text-forest-900/45">{n}</span>
      <span aria-hidden className="h-px w-8 bg-primary-emphasis/40" />
      {label}
    </p>
  );
}

function PullQuote({ children, className = 'mt-8' }: { children: React.ReactNode; className?: string }) {
  return (
    <blockquote className={`border-l-4 border-primary-emphasis pl-5 ${className}`}>
      <p className="text-xl font-bold leading-snug text-forest-950 sm:text-2xl">“{children}”</p>
    </blockquote>
  );
}

function OperatorRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="mt-3 text-xs font-bold uppercase tracking-wider text-white/55 sm:mt-0 sm:pt-0.5">{label}</dt>
      <dd className="break-words">{children}</dd>
    </>
  );
}

function PhotoTile({
  photo,
  className = '',
  sizes,
  priority = false,
}: {
  photo: Photo;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative min-w-0 overflow-hidden rounded-[0.3rem] bg-forest-100 ${className}`}>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}

/** "Photo: Name / Unsplash", linked to the photographer and the photo page. */
function PhotoCredit({ photo, className, linkClassName }: { photo: Photo; className: string; linkClassName: string }) {
  return (
    <span className={className}>
      Photo:{' '}
      <a href={photo.photographerUrl} rel="noopener" className={linkClassName}>
        {photo.photographer}
      </a>{' '}
      /{' '}
      <a href={photo.sourceUrl} rel="noopener" className={linkClassName}>
        Unsplash
      </a>
    </span>
  );
}

/** One discreet line crediting every photograph on the page, including the uncaptioned hero tiles. */
function PhotoCredits({ photos }: { photos: Photo[] }) {
  return (
    <aside aria-label="Photo credits" className="mx-auto max-w-7xl px-4 pb-10 sm:px-6" data-testid="contact-photo-credits">
      <p className="border-t border-forest-900/15 pt-5 text-xs leading-relaxed text-forest-900/55">
        <span className="font-semibold">Photo credits</span> (real photographs, Unsplash License):{' '}
        {photos.map((p, i) => (
          <span key={p.slug}>
            {i > 0 && ' · '}
            {p.place} by{' '}
            <a href={p.photographerUrl} rel="noopener" className="underline-offset-2 hover:text-primary-emphasis hover:underline">
              {p.photographer}
            </a>{' '}
            on{' '}
            <a href={p.sourceUrl} rel="noopener" className="underline-offset-2 hover:text-primary-emphasis hover:underline">
              Unsplash
            </a>
          </span>
        ))}
      </p>
    </aside>
  );
}
