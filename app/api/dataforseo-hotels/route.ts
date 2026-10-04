import { NextResponse } from 'next/server';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATAFORSEO_URL = 'https://api.dataforseo.com/v3/business_data/google/hotel_searches/live';
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;
const BOOKING_AFFILIATE_URL = 'https://tatrck.com/h/0Hu30_OZ0V7N?model=cpc';
const HOTEL_CACHE_FILE = path.join(process.cwd(), 'data', 'hotel-search-cache.json');
const HOTEL_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type DataForSeoHotelItem = {
  type?: string;
  hotel_identifier?: string;
  title?: string;
  stars?: number | null;
  overview_images?: string[] | null;
  reviews?: {
    value?: number | null;
    votes_count?: number | null;
  } | null;
  prices?: {
    price?: number | null;
    currency?: string | null;
    discount_text?: string | null;
  } | null;
};

type DataForSeoResponse = {
  tasks?: Array<{
    result?: Array<{
      items?: DataForSeoHotelItem[] | null;
    }> | null;
  }>;
};

type DataForSeoHotelSearchItem = DataForSeoHotelItem & {
  title: string;
};

type HotelResult = {
  id: string;
  name: string;
  stars: number | null;
  image: string | null;
  rating: number | null;
  reviews: number | null;
  price: number | null;
  currency: string | null;
  discount: string | null;
  href: string;
};

type HotelApiPayload = {
  city: string;
  country: string;
  scope: HotelScope;
  scopeLabel: string;
  checkIn: string;
  checkOut: string;
  hotels: HotelResult[];
  cached?: boolean;
  cachedAt?: string;
};

type HotelCache = Record<string, HotelApiPayload & { cachedAt: string }>;

function withAffiliateHotelLinks<T extends HotelApiPayload>(payload: T): T {
  return {
    ...payload,
    hotels: payload.hotels.map((hotel) => ({
      ...hotel,
      href: BOOKING_AFFILIATE_URL,
    })),
  };
}

function addDays(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function safeCity(value: string | null) {
  const city = (value || '').trim().replace(/\s+/g, ' ');
  if (!city || city.length > 80 || /[<>{}[\]\\]/.test(city)) return '';
  return city;
}

function countryNameFromCode(value: string) {
  if (!/^[A-Za-z]{2}$/.test(value)) return value;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(value.toUpperCase()) || value;
  } catch {
    return value;
  }
}

const HOTEL_SCOPES = {
  popular: { label: 'Popular hotels', suffix: 'hotels' },
  cbd: { label: 'CBD hotels', suffix: 'CBD hotels' },
  center: { label: 'City centre hotels', suffix: 'city centre hotels' },
  airport: { label: 'Airport hotels', suffix: 'airport hotels' },
  resort: { label: 'Resort hotels', suffix: 'resort hotels' },
  luxury: { label: 'Luxury hotels', suffix: 'luxury hotels' },
  budget: { label: 'Budget hotels', suffix: 'budget hotels' },
  family: { label: 'Family hotels', suffix: 'family friendly hotels' },
} satisfies Record<string, { label: string; suffix: string }>;

type HotelScope = keyof typeof HOTEL_SCOPES;

function resolveScope(value: string | null): HotelScope {
  return value && value in HOTEL_SCOPES ? (value as HotelScope) : 'popular';
}

function isHotelSearchItem(item: DataForSeoHotelItem): item is DataForSeoHotelSearchItem {
  return item.type === 'hotel_search_item' && typeof item.title === 'string' && item.title.trim().length > 0;
}

function cacheKey({
  city,
  country,
  scope,
  currency,
  limit,
}: {
  city: string;
  country: string;
  scope: HotelScope;
  currency: string;
  limit: number;
}) {
  return [city, country, scope, currency, limit]
    .map((part) => String(part).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .join('__');
}

async function readHotelCache(): Promise<HotelCache> {
  try {
    return JSON.parse(await readFile(HOTEL_CACHE_FILE, 'utf8')) as HotelCache;
  } catch {
    return {};
  }
}

async function writeHotelCache(cache: HotelCache) {
  await mkdir(path.dirname(HOTEL_CACHE_FILE), { recursive: true });
  const tmp = `${HOTEL_CACHE_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(cache, null, 2)}\n`);
  await rename(tmp, HOTEL_CACHE_FILE);
}

async function saveHotelCacheEntry(key: string, payload: HotelApiPayload & { cachedAt: string }) {
  const latestCache = await readHotelCache();
  latestCache[key] = payload;
  await writeHotelCache(latestCache);
}

export async function GET(request: Request) {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    return NextResponse.json(
      { hotels: [], error: 'DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are not configured.' },
      { status: 200, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }

  const input = new URL(request.url).searchParams;
  const city = safeCity(input.get('city'));
  if (!city) {
    return NextResponse.json({ hotels: [], error: 'city is required.' }, { status: 400 });
  }

  const country = countryNameFromCode(safeCity(input.get('country')));
  const locationName = country || city;
  const scope = resolveScope(input.get('scope'));
  const scopeConfig = HOTEL_SCOPES[scope];
  const limit = Math.min(Math.max(Number(input.get('limit') || 6), 1), 6);
  const currency = (input.get('currency') || 'USD').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'USD';
  const checkIn = addDays(21);
  const checkOut = addDays(22);
  const key = cacheKey({ city, country, scope, currency, limit });
  const forceRefresh = input.get('refresh') === '1';
  const cache = await readHotelCache();
  const cached = cache[key];

  if (!forceRefresh && cached && cached.hotels.length > 0) {
    const age = Date.now() - Date.parse(cached.cachedAt);
    if (Number.isFinite(age) && age < HOTEL_CACHE_TTL_MS) {
      const normalizedCached = withAffiliateHotelLinks(cached);
      return NextResponse.json(
        { ...normalizedCached, cached: true },
        { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } },
      );
    }
  }

  const credentials = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

  try {
    const response = await fetch(DATAFORSEO_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify([
        {
          keyword: `${city} ${scopeConfig.suffix}`,
          location_name: locationName,
          language_code: 'en',
          depth: limit,
          check_in: checkIn,
          check_out: checkOut,
          currency,
          adults: 2,
          sort_by: 'highest_rating',
          min_rating: 4,
          is_vacation_rentals: false,
        },
      ]),
    });

    const data = (await response.json()) as DataForSeoResponse & { status_message?: string };
    if (!response.ok) {
      return NextResponse.json(
        { hotels: [], error: data.status_message || `DataForSEO returned ${response.status}.` },
        { status: 502 },
      );
    }

    const items = data.tasks?.flatMap((task) => task.result?.flatMap((result) => result.items ?? []) ?? []) ?? [];
    const hotels: HotelResult[] = items
      .filter(isHotelSearchItem)
      .slice(0, limit)
      .map((item) => ({
        id: item.hotel_identifier || item.title,
        name: item.title,
        stars: item.stars ?? null,
        image: item.overview_images?.[0] ?? null,
        rating: item.reviews?.value ?? null,
        reviews: item.reviews?.votes_count ?? null,
        price: item.prices?.price ?? null,
        currency: item.prices?.currency ?? currency,
        discount: item.prices?.discount_text ?? null,
        href: BOOKING_AFFILIATE_URL,
      }));

    const payload: HotelApiPayload & { cachedAt: string } = {
      city,
      country,
      scope,
      scopeLabel: scopeConfig.label,
      checkIn,
      checkOut,
      hotels,
      cached: false,
      cachedAt: new Date().toISOString(),
    };
    if (hotels.length > 0) {
      await saveHotelCacheEntry(key, payload);
    }

    return NextResponse.json(
      payload,
      { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } },
    );
  } catch {
    if (cached) {
      const normalizedCached = withAffiliateHotelLinks(cached);
      return NextResponse.json(
        { ...normalizedCached, cached: true, stale: true },
        { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } },
      );
    }
    return NextResponse.json({ hotels: [], error: 'Unable to reach DataForSEO.' }, { status: 502 });
  }
}
