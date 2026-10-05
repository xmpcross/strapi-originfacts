import { NextResponse } from 'next/server';
import { getPopularRoutes } from '@/lib/popular-routes';
import { toCurrency } from '@/lib/currency';

/** GET /api/popular-routes?origin=PER — popular routes and recent fares from one origin. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const origin = (params.get('origin') || '').toUpperCase();
  const currency = toCurrency(params.get('currency'));
  if (!/^[A-Z]{3}$/.test(origin)) {
    return NextResponse.json({ error: 'origin must be a 3-letter IATA code' }, { status: 400 });
  }
  const data = await getPopularRoutes(origin, currency);
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, max-age=600, s-maxage=1800' },
  });
}
