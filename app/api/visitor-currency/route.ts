import { NextResponse } from 'next/server';
import { currencyForCountry } from '@/lib/currency';

export const dynamic = 'force-dynamic';

// Country names as Travelpayouts /whereami returns them, for the fallback below.
const NAME_TO_CODE: Record<string, string> = {
  australia: 'AU', 'united kingdom': 'GB', ireland: 'IE', france: 'FR', germany: 'DE', italy: 'IT', spain: 'ES',
  netherlands: 'NL', belgium: 'BE', austria: 'AT', portugal: 'PT', finland: 'FI', greece: 'GR', luxembourg: 'LU',
  malta: 'MT', cyprus: 'CY', slovakia: 'SK', slovenia: 'SI', estonia: 'EE', latvia: 'LV', lithuania: 'LT', croatia: 'HR',
};

/**
 * GET /api/visitor-currency → { country, currency }: the default display currency
 * for this visitor. Uses Cloudflare's CF-IPCountry header; without it, asks
 * Travelpayouts /whereami (as /api/nearest-city does) with the visitor's IP.
 */
export async function GET(request: Request) {
  const h = request.headers;
  let country = (h.get('cf-ipcountry') || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(country) || country === 'XX' || country === 'T1') {
    country = '';
    const ip = h.get('cf-connecting-ip') || (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || '';
    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      try {
        const res = await fetch(`https://www.travelpayouts.com/whereami?locale=en&ip=${encodeURIComponent(ip)}`, { cache: 'no-store' });
        const d = (await res.json()) as { country_name?: string };
        country = NAME_TO_CODE[(d.country_name || '').toLowerCase()] || '';
      } catch {
        /* fall back to the default */
      }
    }
  }
  return NextResponse.json(
    { country: country || null, currency: currencyForCountry(country) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
