/**
 * Current weather from MET Norway's Locationforecast 2.0 (compact), free for
 * commercial use under CC BY 4.0 / NLOD. Replaces Open-Meteo, whose free API
 * is non-commercial only.
 *
 * Server-only. MET's terms (https://api.met.no/doc/TermsOfService) are
 * followed here, and nowhere else should call api.met.no:
 *   - every request carries an identifying User-Agent with contact details
 *     (browsers cannot set one, so the client widget goes through
 *     /api/weather and never calls MET itself);
 *   - coordinates are truncated to at most 4 decimals;
 *   - responses are cached in memory until their `Expires`, then revalidated
 *     with `If-Modified-Since` (a 304 just extends the cached copy);
 *   - requests are spaced and capped well under 20/s, and a 429 backs off;
 *   - gzip and redirects are supported.
 *
 * Requests use node:https rather than fetch: Next's patched fetch would either
 * cache outside our control or (no-store) turn the ISR airport pages dynamic.
 * Nothing about the visitor (IP, headers) is forwarded: the server makes the
 * request on its own behalf.
 *
 * Any failure gives null, and callers hide the weather rather than erroring.
 */
import https from 'node:https';
import zlib from 'node:zlib';

import { isValidTimeZone } from '@/lib/met-symbols';

export { formatLocalTime, isValidTimeZone } from '@/lib/met-symbols';

export const MET_USER_AGENT = 'Originfacts/1.0 https://www.originfacts.com/contact';
const MET_COMPACT_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';

/** When MET sends no usable Expires header. */
const DEFAULT_TTL_MS = 30 * 60 * 1000;
/** Upper bound on how long we trust one response, whatever Expires says. */
const MAX_TTL_MS = 3 * 60 * 60 * 1000;
/** After a failed request, do not retry that location for this long. */
const FAILURE_TTL_MS = 5 * 60 * 1000;
/** Serve a stale copy for this long if revalidation fails. */
const STALE_GRACE_MS = 3 * 60 * 60 * 1000;
const MAX_ENTRIES = 2000;
const REQUEST_TIMEOUT_MS = 8000;
/** Global pacing: at most one new upstream request per this many ms (≤ 5/s). */
const MIN_SPACING_MS = 200;
const MAX_CONCURRENT = 3;
/** Requests waiting beyond this many are dropped (null) rather than queued. */
const MAX_QUEUE = 25;

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type AirportWeather = {
  /** IANA zone used for local times, when known and valid. */
  timeZone?: string;
  current?: {
    /** ISO time (UTC) of the forecast step shown as "now". */
    time?: string;
    airTemperature?: number;
    relativeHumidity?: number;
    /** km/h, converted from MET's m/s. */
    windSpeedKmh?: number;
    /** MET symbol_code for the next hour, e.g. "partlycloudy_day". */
    symbolCode?: string;
  };
  /** Low/high of the hourly air temperatures over the next 24 hours. */
  next24h?: { min?: number; max?: number };
  /** MET's model run time (properties.meta.updated_at). */
  updatedAt?: string;
};

export type MetResponse = { status: number; headers: Record<string, string | undefined>; body: string };
export type MetTransport = (url: string, headers: Record<string, string>) => Promise<MetResponse>;

/* ------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------ */

/** Truncate (not round) to at most 4 decimals, as MET requires. */
export function truncateCoordinate(value: number): number {
  // Scale via a rounded intermediate so 115.9669 does not become 115.9668
  // through floating-point error, then truncate toward zero.
  const scaled = Math.round(value * 1e8) / 1e4;
  const t = Math.trunc(scaled) / 1e4;
  return Object.is(t, -0) ? 0 : t;
}

export function validLatLon(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function metForecastUrl(lat: number, lon: number, altitudeM?: number): string {
  const url = new URL(MET_COMPACT_URL);
  url.searchParams.set('lat', String(truncateCoordinate(lat)));
  url.searchParams.set('lon', String(truncateCoordinate(lon)));
  if (typeof altitudeM === 'number' && Number.isFinite(altitudeM)) {
    url.searchParams.set('altitude', String(Math.round(altitudeM)));
  }
  return url.toString();
}

/* ------------------------------------------------------------------ *
 * Parsing
 * ------------------------------------------------------------------ */

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

type Step = { t: number; time: string; temp?: number; rh?: number; wind?: number; symbol?: string };

function steps(raw: unknown): { steps: Step[]; updatedAt?: string } | null {
  const props = obj(obj(raw)?.properties);
  if (!props || !Array.isArray(props.timeseries)) return null;
  const meta = obj(props.meta);
  const out: Step[] = [];
  for (const entry of props.timeseries) {
    const e = obj(entry);
    if (!e || typeof e.time !== 'string') continue;
    const t = Date.parse(e.time);
    if (!Number.isFinite(t)) continue;
    const data = obj(e.data);
    const details = obj(obj(data?.instant)?.details);
    const symbol =
      obj(obj(data?.next_1_hours)?.summary)?.symbol_code ??
      obj(obj(data?.next_6_hours)?.summary)?.symbol_code;
    out.push({
      t,
      time: e.time,
      temp: num(details?.air_temperature),
      rh: num(details?.relative_humidity),
      wind: num(details?.wind_speed),
      symbol: typeof symbol === 'string' ? symbol : undefined,
    });
  }
  out.sort((a, b) => a.t - b.t);
  return { steps: out, updatedAt: typeof meta?.updated_at === 'string' ? meta.updated_at : undefined };
}

/**
 * The weather "now" from a compact response: the latest step at or before
 * `now` (the first step if all are in the future), plus the low/high of the
 * hourly temperatures from that step through the next 24 hours.
 */
export function summariseForecast(raw: unknown, now: number = Date.now()): Omit<AirportWeather, 'timeZone'> | null {
  const parsed = steps(raw);
  if (!parsed || parsed.steps.length === 0) return null;
  const all = parsed.steps;
  let idx = 0;
  for (let i = 0; i < all.length; i++) {
    if (all[i].t <= now) idx = i;
    else break;
  }
  const cur = all[idx];
  // A forecast whose first step is more than 3 h old is not "now".
  if (now - cur.t > 3 * 60 * 60 * 1000) return null;
  if (cur.temp === undefined) return null;

  const window = all.filter((s) => s.t >= cur.t && s.t <= cur.t + 24 * 60 * 60 * 1000 && s.temp !== undefined);
  const temps = window.map((s) => s.temp as number);
  return {
    current: {
      time: cur.time,
      airTemperature: cur.temp,
      relativeHumidity: cur.rh,
      windSpeedKmh: cur.wind === undefined ? undefined : cur.wind * 3.6,
      symbolCode: cur.symbol,
    },
    next24h: temps.length >= 2 ? { min: Math.min(...temps), max: Math.max(...temps) } : undefined,
    updatedAt: parsed.updatedAt,
  };
}

/* ------------------------------------------------------------------ *
 * Cache
 * ------------------------------------------------------------------ */

type Entry = {
  /** Parsed body; null when the last attempt failed and nothing is cached. */
  body: unknown | null;
  lastModified?: string;
  /** Epoch ms after which we must revalidate. */
  expires: number;
  /** When `body` was last confirmed by MET. */
  fetchedAt: number;
};

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown | null>>();
let backoffUntil = 0;

/** Expires header → epoch ms, clamped to [now + 60 s, now + MAX_TTL]. */
export function expiryFrom(headers: Record<string, string | undefined>, now: number = Date.now()): number {
  const raw = headers['expires'];
  const t = raw ? Date.parse(raw) : NaN;
  if (!Number.isFinite(t)) return now + DEFAULT_TTL_MS;
  return Math.min(Math.max(t, now + 60_000), now + MAX_TTL_MS);
}

function remember(key: string, entry: Entry) {
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Seconds until this location's cached forecast expires (for Cache-Control). */
export function secondsUntilExpiry(lat: number, lon: number, altitudeM?: number, now: number = Date.now()): number {
  const e = cache.get(metForecastUrl(lat, lon, altitudeM));
  if (!e) return 0;
  return Math.max(0, Math.floor((e.expires - now) / 1000));
}

/* ------------------------------------------------------------------ *
 * Transport + pacing
 * ------------------------------------------------------------------ */

const httpsTransport: MetTransport = (url, headers) =>
  new Promise((resolve, reject) => {
    const get = (target: string, redirects: number) => {
      const req = https.get(target, { headers, timeout: REQUEST_TIMEOUT_MS }, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && status !== 304 && res.headers.location && redirects < 3) {
          res.resume();
          const next = new URL(res.headers.location, target);
          if (next.protocol !== 'https:' || next.hostname !== 'api.met.no') return reject(new Error('unexpected redirect'));
          return get(next.toString(), redirects + 1);
        }
        const enc = String(res.headers['content-encoding'] ?? '').toLowerCase();
        const stream = enc === 'gzip' ? res.pipe(zlib.createGunzip()) : enc === 'deflate' ? res.pipe(zlib.createInflate()) : res;
        const chunks: Buffer[] = [];
        stream.on('data', (c: Buffer) => chunks.push(c));
        stream.on('error', reject);
        stream.on('end', () => {
          const h: Record<string, string | undefined> = {};
          for (const [k, v] of Object.entries(res.headers)) h[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
          resolve({ status, headers: h, body: Buffer.concat(chunks).toString('utf8') });
        });
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', reject);
    };
    get(url, 0);
  });

let transport: MetTransport = httpsTransport;
let active = 0;
let lastStart = 0;
const queue: (() => void)[] = [];

function pump() {
  if (active >= MAX_CONCURRENT || queue.length === 0) return;
  const wait = lastStart + MIN_SPACING_MS - Date.now();
  if (wait > 0) {
    setTimeout(pump, wait);
    return;
  }
  const next = queue.shift()!;
  active++;
  lastStart = Date.now();
  next();
  pump();
}

function paced<T>(task: () => Promise<T>): Promise<T | null> {
  if (queue.length >= MAX_QUEUE) return Promise.resolve(null);
  return new Promise((resolve) => {
    queue.push(() => {
      task()
        .then(resolve, () => resolve(null))
        .finally(() => {
          active--;
          pump();
        });
    });
    pump();
  });
}

/* ------------------------------------------------------------------ *
 * Fetch
 * ------------------------------------------------------------------ */

async function revalidate(url: string, prev: Entry | undefined, now: number): Promise<unknown | null> {
  const headers: Record<string, string> = {
    'User-Agent': MET_USER_AGENT,
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  };
  if (prev?.body && prev.lastModified) headers['If-Modified-Since'] = prev.lastModified;

  const stale = () => (prev?.body && now - prev.fetchedAt < STALE_GRACE_MS ? prev.body : null);
  const fail = () => {
    const body = stale();
    remember(url, {
      body,
      lastModified: body ? prev?.lastModified : undefined,
      expires: now + FAILURE_TTL_MS,
      fetchedAt: body ? prev!.fetchedAt : now,
    });
    return body;
  };

  const res = await paced(() => transport(url, headers));
  if (!res) return fail();
  if (res.status === 304 && prev?.body) {
    remember(url, { ...prev, expires: expiryFrom(res.headers, now), fetchedAt: now, lastModified: res.headers['last-modified'] ?? prev.lastModified });
    return prev.body;
  }
  if (res.status === 429) {
    const retry = Number(res.headers['retry-after']);
    backoffUntil = now + (Number.isFinite(retry) && retry > 0 ? retry * 1000 : 60_000);
    return fail();
  }
  // 203 = deprecated/beta product warning; the data is still valid.
  if (res.status !== 200 && res.status !== 203) return fail();
  let body: unknown;
  try {
    body = JSON.parse(res.body);
  } catch {
    return fail();
  }
  remember(url, { body, lastModified: res.headers['last-modified'], expires: expiryFrom(res.headers, now), fetchedAt: now });
  return body;
}

/** The raw compact forecast for a point, from cache when fresh. */
export async function getMetForecast(lat: number, lon: number, altitudeM?: number): Promise<unknown | null> {
  if (!validLatLon(lat, lon)) return null;
  const url = metForecastUrl(lat, lon, altitudeM);
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && now < hit.expires) return hit.body;
  if (now < backoffUntil) return hit?.body && now - hit.fetchedAt < STALE_GRACE_MS ? hit.body : null;
  const pending = inflight.get(url);
  if (pending) return pending;
  const p = revalidate(url, hit, now).finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

export async function getAirportWeather(args: {
  latitude?: number;
  longitude?: number;
  elevationFt?: number;
  timeZone?: string;
}): Promise<AirportWeather | null> {
  if (!validLatLon(args.latitude, args.longitude)) return null;
  try {
    const altitudeM = typeof args.elevationFt === 'number' ? args.elevationFt * 0.3048 : undefined;
    const raw = await getMetForecast(args.latitude, args.longitude as number, altitudeM);
    if (!raw) return null;
    const summary = summariseForecast(raw);
    if (!summary) return null;
    return { ...summary, timeZone: isValidTimeZone(args.timeZone) ? args.timeZone : undefined };
  } catch {
    return null;
  }
}

/* Test hooks. */
export const __testing = {
  setTransport(t: MetTransport | null) {
    transport = t ?? httpsTransport;
  },
  reset() {
    cache.clear();
    inflight.clear();
    queue.length = 0;
    active = 0;
    lastStart = 0;
    backoffUntil = 0;
  },
  cacheSize: () => cache.size,
};

/* ------------------------------------------------------------------ *
 * /api/weather input
 * ------------------------------------------------------------------ */

const DECIMAL = /^-?\d{1,3}(\.\d{1,12})?$/;

/**
 * Validate `lat`/`lon` query params and round them to 2 decimals (about 1 km):
 * enough for current weather, coarse enough that visitors share cache entries
 * and a precise browser location never reaches MET.
 */
export function parseLatLonParams(params: URLSearchParams): { lat: number; lon: number } | null {
  const rawLat = params.get('lat')?.trim() ?? '';
  const rawLon = params.get('lon')?.trim() ?? '';
  if (!DECIMAL.test(rawLat) || !DECIMAL.test(rawLon)) return null;
  const lat = Math.round(Number(rawLat) * 100) / 100;
  const lon = Math.round(Number(rawLon) * 100) / 100;
  if (!validLatLon(lat, lon)) return null;
  return { lat: Object.is(lat, -0) ? 0 : lat, lon: Object.is(lon, -0) ? 0 : lon };
}
