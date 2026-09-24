import type { Metadata } from 'next';
import { listDestinations, mediaUrl } from '@/lib/strapi';
import DestinationsDirectory from '@/components/DestinationsDirectory';
import CategoryDescription from '@/components/CategoryDescription';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';
import { SECTIONS } from '@/lib/sections';
import Link from 'next/link';
import { Suspense } from 'react';

export const revalidate = 60;

const HUB = HUB_INTROS.destinations;
const PATH = HUB_PATHS.destinations;

export const metadata: Metadata = {
  title: 'Destinations',
  description: HUB.description,
  alternates: { canonical: PATH },
  robots: { index: true, follow: true },
};

export default async function DestinationsPage() {
  const destinations = await listDestinations().catch(() => []);
  const cities = destinations.filter((d) => d.type === 'city').length;
  const countries = destinations.filter((d) => d.type === 'country').length;
  const regions = destinations.filter((d) => d.type === 'region').length;

  const compactDestinations = destinations.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    type: d.type,
    countryCode: d.countryCode,
    description: d.description,
    heroImage: d.heroImage ? { url: d.heroImage.url } : null,
  }));

  const collectionJsonLd = collectionPageJsonLd({
    name: HUB.name,
    description: HUB.description,
    url: PATH,
    itemListName: 'Destinations',
    items: destinations.slice(0, 50).map((d) => ({
      name: d.name,
      url: `/destinations/${d.slug}`,
      image: mediaUrl(d.heroImage ?? null),
    })),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-6" data-testid="destinations-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header className="border-b border-forest-900/15 pb-8" data-testid="destinations-header">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div className="min-w-0 max-w-4xl">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-primary-emphasis">
              Originfacts destination index
            </p>
            <h1 className="mt-4 font-urbanist text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">
              Destinations
            </h1>
            <div className="mt-5 max-w-3xl">
              <CategoryDescription text={HUB.intro} />
            </div>
            <p className="mt-5 max-w-3xl text-base leading-7 text-forest-900/70">
              Move from big-picture region research into country and city guides that connect
              airports, airlines, hotel areas, routes, travel stories and practical planning notes.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[0.3rem] border border-forest-900/10 bg-forest-900/10">
            <DestinationStat label="Places" value={destinations.length} />
            <DestinationStat label="Cities" value={cities} />
            <DestinationStat label="Countries" value={countries} />
            <DestinationStat label="Regions" value={regions} />
          </div>
        </div>

        <nav
          className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-forest-900/10 pt-5 font-urbanist text-[13px] font-bold uppercase tracking-widest text-forest-950"
          aria-label="Categories"
          data-testid="destinations-subnav"
        >
          {[
            ...SECTIONS.filter((s) => s.slug !== 'destinations').map((s) => ({
              href: `/category/${s.slug}`,
              slug: s.slug,
              name: s.title,
            })),
            { href: '/destinations', slug: 'destinations', name: 'Destinations' },
            { href: '/airlines', slug: 'airlines', name: 'Airlines' },
            { href: '/airports', slug: 'airports', name: 'Airports' },
          ].map((item) => (
            <Link
              key={item.slug}
              href={item.href}
              className={`transition hover:text-primary-emphasis ${
                item.slug === 'destinations' ? 'text-primary-emphasis' : ''
              }`}
              aria-current={item.slug === 'destinations' ? 'page' : undefined}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </header>

      <section className="mt-10 grid gap-5 lg:grid-cols-3" aria-label="How to use the destination directory">
        {[
          {
            title: 'Start With Place Context',
            text:
              'Move from a continent or country into the cities, airports, airlines, routes, hotels, weather notes and local planning details that shape the real trip.',
          },
          {
            title: 'Compare Guide Types',
            text:
              'Country pages help with visas, airports, airlines and city coverage. City pages focus on where to stay, how to arrive and what to read before booking.',
          },
          {
            title: 'Search By Route Need',
            text:
              'Search by destination name, country code or region when you know where you want to go. Browse grouped sections when you are still deciding.',
          },
        ].map((item) => (
          <article
            key={item.title}
            className="border-l-2 border-primary-emphasis bg-white py-1 pl-5"
          >
            <h2 className="font-urbanist text-xl font-bold leading-tight text-forest-950">
              {item.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-forest-900/70">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="mt-10 bg-gradient-to-br from-[#f8fbff] via-white to-[#fff8e6] px-6 py-8 ring-1 ring-forest-900/10 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-primary-emphasis">
              Planning layer
            </p>
            <h2 className="mt-3 font-urbanist text-3xl font-bold leading-tight text-forest-950">
              What each guide brings together
            </h2>
          </div>
          <div className="grid gap-5 text-base leading-relaxed text-forest-900/70 md:grid-cols-2">
            <p>
              Each destination profile is designed to be more than a postcard summary. It pulls
              together nearby airports, airlines, hotel areas, route context, weather patterns,
              practical entry notes, and related stories where we have coverage.
            </p>
            <p>
              Use the destination index before you open a booking site when you need to decide what
              kind of trip is realistic. A city with several nearby airports may be easier to reach
              than a better-known place with limited routes.
            </p>
          </div>
        </div>
      </section>

      <Suspense>
        <DestinationsDirectory destinations={compactDestinations} />
      </Suspense>
    </div>
  );
}

function DestinationStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#f8fafc] p-5" data-testid={`destinations-stat-${label.toLowerCase()}`}>
      <div className="font-urbanist text-3xl font-bold leading-none text-forest-950">
        {value.toLocaleString()}
      </div>
      <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-forest-900/60">
        {label}
      </div>
    </div>
  );
}
