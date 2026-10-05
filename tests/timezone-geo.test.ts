import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeForTimeZone, placeFromBrowserTimeZone } from '../lib/timezone-geo';

test('timezone-geo: maps common zones to a city and IATA code', () => {
  assert.deepEqual(placeForTimeZone('Europe/London'), { iata: 'LON', city: 'London', lat: 51.507, lon: -0.128 });
  assert.equal(placeForTimeZone('Australia/Perth')?.iata, 'PER');
  assert.equal(placeForTimeZone('Asia/Calcutta')?.city, 'Delhi');
  assert.equal(placeForTimeZone('America/New_York')?.iata, 'NYC');
});

test('timezone-geo: unknown or empty zones give null (caller uses its default)', () => {
  assert.equal(placeForTimeZone('Etc/UTC'), null);
  assert.equal(placeForTimeZone(''), null);
  assert.equal(placeForTimeZone(undefined), null);
});

test('timezone-geo: every entry is a valid IATA code with in-range coordinates', () => {
  for (const tz of ['Europe/Paris', 'Asia/Tokyo', 'Pacific/Auckland', 'America/Sao_Paulo']) {
    const p = placeForTimeZone(tz)!;
    assert.match(p.iata, /^[A-Z]{3}$/);
    assert.ok(Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180);
  }
});

test('timezone-geo: reads the runtime time zone without throwing', () => {
  const p = placeFromBrowserTimeZone();
  assert.ok(p === null || /^[A-Z]{3}$/.test(p.iata));
});
