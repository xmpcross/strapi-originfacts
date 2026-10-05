import { NextResponse } from 'next/server';
import { getRoute } from '@/lib/strapi';
import { getRouteFares, farePrices } from '@/lib/route-fares';
import { isCurrency, toCurrency } from '@/lib/currency';

/**
 * GET /api/route-fares?slug=bah-to-doh&currency=AUD → { prices } for a route
 * page's fare tables in the visitor's header currency
 * (components/route-v2/FarePrices.tsx), or { prices: null } when Travelpayouts
 * has no recent nonstop fares or cannot be reached.
 *
 * Only slugs with a route record are answered, so the endpoint cannot be used
 * to spend the Travelpayouts quota on arbitrary pairs. Fares are cached per
 * route and currency for 6 hours (lib/route-fares.ts).
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const slug = (params.get('slug') || '').toLowerCase();
  const currencyParam = params.get('currency');
  if (!/^[a-z0-9]{3}-to-[a-z0-9]{3}$/.test(slug) || !isCurrency(currencyParam)) {
    return NextResponse.json({ error: 'slug (xxx-to-yyy) and currency (AUD, USD, GBP or EUR) are required' }, { status: 400 });
  }
  const route = await getRoute(slug).catch(() => null);
  if (!route?.origin?.iata || !route.destination?.iata) {
    return NextResponse.json({ error: 'unknown route' }, { status: 404 });
  }
  const fares = await getRouteFares(route.origin.iata, route.destination.iata, toCurrency(currencyParam));
  return NextResponse.json(
    { prices: fares ? farePrices(fares) : null },
    { headers: { 'Cache-Control': fares ? 'public, max-age=900, s-maxage=3600' : 'public, max-age=120' } },
  );
}
