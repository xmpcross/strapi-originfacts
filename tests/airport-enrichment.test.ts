import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  airportNamesMatch,
  compass16,
  filterFareEvidence,
  haversineKm,
  indexOurAirports,
  joinOurAirports,
  monthlyNormals,
  parseCsv,
  pickOpening,
  pickPatronage,
  pickWikidataItem,
  runwaysFor,
} from '../lib/airport-enrichment-joins.mjs';
import { enrichmentMetaFacts, formatOpened, formatPassengers, resolveAirlineCode, type SiteAirline } from '../lib/airport-enrichment';
import { enrichmentFaqs } from '../components/airport-v2/enrichment-faqs';
import { airportGuideV2Faqs } from '../components/airport-v2/faqs';
import { airportV2MetaDescription } from '../lib/airport-v2';
import { DESCRIPTION_MAX } from '../lib/seo';

/* OurAirports rows as airports.csv spells them (October 2026). */
const CSV = `"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft","continent","iso_country","iso_region","municipality","scheduled_service","icao_code","iata_code","gps_code","local_code","home_link","wikipedia_link","keywords"
2223,"EIDW","large_airport","Dublin Airport",53.421299,-6.27007,242,"EU","IE","IE-D","Dublin","yes","EIDW","DUB","EIDW",,"https://www.dublinairport.com/",,
1,"ZYCC","large_airport","Changchun Longjia International Airport",43.996201,125.684998,706,"AS","CN","CN-22","Changchun","yes","ZYCC","CGQ","ZYCC",,,,
2,"SBSO","small_airport","Adolino Bedin Regional Airport",-12.479177,-55.672341,1266,"SA","BR","BR-MT","Sorriso","yes","SBSO","SMT","SBSO",,,,
3,"XX01","small_airport","Ziguinchor Airport",12.5556,-16.281799,75,"AF","SN","SN-ZG","Ziguinchor","yes",,"ZIG",,,,,
4,"XX02","closed","Ziguinchor Old Airport",12.56,-16.28,75,"AF","SN","SN-ZG","Ziguinchor","no",,"ZIG",,,,,
`;
const index = indexOurAirports(parseCsv(CSV));

test('ourairports join: ICAO is the identity', () => {
  const j = joinOurAirports({ iata: 'DUB', icao: 'EIDW', name: 'Dublin Airport', countryCode: 'IE', latitude: 53.42, longitude: -6.27 }, index);
  assert.ok(j.row);
  assert.equal(j.row!.ident, 'EIDW');
  assert.equal((j as { joinedBy: string }).joinedBy, 'icao');
});

test('ourairports join: ICAO + IATA agreeing wins over rounded record coordinates', () => {
  // The record puts CGQ at the city, 39 km from the airport.
  const j = joinOurAirports({ iata: 'CGQ', icao: 'ZYCC', name: 'Changchun Longjia International Airport', countryCode: 'CN', latitude: 43.9, longitude: 125.22 }, index);
  assert.equal(j.row?.iata_code, 'CGQ');
});

test('ourairports join: a mistyped ICAO is rejected when the IATA and coordinates disagree', () => {
  // Sun Moon Lake (Taiwan) carries Sorriso's (Brazil) codes on the record.
  const j = joinOurAirports({ iata: 'SMT', icao: 'SBSO', name: 'Sun Moon Lake', countryCode: 'TW', latitude: 23.88, longitude: 120.93 }, index);
  assert.equal(j.row, null);
  assert.equal((j as { reason: string }).reason, 'icao-coordinates-disagree');
});

test('ourairports join: an unknown ICAO falls back to IATA only with name, country and coordinates agreeing', () => {
  // Superseded code on the record (no coordinates): no join.
  assert.equal(joinOurAirports({ iata: 'DUB', icao: 'EIXX', name: 'Dublin Airport', countryCode: 'IE' }, index).row, null);
  const j = joinOurAirports({ iata: 'DUB', icao: 'EIXX', name: 'Dublin Airport', countryCode: 'IE', latitude: 53.42, longitude: -6.27 }, index);
  assert.equal(j.row?.ident, 'EIDW');
  assert.equal((j as { supersededIcao?: string }).supersededIcao, 'EIXX');
  // Coordinates elsewhere: no join.
  assert.equal(joinOurAirports({ iata: 'DUB', icao: 'EIXX', name: 'Dublin Airport', countryCode: 'IE', latitude: 52, longitude: -8 }, index).row, null);
});

test('ourairports join: IATA only with country and name agreeing, closed rows ignored', () => {
  const ok = joinOurAirports({ iata: 'ZIG', name: 'Ziguinchor Airport', countryCode: 'SN' }, index);
  assert.equal(ok.row?.id, '3');
  assert.equal((ok as { joinedBy: string }).joinedBy, 'iata+name+country');
  assert.equal(joinOurAirports({ iata: 'ZIG', name: 'Ziguinchor Airport', countryCode: 'GM' }, index).row, null);
  assert.equal(joinOurAirports({ iata: 'ZIG', name: 'Cap Skirring Airport', countryCode: 'SN' }, index).row, null);
  assert.equal(joinOurAirports({ iata: 'ZIG', name: 'Ziguinchor Airport' }, index).row, null);
});

test('airport names: generic words alone are not a match', () => {
  assert.equal(airportNamesMatch('Dublin Airport', 'Dublin International Airport'), true);
  assert.equal(airportNamesMatch('International Airport', 'Regional International Airport'), false);
});

test('runways: helipads dropped, closed counted, longest first', () => {
  const rows = parseCsv(`"id","airport_ref","airport_ident","length_ft","width_ft","surface","lighted","closed","le_ident","he_ident"
1,2223,"EIDW",6798,200,"ASP",1,0,"16","34"
2,2223,"EIDW",10200,148,"CON",1,0,"10R","28L"
3,2223,"EIDW",4500,100,"ASP",0,1,"11","29"
4,2223,"EIDW",60,60,"CON",0,0,"H1",
`);
  const { runways, closedCount } = runwaysFor(rows);
  assert.deepEqual(runways.map((r) => r.ident), ['10R/28L', '16/34']);
  assert.equal(runways[0].surface, 'concrete');
  assert.equal(closedCount, 1);
});

test('wikidata: accepted only on ICAO match with agreeing IATA, exactly one item', () => {
  const dub = { qid: 'Q178021', icao: ['EIDW'], iata: ['DUB'] };
  assert.equal(pickWikidataItem({ iata: 'DUB', icao: 'EIDW' }, [dub])?.qid, 'Q178021');
  assert.equal(pickWikidataItem({ iata: 'DUB', icao: 'EIDW' }, [{ ...dub, iata: ['XYZ'] }]), null);
  assert.equal(pickWikidataItem({ iata: 'DUB', icao: 'EIDW' }, [{ ...dub, dissolved: true }]), null);
  assert.equal(pickWikidataItem({ iata: 'DUB', icao: 'EIDW' }, [dub, { qid: 'Q2', icao: ['EIDW'], iata: [] }]), null);
  assert.equal(pickWikidataItem({ iata: 'DUB', icao: 'EIDW' }, [{ qid: 'Q3', icao: ['EGLL'], iata: ['DUB'] }]), null);
});

test('wikidata opening: precision kept, official opening preferred, disagreement dropped', () => {
  const o = pickOpening([
    { time: '1940-01-01T00:00:00Z', precision: 9, prop: 'P571' },
    { time: '1940-01-19T00:00:00Z', precision: 11, prop: 'P1619' },
  ]);
  assert.deepEqual(o, { value: '1940-01-19', precision: 'day', prop: 'P1619' });
  assert.equal(formatOpened(o as never), '19 January 1940');
  const y = pickOpening([{ time: '+1932-01-01T00:00:00Z', precision: 9, prop: 'P1619' }]);
  assert.equal(formatOpened(y as never), '1932');
  assert.equal(pickOpening([
    { time: '1919-01-01T00:00:00Z', precision: 9, prop: 'P571' },
    { time: '1946-01-01T00:00:00Z', precision: 9, prop: 'P571' },
  ]), null);
});

test('wikidata patronage: latest year, scoped statements skipped, conflicting ties dropped', () => {
  const p = pickPatronage([
    { value: 30_000_000, time: '2019-01-01T00:00:00Z' },
    { value: 32_294_167, time: '2023-01-01T00:00:00Z', refUrl: 'https://example.org/stats' },
    { value: 99, time: '2024-01-01T00:00:00Z', scoped: true },
  ]);
  assert.deepEqual(p, { value: 32_294_167, year: 2023, refUrl: 'https://example.org/stats' });
  assert.equal(formatPassengers(p!.value), '32.3 million');
  assert.equal(pickPatronage([
    { value: 1, time: '2024-01-01T00:00:00Z' },
    { value: 2, time: '2024-01-01T00:00:00Z' },
  ]), null);
});

test('climate: monthly normals from daily values, fill values skipped', () => {
  const tmax: Record<string, number> = {};
  const tmin: Record<string, number> = {};
  const pr: Record<string, number> = {};
  for (let d = 1; d <= 31; d++) {
    const k = `202401${String(d).padStart(2, '0')}`;
    tmax[k] = d === 5 ? -999 : 10;
    tmin[k] = 2;
    pr[k] = 1;
  }
  const m = monthlyNormals(tmax, tmin, pr);
  assert.deepEqual(m[0], { month: 1, hiC: 10, loC: 2, precipMm: 31 });
  assert.equal(m[1].hiC, null);
});

test('geometry: distance and compass', () => {
  assert.ok(Math.abs(haversineKm(53.4213, -6.27007, 53.3497, -6.2603) - 8) < 0.5);
  assert.equal(compass16(0), 'N');
  assert.equal(compass16(350), 'N');
  assert.equal(compass16(200), 'SSW');
});

/* Site airlines as Strapi returns them. */
const EI: SiteAirline = { slug: 'aer-lingus', name: 'Aer Lingus', iataCode: 'EI', country: 'Ireland' };
const FR_WRONG: SiteAirline = { slug: 'some-other-fr', name: 'Freedom Air', iataCode: 'FR', country: 'Ireland' };
const ADRIA: SiteAirline = { slug: 'adria-airways', name: 'Adria Airways', iataCode: 'JP', country: 'Slovenia' };

test('airline identity: a code resolves only with a matching name, current holder and no cessation', () => {
  assert.equal(resolveAirlineCode('EI', 'Aer Lingus', [EI])?.slug, 'aer-lingus');
  // Same code, different carrier name: never linked by code alone.
  assert.equal(resolveAirlineCode('EI', 'Eirjet', [EI]), null);
  // Duffel says FR is Ryanair; a CMS airline holding FR under another name is not it.
  assert.equal(resolveAirlineCode('FR', 'Ryanair', [FR_WRONG]), null);
  // Sourced cessation (Wikidata snapshot): not linked.
  assert.equal(resolveAirlineCode('JP', 'Adria Airways', [ADRIA]), null);
  // No source name: nothing to check against.
  assert.equal(resolveAirlineCode('EI', null, [EI]), null);
});

const RUNWAYS = [
  { ident: '10R/28L', lengthFt: 10200, widthFt: 148, surface: 'concrete', surfaceRaw: 'CON', lighted: true },
  { ident: '16/34', lengthFt: 6798, widthFt: 200, surface: 'asphalt', surfaceRaw: 'ASP', lighted: true },
];

test('enrichment faq: questions follow the data, answers name the dataset', () => {
  const full = enrichmentFaqs({
    name: 'Dublin Airport',
    iata: 'DUB',
    runways: RUNWAYS,
    opened: { value: '1940-01-19', precision: 'day', prop: 'P1619' },
    operators: ['DAA Public Limited Company'],
    owners: ['Government of Ireland'],
    cityCentre: { name: 'Dublin', km: 8.1, compass: 'N' },
    fares: { destinations: 98, countries: 30, topCountries: [{ country: 'Spain', count: 20 }, { country: 'Italy', count: 9 }], retrieved: '5 Oct 2026' },
    max: 10,
  });
  const text = full.map((f) => `${f.q} ${f.a}`).join(' ');
  assert.match(text, /OurAirports lists 2 open runways at DUB: 10R\/28L \(3,109 m \(10,200 ft\), concrete\)/);
  assert.match(text, /Wikidata gives 19 January 1940 as its official opening date/);
  assert.match(text, /operated by DAA Public Limited Company, owned by Government of Ireland/);
  assert.match(text, /8\.1 km north of Dublin city centre in a straight line/);
  assert.match(text, /98 destinations in 30 countries, the most in Spain \(20\) and Italy \(9\)/);
  assert.match(text, /not a complete or live schedule/);
  assert.doesNotMatch(text, /passengers|hub|weather|elevation/i);

  // A small airport with only a runway gets only the runway question.
  const small = enrichmentFaqs({ name: 'Tiny Strip', iata: 'TNY', runways: [RUNWAYS[1]] });
  assert.deepEqual(small.map((f) => f.q), ['How many runways does Tiny Strip have?']);
  assert.match(small[0].a, /one open runway/);
  assert.deepEqual(enrichmentFaqs({ name: 'Nothing Known', iata: 'NKN' }), []);
  assert.equal(full.length <= 10, true);
  assert.equal(enrichmentFaqs({ name: 'Dublin Airport', iata: 'DUB', runways: RUNWAYS, elevationFt: 242, cityCentre: { name: 'Dublin', km: 8, compass: 'N' }, max: 2 }).length, 2);
});

test('enrichment faq: merged after the core questions without duplicates', () => {
  const extra = enrichmentFaqs({ name: 'Dublin Airport', iata: 'DUB', runways: RUNWAYS, elevationFt: 242 });
  const faqs = airportGuideV2Faqs({ name: 'Dublin Airport', iata: 'DUB', airlines: [], destinations: [], countryCount: 0 }, [...extra, extra[0]]);
  assert.equal(faqs[0].q, 'What are the airport codes for Dublin Airport?');
  assert.equal(new Set(faqs.map((f) => f.q)).size, faqs.length);
  assert.match(faqs.map((f) => f.a).join(' '), /74 m \(242 ft\) above sea level/);
});

test('meta description: one or two distinctive facts when available, within the limit', () => {
  const facts = enrichmentMetaFacts({
    oa: { runways: RUNWAYS } as never,
    wd: { opened: { value: '1940', precision: 'year', prop: 'P1619' } } as never,
    fares: null,
    climate: null,
    computed: null,
  });
  assert.deepEqual(facts, ['2 runways', 'opened 1940']);
  const d = airportV2MetaDescription({
    name: 'Dublin Airport',
    iata: 'DUB',
    icao: 'EIDW',
    city: 'Dublin',
    country: 'Ireland',
    hasRoutes: false,
    facts,
    covers: { runways: true, climate: true, fares: true },
  });
  assert.equal(d, 'Dublin Airport (DUB/EIDW) in Dublin, Ireland: 2 runways, opened 1940. Codes, location, runways, climate and nonstop destinations.');
  assert.ok(d.length <= DESCRIPTION_MAX);
  const long = airportV2MetaDescription({
    name: 'Hartsfield–Jackson Atlanta International Airport',
    iata: 'ATL',
    icao: 'KATL',
    city: 'Atlanta',
    country: 'United States',
    hasRoutes: true,
    facts: ['5 runways', 'opened 1926'],
    covers: { runways: true, climate: true, fares: true },
  });
  assert.ok(long.length <= DESCRIPTION_MAX, `${long.length}: ${long}`);
  assert.match(long, /5 runways/);
});

test('fares: a lone fare on an airline from neither country is excluded, bases abroad are kept', () => {
  const home: Record<string, string> = { AA: 'United States', U2: 'United Kingdom', TO: 'France' };
  const { kept, excluded } = filterFareEvidence(
    [
      { code: 'SCL', name: 'Santiago', cc: 'CL', country: 'Chile', airlines: ['AA'] },
      { code: 'NCE', name: 'Nice', cc: 'FR', country: 'France', airlines: ['U2'] },
      { code: 'BOD', name: 'Bordeaux', cc: 'FR', country: 'France', airlines: ['U2', 'TO'] },
      { code: 'XXX', name: 'Unknown home', cc: 'ES', country: 'Spain', airlines: ['ZZ'] },
    ],
    { originCountry: 'France', homeOf: (c) => home[c] ?? null },
  );
  assert.deepEqual(kept.map((d) => d.code), ['NCE', 'BOD', 'XXX']);
  assert.deepEqual(excluded.map((x) => `${x.code}:${x.airline}`), ['SCL:AA']);
});
