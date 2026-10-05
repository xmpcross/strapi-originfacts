import { NextResponse } from 'next/server';
import { getMetForecast, parseLatLonParams, secondsUntilExpiry, summariseForecast } from '@/lib/met-weather';

/**
 * Current weather for the sidebar widget, from MET Norway via the server
 * (lib/met-weather.ts): browsers cannot send the User-Agent MET requires, and
 * the visitor's IP and headers are never passed on. Coordinates are rounded to
 * 2 decimals so nearby visitors share one cached upstream response.
 *
 * GET /api/weather?lat=..&lon=..  →  { tempC, symbolCode, time, attribution }
 */
export async function GET(req: Request) {
  const point = parseLatLonParams(new URL(req.url).searchParams);
  if (!point) return NextResponse.json({ error: 'lat and lon must be decimal degrees' }, { status: 400 });

  const raw = await getMetForecast(point.lat, point.lon);
  const summary = raw ? summariseForecast(raw) : null;
  if (!summary?.current || typeof summary.current.airTemperature !== 'number') {
    return NextResponse.json({ error: 'weather unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  const maxAge = Math.min(Math.max(secondsUntilExpiry(point.lat, point.lon), 60), 1800);
  return NextResponse.json(
    {
      lat: point.lat,
      lon: point.lon,
      tempC: summary.current.airTemperature,
      symbolCode: summary.current.symbolCode ?? null,
      time: summary.current.time ?? null,
      attribution: 'Weather data from MET Norway (api.met.no), CC BY 4.0',
    },
    { headers: { 'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}` } },
  );
}
