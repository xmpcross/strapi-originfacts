import 'server-only';
import { DESTINATION_CITIES, POPULAR_DESTINATIONS } from '@/lib/flights-data';
import { listAirports, listDestinations, mediaUrl } from '@/lib/strapi';
import { DEFAULT_CURRENCY, type Currency } from '@/lib/currency';

/**
 * Popular routes from an origin, for "Popular flight searches" on /flight-search.
 *
 * Routes and fares come from Travelpayouts' city-directions feed: for an origin
 * it returns about 30 destinations travellers search and book from there, each
 * with the lowest fare found recently (in the requested currency), airline, dates and stops.
 * Fares are cached by the partner, so they are shown as "from" prices and the
 * link opens the search for the very dates the fare was found for.
 *
 * Names come from the CMS airports table and the curated destination list;
 * photos from the curated list or the CMS city destinations. A route without a
 * photo is still returned (the card draws a tile instead).
 */
export type PopularRoute = {
  iata: string;
  city: string;
  country: string | null;
  imageUrl: string | null;
  price: number;
  currency: Currency;
  transfers: number;
  departISO: string;
  returnISO: string | null;
};

export type PopularRoutes = {
  origin: string;
  originCity: string | null;
  /** /destinations/<slug> for the origin city, when the site has a guide for it. */
  guideSlug: string | null;
  routes: PopularRoute[];
};

type DirectionRow = {
  destination?: string;
  price?: number;
  transfers?: number;
  departure_at?: string;
  return_at?: string;
};

const ROUTES_SHOWN = 6;
const norm = (s: string) => s.toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

export async function getPopularRoutes(origin: string, currency: Currency = DEFAULT_CURRENCY): Promise<PopularRoutes> {
  const empty: PopularRoutes = { origin, originCity: null, guideSlug: null, routes: [] };
  const token = process.env.TRAVELPAYOUTS_API_TOKEN;
  if (!token) return empty;

  let rows: DirectionRow[] = [];
  try {
    const res = await fetch(
      `https://api.travelpayouts.com/v1/city-directions?origin=${encodeURIComponent(origin)}&currency=${currency.toLowerCase()}&token=${token}`,
      { next: { revalidate: 1800 } },
    );
    if (!res.ok) return empty;
    const json = (await res.json()) as { success?: boolean; data?: Record<string, DirectionRow> };
    if (!json.success || !json.data) return empty;
    rows = Object.entries(json.data).map(([iata, row]) => ({ ...row, destination: row.destination ?? iata }));
  } catch {
    return empty;
  }

  const [airports, destinations] = await Promise.all([
    listAirports().catch(() => []),
    listDestinations().catch(() => []),
  ]);

  const airportByIata = new Map<string, { city: string; country: string | null }>();
  for (const a of airports) {
    if (a.iata && a.city && !airportByIata.has(a.iata)) {
      airportByIata.set(a.iata, { city: a.city, country: a.country ?? null });
    }
  }
  const curated = new Map(POPULAR_DESTINATIONS.map((d) => [d.iata, d]));
  const listedCity = new Map(DESTINATION_CITIES.map((d) => [d.iata, d.name.split(',')[0].trim()]));
  const cityGuides = new Map<string, { slug: string; image: string | null }>();
  for (const d of destinations) {
    if (d.type === 'city' && d.slug && d.name) {
      cityGuides.set(norm(d.name), { slug: d.slug, image: mediaUrl(d.heroImage ?? null) });
    }
  }

  const cityOf = (iata: string) =>
    curated.get(iata)?.name ?? listedCity.get(iata) ?? airportByIata.get(iata)?.city?.replace(/\s*\(.*?\)\s*/g, '').trim() ?? null;

  const originCity = cityOf(origin);
  const originKey = originCity ? norm(originCity) : null;

  const seen = new Set<string>();
  const candidates: Array<PopularRoute & { rank: [number, number, number] }> = [];
  for (const row of rows) {
    const iata = (row.destination ?? '').toUpperCase();
    const city = cityOf(iata);
    if (!/^[A-Z]{3}$/.test(iata) || iata === origin || !city || typeof row.price !== 'number' || row.price <= 0) continue;
    if (norm(city) === originKey || seen.has(norm(city))) continue;
    seen.add(norm(city));

    const imageUrl = curated.get(iata)?.imageUrl ?? cityGuides.get(norm(city))?.image ?? null;
    const transfers = typeof row.transfers === 'number' ? row.transfers : 1;
    candidates.push({
      iata,
      city,
      country: curated.get(iata)?.country ?? airportByIata.get(iata)?.country ?? null,
      imageUrl,
      price: Math.round(row.price),
      currency,
      transfers,
      departISO: (row.departure_at ?? '').slice(0, 10),
      returnISO: row.return_at ? row.return_at.slice(0, 10) : null,
      // Photo first, then fewer stops, then price.
      rank: [imageUrl ? 0 : 1, transfers > 1 ? 1 : 0, Math.round(row.price)],
    });
  }
  candidates.sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2]);

  return {
    origin,
    originCity,
    guideSlug: originKey ? cityGuides.get(originKey)?.slug ?? null : null,
    routes: candidates.slice(0, ROUTES_SHOWN).map(({ rank: _rank, ...route }) => route),
  };
}
