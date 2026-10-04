import type { Metadata } from 'next';
import Link from 'next/link';
import ContactForm from '@/components/ContactForm';
import { JsonLd } from '@/components/SeoBlocks';
import { ORG_ID, organizationJsonLd, absoluteUrl, breadcrumbJsonLd } from '@/lib/jsonld';

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

export default function ContactPage() {
  return (
    <article className="mx-auto max-w-7xl px-6 py-16" data-testid="contact-page">
      <JsonLd data={organizationJsonLd({ withContactPoint: true })} />
      <JsonLd data={contactPageJsonLd} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Contact', url: '/contact' }])} />
      <header className="max-w-3xl">
        <h1 className="editorial-h text-3xl font-bold leading-tight text-forest-900 sm:text-4xl">
          Get in Touch
        </h1>
        <p className="mt-3 text-lg font-light text-forest-900/75">
          Originfacts offers direct communication channels for reader inquiries, editorial feedback, data corrections, and partnership opportunities. You can reach our editorial team directly via our verified email address at contact@originfacts.com or by submitting the secure contact form below. All reader inquiries receive prompt human review from our site administrators and subject specialists.
        </p>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-16">
        {/* Left — contact info */}
        <aside className="space-y-10">
          <div>
            <h2 className="editorial-h text-sm uppercase tracking-widest text-forest-800/70">
              How do you contact us via email?
            </h2>
            <a
              href="mailto:contact@originfacts.com"
              className="mt-2 block font-urbanist text-xl font-bold text-forest-900 hover:text-forest-700"
            >
              contact@originfacts.com
            </a>
            <p className="mt-2 text-sm font-light text-forest-900/70">
              We aim to review messages within a reasonable time.
            </p>
          </div>

          <div>
            <h2 className="editorial-h text-sm uppercase tracking-widest text-forest-800/70">
              Where is our official mailing address?
            </h2>
            <address className="mt-2 text-base not-italic leading-relaxed text-forest-900">
              FXN HOLDINGS LIMITED
              <br />
              61 Bridge Street
              <br />
              Kington, HR5 3DJ
              <br />
              United Kingdom
            </address>
          </div>

          <div>
            <h2 className="editorial-h text-sm uppercase tracking-widest text-forest-800/70">
              Where can you follow us on social media?
            </h2>
            <ul className="mt-3 flex items-center gap-3" aria-label="Originfacts on social media">
              <li>
                <a
                  href="https://x.com/realoriginfacts"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Originfacts on X"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-forest-900/20 text-forest-900 transition hover:border-primary-emphasis hover:text-primary-emphasis"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.967 6.817H1.677l7.73-8.835L1.255 2.25h6.83l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/originfacts/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Originfacts on Facebook"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-forest-900/20 text-forest-900 transition hover:border-primary-emphasis hover:text-primary-emphasis"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path d="M22 12.06C22 6.48 17.52 2 11.94 2 6.36 2 1.88 6.48 1.88 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.78v-2.91h2.54V9.84c0-2.51 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46H15.1c-1.24 0-1.62.77-1.62 1.56v1.87h2.76l-.44 2.91h-2.32V22c4.78-.76 8.52-4.92 8.52-9.94z" />
                  </svg>
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/143027896/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Originfacts on LinkedIn"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-forest-900/20 text-forest-900 transition hover:border-primary-emphasis hover:text-primary-emphasis"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.8 0 0 .78 0 1.75v20.5C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.75V1.75C24 .78 23.2 0 22.22 0z" />
                  </svg>
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/originfacts/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Originfacts on Instagram"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-forest-900/20 text-forest-900 transition hover:border-primary-emphasis hover:text-primary-emphasis"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
              </li>
              <li>
                <a
                  href="https://www.reddit.com/r/Originfacts/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Originfacts on Reddit"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-forest-900/20 text-forest-900 transition hover:border-primary-emphasis hover:text-primary-emphasis"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.74c.69 0 1.25.56 1.25 1.25a1.25 1.25 0 0 1-2.5.01c0-.69.56-1.26 1.25-1.26zm-5.01 1.4c2.62 0 4.99.87 6.66 2.23a1.81 1.81 0 0 1 2.4 2.75c0 .05.01.1.01.15 0 2.68-3.15 4.85-7.06 4.85s-7.06-2.17-7.06-4.85c0-.05 0-.1.01-.15a1.81 1.81 0 0 1 2.4-2.75C7.02 7.01 9.39 6.14 12 6.14zm-3.8 4.15a1.25 1.25 0 0 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm7.6 0a1.25 1.25 0 0 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm-3.8 4.66c-1 0-1.98.11-2.85.35-.25.07-.4.32-.33.57.06.2.24.34.45.34l.12-.02c.77-.21 1.65-.32 2.54-.32.89 0 1.77.11 2.54.32l.12.02c.21 0 .39-.14.45-.34a.46.46 0 0 0-.33-.57c-.87-.24-1.85-.35-2.85-.35z" />
                  </svg>
                </a>
              </li>
              <li>
                <a
                  href="/feed.xml"
                  aria-label="Originfacts RSS feed"
                  title="RSS feed"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-forest-900/20 text-forest-900 transition hover:border-primary-emphasis hover:text-primary-emphasis"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path d="M4.252 11.105a8.643 8.643 0 0 1 8.643 8.643h-2.882a5.761 5.761 0 0 0-5.761-5.761zM4.252 5.343A14.404 14.404 0 0 1 18.657 19.748h-2.882A11.523 11.523 0 0 0 4.252 8.225zM6.413 16.146a2.16 2.16 0 1 1-4.321 0 2.16 2.16 0 0 1 4.321 0z" />
                  </svg>
                </a>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-forest-900/10 bg-forest-50 p-5 text-sm leading-relaxed text-forest-900/80">
            <strong className="font-semibold text-forest-900">Booking issues?</strong> Originfacts
            does not handle bookings, payments, or refunds. If your question is about a ticket,
            hotel, rental, or tour, contact the provider you booked with directly.
          </div>

          <div className="rounded-lg border border-forest-900/10 bg-white p-5 text-sm leading-relaxed text-forest-900/80">
            <h2 className="editorial-h text-sm uppercase tracking-widest text-forest-800/70">
              What editorial standards do we follow?
            </h2>
            <p className="mt-3">
              Send corrections with the page URL, the exact line that looks wrong, and a source we
              can verify. Airport, airline, hotel, and destination details can change quickly, so
              clear source links help us update pages faster. Read our full{' '}
              <Link href="/methodology" className="font-semibold underline hover:text-forest-900">
                Editorial Methodology &amp; Data Standards
              </Link>.
            </p>
          </div>
        </aside>

        {/* Right — form (Client Component) */}
        <ContactForm />
      </div>

      <section className="mt-14 grid gap-6 border-t border-forest-900/10 pt-10 md:grid-cols-3">
        <div>
          <h2 className="editorial-h text-xl font-bold text-forest-950">How do you submit content corrections?</h2>
          <p className="mt-3 text-base leading-7 text-forest-900/75">
            Tell us when a route, airport code, airline policy, destination detail, or article
            reference needs review. Include enough context for our editors to reproduce the issue.
          </p>
        </div>
        <div>
          <h2 className="editorial-h text-xl font-bold text-forest-950">Have questions about our affiliate relationships?</h2>
          <p className="mt-3 text-base leading-7 text-forest-900/75">
            We can review advertiser, affiliate, and disclosure questions related to sponsored
            links, travel widgets, hotel search cards, flight partners, or commercial placements.
          </p>
        </div>
        <div>
          <h2 className="editorial-h text-xl font-bold text-forest-950">How can you make a privacy or access request?</h2>
          <p className="mt-3 text-base leading-7 text-forest-900/75">
            Use this page for privacy requests, accessibility feedback, user content concerns, and
            account-independent support. We route legal or data requests to the right reviewer.
          </p>
        </div>
      </section>
    </article>
  );
}
