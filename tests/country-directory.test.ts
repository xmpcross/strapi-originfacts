import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  airlinesHref,
  airportsHref,
  buildCountryDirectory,
  countryHref,
  featuredCountries,
  flagEmoji,
  fromRow,
  toRow,
} from '../lib/country-directory';

const input = {
  countries: [
    { code: 'tr', name: 'Turkey', region: 'Asia' as const },
    { code: 'KR', name: 'South Korea', region: 'Asia' as const },
    { code: 'CZ', name: 'Czechia', region: 'Europe' as const },
    { code: 'XX', name: 'Nowhere', region: 'Europe' as const },
  ],
  airports: [
    { iata: 'IST', countryCode: 'TR' },
    { iata: 'SAW', countryCode: 'tr' },
    { iata: 'ICN', countryCode: 'KR' },
    { iata: '', countryCode: 'KR' }, // no IATA: not listed on /airports
    { iata: 'PRG', countryCode: 'CZ' },
  ],
  destinations: [
    { slug: 'turkey', type: 'country' as const, countryCode: 'TR' },
    { slug: 'istanbul', type: 'city' as const, countryCode: 'TR' },
    { slug: 'cappadocia', type: 'region' as const, countryCode: 'TR' },
    { slug: 'south-korea', type: 'country' as const, countryCode: 'KR' },
  ],
  airlines: [
    { country: 'Turkey' },
    { country: 'Republic of Korea' },
    { country: 'Republic of Korea' },
    { country: 'South Korea' },
    { country: 'Czech Republic' },
    { country: 'Atlantis' },
  ],
  originRouteCounts: new Map([
    ['ist', 40],
    ['saw', 2],
    ['icn', 7],
  ]),
  articleCounts: new Map([['TR', 3]]),
};

test('counts are computed per ISO code and rows are A–Z', () => {
  const rows = buildCountryDirectory(input);
  assert.deepEqual(
    rows.map((r) => r.code),
    ['CZ', 'XX', 'KR', 'TR'],
  );
  const tr = rows.find((r) => r.code === 'TR')!;
  assert.equal(tr.airports, 2);
  assert.equal(tr.routes, 42);
  assert.equal(tr.cityGuides, 1); // the region guide is not a city guide
  assert.equal(tr.articles, 3);
  assert.equal(tr.guide, 'turkey');
  assert.equal(tr.region, 'Asia');
  const kr = rows.find((r) => r.code === 'KR')!;
  assert.equal(kr.airports, 1);
  assert.equal(kr.airlines, 3);
  // Two spellings, neither inside the other: no single /airlines search finds all three.
  assert.equal(kr.airlineQuery, undefined);
  const cz = rows.find((r) => r.code === 'CZ')!;
  assert.equal(cz.airlines, 1);
  assert.equal(cz.airlineQuery, 'Czech Republic');
  const xx = rows.find((r) => r.code === 'XX')!;
  assert.deepEqual([xx.airports, xx.airlines, xx.routes, xx.articles], [0, 0, 0, 0]);
  assert.equal(xx.guide, undefined);
});

test('links: guide when one exists, else the country page; filters by name', () => {
  const rows = buildCountryDirectory(input);
  const tr = rows.find((r) => r.code === 'TR')!;
  const xx = rows.find((r) => r.code === 'XX')!;
  assert.equal(countryHref(tr), '/destinations/turkey');
  assert.equal(countryHref(xx), '/countries/xx');
  assert.equal(airportsHref(tr), '/airports?country=Turkey');
  assert.equal(airlinesHref(rows.find((r) => r.code === 'KR')!), null);
  assert.equal(airlinesHref(rows.find((r) => r.code === 'CZ')!), '/airlines?country=Czech%20Republic');
  assert.equal(airlinesHref(tr), '/airlines?country=Turkey');
});

test('featured: most airports per region, countries without airports left out', () => {
  const rows = buildCountryDirectory(input);
  assert.deepEqual(
    featuredCountries(rows, 1).map((r) => r.code),
    ['TR', 'CZ'],
  );
});

test('rows survive the compact tuple round trip', () => {
  for (const r of buildCountryDirectory(input)) assert.deepEqual(fromRow(toRow(r)), r);
});

test('flag emoji only for two-letter codes', () => {
  assert.equal(flagEmoji('jp'), '🇯🇵');
  assert.equal(flagEmoji('JPN'), '');
});

test('no airline link when the search text would also match another country', () => {
  const rows = buildCountryDirectory({
    ...input,
    countries: [
      { code: 'NE', name: 'Niger', region: 'Africa' as const },
      { code: 'NG', name: 'Nigeria', region: 'Africa' as const },
    ],
    airlines: [{ country: 'Niger' }, { country: 'Nigeria' }],
  });
  assert.equal(rows.find((r) => r.code === 'NE')!.airlineQuery, undefined);
  assert.equal(rows.find((r) => r.code === 'NG')!.airlineQuery, 'Nigeria');
});
