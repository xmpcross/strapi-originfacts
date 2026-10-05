import { NextResponse } from 'next/server';
import { currencyForCountry } from '@/lib/currency';

export const dynamic = 'force-dynamic';

/**
 * GET /api/visitor-currency → { country, currency }: the default display
 * currency from Cloudflare's CF-IPCountry header, which Cloudflare adds to the
 * request on its way here (originfacts.com is proxied through Cloudflare).
 * Nothing is looked up and no request leaves this server. Without the header
 * (direct hits, local runs) it answers { country: null, currency: null } and
 * the browser works the currency out from its time zone / language instead
 * (components/useCurrency.ts).
 */
export async function GET(request: Request) {
  const country = (request.headers.get('cf-ipcountry') || '').toUpperCase();
  const known = /^[A-Z]{2}$/.test(country) && country !== 'XX' && country !== 'T1';
  return NextResponse.json(
    known ? { country, currency: currencyForCountry(country) } : { country: null, currency: null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
