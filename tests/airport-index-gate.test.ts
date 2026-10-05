import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MIN_FARE_DESTINATIONS, airportHasRealData, airportIsIndexable } from '../lib/airport-index-gate';
import { THIN_AIRPORT_IATAS } from '../lib/entity-seo';
import type { StrapiAirport } from '../lib/strapi';

const airport = (iata: string) => ({ iata } as StrapiAirport);
const fares = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data', 'airport-enrichment', 'fares.json'), 'utf8'),
).airports as Record<string, { destinations?: unknown[] }>;
const guides = fs
  .readdirSync(path.join(process.cwd(), 'content', 'airport-guides'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', '').toUpperCase());

test('index gate: an airport with enough nonstop destinations in the fare data is indexable without routes', () => {
  const code = Object.keys(fares).find(
    (k) => (fares[k].destinations?.length ?? 0) >= MIN_FARE_DESTINATIONS && !THIN_AIRPORT_IATAS.has(k),
  )!;
  assert.ok(code);
  assert.equal(airportHasRealData(code), true);
  assert.equal(airportIsIndexable(airport(code), false), true);
});

test('index gate: fewer destinations than the minimum do not count on their own', () => {
  const code = Object.keys(fares).find((k) => {
    const n = fares[k].destinations?.length ?? 0;
    return n > 0 && n < MIN_FARE_DESTINATIONS && !guides.includes(k);
  });
  if (code) assert.equal(airportHasRealData(code), false);
});

test('index gate: every airport with a sourced guide is indexable', () => {
  for (const code of guides) {
    if (THIN_AIRPORT_IATAS.has(code)) continue;
    assert.equal(airportIsIndexable(airport(code), false), true, code);
  }
});

test('index gate: retired airports are never indexable, even with fare data or routes', () => {
  for (const code of THIN_AIRPORT_IATAS) {
    assert.equal(airportIsIndexable(airport(code), true), false, code);
    assert.equal(airportIsIndexable(airport(code), false), false, code);
  }
});

test('index gate: a bare airport (no routes, fares, guide or review) is not indexable', () => {
  assert.equal(airportHasRealData('DIQ'), false);
  assert.equal(airportIsIndexable(airport('DIQ'), false), false);
  assert.equal(airportIsIndexable({} as StrapiAirport, true), false);
});

test('index gate: an airport with tracked routes is still indexable', () => {
  assert.equal(airportIsIndexable(airport('DIQ'), true), true);
});
