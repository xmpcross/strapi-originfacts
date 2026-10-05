import { NextResponse } from 'next/server';
import { searchPlaces } from '@/lib/weather-places';

/**
 * City search for the sidebar weather widget, from the site's own OurAirports
 * snapshot (lib/weather-places.ts). No third-party geocoder.
 *
 * GET /api/weather/places?q=per  →  { results: [{ name, country, iata, lat, lon }] }
 */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').slice(0, 60);
  return NextResponse.json(
    { results: searchPlaces(q) },
    { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } },
  );
}
