import { NextResponse } from 'next/server';

const SERPAPI_URL = 'https://serpapi.com/search.json';
const SERPAPI_KEY = process.env.SERPAPI_API_KEY;

export const dynamic = 'force-dynamic';

function isIata(value: string) {
  return /^[A-Z]{3}$/.test(value);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export async function GET(request: Request) {
  if (!SERPAPI_KEY) {
    return NextResponse.json({ error: 'SERPAPI_API_KEY is not configured.' }, { status: 500 });
  }

  const input = new URL(request.url).searchParams;
  const bookingToken = input.get('booking_token');
  const currency = (input.get('currency') || 'USD').toUpperCase();
  const params = new URLSearchParams({
    engine: 'google_flights',
    api_key: SERPAPI_KEY,
    currency,
    hl: 'en',
    gl: (input.get('gl') || 'us').toLowerCase(),
  });

  if (bookingToken) {
    params.set('booking_token', bookingToken);
  } else {
    const origin = (input.get('origin') || '').toUpperCase();
    const destination = (input.get('destination') || '').toUpperCase();
    const outboundDate = input.get('outbound_date') || '';
    const returnDate = input.get('return_date') || '';
    const oneWay = input.get('type') === '2';

    if (!isIata(origin) || !isIata(destination)) {
      return NextResponse.json({ error: 'Origin and destination must be 3-letter IATA codes.' }, { status: 400 });
    }
    if (!isIsoDate(outboundDate) || (!oneWay && !isIsoDate(returnDate))) {
      return NextResponse.json({ error: 'Enter valid outbound and return dates.' }, { status: 400 });
    }

    params.set('departure_id', origin);
    params.set('arrival_id', destination);
    params.set('outbound_date', outboundDate);
    params.set('type', oneWay ? '2' : '1');
    if (!oneWay) params.set('return_date', returnDate);
    params.set('adults', String(Math.min(Math.max(Number(input.get('adults')) || 1, 1), 9)));
    if (input.get('nonstop') === 'true') params.set('stops', '1');
    params.set('deep_search', 'true');
  }

  try {
    const response = await fetch(`${SERPAPI_URL}?${params.toString()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok || data.error) {
      return NextResponse.json(
        { error: typeof data.error === 'string' ? data.error : `SerpApi returned ${response.status}.` },
        { status: response.ok ? 502 : response.status },
      );
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ error: 'Unable to reach SerpApi.' }, { status: 502 });
  }
}
