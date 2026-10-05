import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDuration,
  fromRow,
  isDomestic,
  matchesQuery,
  routeHaystack,
  sortRoutes,
  toRow,
  type DirectoryRoute,
} from '../lib/route-directory';

const lhrBkk: DirectoryRoute = {
  slug: 'lhr-to-bkk',
  origin: { iata: 'LHR', city: 'London', name: 'London Heathrow Airport', country: 'United Kingdom', region: 'Europe', slug: 'london-lhr' },
  destination: { iata: 'BKK', city: 'Bangkok', name: 'Suvarnabhumi Airport', country: 'Thailand', region: 'Asia', slug: 'bangkok' },
  distanceKm: 9542,
  durationMinutes: 690,
  popularity: 85,
  carriers: [0],
};
const sydMel: DirectoryRoute = {
  slug: 'syd-to-mel',
  origin: { iata: 'SYD', city: 'Sydney', name: 'Sydney Airport', country: 'Australia', region: 'Oceania', slug: 'sydney' },
  destination: { iata: 'MEL', city: 'Melbourne', name: 'Melbourne Airport', country: 'Australia', region: 'Oceania', slug: 'melbourne' },
  popularity: 9,
  carriers: [],
};

test('rows round-trip without losing fields', () => {
  assert.deepEqual(fromRow(toRow(lhrBkk)), lhrBkk);
  assert.deepEqual(fromRow(toRow(sydMel)), sydMel);
});

test('domestic means both ends in one country', () => {
  assert.equal(isDomestic(sydMel), true);
  assert.equal(isDomestic(lhrBkk), false);
});

test('search matches every term, by code, city, country or airline', () => {
  const hay = routeHaystack(lhrBkk, [{ slug: 'thai-airways', name: 'Thai Airways', iata: 'TG' }]);
  assert.ok(matchesQuery(hay, 'lhr bkk'));
  assert.ok(matchesQuery(hay, 'LHR-BKK'));
  assert.ok(matchesQuery(hay, 'London to Bangkok'));
  assert.ok(matchesQuery(hay, 'thai'));
  assert.ok(!matchesQuery(hay, 'london paris'));
});

test('distance sorts put routes without a distance last', () => {
  assert.deepEqual(sortRoutes([sydMel, lhrBkk], 'shortest').map((r) => r.slug), ['lhr-to-bkk', 'syd-to-mel']);
  assert.deepEqual(sortRoutes([sydMel, lhrBkk], 'popular').map((r) => r.slug), ['lhr-to-bkk', 'syd-to-mel']);
  assert.deepEqual(sortRoutes([lhrBkk, sydMel], 'az').map((r) => r.slug), ['lhr-to-bkk', 'syd-to-mel']);
});

test('durations format as hours and minutes', () => {
  assert.equal(formatDuration(690), '11h 30m');
  assert.equal(formatDuration(120), '2h');
  assert.equal(formatDuration(45), '45m');
});
