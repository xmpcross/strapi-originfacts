'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatPrice } from '@/lib/currency';
import { countryName, placeFromBrowserTimeZone } from '@/lib/timezone-geo';
import { useCurrency } from './useCurrency';

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

type CityContext = {
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

// v4: results are now anchored by coordinates; v3 entries could hold hotels
// from the wrong country and are no longer read.
const HOTEL_BROWSER_CACHE_PREFIX = 'originfacts:hotels-near-you:v6';
const HOTEL_BROWSER_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function hotelBrowserCacheKey({
  city,
  country,
  scope,
  currency,
  lat,
  lng,
}: {
  city: string;
  country: string;
  scope: HotelScope;
  currency: string;
  lat: number;
  lng: number;
}) {
  return [HOTEL_BROWSER_CACHE_PREFIX, city, country, scope, currency, lat.toFixed(2), lng.toFixed(2)]
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

    // Links come from the API (Takeads tracking URLs, built on the server). The key
    // version above is bumped whenever the link scheme changes, so entries saved
    // under an older scheme are never read.
    return { ...parsed, cached: true };
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
  return formatPrice(value, currency || 'USD');
}

export default function PopularHotelsByCity({
  city,
  country,
  lat,
  lng,
  eyebrow = 'Hotels near you',
  title,
  description,
  searchContextLabel = 'IP-detected city',
}: {
  city?: string;
  country?: string;
  /** City coordinates; the hotel search is anchored here. Without them nothing renders. */
  lat?: number;
  lng?: number;
  eyebrow?: string;
  title?: string;
  description?: string;
  searchContextLabel?: string;
}) {
  const [data, setData] = useState<HotelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<HotelScope>('popular');
  // Bumped when the already-selected tab is clicked, so an empty tab can be retried.
  const [retry, setRetry] = useState(0);
  const [cityContext, setCityContext] = useState<CityContext | null>(null);
  const { currency, ready } = useCurrency();
  // Keyed by "<currency>|<tab>", so switching currency never shows another currency's prices.
  const responsesByScopeRef = useRef<Partial<Record<string, HotelResponse>>>({});
  const inflightRef = useRef<Partial<Record<string, Promise<HotelResponse | null>>>>({});
  const sectionRef = useRef<HTMLElement>(null);
  const hasFixedCity = Boolean(city?.trim());
  const hasCoordinates = typeof lat === 'number' && typeof lng === 'number';

  useEffect(() => {
    if (hasFixedCity) {
      setCityContext({ name: city?.trim() || 'New York', country: country?.trim() || '' });
      return;
    }

    // No fixed city: the browser's time zone (no network, nothing sent to a
    // third party), else New York.
    const place = placeFromBrowserTimeZone();
    setCityContext(
      place
        ? { name: place.city, country: countryName(place.country) || 'United States' }
        : { name: 'New York', country: 'United States' },
    );
  }, [city, country, hasFixedCity]);

  /*
   * Fetch one tab: memory, then localStorage, then the API. A tab already being
   * fetched (by the background preload, a hover or a click) shares that request.
   * Only answers that had hotels are remembered, so a tab that came back empty
   * (DataForSEO error, or the site mid-restart) retries when it is clicked again.
   */
  const fetchScope = useCallback(
    (target: HotelScope): Promise<HotelResponse | null> => {
      if (!cityContext?.name || !hasCoordinates || !ready) return Promise.resolve(null);
      const slot = `${currency}|${target}`;
      const remembered = responsesByScopeRef.current[slot];
      if (remembered?.hotels?.length) return Promise.resolve(remembered);
      const pending = inflightRef.current[slot];
      if (pending) return pending;

      const cityName = cityContext.name || 'New York';
      const countryName = cityContext.country || 'United States';
      const browserCacheKey = hotelBrowserCacheKey({ city: cityName, country: countryName, scope: target, currency, lat: lat!, lng: lng! });
      const stored = readHotelBrowserCache(browserCacheKey);
      if (stored) {
        const value = { city: cityName, country: countryName, ...stored };
        responsesByScopeRef.current[slot] = value;
        return Promise.resolve(value);
      }

      const params = new URLSearchParams({
        city: cityName,
        country: countryName,
        scope: target,
        limit: '6',
        currency,
        lat: String(lat),
        lng: String(lng),
      });
      const request = fetch(`/api/dataforseo-hotels?${params.toString()}`)
        .then((res) => res.json() as Promise<HotelResponse>)
        .then((hotelData) => {
          const value = { city: cityName, country: countryName, ...hotelData };
          if (value.hotels?.length) {
            responsesByScopeRef.current[slot] = value;
            writeHotelBrowserCache(browserCacheKey, value);
          }
          return value;
        })
        .catch((): HotelResponse => ({ city: 'your city', hotels: [] }))
        .finally(() => {
          delete inflightRef.current[slot];
        });
      inflightRef.current[slot] = request;
      return request;
    },
    [cityContext, hasCoordinates, lat, lng, currency, ready],
  );

  // The selected tab.
  useEffect(() => {
    if (!cityContext?.name || !hasCoordinates || !ready) return;
    let active = true;
    const remembered = responsesByScopeRef.current[`${currency}|${scope}`];
    if (remembered?.hotels?.length) {
      setData(remembered);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchScope(scope).then((value) => {
      if (!active) return;
      setData(value ?? { city: 'your city', hotels: [] });
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [cityContext, scope, retry, hasCoordinates, fetchScope, currency, ready]);

  // Preload the other tabs once the section is near the screen, three at a time.
  // A tab that is not stored on the server takes several seconds (a live
  // DataForSEO search), so by the time a visitor clicks CBD or Airport it is
  // usually ready. Visitors who never scroll this far trigger no searches.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !cityContext?.name || !hasCoordinates || typeof IntersectionObserver === 'undefined') return;
    let cancelled = false;
    const preload = () => {
      const queue = HOTEL_SCOPES.map((item) => item.value).filter(
        (value) => !responsesByScopeRef.current[`${currency}|${value}`]?.hotels?.length,
      );
      const worker = async () => {
        while (!cancelled && queue.length) await fetchScope(queue.shift()!);
      };
      void Promise.all([worker(), worker(), worker()]);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          preload();
        }
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [cityContext, hasCoordinates, fetchScope, currency]);

  // No coordinates means the search can't be pinned to this city: show nothing
  // rather than hotels from somewhere else.
  if (!hasCoordinates) return null;

  const hotels = data?.hotels ?? [];
  const cityLabel = data?.city && data.city !== 'your city' ? data.city : 'your area';
  const [featured, ...secondary] = hotels;

  return (
    <section
      ref={sectionRef}
      id="hotels"
      className="mt-20 border-0 p-0 shadow-none scroll-mt-28"
      data-testid="popular-hotels-by-city"
      data-hotels-count={hotels.length}
      aria-labelledby="popular-hotels-by-city-heading"
    >
      <div className="rounded-[0.5rem] bg-gradient-to-br from-forest-50 via-white to-sand-50">
        <header className="border-b border-forest-900/10 pb-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary-emphasis">
                {eyebrow}
              </p>
              <h2
                id="hotels-heading"
                className="mt-3 max-w-3xl text-3xl font-bold leading-[1.05] text-forest-950 sm:text-4xl"
              >
                {title || `Compare hotel areas near ${cityLabel}`}
              </h2>
              <p className="mt-4 max-w-4xl text-sm leading-6 text-forest-900/68 sm:text-base">
                {description ||
                  'Choose the type of stay you want, then scan live Google Hotels data before you commit to a flight. CBD and city-centre searches are useful when location matters more than the lowest nightly rate.'}
              </p>
            </div>
            <div className="rounded-[0.4rem] bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-forest-900/10">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-forest-900/45">
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
                onClick={() => {
                  if (item.value === scope) setRetry((n) => n + 1);
                  setScope(item.value);
                }}
                // Start fetching on intent, before the click lands.
                onMouseEnter={() => void fetchScope(item.value)}
                onFocus={() => void fetchScope(item.value)}
                onTouchStart={() => void fetchScope(item.value)}
                className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition ${
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

/* Google Hotels photos (via DataForSEO) arrive as 287×192 thumbnails: the size is
   the `=s287-w287-h192-…` suffix on the googleusercontent URL. Ask Google for a
   size that fits the card instead; other image hosts are returned unchanged. */
function sizedHotelImage(url: string, width: number, height: number): string {
  if (!/^https:\/\/lh\d\.googleusercontent\.com\//.test(url)) return url;
  const base = url.replace(/=[^/=]*$/, '');
  return `${base}=w${width}-h${height}-k-no`;
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
          src={sizedHotelImage(hotel.image, 1200, 800)}
          alt={hotel.name}
          className="absolute inset-0 h-full w-full object-cover opacity-85 transition duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-forest-100 to-[#dcfce7]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
        <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-forest-950">
          Best match
        </span>
        <h3 className="mt-4 max-w-xl text-3xl font-bold leading-tight !text-[#ffffff]" style={{ color: '#ffffff' }}>
          {hotel.name}
        </h3>
        <HotelMeta hotel={hotel} className="mt-3 text-white/82" />
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <HotelPrice price={price} prominent />
          <span className="rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-forest-950 transition group-hover:bg-primary-emphasis group-hover:text-white">
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
            src={sizedHotelImage(hotel.image, 600, 400)}
            alt={hotel.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="h-full bg-gradient-to-br from-forest-100 to-[#dcfce7]" />
        )}
        <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-forest-950">
          #{rank}
        </span>
      </div>
      <div className="flex min-w-0 flex-col p-4">
        <HotelMeta hotel={hotel} className="text-forest-900/55" />
        <h3 className="mt-2 line-clamp-2 text-base font-bold leading-snug text-forest-950">
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
          <strong className={prominent ? 'text-3xl text-white' : 'text-lg text-forest-950'}>
            {price}
          </strong>
        </>
      ) : (
        'Check rates'
      )}
    </p>
  );
}
