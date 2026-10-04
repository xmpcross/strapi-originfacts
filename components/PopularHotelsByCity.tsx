'use client';

import { useEffect, useRef, useState } from 'react';

type HotelScope = (typeof HOTEL_SCOPES)[number]['value'];

type Hotel = {
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

type HotelResponse = {
  city?: string;
  country?: string;
  scope?: HotelScope;
  scopeLabel?: string;
  checkIn?: string;
  checkOut?: string;
  hotels?: Hotel[];
  error?: string;
  cached?: boolean;
  cachedAt?: string;
};

type GeoResponse = {
  name?: string;
  country?: string;
};

const HOTEL_SCOPES = [
  { value: 'popular', label: 'Popular' },
  { value: 'cbd', label: 'CBD' },
  { value: 'center', label: 'City centre' },
  { value: 'airport', label: 'Airport' },
  { value: 'resort', label: 'Resort' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'budget', label: 'Budget' },
  { value: 'family', label: 'Family' },
] as const;

const BOOKING_AFFILIATE_URL = 'https://tatrck.com/h/0Hu30_OZ0V7N?model=cpc';
const HOTEL_BROWSER_CACHE_PREFIX = 'originfacts:hotels-near-you:v3';
const HOTEL_BROWSER_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function hotelBrowserCacheKey({
  city,
  country,
  scope,
}: {
  city: string;
  country: string;
  scope: HotelScope;
}) {
  return [HOTEL_BROWSER_CACHE_PREFIX, city, country, scope]
    .map((part) => part.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .join(':');
}

function readHotelBrowserCache(key: string): HotelResponse | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as HotelResponse & { storedAt?: string };
    const storedAt = parsed.storedAt ? Date.parse(parsed.storedAt) : 0;
    if (!Number.isFinite(storedAt) || Date.now() - storedAt > HOTEL_BROWSER_CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    if (!parsed.hotels || parsed.hotels.length === 0) {
      window.localStorage.removeItem(key);
      return null;
    }

    return {
      ...parsed,
      cached: true,
      hotels: parsed.hotels?.map((hotel) => ({ ...hotel, href: BOOKING_AFFILIATE_URL })),
    };
  } catch {
    return null;
  }
}

function writeHotelBrowserCache(key: string, data: HotelResponse) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify({ ...data, storedAt: new Date().toISOString() }));
  } catch {
    // Ignore storage quota/private-mode failures; the server cache still works.
  }
}

function formatMoney(value: number | null, currency: string | null) {
  if (value == null || value <= 0) return null;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || 'USD'} ${Math.round(value)}`;
  }
}

export default function PopularHotelsByCity({
  city,
  country,
  eyebrow = 'Hotels near you',
  title,
  description,
  searchContextLabel = 'IP-detected city',
}: {
  city?: string;
  country?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  searchContextLabel?: string;
}) {
  const [data, setData] = useState<HotelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<HotelScope>('popular');
  const [cityContext, setCityContext] = useState<GeoResponse | null>(null);
  const responsesByScopeRef = useRef<Partial<Record<HotelScope, HotelResponse>>>({});
  const hasFixedCity = Boolean(city?.trim());

  useEffect(() => {
    if (hasFixedCity) {
      setCityContext({ name: city?.trim() || 'New York', country: country?.trim() || '' });
      return;
    }

    let active = true;

    async function loadCity() {
      try {
        const geoRes = await fetch('/api/nearest-city', { cache: 'no-store' });
        const geo = (await geoRes.json()) as GeoResponse;
        if (active) setCityContext({ name: geo.name || 'New York', country: geo.country || 'United States' });
      } catch {
        if (active) setCityContext({ name: 'New York', country: 'United States' });
      }
    }

    loadCity();
    return () => {
      active = false;
    };
  }, [city, country, hasFixedCity]);

  useEffect(() => {
    if (!cityContext?.name) return;

    let active = true;
    const resolvedCityContext = cityContext;

    async function load() {
      const cachedResponse = responsesByScopeRef.current[scope];
      if (cachedResponse) {
        setData(cachedResponse);
        setLoading(false);
        return;
      }

      const city = resolvedCityContext.name || 'New York';
      const country = resolvedCityContext.country || 'United States';
      const browserCacheKey = hotelBrowserCacheKey({ city, country, scope });
      const browserCachedResponse = readHotelBrowserCache(browserCacheKey);
      if (browserCachedResponse) {
        responsesByScopeRef.current = { ...responsesByScopeRef.current, [scope]: browserCachedResponse };
        setData({ city, country, ...browserCachedResponse });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({ city, country, scope, limit: '6', currency: 'USD' });
        const hotelRes = await fetch(`/api/dataforseo-hotels?${params.toString()}`);
        const hotelData = (await hotelRes.json()) as HotelResponse;
        if (active) {
          const nextData = { city, country, ...hotelData };
          setData(nextData);
          responsesByScopeRef.current = { ...responsesByScopeRef.current, [scope]: nextData };
          writeHotelBrowserCache(browserCacheKey, nextData);
        }
      } catch {
        if (active) setData({ city: 'your city', hotels: [] });
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [cityContext, scope]);

  const hotels = data?.hotels ?? [];
  const cityLabel = data?.city && data.city !== 'your city' ? data.city : 'your area';
  const [featured, ...secondary] = hotels;

  return (
    <section
      id="hotels"
      className="mt-20 border-0 p-0 shadow-none scroll-mt-28"
      data-testid="popular-hotels-by-city"
      data-hotels-count={hotels.length}
      aria-labelledby="popular-hotels-by-city-heading"
    >
      <div className="rounded-[0.5rem] bg-gradient-to-br from-[#f8fbff] via-white to-[#eef7f2]">
        <header className="border-b border-forest-900/10 pb-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
            <div>
              <p className="font-urbanist text-[11px] font-bold uppercase tracking-[0.22em] text-primary-emphasis">
                {eyebrow}
              </p>
              <h2
                id="hotels-heading"
                className="mt-3 max-w-3xl font-urbanist text-3xl font-bold leading-[1.05] text-forest-950 sm:text-4xl"
              >
                {title || `Compare hotel areas near ${cityLabel}`}
              </h2>
              <p className="mt-4 max-w-4xl text-sm leading-6 text-forest-900/68 sm:text-base">
                {description ||
                  'Choose the type of stay you want, then scan live Google Hotels data before you commit to a flight. CBD and city-centre searches are useful when location matters more than the lowest nightly rate.'}
              </p>
            </div>
            <div className="rounded-[0.4rem] bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-forest-900/10">
              <span className="block font-urbanist text-[10px] font-bold uppercase tracking-[0.18em] text-forest-900/45">
                Search context
              </span>
              <span className="mt-1 block font-semibold text-forest-950">{searchContextLabel}</span>
              {data?.checkIn && data.checkOut && (
                <span className="mt-2 block text-xs font-medium text-forest-900/55">
                  Sample dates: {data.checkIn} to {data.checkOut}
                </span>
              )}
            </div>
          </div>
          <div className="mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="Choose hotel search type">
            {HOTEL_SCOPES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setScope(item.value)}
                className={`shrink-0 rounded-full px-4 py-2 font-urbanist text-[11px] font-bold uppercase tracking-wider transition ${
                  scope === item.value
                    ? 'bg-forest-950 text-white shadow-sm'
                    : 'bg-white text-forest-900/65 ring-1 ring-forest-900/10 hover:text-primary-emphasis'
                }`}
                aria-pressed={scope === item.value}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <div className="pt-6">
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div className="h-[360px] animate-pulse rounded-[0.4rem] bg-white shadow-sm ring-1 ring-forest-900/10" />
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-[172px] animate-pulse rounded-[0.4rem] bg-white shadow-sm ring-1 ring-forest-900/10" />
                ))}
              </div>
            </div>
          ) : featured ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <HotelFeatureCard hotel={featured} />
              <div className="grid gap-4 sm:grid-cols-2">
                {secondary.slice(0, 4).map((hotel, index) => (
                  <HotelCompactCard key={hotel.id} hotel={hotel} rank={index + 2} />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-[0.35rem] bg-white px-5 py-5 text-sm leading-6 text-forest-900/65 ring-1 ring-forest-900/10">
              No hotel rows returned for {cityLabel}. Try another stay type above, or compare hotel prices after choosing your flight destination.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function HotelFeatureCard({ hotel }: { hotel: Hotel }) {
  const price = formatMoney(hotel.price, hotel.currency);

  return (
    <a
      href={hotel.href}
      target="_blank"
      rel="sponsored nofollow noopener noreferrer"
      className="group relative min-h-[360px] overflow-hidden rounded-[0.45rem] bg-forest-950 shadow-sm ring-1 ring-forest-900/10"
      aria-label={`Search ${hotel.name} on Booking.com`}
    >
      {hotel.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hotel.image}
          alt={hotel.name}
          className="absolute inset-0 h-full w-full object-cover opacity-85 transition duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#dbeafe] to-[#dcfce7]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
        <span className="rounded-full bg-white/95 px-3 py-1 font-urbanist text-[11px] font-bold uppercase tracking-wider text-forest-950">
          Best match
        </span>
        <h3 className="mt-4 max-w-xl font-urbanist text-3xl font-bold leading-tight !text-[#ffffff]" style={{ color: '#ffffff' }}>
          {hotel.name}
        </h3>
        <HotelMeta hotel={hotel} className="mt-3 text-white/82" />
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <HotelPrice price={price} prominent />
          <span className="rounded-full bg-white px-4 py-2 font-urbanist text-xs font-bold uppercase tracking-wider text-forest-950 transition group-hover:bg-primary-emphasis group-hover:text-white">
            View on Booking.com
          </span>
        </div>
      </div>
    </a>
  );
}

function HotelCompactCard({ hotel, rank }: { hotel: Hotel; rank: number }) {
  const price = formatMoney(hotel.price, hotel.currency);

  return (
    <a
      href={hotel.href}
      target="_blank"
      rel="sponsored nofollow noopener noreferrer"
      className="group grid min-h-[172px] grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-[0.4rem] bg-white shadow-sm ring-1 ring-forest-900/10 transition hover:-translate-y-0.5 hover:shadow-md"
      aria-label={`Search ${hotel.name} on Booking.com`}
    >
      <div className="relative bg-forest-900/5">
        {hotel.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hotel.image}
            alt={hotel.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="h-full bg-gradient-to-br from-[#dbeafe] to-[#dcfce7]" />
        )}
        <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 font-urbanist text-[10px] font-bold text-forest-950">
          #{rank}
        </span>
      </div>
      <div className="flex min-w-0 flex-col p-4">
        <HotelMeta hotel={hotel} className="text-forest-900/55" />
        <h3 className="mt-2 line-clamp-2 font-urbanist text-base font-bold leading-snug text-forest-950">
          {hotel.name}
        </h3>
        {hotel.reviews ? (
          <p className="mt-1 text-xs text-forest-900/45">{hotel.reviews.toLocaleString()} reviews</p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <HotelPrice price={price} />
          <span className="rounded-full bg-primary-emphasis/10 px-2.5 py-1 text-[11px] font-bold text-primary-emphasis transition group-hover:bg-primary-emphasis group-hover:text-white">
            View
          </span>
        </div>
      </div>
    </a>
  );
}

function HotelMeta({ hotel, className }: { hotel: Hotel; className: string }) {
  const items = [
    hotel.stars ? `${hotel.stars}-star` : null,
    hotel.rating ? `${hotel.rating.toFixed(1)} rated` : null,
  ].filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 text-[11px] font-semibold ${className}`}>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

function HotelPrice({ price, prominent = false }: { price: string | null; prominent?: boolean }) {
  return (
    <p className={prominent ? 'text-sm text-white/75' : 'text-xs leading-tight text-forest-900/55'}>
      {price ? (
        <>
          <span className="block">Sample rate from</span>
          <strong className={prominent ? 'font-urbanist text-3xl text-white' : 'font-urbanist text-lg text-forest-950'}>
            {price}
          </strong>
        </>
      ) : (
        'Check rates'
      )}
    </p>
  );
}
