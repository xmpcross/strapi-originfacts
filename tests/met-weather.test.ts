import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  __testing,
  expiryFrom,
  getAirportWeather,
  getMetForecast,
  MET_USER_AGENT,
  metForecastUrl,
  parseLatLonParams,
  summariseForecast,
  truncateCoordinate,
  type MetResponse,
} from '../lib/met-weather';
import { baseSymbol, describeWeather, formatLocalTime, weatherKind, weatherLabel } from '../lib/met-symbols';
import { buildPlaceIndex, searchPlaces } from '../lib/weather-places';

/* ------------------------------------------------------------------ *
 * Coordinates
 * ------------------------------------------------------------------ */

test('truncateCoordinate truncates to 4 decimals, never rounds up', () => {
  assert.equal(truncateCoordinate(-31.940299), -31.9402);
  assert.equal(truncateCoordinate(115.966904), 115.9669);
  assert.equal(truncateCoordinate(115.9669), 115.9669); // no float drift to .9668
  assert.equal(truncateCoordinate(53.421299), 53.4212);
  assert.equal(truncateCoordinate(-6.27007), -6.27);
  assert.equal(truncateCoordinate(1.35019), 1.3501);
  assert.equal(truncateCoordinate(-0.00001), 0);
});

test('metForecastUrl uses compact, ≤4 decimals and a rounded altitude', () => {
  const u = new URL(metForecastUrl(-31.940299, 115.966904, 20.4216));
  assert.equal(u.origin + u.pathname, 'https://api.met.no/weatherapi/locationforecast/2.0/compact');
  assert.equal(u.searchParams.get('lat'), '-31.9402');
  assert.equal(u.searchParams.get('lon'), '115.9669');
  assert.equal(u.searchParams.get('altitude'), '20');
  for (const k of ['lat', 'lon']) {
    const decimals = (u.searchParams.get(k)!.split('.')[1] ?? '').length;
    assert.ok(decimals <= 4, `${k} has ${decimals} decimals`);
  }
  assert.equal(new URL(metForecastUrl(1, 2)).searchParams.has('altitude'), false);
});

/* ------------------------------------------------------------------ *
 * Symbols
 * ------------------------------------------------------------------ */

test('symbol_code mapping', () => {
  assert.equal(baseSymbol('partlycloudy_polartwilight'), 'partlycloudy');
  assert.equal(weatherLabel('clearsky_day'), 'Clear sky');
  assert.equal(weatherLabel('clearsky_night'), 'Clear sky');
  assert.equal(weatherLabel('fair_day'), 'Mainly clear');
  assert.equal(weatherLabel('partlycloudy_night'), 'Partly cloudy');
  assert.equal(weatherLabel('cloudy'), 'Overcast');
  assert.equal(weatherLabel('fog'), 'Fog');
  assert.equal(weatherLabel('lightrain'), 'Light rain');
  assert.equal(weatherLabel('heavyrain'), 'Rain');
  assert.equal(weatherLabel('rainshowers_day'), 'Rain showers');
  assert.equal(weatherLabel('heavysleet'), 'Sleet');
  assert.equal(weatherLabel('lightsleetshowers_day'), 'Sleet showers');
  assert.equal(weatherLabel('snow'), 'Snow');
  assert.equal(weatherLabel('heavysnowshowers_night'), 'Snow showers');
  assert.equal(weatherLabel('rainandthunder'), 'Thunderstorm');
  assert.equal(weatherLabel('lightssnowshowersandthunder_day'), 'Thunderstorm'); // MET's own spelling
  assert.equal(weatherLabel('somethingnew'), 'Local conditions');
  assert.equal(weatherLabel(undefined), 'Weather unavailable');
  assert.equal(weatherKind('sleetshowersandthunder_day'), 'thunder');
  assert.deepEqual(describeWeather('clearsky_day'), { label: 'Clear', icon: '☀️' });
  assert.deepEqual(describeWeather('heavyrainshowers_day'), { label: 'Rain showers', icon: '🌧️' });
  assert.deepEqual(describeWeather(null), { label: 'Weather', icon: '🌍' });
});

/* ------------------------------------------------------------------ *
 * Forecast summary
 * ------------------------------------------------------------------ */

function step(time: string, temp: number, symbol = 'fair_day', extra: Record<string, number> = {}) {
  return {
    time,
    data: {
      instant: { details: { air_temperature: temp, relative_humidity: 50, wind_speed: 5, ...extra } },
      next_1_hours: { summary: { symbol_code: symbol }, details: { precipitation_amount: 0 } },
    },
  };
}

function forecast(startIso: string, temps: number[]) {
  const t0 = Date.parse(startIso);
  return {
    type: 'Feature',
    properties: {
      meta: { updated_at: startIso },
      timeseries: temps.map((t, i) => step(new Date(t0 + i * 3600_000).toISOString().replace('.000', ''), t, i === 1 ? 'rain' : 'fair_day')),
    },
  };
}

test('summariseForecast picks the step at or before now and a 24 h range', () => {
  const raw = forecast('2026-10-05T05:00:00Z', [20, 21, 25, 12, ...Array(30).fill(15)]);
  const s = summariseForecast(raw, Date.parse('2026-10-05T06:20:00Z'))!;
  assert.equal(s.current?.time, '2026-10-05T06:00:00Z');
  assert.equal(s.current?.airTemperature, 21);
  assert.equal(s.current?.symbolCode, 'rain');
  assert.equal(s.current?.windSpeedKmh, 18); // 5 m/s
  assert.deepEqual(s.next24h, { min: 12, max: 25 });
});

test('summariseForecast rejects stale or malformed data', () => {
  const raw = forecast('2026-10-01T00:00:00Z', [10, 11]);
  assert.equal(summariseForecast(raw, Date.parse('2026-10-05T00:00:00Z')), null);
  assert.equal(summariseForecast({}, Date.now()), null);
  assert.equal(summariseForecast(null, Date.now()), null);
  assert.equal(summariseForecast({ properties: { timeseries: 'x' } }, Date.now()), null);
});

test('formatLocalTime uses the airport zone, else UTC', () => {
  assert.equal(formatLocalTime('2026-10-05T05:00:00Z', 'Australia/Perth'), '13:00 local');
  assert.equal(formatLocalTime('2026-10-05T05:00:00Z', 'Not/AZone'), '05:00 UTC');
  assert.equal(formatLocalTime(undefined, 'Europe/Dublin'), null);
});

/* ------------------------------------------------------------------ *
 * Cache + expiry
 * ------------------------------------------------------------------ */

type Call = { url: string; headers: Record<string, string> };
let calls: Call[] = [];
let responder: (c: Call) => MetResponse;

beforeEach(() => {
  __testing.reset();
  calls = [];
  __testing.setTransport(async (url, headers) => {
    const c = { url, headers };
    calls.push(c);
    return responder(c);
  });
});

const nowIso = () => new Date(Math.floor(Date.now() / 3600_000) * 3600_000).toISOString();

function ok(expiresInMs: number, lastModified = 'Mon, 05 Oct 2026 05:35:00 GMT'): MetResponse {
  return {
    status: 200,
    headers: { expires: new Date(Date.now() + expiresInMs).toUTCString(), 'last-modified': lastModified },
    body: JSON.stringify(forecast(nowIso(), [18, 19, 20])),
  };
}

test('expiryFrom honours Expires within sane bounds', () => {
  const now = Date.parse('2026-10-05T05:35:00Z');
  assert.equal(expiryFrom({ expires: 'Mon, 05 Oct 2026 06:05:23 GMT' }, now), Date.parse('2026-10-05T06:05:23Z'));
  assert.equal(expiryFrom({}, now), now + 30 * 60_000);
  assert.equal(expiryFrom({ expires: 'garbage' }, now), now + 30 * 60_000);
  assert.equal(expiryFrom({ expires: 'Mon, 05 Oct 2026 05:00:00 GMT' }, now), now + 60_000); // past → 60 s floor
  assert.equal(expiryFrom({ expires: 'Mon, 12 Oct 2026 05:00:00 GMT' }, now), now + 3 * 3600_000); // capped
});

test('sends the identifying User-Agent and gzip, and serves from cache until Expires', async () => {
  responder = () => ok(30 * 60_000);
  const a = await getMetForecast(-31.940299, 115.966904);
  const b = await getMetForecast(-31.940299, 115.966904);
  assert.ok(a);
  assert.equal(a, b);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers['User-Agent'], MET_USER_AGENT);
  assert.match(calls[0].headers['Accept-Encoding'], /gzip/);
  assert.equal(calls[0].headers['If-Modified-Since'], undefined);
  assert.match(calls[0].url, /lat=-31\.9402&lon=115\.9669$/);
});

test('concurrent requests for one point share a single upstream call', async () => {
  responder = () => ok(30 * 60_000);
  const [a, b, c] = await Promise.all([getMetForecast(1.35, 103.99), getMetForecast(1.35, 103.99), getMetForecast(1.35, 103.99)]);
  assert.ok(a && a === b && b === c);
  assert.equal(calls.length, 1);
});

test('after Expires, revalidates with If-Modified-Since and keeps the body on 304', async () => {
  responder = () => ok(-1000); // already expired → clamped to 60 s
  const first = await getMetForecast(53.4213, -6.27);
  assert.equal(calls.length, 1);
  // Force expiry by moving the clock forward.
  const realNow = Date.now;
  Date.now = () => realNow() + 2 * 60_000;
  try {
    responder = () => ({ status: 304, headers: { expires: new Date(Date.now() + 30 * 60_000).toUTCString() }, body: '' });
    const second = await getMetForecast(53.4213, -6.27);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].headers['If-Modified-Since'], 'Mon, 05 Oct 2026 05:35:00 GMT');
    assert.equal(second, first);
    await getMetForecast(53.4213, -6.27);
    assert.equal(calls.length, 2, '304 extended the expiry');
  } finally {
    Date.now = realNow;
  }
});

test('failures give null, are negatively cached, and 429 backs off', async () => {
  responder = () => ({ status: 500, headers: {}, body: '' });
  assert.equal(await getMetForecast(10, 10), null);
  assert.equal(await getMetForecast(10, 10), null);
  assert.equal(calls.length, 1);

  responder = () => ({ status: 429, headers: { 'retry-after': '120' }, body: '' });
  assert.equal(await getMetForecast(20, 20), null);
  responder = () => ok(30 * 60_000);
  assert.equal(await getMetForecast(30, 30), null, 'backing off after 429');
  assert.equal(calls.length, 2);

  __testing.reset();
  responder = () => {
    throw new Error('network');
  };
  assert.equal(await getAirportWeather({ latitude: 40, longitude: 40 }), null);
  responder = () => ({ status: 200, headers: {}, body: 'not json' });
  assert.equal(await getAirportWeather({ latitude: 41, longitude: 41 }), null);
  assert.equal(await getAirportWeather({ latitude: undefined, longitude: 41 }), null);
});

test('getAirportWeather summarises and keeps a valid time zone only', async () => {
  responder = () => ok(30 * 60_000);
  const w = await getAirportWeather({ latitude: -31.9403, longitude: 115.9669, elevationFt: 67, timeZone: 'Australia/Perth' });
  assert.equal(w?.timeZone, 'Australia/Perth');
  assert.equal(w?.current?.airTemperature, 18);
  assert.match(calls[0].url, /altitude=20$/);
  const v = await getAirportWeather({ latitude: 5, longitude: 5, timeZone: 'bogus' });
  assert.equal(v?.timeZone, undefined);
});

/* ------------------------------------------------------------------ *
 * /api/weather input
 * ------------------------------------------------------------------ */

test('parseLatLonParams validates and rounds to 2 decimals', () => {
  const p = (q: string) => parseLatLonParams(new URLSearchParams(q));
  assert.deepEqual(p('lat=-31.95123&lon=115.86789'), { lat: -31.95, lon: 115.87 });
  assert.deepEqual(p('lat=51.507&lon=-0.128'), { lat: 51.51, lon: -0.13 });
  assert.deepEqual(p('lat=0&lon=-0.001'), { lat: 0, lon: 0 });
  for (const bad of ['', 'lat=1', 'lon=1', 'lat=abc&lon=1', 'lat=91&lon=0', 'lat=0&lon=181', 'lat=1e2&lon=1', 'lat=Infinity&lon=1', 'lat=1&lon=1;drop', 'lat= &lon=1', 'lat=0x10&lon=1']) {
    assert.equal(p(bad), null, bad);
  }
});

/* ------------------------------------------------------------------ *
 * City search
 * ------------------------------------------------------------------ */

test('place index: one entry per city, main airport first, search by name or IATA', () => {
  const idx = buildPlaceIndex({
    PER: { iata: 'PER', type: 'large_airport', lat: -31.9403, lon: 115.9669, country: 'AU', municipality: 'Perth', scheduledService: true },
    PSL: { iata: 'PSL', type: 'small_airport', lat: 56.4, lon: -3.4, country: 'GB', municipality: 'Perth', scheduledService: true },
    JAD: { iata: 'JAD', type: 'small_airport', lat: -32.09, lon: 115.88, country: 'AU', municipality: 'Perth (Jandakot)', scheduledService: true },
    DUB: { iata: 'DUB', type: 'large_airport', lat: 53.4213, lon: -6.27, country: 'IE', municipality: 'Dublin', scheduledService: true },
    XXX: { iata: 'XXX', type: 'large_airport', lat: 1, lon: 1, country: 'ZZ', municipality: 'Nowhere', scheduledService: false },
    SAO: { iata: 'GRU', type: 'large_airport', lat: -23.43, lon: -46.47, country: 'BR', municipality: 'São Paulo', scheduledService: true },
  });
  assert.equal(idx.length, 4);
  const perth = searchPlaces('per', 6, idx);
  assert.deepEqual(perth.map((p) => `${p.name}/${p.country}/${p.iata}`), ['Perth/AU/PER', 'Perth/GB/PSL']);
  assert.deepEqual(perth[0], { name: 'Perth', country: 'AU', iata: 'PER', lat: -31.94, lon: 115.97 });
  assert.equal(searchPlaces('dub', 6, idx)[0].iata, 'DUB');
  assert.equal(searchPlaces('Sao Paulo', 6, idx)[0].iata, 'GRU');
  assert.equal(searchPlaces('paulo', 6, idx)[0].iata, 'GRU');
  assert.deepEqual(searchPlaces('p', 6, idx), []);
  assert.deepEqual(searchPlaces('nowhere', 6, idx), []);
});
