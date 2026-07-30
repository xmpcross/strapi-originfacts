import type { Metadata } from 'next';
import { listAirports } from '@/lib/strapi';
import { HUB_AIRPORT_SET } from '@/lib/hub-airports';
import HubAirportsDirectory from '@/components/HubAirportsDirectory';
import ExpandableDescription from '@/components/ExpandableDescription';

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
    <div className="mx-auto max-w-7xl px-6 py-16" data-testid="airport-hubs-page">
      <header>
        <h1 className="editorial-h text-3xl font-bold text-forest-900">
          Top {HUB_AIRPORT_SET.size} international airport hubs
        </h1>
        <ExpandableDescription
          text={`The international hub airports listed here are the connection points the rest of the network bends around — ${HUB_AIRPORT_SET.size} airports across ${countContinents(hubs)} continents and ${countCountries(hubs)} countries, chosen for the volume of long-haul traffic they actually move rather than how flashy their terminals look. For each hub we surface the city it serves, country and continent, the carriers that base operations there, and the runway and terminal context that helps you predict transfer time before you commit to a tight layover. Use the filters to browse by continent or search by name, IATA, or city; click any hub for a deeper profile, including direct routes and the airlines flying them. Most travellers only know a handful of these airports first-hand — this directory is the cheat sheet for the rest, useful whether you're planning a self-connect, evaluating an alliance reroute, or trying to decide which hub gives you a smoother layover en route to somewhere slower.`}
        />
      </header>

      <HubAirportsDirectory airports={hubs} />
    </div>
  );
}

function countContinents(airports: Awaited<ReturnType<typeof listAirports>>): number {
  return new Set(airports.map((a) => a.region).filter(Boolean)).size;
}

function countCountries(airports: Awaited<ReturnType<typeof listAirports>>): number {
  return new Set(airports.map((a) => a.country).filter(Boolean)).size;
}
