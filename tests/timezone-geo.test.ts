import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countryForLanguage,
  countryForTimeZone,
  countryName,
  placeForTimeZone,
  placeFromBrowserTimeZone,
} from '../lib/timezone-geo';
import { currencyForCountry } from '../lib/currency';

test('timezone-geo: maps common zones to a city and IATA code', () => {
  assert.deepEqual(placeForTimeZone('Europe/London'), { iata: 'LON', city: 'London', lat: 51.507, lon: -0.128, country: 'GB' });
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

test('timezone-geo: time zone → country → default currency', () => {
  const cases: Array<[string, string, string]> = [
    ['Australia/Perth', 'AU', 'AUD'],
    ['Australia/Sydney', 'AU', 'AUD'],
    ['Australia/Lord_Howe', 'AU', 'AUD'],
    ['Europe/London', 'GB', 'GBP'],
    ['Europe/Belfast', 'GB', 'GBP'],
    ['Europe/Jersey', 'JE', 'GBP'],
    ['Europe/Paris', 'FR', 'EUR'],
    ['Europe/Dublin', 'IE', 'EUR'],
    ['Europe/Riga', 'LV', 'EUR'],
    ['Atlantic/Canary', 'ES', 'EUR'],
    ['Europe/Zurich', 'CH', 'USD'],
    ['America/New_York', 'US', 'USD'],
    ['America/Toronto', 'CA', 'USD'],
    ['Asia/Bangkok', 'TH', 'USD'],
    ['Pacific/Auckland', 'NZ', 'USD'],
  ];
  for (const [tz, cc, cur] of cases) {
    assert.equal(countryForTimeZone(tz), cc, tz);
    assert.equal(currencyForCountry(countryForTimeZone(tz)), cur, tz);
  }
});

test('timezone-geo: every mapped zone has a country code', () => {
  for (const tz of ['Asia/Tokyo', 'Africa/Nairobi', 'America/Sao_Paulo', 'Asia/Calcutta']) {
    assert.match(placeForTimeZone(tz)!.country, /^[A-Z]{2}$/);
  }
});

test('timezone-geo: unmapped zones give no country (USD default)', () => {
  assert.equal(countryForTimeZone('Etc/UTC'), null);
  assert.equal(countryForTimeZone(undefined), null);
  assert.equal(currencyForCountry(countryForTimeZone('Etc/UTC')), 'USD');
});

test('timezone-geo: language region fallback', () => {
  assert.equal(countryForLanguage('en-GB'), 'GB');
  assert.equal(countryForLanguage('en-AU'), 'AU');
  assert.equal(countryForLanguage('de-DE'), 'DE');
  assert.equal(countryForLanguage('en'), null);
  assert.equal(countryForLanguage('not a tag!'), null);
  assert.equal(currencyForCountry(countryForLanguage('en-AU')), 'AUD');
  assert.equal(currencyForCountry(countryForLanguage('fr-FR')), 'EUR');
});

test('timezone-geo: country names for the flight-search "From" subtitle', () => {
  assert.equal(countryName('TH'), 'Thailand');
  assert.equal(countryName('AU'), 'Australia');
  assert.equal(countryName(''), '');
});
