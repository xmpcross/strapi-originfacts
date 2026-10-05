import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  carrierCodeMismatch,
  carrierOperatesRoute,
  judgeRouteCarrier,
  normCountry,
  operableCarriers,
  sameCarrierName,
  type RouteCarrier,
} from '../lib/route-carriers';

// Carrier and airport values as they come back from Strapi (October 2026).
const c = (slug: string, name: string, iataCode: string, country: string): RouteCarrier => ({ slug, name, iataCode, country });
const QF = c('qantas', 'Qantas', 'QF', 'Australia');
const JQ = c('jetstar', 'Jetstar', 'JQ', 'Australia');
const NZ = c('air-new-zealand', 'Air New Zealand', 'NZ', 'New Zealand');
const AA = c('american-airlines', 'American Airlines', 'AA', 'United States');
const LA = c('latam-airlines', 'LATAM Airlines', 'LA', 'Chile');
const DJ = c('air-djibouti', 'Air Djibouti', 'DJ', 'Djibouti');
const US = c('silk-avia', 'Silk Avia', 'US', 'Uzbekistan');
const AC = c('air-canada', 'Air Canada', 'AC', 'Canada');
const AF = c('air-france', 'Air France', 'AF', 'France');
const WB = c('rwandair', 'RwandAir', 'WB', 'Rwanda');
const SN = c('brussels-airlines', 'Brussels Airlines', 'SN', 'Belgium');
const CY = c('cyprus-airways', 'Cyprus Airways', 'CY', 'Cyprus');
const CA = c('air-china', 'Air China', 'CA', "People's Republic of China");
const NH = c('all-nippon-airways', 'All Nippon Airways', 'NH', 'Japan');

const ap = (iata: string, country: string, countryCode: string) => ({ iata, country, countryCode });
const SYD = ap('SYD', 'Australia', 'AU');
const MEL = ap('MEL', 'Australia', 'AU');
const AKL = ap('AKL', 'New Zealand', 'NZ');
const KGL = ap('KGL', 'Rwanda', 'RW');
const EBB = ap('EBB', 'Uganda', 'UG');
const LHR = ap('LHR', 'United Kingdom', 'GB');
const JFK = ap('JFK', 'United States', 'US');
const PEK = ap('PEK', 'China', 'CN');
const PVG = ap('PVG', 'China', 'CN');
const LIM = ap('LIM', 'Peru', 'PE');
const CUZ = ap('CUZ', 'Peru', 'PE');

const slugs = (xs: RouteCarrier[]) => xs.map((x) => x.slug);

test('Kigali–Entebbe drops Air Canada and Air France (codeshare-only) and Silk Avia', () => {
  const route = { origin: KGL, destination: EBB, carriers: [AC, AF, SN, US, WB] };
  assert.deepEqual(judgeRouteCarrier(route, AC), { keep: false, reason: 'codeshare-only' });
  assert.deepEqual(judgeRouteCarrier(route, AF), { keep: false, reason: 'codeshare-only' });
  assert.deepEqual(judgeRouteCarrier(route, US), { keep: false, reason: 'network-elsewhere' });
  assert.deepEqual(slugs(operableCarriers(route)), ['brussels-airlines', 'rwandair']);
});

test('Auckland–Sydney drops Air Djibouti (DJ was Virgin Blue) but keeps Qantas, Air NZ, Jetstar, LATAM', () => {
  const route = { origin: AKL, destination: SYD, carriers: [AA, DJ, JQ, LA, NZ, QF] };
  assert.deepEqual(judgeRouteCarrier(route, DJ), { keep: false, reason: 'network-elsewhere' });
  // AA is a QF codeshare here; QF is listed only as a codeshare too, but Sydney is home.
  assert.deepEqual(judgeRouteCarrier(route, AA), { keep: false, reason: 'codeshare-only' });
  assert.deepEqual(slugs(operableCarriers(route)), ['jetstar', 'latam-airlines', 'air-new-zealand', 'qantas']);
});

test('Sydney–Melbourne keeps only Australian carriers', () => {
  const route = { origin: SYD, destination: MEL, carriers: [AA, DJ, JQ, QF, US] };
  assert.deepEqual(slugs(operableCarriers(route)), ['jetstar', 'qantas']);
  assert.equal(carrierOperatesRoute(route, 'silk-avia'), false);
  assert.equal(carrierOperatesRoute(route, 'qantas'), true);
});

test('code held by someone else today (Duffel): Cyprus Airways on Heathrow–JFK', () => {
  const route = { origin: LHR, destination: JFK, carriers: [AA, CY] };
  assert.deepEqual(judgeRouteCarrier(route, CY), { keep: false, reason: 'code-reassigned' });
  assert.deepEqual(judgeRouteCarrier(route, AA), { keep: true });
});

test('Chinese carriers stay on Chinese domestic routes despite the CMS country spelling', () => {
  const route = { origin: PEK, destination: PVG, carriers: [CA, NH] };
  assert.deepEqual(slugs(operableCarriers(route)), ['air-china']);
  assert.deepEqual(judgeRouteCarrier(route, NH), { keep: false, reason: 'foreign-domestic' });
});

test('LATAM keeps Peruvian domestic flying (LATAM Perú flies as LA)', () => {
  assert.deepEqual(judgeRouteCarrier({ origin: LIM, destination: CUZ, carriers: [LA] }, LA), { keep: true });
});

test('missing evidence keeps the carrier', () => {
  const unknown = c('mystery-air', 'Mystery Air', '0Z', 'Atlantis');
  assert.deepEqual(judgeRouteCarrier({ origin: SYD, destination: AKL, carriers: [unknown] }, unknown), { keep: true });
  const noCountry = { slug: 'qantas', name: 'Qantas', iataCode: 'QF' };
  assert.deepEqual(judgeRouteCarrier({ origin: KGL, destination: EBB, carriers: [noCountry] }, noCountry), { keep: true });
  assert.deepEqual(operableCarriers({ carriers: [QF] }), [QF]);
});

test('ceased carriers drop; route date is respected', () => {
  const vx = c('virgin-america', 'Virgin America', 'VX', 'United States');
  const route = { origin: JFK, destination: ap('LAX', 'United States', 'US'), carriers: [vx] };
  assert.deepEqual(judgeRouteCarrier({ ...route, createdAt: '2026-04-22T00:00:00Z' }, vx), { keep: false, reason: 'ceased' });
  assert.equal(judgeRouteCarrier({ ...route, createdAt: '2010-01-01T00:00:00Z' }, vx).keep, true);
});

test('name and country matching', () => {
  assert.ok(sameCarrierName('ANA', 'All Nippon Airways'));
  assert.ok(sameCarrierName('KLM', 'KLM Royal Dutch Airlines'));
  assert.ok(sameCarrierName('EgyptAir', 'Egyptair'));
  assert.ok(!sameCarrierName('Charlie Airways', 'Cyprus Airways'));
  assert.ok(!sameCarrierName('Go First', 'Guyane Express Fly'));
  assert.equal(normCountry("People's Republic of China"), 'china');
  assert.equal(normCountry('Republic of Korea'), normCountry('South Korea'));
});

test('carrier-level identity: code-keyed network data is withheld from the wrong holder', () => {
  assert.equal(carrierCodeMismatch(DJ), 'network-elsewhere');
  assert.equal(carrierCodeMismatch(US), 'network-elsewhere');
  assert.equal(carrierCodeMismatch(CY), 'code-reassigned');
  assert.equal(carrierCodeMismatch(QF), null);
  assert.equal(carrierCodeMismatch(NH), null);
  assert.equal(carrierCodeMismatch(c('japan-airlines', 'Japan Airlines', 'JL', 'Japan')), null);
  assert.equal(carrierCodeMismatch(c('wideroe', 'Widerøe', 'WF', 'Norway')), null);
});
