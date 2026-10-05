'use client';

import { useEffect, useState } from 'react';
import { placeFromBrowserTimeZone, type TimeZonePlace } from '@/lib/timezone-geo';

type Weather = {
  city: string;
  tempC: number;
  code: number;
  fetchedAt: number;
};

type GeocodeHit = {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
};

const WEATHER_CACHE_KEY = 'originfacts.weather.v1';
const UNIT_KEY = 'originfacts.weather.unit.v1';
const CACHE_TTL_MS = 30 * 60 * 1000;
/** Used when the browser's time zone is not one we map. */
const DEFAULT_PLACE: TimeZonePlace = { iata: 'LON', city: 'London', lat: 51.507, lon: -0.128 };

function describe(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Clear', icon: '☀️' };
  if (code <= 3) return { label: 'Partly cloudy', icon: '⛅' };
  if (code <= 48) return { label: 'Foggy', icon: '🌫️' };
  if (code <= 57) return { label: 'Drizzle', icon: '🌦️' };
  if (code <= 67) return { label: 'Rain', icon: '🌧️' };
  if (code <= 77) return { label: 'Snow', icon: '🌨️' };
  if (code <= 82) return { label: 'Rain showers', icon: '🌧️' };
  if (code <= 86) return { label: 'Snow showers', icon: '🌨️' };
  if (code <= 99) return { label: 'Thunderstorm', icon: '⛈️' };
  return { label: 'Weather', icon: '🌍' };
}

function readCache(): Weather | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Weather;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(w: Weather) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(w));
  } catch {
    /* storage off */
  }
}

function readUnit(): 'C' | 'F' {
  if (typeof window === 'undefined') return 'C';
  try {
    const u = window.localStorage.getItem(UNIT_KEY);
    return u === 'F' ? 'F' : 'C';
  } catch {
    return 'C';
  }
}

function writeUnit(u: 'C' | 'F') {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UNIT_KEY, u);
  } catch {
    /* storage off */
  }
}

/** Fetch current weather for the given coords + label and cache. */
async function fetchWeather(lat: number, lon: number, city: string): Promise<Weather | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    if (typeof json.current?.temperature_2m !== 'number') return null;
    const next: Weather = {
      city: city || 'Your area',
      tempC: Math.round(json.current.temperature_2m),
      code: json.current.weather_code ?? 0,
      fetchedAt: Date.now(),
    };
    writeCache(next);
    return next;
  } catch {
    return null;
  }
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeocodeHit[]>([]);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  // Initial load: cached weather, else the city for the browser's time zone
  useEffect(() => {
    setUnit(readUnit());
    let cancelled = false;
    const cached = readCache();
    if (cached) {
      setWeather(cached);
      setLoading(false);
      return;
    }
    (async () => {
      // Default city from the browser's time zone: no IP lookup, no request to
      // a geolocation service. "Use my location" (below) is the opt-in for a
      // precise position.
      const place = placeFromBrowserTimeZone() ?? DEFAULT_PLACE;
      try {
        const w = await fetchWeather(place.lat, place.lon, place.city);
        if (!cancelled && w) setWeather(w);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced city search via Open-Meteo's geocoding API
  useEffect(() => {
    if (!searchOpen) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=5&language=en&format=json`,
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const json = (await res.json()) as { results?: GeocodeHit[] };
        setResults(Array.isArray(json.results) ? json.results : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [query, searchOpen]);

  const onPick = async (hit: GeocodeHit) => {
    setSearchOpen(false);
    setQuery('');
    setResults([]);
    setLoading(true);
    const w = await fetchWeather(hit.latitude, hit.longitude, hit.name);
    if (w) setWeather(w);
    setLoading(false);
  };

  const locateMe = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocateError('Location is not available in this browser.');
      return;
    }
    setLocateError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const w = await fetchWeather(pos.coords.latitude, pos.coords.longitude, 'Your location');
        if (w) setWeather(w);
        setLocating(false);
      },
      () => {
        setLocateError('Could not get your location.');
        setLocating(false);
      },
      { maximumAge: 10 * 60 * 1000, timeout: 10000 },
    );
  };

  const toggleUnit = () => {
    const next = unit === 'C' ? 'F' : 'C';
    setUnit(next);
    writeUnit(next);
  };

  if (loading && !weather) {
    return (
      <div
        className="rounded-[0.3rem] border border-forest-900/10 bg-white px-4 py-3"
        data-testid="weather-widget-loading"
        aria-hidden
      >
        <div className="h-3 w-24 animate-pulse rounded bg-forest-900/10" />
        <div className="mt-2 h-5 w-12 animate-pulse rounded bg-forest-900/10" />
      </div>
    );
  }

  if (!weather) return null;

  const { label, icon } = describe(weather.code);
  const displayTemp =
    unit === 'C' ? weather.tempC : Math.round(weather.tempC * (9 / 5) + 32);

  return (
    <div
      className="rounded-[0.3rem] border border-forest-900/10 bg-white p-4 shadow-sm"
      data-testid="weather-widget"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-forest-900/55">
            {label}
          </p>
          <p className="mt-0.5 truncate text-sm font-bold text-forest-950">
            {weather.city}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-2xl leading-none">{icon}</span>
          <span className="text-xl font-bold leading-none text-forest-950">
            {displayTemp}°
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-forest-900/10 pt-3">
        {/* C / F toggle */}
        <div className="inline-flex rounded-full border border-forest-900/10 p-0.5 text-[11px] font-bold uppercase tracking-widest">
          <button
            type="button"
            onClick={() => unit === 'F' && toggleUnit()}
            aria-pressed={unit === 'C'}
            className={`rounded-full px-2.5 py-0.5 transition ${
              unit === 'C' ? 'bg-forest-900 text-white' : 'text-forest-900/60 hover:text-forest-900'
            }`}
          >
            °C
          </button>
          <button
            type="button"
            onClick={() => unit === 'C' && toggleUnit()}
            aria-pressed={unit === 'F'}
            className={`rounded-full px-2.5 py-0.5 transition ${
              unit === 'F' ? 'bg-forest-900 text-white' : 'text-forest-900/60 hover:text-forest-900'
            }`}
          >
            °F
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Precise location only on request (browser permission prompt) */}
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-forest-900/60 transition hover:bg-forest-900/5 hover:text-forest-900 disabled:opacity-50"
            data-testid="weather-use-location"
          >
            {locating ? 'Locating…' : 'Use my location'}
          </button>
          {/* Search city trigger */}
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-expanded={searchOpen}
            aria-label={searchOpen ? 'Close city search' : 'Change city'}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-forest-900/60 transition hover:bg-forest-900/5 hover:text-forest-900"
            data-testid="weather-search-toggle"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        </div>
      </div>

      {locateError && (
        <p className="mt-2 text-xs text-forest-900/55" role="status">{locateError}</p>
      )}

      {searchOpen && (
        <div className="mt-3" data-testid="weather-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder="Search city…"
            className="h-9 w-full rounded-[0.3rem] border border-forest-900/15 bg-white px-3 text-sm text-forest-950 placeholder:text-forest-900/45 focus:border-primary-emphasis focus:outline-none"
          />
          {(searching || results.length > 0) && (
            <ul className="mt-2 max-h-48 overflow-y-auto rounded-[0.3rem] border border-forest-900/10 bg-white text-sm shadow-sm">
              {searching && (
                <li className="px-3 py-2 text-xs text-forest-900/55">Searching…</li>
              )}
              {!searching &&
                results.map((r, i) => (
                  <li key={`${r.name}-${i}`}>
                    <button
                      type="button"
                      onClick={() => onPick(r)}
                      className="block w-full px-3 py-2 text-left text-sm text-forest-950 transition hover:bg-forest-900/5"
                    >
                      <span className="font-medium">{r.name}</span>
                      {(r.admin1 || r.country) && (
                        <span className="ml-2 text-xs text-forest-900/55">
                          {[r.admin1, r.country].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              {!searching && results.length === 0 && query.trim().length >= 2 && (
                <li className="px-3 py-2 text-xs text-forest-900/55">No matches.</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
