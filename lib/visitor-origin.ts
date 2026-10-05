'use client';

import { useEffect, useState } from 'react';
import { FALLBACK_ORIGIN } from '@/lib/flights-data';
import { placeFromBrowserTimeZone } from '@/lib/timezone-geo';

export type Origin = { name: string; iata: string };

const CACHE_KEY = 'originfacts.visitor-origin.v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedOrigin = { origin: Origin; decidedAt: number };

const KNOWN_CITIES: Record<string, string> = {
  LON: 'London',
  LHR: 'London',
  LGW: 'London',
  STN: 'London',
  LTN: 'London',
  PER: 'Perth',
  BKK: 'Bangkok',
  DMK: 'Bangkok',
  DPS: 'Denpasar',
  SIN: 'Singapore',
  KUL: 'Kuala Lumpur',
  SYD: 'Sydney',
  MEL: 'Melbourne',
  BNE: 'Brisbane',
  ADL: 'Adelaide',
  HND: 'Tokyo',
  NRT: 'Tokyo',
  TYO: 'Tokyo',
  ICN: 'Seoul',
  SEL: 'Seoul',
  CDG: 'Paris',
  PAR: 'Paris',
  DXB: 'Dubai',
  JFK: 'New York',
  NYC: 'New York',
  LAX: 'Los Angeles',
};

export function getOriginFromUrl(): Origin | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    let code = params.get('origin') || params.get('from');
    const fs = params.get('flightSearch');
    if (!code && fs) {
      const match = fs.trim().match(/^([A-Za-z]{3})/);
      if (match) code = match[1];
    }
    if (code) {
      const upper = code.toUpperCase();
      const name = KNOWN_CITIES[upper] || upper;
      return { iata: upper, name };
    }
  } catch {
    /* silent */
  }
  return null;
}

function readCache(): Origin | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedOrigin;
    if (Date.now() - parsed.decidedAt > CACHE_TTL_MS) return null;
    if (!parsed.origin?.iata) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function writeCache(origin: Origin) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ origin, decidedAt: Date.now() } satisfies CachedOrigin),
    );
  } catch {
    /* private mode / storage off — silent */
  }
}

export function setVisitorOrigin(origin: Origin) {
  writeCache(origin);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('visitor-origin-change', { detail: origin }));
  }
}

let inflight: Promise<Origin | null> | null = null;

export function resolveVisitorOrigin(): Promise<Origin | null> {
  const urlOrigin = getOriginFromUrl();
  if (urlOrigin) {
    writeCache(urlOrigin);
    return Promise.resolve(urlOrigin);
  }

  const cached = readCache();
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const apiRes = await fetch('/api/nearest-city', { cache: 'no-store' });
      if (apiRes.ok) {
        const j = (await apiRes.json()) as { code?: string; name?: string };
        if (j?.code && j?.name) {
          const origin: Origin = { iata: j.code, name: j.name };
          writeCache(origin);
          return origin;
        }
      }
      // No IP lookup in the browser: fall back to the browser's time zone
      // (no network, nothing sent to a third party). An unmapped zone leaves
      // the caller on FALLBACK_ORIGIN.
      const place = placeFromBrowserTimeZone();
      if (!place) return null;
      const origin: Origin = { iata: place.iata, name: place.city };
      writeCache(origin);
      return origin;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useVisitorOrigin(): Origin {
  // Start from the fallback on the server and in the browser alike. Reading the
  // URL or sessionStorage here made the browser's first render differ from the
  // server HTML once a city was cached (React error #418, and React then
  // re-renders the whole tree on the client). The real origin is applied right
  // after mount.
  const [origin, setOrigin] = useState<Origin>(FALLBACK_ORIGIN);

  useEffect(() => {
    const handleUpdate = () => {
      const updated = getOriginFromUrl() ?? readCache() ?? FALLBACK_ORIGIN;
      setOrigin(updated);
    };

    handleUpdate();
    if (!getOriginFromUrl() && !readCache()) {
      resolveVisitorOrigin().then((o) => {
        if (o) setOrigin(o);
      });
    }

    window.addEventListener('visitor-origin-change', handleUpdate);
    window.addEventListener('popstate', handleUpdate);
    window.addEventListener('urlchange', handleUpdate);
    return () => {
      window.removeEventListener('visitor-origin-change', handleUpdate);
      window.removeEventListener('popstate', handleUpdate);
      window.removeEventListener('urlchange', handleUpdate);
    };
  }, []);

  return origin;
}
