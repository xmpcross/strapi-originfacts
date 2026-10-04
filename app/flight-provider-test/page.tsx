import GoogleFlightsProviderTest from '@/components/GoogleFlightsProviderTest';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/SeoBlocks';

export const metadata = {
  title: 'Google Flights Provider Test',
  robots: { index: false, follow: false },
};

export default function FlightProviderTestPage() {
  const breadcrumbs = breadcrumbJsonLd([{ name: 'Google Flights Provider Test', url: '/flight-provider-test' }]);
  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <JsonLd data={breadcrumbs} />
      <header className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-wider text-primary-emphasis">Internal test</p>
        <h1 className="editorial-h mt-2 text-4xl font-bold text-forest-900">Google Flights provider data</h1>
        <p className="mt-3 text-ink/70">Search flight itineraries, choose one result, and inspect which booking sellers Google makes available through SerpApi.</p>
      </header>
      <div className="mt-8"><GoogleFlightsProviderTest /></div>
    </main>
  );
}
