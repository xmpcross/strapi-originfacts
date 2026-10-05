import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { THIN_AIRPORT_IATAS, airportIsSubstantive } from '../lib/entity-seo';
import type { StrapiAirport } from '../lib/strapi';

const guided = new Set(
  fs
    .readdirSync(path.join(process.cwd(), 'content', 'airport-guides'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', '').toUpperCase()),
);

test('thin airports: 35 codes, all valid IATA', () => {
  assert.equal(THIN_AIRPORT_IATAS.size, 35);
  for (const c of THIN_AIRPORT_IATAS) assert.match(c, /^[A-Z]{3}$/);
});

test('thin airports: never indexable, even with tracked routes', () => {
  for (const iata of THIN_AIRPORT_IATAS) {
    assert.equal(airportIsSubstantive({ iata } as StrapiAirport, true), false, iata);
    assert.equal(airportIsSubstantive({ iata } as StrapiAirport, false), false, iata);
  }
});

test('thin airports: an airport with a sourced guide is not on the list', () => {
  for (const iata of THIN_AIRPORT_IATAS) assert.ok(!guided.has(iata), `${iata} has a guide: remove it from THIN_AIRPORT_IATAS`);
});

test('thin airports: an airport with routes outside the list is still indexable', () => {
  assert.equal(airportIsSubstantive({ iata: 'LHR' } as StrapiAirport, true), true);
});
