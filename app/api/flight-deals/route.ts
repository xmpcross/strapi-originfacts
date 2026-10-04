import { NextResponse } from 'next/server';
import { fetchSerpapiExplore } from '@/lib/explore';

const TP_TOKEN = process.env.TRAVELPAYOUTS_API_TOKEN;
const SERPAPI_KEY = process.env.SERPAPI_API_KEY;
const TP_BASE = 'https://api.travelpayouts.com';

export const revalidate = 1800;

type CheapPriceRow = {
  price: number;
  airline: string;
  flight_number: string;
  departure_at: string;
  return_at?: string;
  expires_at: string;
};

type CheapPriceResponse = {
  success: boolean;
  data: Record<string, Record<string, CheapPriceRow>>;
  error?: string | null;
};

export type FlightDeal = {
  origin: string;
  destination: string;
  destinationName?: string;
  price: number;
  currency: string;
  airline: string;
  departureAt: string;
  returnAt?: string;
  bookingUrl?: string;
  source: 'serpapi' | 'travelpayouts';
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = (url.searchParams.get('origin') || '').toUpperCase();
  const destination = (url.searchParams.get('destination') || '-').toUpperCase();
  const currency = (url.searchParams.get('currency') || 'usd').toLowerCase();
  const provider = (url.searchParams.get('provider') || 'auto').toLowerCase();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 4), 1), 10);

  if (!/^[A-Z]{3}$/.test(origin)) {
    return NextResponse.json({ error: 'origin must be a 3-letter IATA' }, { status: 400 });
  }

  // 1. SerpApi Google Flights Deals integration
  if ((provider === 'serpapi' || provider === 'auto') && SERPAPI_KEY) {
    try {
      const serpResult = await fetchSerpapiExplore({
        originIata: origin,
        limit,
      });
      if (serpResult.ok && serpResult.fares.length > 0) {
        const deals: FlightDeal[] = serpResult.fares.slice(0, limit).map((f) => ({
          origin,
          destination: f.destinationIata || f.destinationName,
          destinationName: f.destinationName,
          price: f.priceMinor,
          currency: f.currency,
          airline: f.airline || 'Google Flights',
          departureAt: f.departureDate || new Date().toISOString(),
          returnAt: f.returnDate,
          bookingUrl: f.bookingUrl,
          source: 'serpapi',
        }));
        return NextResponse.json(
          { deals, currency, provider: 'serpapi' },
          { headers: { 'Cache-Control': 'public, max-age=600, s-maxage=1800' } },
        );
      }
    } catch (err) {
      console.warn('[api/flight-deals] SerpApi fetch failed, trying TravelPayouts', err);
    }
  }

  // 2. TravelPayouts fallback
  if (!TP_TOKEN) {
    return NextResponse.json({ error: 'Neither SERPAPI_API_KEY nor TRAVELPAYOUTS_API_TOKEN is available' }, { status: 500 });
  }

  const tpQs = new URLSearchParams({
    origin,
    destination,
    currency,
    token: TP_TOKEN,
  });

  let json: CheapPriceResponse;
  try {
    const res = await fetch(`${TP_BASE}/v1/prices/cheap?${tpQs.toString()}`, {
      headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip' },
      next: { revalidate: 1800 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Travelpayouts ${res.status}` }, { status: 502 });
    }
    json = (await res.json()) as CheapPriceResponse;
  } catch {
    return NextResponse.json({ error: 'Travelpayouts fetch failed' }, { status: 502 });
  }

  if (!json.success || !json.data) {
    return NextResponse.json({ deals: [], currency, provider: 'travelpayouts' }, {
      headers: { 'Cache-Control': 'public, max-age=600, s-maxage=1800' },
    });
  }

  const deals: FlightDeal[] = [];
  for (const [destIata, byNumber] of Object.entries(json.data)) {
    const rows = Object.values(byNumber);
    if (rows.length === 0) continue;
    const best = rows.reduce((a, b) => (b.price < a.price ? b : a));
    deals.push({
      origin,
      destination: destIata,
      price: best.price,
      currency,
      airline: best.airline,
      departureAt: best.departure_at,
      returnAt: best.return_at,
      source: 'travelpayouts',
    });
  }
  deals.sort((a, b) => a.price - b.price);

  return NextResponse.json(
    { deals: deals.slice(0, limit), currency, provider: 'travelpayouts' },
    { headers: { 'Cache-Control': 'public, max-age=600, s-maxage=1800' } },
  );
}
