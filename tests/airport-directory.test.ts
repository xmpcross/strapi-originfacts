import { test } from 'node:test';
import assert from 'node:assert/strict';
import { airportCountryIndex, compareAirports, foldText, letterOf } from '../lib/airport-directory';

const countries = [
  { code: 'TR', name: 'Turkey', region: 'Asia' as const },
  { code: 'CZ', name: 'Czechia', region: 'Europe' as const },
];

test('region and country name come from the country collection by code', () => {
  const of = airportCountryIndex(countries);
  assert.deepEqual(of({ countryCode: 'tr', country: 'Turkey', region: 'Europe' }), { country: 'Turkey', region: 'Asia' });
  assert.deepEqual(of({ countryCode: 'CZ', country: 'Czech Republic', region: 'Europe' }), {
    country: 'Czechia',
    region: 'Europe',
  });
});

test('unknown country code falls back to the record', () => {
  const of = airportCountryIndex(countries);
  assert.deepEqual(of({ countryCode: 'NY', country: 'Northern Cyprus', region: undefined }), {
    country: 'Northern Cyprus',
    region: undefined,
  });
  assert.deepEqual(of({ countryCode: 'XX', country: 'Somewhere', region: 'Oceania' }), {
    country: 'Somewhere',
    region: 'Oceania',
  });
});

test('search folding ignores accents and case', () => {
  assert.equal(foldText('São Paulo–Guarulhos'), 'sao paulo–guarulhos');
  assert.equal(letterOf('Ålesund'), 'A');
  assert.equal(letterOf("'s-Hertogenbosch"), '#');
});

test('airports sort by city, then airport name', () => {
  const a = { iata: 'LGW', name: 'Gatwick', city: 'London', slug: 'x' };
  const b = { iata: 'LHR', name: 'Heathrow', city: 'London', slug: 'y' };
  const c = { iata: 'AMS', name: 'Schiphol', city: 'Amsterdam', slug: 'z' };
  assert.deepEqual([b, a, c].sort(compareAirports).map((x) => x.iata), ['AMS', 'LGW', 'LHR']);
});

test('rows round-trip and ranking puts reviewed, then route records, then A–Z first', async () => {
  const { toRow, fromRow, rankAirports } = await import('../lib/airport-directory');
  const full = { iata: 'PER', icao: 'YPPH', name: 'Perth Airport', city: 'Perth', country: 'Australia', region: 'Oceania' as const, slug: 'perth', reviewed: true, routes: 7 };
  const bare = { iata: 'ZZZ', name: 'Somewhere', slug: 'somewhere' };
  assert.deepEqual(fromRow(toRow(full)), full);
  assert.deepEqual(fromRow(toRow(bare)), bare);
  const routed = { iata: 'AAA', name: 'Zed', city: 'Zed', slug: 'zed', routes: 9 };
  const plain = { iata: 'BBB', name: 'Alpha', city: 'Alpha', slug: 'alpha' };
  assert.deepEqual([plain, routed, bare, full].sort(rankAirports).map((x) => x.iata), ['PER', 'AAA', 'BBB', 'ZZZ']);
});
