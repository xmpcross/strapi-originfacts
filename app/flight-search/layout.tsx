import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compare Cheap Flights from 100s of Sites',
  description:
    'Compare cheap flights from hundreds of airlines and travel sites, check flexible dates, browse popular routes, and plan hotels near your trip.',
  alternates: { canonical: '/flight-search' },
};

export default function FlightSearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
