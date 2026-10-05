import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { ROUTE_TEMPLATE_V2_DEFAULT, ROUTE_TEMPLATE_V2_EXCLUDED, routeUsesTemplateV2 } from '../lib/route-template-v2';

// lib/route-v2 reaches facts-view, which reaches a React component importing a
// CSS module; Node cannot load CSS, so stub it out (Next handles it in the build).
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'commonjs', source: 'module.exports = {};', shortCircuit: true };
    return nextLoad(url, context);
  },
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const v2 = require('../lib/route-v2') as typeof import('../lib/route-v2');

test('route v2: default for every route, with an (empty) exclusion set for rollback', () => {
  assert.equal(ROUTE_TEMPLATE_V2_DEFAULT, true);
  assert.deepEqual([...ROUTE_TEMPLATE_V2_EXCLUDED], []);
  for (const slug of ['bah-to-doh', 'BAH-TO-DOH', 'doh-to-bah', 'syd-to-mel', 'lhr-to-jfk']) {
    assert.equal(routeUsesTemplateV2(slug), true, slug);
  }
});

test('route v2 airline highlights: official fact-file fields only', () => {
  const qr = v2.airlineHighlights('qatar-airways');
  const byId = Object.fromEntries(qr.map((h) => [h.id, h]));
  // Qatar Airways' carry-on module is still pending: nothing to show.
  assert.equal(byId['carryon-size'].values.length, 0);
  // Its check-in module is official; every value carries its page and date.
  for (const h of qr) for (const v of h.values) assert.ok(v.sourceUrl.startsWith('https://') && /^\d{4}-\d{2}-\d{2}/.test(v.verifiedAt));
  // Gulf Air has no official fields yet.
  assert.ok(v2.airlineHighlights('gulf-air').every((h) => h.values.length === 0));
  // An airline without a fact file is all gaps, not an error.
  assert.ok(v2.airlineHighlights('no-such-airline').every((h) => h.values.length === 0));
});

test('route v2 time difference: from IANA zones, labelled both ways', () => {
  const at = new Date('2026-10-05T12:00:00Z');
  const bah = v2.zoneInfo('Asia/Bahrain', at);
  const doh = v2.zoneInfo('Asia/Qatar', at);
  assert.deepEqual(v2.timeDifference(bah, doh), { minutes: 0, text: 'None' });
  const syd = v2.zoneInfo('Australia/Sydney', at); // AEDT, UTC+11
  const per = v2.zoneInfo('Australia/Perth', at); // UTC+8
  assert.deepEqual(v2.timeDifference(syd, per), { minutes: -180, text: '−3h' });
  const del = v2.zoneInfo('Asia/Kolkata', at);
  assert.deepEqual(v2.timeDifference(bah, del), { minutes: 150, text: '+2h 30m' });
  assert.equal(v2.timeDifference(bah, v2.zoneInfo(null)), null);
});

test('route v2 distance: record checked against airport coordinates', () => {
  const bah = { latitude: 26.27, longitude: 50.63 };
  const doh = { latitude: 25.27, longitude: 51.56 };
  assert.deepEqual(v2.distanceCheck(145, bah, doh), { computedKm: 145, agrees: true });
  assert.equal(v2.distanceCheck(400, bah, doh).agrees, false);
  assert.deepEqual(v2.distanceCheck(145, bah, {}), { computedKm: null, agrees: false });
});

test('route v2 faq (no guide): restates only the figures passed in', () => {
  const at = new Date('2026-10-05T12:00:00Z');
  const faqs = v2.routeV2Faqs({
    fromName: 'Sydney',
    toName: 'Perth',
    originIata: 'SYD',
    destinationIata: 'PER',
    originAirport: 'Sydney Airport',
    destinationAirport: 'Perth Airport',
    carriers: ['Qantas', 'Virgin Australia'],
    distanceKm: 3284,
    distanceIsGreatCircle: true,
    estimateMinutes: 300,
    from: v2.zoneInfo('Australia/Sydney', at),
    to: v2.zoneInfo('Australia/Perth', at),
  });
  const text = faqs.map((f) => `${f.q} ${f.a}`).join(' ');
  assert.match(text, /route record for SYD–PER lists Qantas and Virgin Australia/);
  assert.match(text, /About 3,284 km, the great-circle distance/);
  assert.match(text, /estimates about 5h nonstop/);
  assert.match(text, /Perth is 3h behind Sydney today/);
  assert.doesNotMatch(text, /cheap|fastest|best|daily|flexible/i);

  const sparse = v2.routeV2Faqs({
    fromName: 'A',
    toName: 'B',
    originIata: 'AAA',
    destinationIata: 'BBB',
    originAirport: 'A Airport',
    destinationAirport: 'B Airport',
    carriers: [],
    distanceKm: null,
    distanceIsGreatCircle: false,
    estimateMinutes: null,
    from: null,
    to: null,
  });
  assert.deepEqual(sparse, []);
});

test('route v2 airline highlights: market-split check-in picks the rule for the route', () => {
  const other = v2.airlineHighlights('qatar-airways').find((h) => h.id === 'online-checkin')!;
  assert.equal(other.values.length, 1);
  assert.equal(other.values[0].qualifier, 'Flights not to or from the US');
  assert.match(other.values[0].value, /48 hours to 90 minutes/);
  const us = v2.airlineHighlights('qatar-airways', { usRoute: true }).find((h) => h.id === 'online-checkin')!;
  assert.equal(us.values[0].qualifier, 'Flights to or from the US');
});

test('route v2 highlight tiles stay in step with the airline v2 glance tiles', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GLANCE_TILES, glanceValues, loadModules } = require('../components/airline-v2/facts-view') as typeof import('../components/airline-v2/facts-view');
  const { getAirlineFacts } = require('../lib/airline-facts') as typeof import('../lib/airline-facts');
  for (const slug of ['qantas', 'american-airlines', 'kuwait-airways', 'gulf-air']) {
    const modules = loadModules(getAirlineFacts(slug));
    for (const h of v2.airlineHighlights(slug)) {
      const tile = GLANCE_TILES.find((t) => t.id === h.id)!;
      const expected = glanceValues(modules, tile).map((g) => g.field.value);
      if (expected.length) assert.deepEqual(h.values.map((v) => v.value), expected, `${slug} ${h.id}`);
    }
  }
});

test('route v2 airport facts: OurAirports and Wikidata values only, with their dates', () => {
  const doh = v2.routeAirportFacts('DOH')!;
  assert.ok(doh);
  assert.equal(doh.typeLabel, 'Large airport');
  assert.ok(doh.runwayCount >= 1 && doh.longestRunway && doh.longestRunway.metres > 3000);
  assert.deepEqual(doh.opened, { text: '30 April 2014', official: true });
  assert.ok(doh.operators.includes('Qatar Airways'));
  assert.match(doh.ourairportsRetrieved ?? '', /^\d{4}-\d{2}-\d{2}$/);
  assert.match(doh.wikidataRetrieved ?? '', /^\d{4}-\d{2}-\d{2}$/);
  // Unknown airport: nothing, not an empty card.
  assert.equal(v2.routeAirportFacts('ZZZ'), null);
});

test('route v2 climate: NASA POWER months, current month called out', () => {
  const c = v2.routeClimate('DOH', new Date('2026-10-05T12:00:00Z'));
  if (!c) return; // DOH lacks a climate snapshot: the section simply does not render
  assert.equal(c.months.length, 12);
  assert.equal(c.current, 9);
  assert.equal(c.months[9].month, 'Oct');
  assert.ok(c.months.every((m) => m.hi >= m.lo));
  assert.equal(v2.routeClimate('ZZZ'), null);
});

test('route v2 cheapest-month FAQ answer names no price or currency', () => {
  const a = v2.cheapestMonthAnswer({ monthLabel: 'November 2026', fetched: '5 Oct 2026, 12:00 UTC', flight: 'Qatar Airways QR 1103' });
  assert.match(a, /November 2026, on Qatar Airways QR 1103/);
  assert.doesNotMatch(a, /US\$|A\$|£|€|\d+ ?(USD|AUD|GBP|EUR)/);
});

test('route fares: price map keyed like the table rows', () => {
  const { farePrices, flightKey } = require('../lib/route-fares') as typeof import('../lib/route-fares');
  const prices = farePrices({
    currency: 'AUD',
    fetchedAt: '2026-10-05T00:00:00Z',
    months: [{ month: '2026-11', price: 141, airline: 'QR', flightNumber: '1103', departureAt: '2026-11-02T10:00:00+03:00' }],
    flights: [{ airline: 'QR', flightNumber: '1103', departs: '10:00', durationMinutes: 55, datesSeen: 3, lowestPrice: 141 }],
    airlines: ['QR'],
    duration: { min: 55, max: 55 },
    fareCount: 3,
  });
  assert.deepEqual(prices, { currency: 'AUD', fetchedAt: '2026-10-05T00:00:00Z', months: { '2026-11': 141 }, flights: { QR1103: 141 } });
  assert.equal(flightKey({ airline: 'GF', flightNumber: '526' }), 'GF526');
});
