import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AIRPORT_TEMPLATE_V2_DEFAULT,
  AIRPORT_TEMPLATE_V2_EXCLUDED,
  airportUsesTemplateV2,
} from '../lib/airport-template-v2';
import { airportGuideV2Faqs } from '../components/airport-v2/faqs';

test('airport v2: the default for every airport unless excluded', () => {
  assert.equal(AIRPORT_TEMPLATE_V2_DEFAULT, true);
  assert.deepEqual([...AIRPORT_TEMPLATE_V2_EXCLUDED], []);
  assert.equal(airportUsesTemplateV2('perth'), true);
  assert.equal(airportUsesTemplateV2('PERTH'), true);
  assert.equal(airportUsesTemplateV2('sydney'), true);
  assert.equal(airportUsesTemplateV2('monkey-mia'), true);
});

test('airport v2 faq: answers restate only the facts passed in', () => {
  const faqs = airportGuideV2Faqs({
    name: 'Perth Airport',
    iata: 'PER',
    icao: 'YPPH',
    city: 'Perth',
    country: 'Australia',
    timezone: 'Australia/Perth',
    coordinates: '-31.930°, 115.960°',
    officialSite: 'https://www.perthairport.com.au/',
    airlines: ['Qantas', 'Singapore Airlines'],
    destinations: ['Singapore'],
    countryCount: 1,
    routeVintage: '21 May 2026',
  });
  const text = faqs.map((f) => `${f.q} ${f.a}`).join(' ');
  assert.match(text, /IATA code is PER and the ICAO code is YPPH/);
  assert.match(text, /route records \(last updated 21 May 2026\) list Qantas and Singapore Airlines/);
  assert.match(text, /not a complete list/);
  // No rule-of-thumb fillers or references to features the page lacks.
  assert.doesNotMatch(text, /two hours|three hours|flight search|refreshed regularly/i);
  assert.equal(new Set(faqs.map((f) => f.q)).size, faqs.length);
});

test('airport v2 faq: missing fields skip their question', () => {
  const faqs = airportGuideV2Faqs({ name: 'Tiny Strip', iata: 'TNY', airlines: [], destinations: [], countryCount: 0 });
  assert.deepEqual(
    faqs.map((f) => f.q),
    ['What are the airport codes for Tiny Strip?'],
  );
  assert.equal(faqs[0].a, 'The IATA code is TNY.');
});
