import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  airportCityPhoto,
  airportV2MetaDescription,
  REVIEWED_CITY_PHOTOS,
  routeCoverage,
  splitCeasedAirlines,
} from '../lib/airport-v2';
import { getCeasedAirline } from '../lib/airline-status';
import { DESCRIPTION_MAX } from '../lib/seo';
import { airportGuideV2Faqs } from '../components/airport-v2/faqs';

test('ceased carriers are split out by airline slug, using the Wikidata snapshot', () => {
  // Sanity: the snapshot has these, and Spirit is inside the recent-date hold.
  assert.ok(getCeasedAirline('silkair'));
  assert.ok(getCeasedAirline('virgin-america'));
  assert.equal(getCeasedAirline('spirit-airlines'), null);

  const { operating, ceased } = splitCeasedAirlines([
    { slug: 'singapore-airlines', name: 'Singapore Airlines', iataCode: 'SQ' },
    { slug: 'silkair', name: 'SilkAir', iataCode: 'MI' },
    { slug: 'spirit-airlines', name: 'Spirit Airlines', iataCode: 'NK' },
    { slug: 'virgin-america', name: 'Virgin America', iataCode: 'VX' },
  ]);
  assert.deepEqual(
    operating.map((a) => a.slug),
    ['singapore-airlines', 'spirit-airlines'],
  );
  assert.deepEqual(
    ceased.map((a) => a.slug),
    ['silkair', 'virgin-america'],
  );
  assert.match(ceased[0].ceased.wikidata, /wikidata\.org\/entity\/Q/);
});

test('ceased carriers: the join is on slug, never on the IATA code', () => {
  // A live carrier holding a recycled code of a ceased one stays listed.
  const { operating, ceased } = splitCeasedAirlines([{ slug: 'some-new-carrier', name: 'New Carrier', iataCode: 'MI' }]);
  assert.equal(operating.length, 1);
  assert.equal(ceased.length, 0);
});

test('airport v2 faq: ceased carriers are left out of the airline answer and named as such', () => {
  const faqs = airportGuideV2Faqs({
    name: 'Changi International Airport',
    iata: 'SIN',
    airlines: ['Singapore Airlines'],
    ceasedAirlines: ['SilkAir'],
    destinations: ['Kuala Lumpur'],
    countryCount: 1,
    routeCount: { tracked: 18, shown: 15 },
  });
  const airlines = faqs.find((f) => f.q.startsWith('Which airlines'))!;
  assert.match(airlines.a, /list Singapore Airlines on routes from SIN\. SilkAir is left out: Wikidata records it as having ceased operations\./);
});

test('route coverage: partial at any count, stronger when only a few routes are tracked', () => {
  const one = routeCoverage({ name: 'Perth Airport', code: 'PER', tracked: 1, shown: 1 });
  assert.equal(one.sparse, true);
  assert.equal(one.headline, '1 route tracked so far');
  assert.equal(one.shownNote, null);
  assert.match(one.caveat, /Only 1 route from PER is in Originfacts’ route records so far — a small sample, not Perth Airport’s full network/);

  const many = routeCoverage({ name: 'Changi', code: 'SIN', tracked: 18, shown: 15 });
  assert.equal(many.sparse, false);
  assert.equal(many.headline, '18 routes tracked so far');
  assert.equal(many.shownNote, '15 shown here');
  assert.match(many.caveat, /not Changi’s full network/);

  // A total lower than what is shown (count failed) never under-reports.
  assert.equal(routeCoverage({ name: 'X', code: 'XXX', tracked: 0, shown: 4 }).tracked, 4);
});

test('airport v2 faq: destination answer says the records are partial and points to the official site', () => {
  const faqs = airportGuideV2Faqs({
    name: 'Perth Airport',
    iata: 'PER',
    officialSite: 'https://www.perthairport.com.au/',
    airlines: ['Singapore Airlines'],
    destinations: ['Singapore'],
    countryCount: 1,
    routeCount: { tracked: 1, shown: 1 },
    routeVintage: '21 May 2026',
  });
  const where = faqs.find((f) => f.q === 'Where can you fly from PER?')!;
  assert.match(where.a, /include only one route from PER so far, to Singapore\. That is a small sample, not Perth Airport’s full network\./);
  assert.match(where.a, /check the airport’s official website \(perthairport\.com\.au\) or the airlines\.$/);
  assert.doesNotMatch(where.a, /1 destination in 1 country/);

  const sin = airportGuideV2Faqs({
    name: 'Changi',
    iata: 'SIN',
    airlines: [],
    destinations: ['Kuala Lumpur', 'Bangkok'],
    countryCount: 2,
    routeCount: { tracked: 18, shown: 15 },
  }).find((f) => f.q === 'Where can you fly from SIN?')!;
  assert.match(sin.a, /include 18 routes from SIN so far; the 15 shown on this page go to 2 destinations in 2 countries/);
  assert.match(sin.a, /not Changi’s full network/);
});

test('v2 meta description: built from codes and location, never from CMS prose', () => {
  const d = airportV2MetaDescription({
    name: 'Perth Airport',
    iata: 'per',
    icao: 'YPPH',
    city: 'Perth',
    country: 'Australia',
    hasRoutes: true,
  });
  assert.equal(
    d,
    'Perth Airport (PER/YPPH) in Perth, Australia: codes, location, airlines and routes we track, and where to check terminals.',
  );
  assert.ok(d.length <= DESCRIPTION_MAX, `${d.length} chars`);

  const sin = airportV2MetaDescription({ name: 'Changi International Airport', iata: 'SIN', icao: 'WSSS', city: 'Singapore', country: 'Singapore', hasRoutes: true });
  assert.match(sin, /in Singapore: /);
  assert.doesNotMatch(sin, /Singapore, Singapore/);
  const long = airportV2MetaDescription({ name: 'Sydney (Kingsford Smith) Airport', iata: 'SYD', icao: 'YSSY', city: 'Sydney', country: 'Australia', hasRoutes: true });
  assert.ok(long.length <= DESCRIPTION_MAX, `${long.length} chars`);
  assert.match(long, /\.$/);

  const thin = airportV2MetaDescription({ name: 'Monkey Mia Airport', iata: 'MJK', hasRoutes: false });
  assert.equal(thin, 'Monkey Mia Airport (MJK): codes, location, and where to check terminals and transport.');
  assert.doesNotMatch(thin, /airlines|routes|ground-transfer/);
});

test('city photo: only reviewed uploads, pinned to the exact file, described as the city', () => {
  const resolve = (p: string) => `https://cms.fxnstudio.com${p}`;
  const reviewed = REVIEWED_CITY_PHOTOS['chiang-mai'];
  const photo = airportCityPhoto(
    { slug: 'chiang-mai', name: 'Chiang Mai', heroImage: { url: reviewed.url, width: 750, height: 400 } },
    resolve,
  );
  assert.ok(photo);
  assert.equal(photo!.src, `https://cms.fxnstudio.com${reviewed.url}`);
  assert.equal(photo!.guideHref, '/destinations/chiang-mai');
  assert.doesNotMatch(photo!.alt, /airport/i);

  // A generated hero for a city that is not on the list: no photo.
  assert.equal(
    airportCityPhoto({ slug: 'perth', name: 'Perth', heroImage: { url: '/uploads/perth_hero_f2db9ce10a.jpg', width: 1024, height: 576 } }, resolve),
    null,
  );
  // A reviewed city whose image has since been replaced: no photo until re-reviewed.
  assert.equal(
    airportCityPhoto({ slug: 'chiang-mai', name: 'Chiang Mai', heroImage: { url: '/uploads/other.jpg', width: 1024, height: 576 } }, resolve),
    null,
  );
  assert.equal(airportCityPhoto(null, resolve), null);
});
