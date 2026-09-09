import { listAirports, mediaUrl } from '@/lib/strapi';
import AirportDirectory from '@/components/AirportDirectory';
import CategoryDescription from '@/components/CategoryDescription';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';
import { airportPath } from '@/lib/airport-slugs';
import { SECTIONS } from '@/lib/sections';
import Link from 'next/link';
import { Suspense } from 'react';

export const revalidate = 60;

const HUB = HUB_INTROS.airports;
const PATH = HUB_PATHS.airports;

export const metadata = {
  title: 'Airport Directory',
  description: HUB.description,
  alternates: { canonical: PATH },
};

export default async function AirportsPage() {
  const airports = await listAirports().catch(() => []);

  const collectionJsonLd = collectionPageJsonLd({
    name: HUB.name,
    description: HUB.description,
    url: PATH,
    itemListName: 'Airports',
    items: airports.map((a) => ({
      name: a.city ? `${a.name} (${a.iata}) — ${a.city}` : `${a.name} (${a.iata})`,
      url: airportPath(a, airports),
      image: mediaUrl(a.heroImage ?? null),
    })),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-6" data-testid="airports-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header data-testid="airports-header">
        <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-12">
          <div className="min-w-0">
            <h1 className="font-urbanist text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">
              Airports
            </h1>
            <CategoryDescription text={HUB.intro} />
          </div>
          <div
            className="flex h-32 w-32 flex-col items-center justify-center rounded-[0.3rem] bg-[#f1f5f9] text-forest-950"
            data-testid="airports-count"
          >
            <span className="font-urbanist text-4xl font-bold leading-none">{airports.length.toLocaleString()}</span>
            <span className="mt-2 font-urbanist text-[11px] font-bold uppercase tracking-widest text-forest-900/70">
              Airports
            </span>
          </div>
        </div>

        <nav
          className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-forest-900/15 py-4 font-urbanist text-[14px] font-bold uppercase tracking-widest text-forest-950"
          aria-label="Categories"
          data-testid="airports-subnav"
        >
          {[
            ...SECTIONS.filter((s) => s.slug !== 'destinations').map((s) => ({
              href: `/category/${s.slug}`,
              slug: s.slug,
              name: s.title,
            })),
            { href: '/airlines', slug: 'airlines', name: 'Airlines' },
            { href: '/airports', slug: 'airports', name: 'Airports' },
          ].map((item) => (
            <Link
              key={item.slug}
              href={item.href}
              className={`transition hover:text-primary-emphasis ${
                item.slug === 'airports' ? 'text-primary-emphasis' : ''
              }`}
              aria-current={item.slug === 'airports' ? 'page' : undefined}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </header>

      <Suspense>
        <AirportDirectory airports={airports} />
      </Suspense>
    </div>
  );
}
