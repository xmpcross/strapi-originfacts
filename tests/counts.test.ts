import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spelledCount, capitalise } from '../lib/format';
import {
  airportFaqs,
  airportIntro,
  airlineFaqs,
  summariseRoutes,
  trackedCount,
  sampleComplete,
  type RouteSummary,
} from '../lib/entity-seo';

const sampleSummary = (overrides: Partial<RouteSummary> = {}): RouteSummary => ({
  destinationCount: 15,
  countryCount: 4,
  carrierCount: 3,
  destinationNames: ['Melbourne', 'Brisbane', 'Perth'],
  countryNames: ['Australia'],
  carriers: [{ name: 'Qantas', slug: 'qantas' }],
  ...overrides,
});

/* ----- the featured-snippet bug: FAQ answers must state dataset counts ----- */

test('airport country FAQ states the dataset airport count, not the rendered sample', () => {
  const airport = { id: 1, iata: 'SYD', name: 'Sydney Airport', country: 'Australia' } as never;
  // Dataset says 130 airports in the country; the page renders 9 cards.
  const faqs = airportFaqs(airport, undefined, { countryAirportCount: 130 });
  const answer = faqs.find((f) => f.q.includes('other airports'))?.a ?? '';
  assert.ok(answer.includes('129 other airports'), answer); // 130 minus this one
  assert.ok(!/\b9 other airports/.test(answer), answer);
  // The nearby strip is a sample — the answer must not claim it shows all.
  assert.ok(!answer.includes('links to each of them'), answer);
});

test('destination-count claims use the dataset routeTotal over the capped sample', () => {
  const s = sampleSummary({ routeTotal: 87 });
  assert.equal(trackedCount(s), 87);
  const airport = { id: 1, iata: 'SYD', name: 'Sydney Airport', city: 'Sydney', country: 'Australia' } as never;
  const intro = airportIntro(airport, s);
  assert.ok(intro.includes('87 destinations'), intro);
  assert.ok(!intro.includes('15 destinations'), intro);
});

test('sample-derived tallies are dropped when the sample is incomplete', () => {
  const capped = sampleSummary({ routeTotal: 87 });
  assert.equal(sampleComplete(capped), false);
  const airline = { id: 1, name: 'Qantas', slug: 'qantas', iataCode: 'QF' } as never;
  const faqs = airlineFaqs(airline, capped, undefined);
  const network = faqs.map((f) => f.a).join(' ');
  // countryCount (4) came from 15 sampled routes — must not be asserted.
  assert.ok(!network.includes('across 4 countries'), network);
  assert.ok(network.includes('87 destinations'), network);
});

test('complete samples keep their tallies', () => {
  const complete = sampleSummary({ destinationCount: 12, routeTotal: 12 });
  assert.equal(sampleComplete(complete), true);
  assert.equal(trackedCount(complete), 12);
});

test('no routeTotal means the sample is all we track — counts still consistent', () => {
  const s = sampleSummary();
  assert.equal(trackedCount(s), 15);
  assert.equal(sampleComplete(s), true);
});

/* ----- stat blocks and prose agree: same number, spelled vs numeric ----- */

test('spelledCount matches the numerals stat blocks display', () => {
  assert.equal(spelledCount(6), 'six'); // "Regions 6" ↔ "six continental groupings"
  assert.equal(capitalise(spelledCount(6)), 'Six');
  assert.equal(spelledCount(12), 'twelve');
  assert.equal(spelledCount(58), '58');
  assert.equal(spelledCount(3602), '3,602');
});

test('region blurb text derives from the same count as the stat value', () => {
  // Mirrors the SummaryCard construction in both directories: the value and
  // the blurb must come from ONE number.
  const regionCount = 6;
  const value = regionCount.toString();
  const blurb = `${capitalise(spelledCount(regionCount))} continental groupings, each spanning dozens of countries and time zones.`;
  assert.equal(value, '6');
  assert.ok(blurb.startsWith('Six '));
  // If the count ever changes, both change together:
  const other = 7;
  assert.ok(`${capitalise(spelledCount(other))} continental groupings`.startsWith('Seven'));
});
