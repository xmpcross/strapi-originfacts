import type { Metadata } from 'next';
import { listAirports } from '@/lib/strapi';
import { HUB_AIRPORT_SET } from '@/lib/hub-airports';
import HubAirportsDirectory from '@/components/HubAirportsDirectory';
import CategoryDescription from '@/components/CategoryDescription';
import { SECTIONS } from '@/lib/sections';
import Link from 'next/link';

import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd } from '@/lib/jsonld';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Top international airport hubs',
  description:
    "The world's busiest international airports — 100 hubs across 6 continents, with terminal, runway and airline detail for each.",
};

export default async function HubsPage() {
  const all = await listAirports().catch(() => []);
  const hubs = all.filter((a) => a.iata && HUB_AIRPORT_SET.has(a.iata.toUpperCase()));

  return (
    <main className="mx-auto max-w-7xl px-6 py-16" data-testid="airport-hubs-page">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Airports', url: '/airports' },
          { name: 'Top Hubs', url: '/airports/hubs' },
        ])}
      />
      <header data-testid="airport-hubs-header">
        <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-12">
          <div className="min-w-0">
            <h1 className="font-urbanist text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">
              Top international airport hubs
            </h1>
            <CategoryDescription
              text="A focused directory of the airports that shape long-haul travel: primary gateways, alliance connection points, large domestic-international bridges and regional anchors. Use it to compare hub geography, airport codes, city coverage and the best airport profile to open before planning a connection."
              previewWords={21}
            />
          </div>
          <div
            className="flex h-32 w-32 flex-col items-center justify-center rounded-[0.3rem] bg-[#f1f5f9] text-forest-950"
            data-testid="airport-hubs-count"
          >
            <span className="font-urbanist text-4xl font-bold leading-none">{hubs.length.toLocaleString()}</span>
            <span className="mt-2 font-urbanist text-[11px] font-bold uppercase tracking-widest text-forest-900/70">
              Hubs
            </span>
          </div>
        </div>

        <nav
          className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-forest-900/15 py-4 font-urbanist text-[14px] font-bold uppercase tracking-widest text-forest-950"
          aria-label="Categories"
          data-testid="airport-hubs-subnav"
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

      <HubAirportsDirectory airports={hubs} allAirports={all} />
    </main>
  );
}
