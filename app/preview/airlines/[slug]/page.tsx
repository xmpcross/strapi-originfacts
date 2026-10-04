import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAirline } from '@/lib/strapi';
import { getRouteFacts } from '@/lib/route-facts';
import { getAirlineFacts } from '@/lib/airline-facts';
import { getFlySfoAirlineProfile } from '@/lib/flysfo-airline';
import { getAirlineReviews } from '@/lib/airline-reviews';
import { getAirlineRef } from '@/lib/airline-refs';
import { SITE_URL, faqJsonLd } from '@/lib/entity-seo';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/SeoBlocks';
import AirlineTier1, { derivedFaqs } from '@/components/airline-tier1/AirlineTier1';

/**
 * Preview harness for the Tier 1 airline template.
 *
 * Separate from /airlines/[slug] on purpose: the live route keeps its current
 * layout until this one is signed off, so the two can be compared side by side
 * on the same data.
 *
 * Always noindex. It renders the same data as the live route with no editorial
 * gate in front of it, and preview URLs have no business in an index.
 */
export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const airline = await getAirline(slug);
  return {
    title: airline ? `${airline.name} — Tier 1 template preview` : 'Preview',
    description: airline
      ? `Check ${airline.name} baggage rules, fare inclusions, check-in information, seating, passenger rights and route-network facts, with links to official sources.`
      : undefined,
    robots: { index: false, follow: false },
    alternates: { canonical: `${SITE_URL}/airlines/${slug}` },
  };
}

export default async function AirlineTier1Preview({ params }: Props) {
  const { slug } = await params;
  const airline = await getAirline(slug);
  if (!airline) notFound();

  const alliance = await getFlySfoAirlineProfile(airline)
    .then((p) => p?.alliance ?? null)
    .catch(() => null);

  const routeFacts = getRouteFacts(airline.iataCode);
  const reviews = getAirlineReviews(airline.slug);
  const airlineRef = getAirlineRef(airline.iataCode);

  const facts = getAirlineFacts(airline.slug);

  const url = `${SITE_URL}/airlines/${airline.slug}`;
  const faqs = derivedFaqs(airline, routeFacts, alliance, true);

  const airlineLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Airline',
    '@id': `${url}#airline`,
    name: airline.name,
    url,
  };
  if (airline.iataCode) airlineLd.iataCode = airline.iataCode;
  if (airline.legalName) airlineLd.legalName = airline.legalName;
  if (airline.country) airlineLd.address = { '@type': 'PostalAddress', addressCountry: airline.country };
  if (airline.founded) airlineLd.foundingDate = String(airline.founded);
  if (alliance) airlineLd.memberOf = { '@type': 'Organization', name: alliance };
  if (airline.website) {
    airlineLd.sameAs = airline.website.startsWith('http') ? airline.website : `https://${airline.website}`;
  }

  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Airline Fares', url: '/preview/airlines' },
    { name: airline.name, url: `/preview/airlines/${slug}` },
  ]);

  return (
    <>
      {/* Schema is emitted on the preview so the markup can be validated, but
          the page stays noindex — nothing here is eligible for a rich result. */}
      <JsonLd data={airlineLd} />
      {faqs.length > 0 && <JsonLd data={faqJsonLd(faqs)} />}
      <JsonLd data={breadcrumbs} />
      <AirlineTier1
        airline={airline}
        routeFacts={routeFacts}
        facts={facts}
        alliance={alliance}
        reviews={reviews}
        airlineRef={airlineRef}
        previewRedesign
      />
    </>
  );
}
