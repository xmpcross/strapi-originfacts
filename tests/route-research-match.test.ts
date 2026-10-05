import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  htmlToText,
  extractMeta,
  quoteOnPage,
  keyTokens,
  missingTokens,
  locateQuote,
  mentionsPlace,
  placeNames,
  parseRobots,
  rejectedHost,
  operatorQuoteProblem,
  otherAirportCodes,
} from '../ops/route-research/match.mjs';
import { resolveAirline, formatPublished, buildGuide, operatorIata } from '../ops/route-research/build-guides';

const PAGE = htmlToText(`<html><head><title>Gulf Air returns</title>
<meta property="og:site_name" content="Gulf Daily News"><meta property="article:published_time" content="2023-05-25T08:00:00Z"></head>
<body><script>var x = "Qatar Airways 99 flights";</script>
<p>Qatar Airways has announced resumption of its services to Bahrain starting today (May 25) with a daily flight. A second and third daily service will commence on June 15.</p>
<p>Meanwhile, Gulf Air, Bahrain&#8217;s official carrier, was also scheduled to resume its flights to Doha, Qatar from today. The airline plans to operate three daily flights to Doha.</p>
<p>Buses leave from exit 4&#x200E; on the Arrival level, from zone 4A.</p></body></html>`);

test('htmlToText drops scripts and decodes entities', () => {
  assert.ok(!PAGE.includes('99 flights'));
  assert.ok(PAGE.includes('Bahrain’s official carrier'));
});

test('extractMeta reads title, site name and published date', () => {
  const m = extractMeta('<title> A &amp; B </title><meta property="og:site_name" content="GDN"><meta property="article:published_time" content="2023-05-25">');
  assert.deepEqual(m, { title: 'A & B', siteName: 'GDN', published: '2023-05-25' });
});

test('quoteOnPage: exact quote matches across curly quotes, whitespace and invisible marks', () => {
  assert.equal(quoteOnPage(PAGE, "Gulf Air, Bahrain's official carrier, was also scheduled to resume its flights to Doha, Qatar from today."), true);
  assert.equal(quoteOnPage(PAGE, 'Buses leave from exit 4 on the Arrival level, from zone 4A.'), true);
});

test('quoteOnPage: an altered quote, an ellipsis quote and a too-short quote are rejected', () => {
  assert.equal(quoteOnPage(PAGE, 'The airline plans to operate four daily flights to Doha.'), false);
  assert.equal(quoteOnPage(PAGE, 'Qatar Airways has announced … with a daily flight.'), false);
  assert.equal(quoteOnPage(PAGE, 'daily flight'), false);
});

test('keyTokens: numbers, number words, months, airlines and strong words', () => {
  const k = keyTokens('Gulf Air operates three daily flights to Doha from 25 May 2023, the first since 2017.', ['Gulf Air'], ['Qatar Airways', 'Gulf Air']);
  assert.deepEqual(new Set(k.numbers), new Set(['3', '25', '2023', '2017']));
  assert.deepEqual(k.months, ['may']);
  assert.deepEqual(k.airlines, ['gulf air']);
  assert.deepEqual(new Set(k.strong), new Set(['daily', 'first']));
});

test('keyTokens: an airline in the text is required even if the model did not list it; a contained name is not double-counted', () => {
  const k = keyTokens('Air India Express flies the route.', [], ['Air India', 'Air India Express']);
  assert.deepEqual(k.airlines, ['air india express']);
});

test('missingTokens: digits vs words, dates in either order, airline and strong words', () => {
  const k = keyTokens('Qatar Airways restarted daily flights on 25 May.', ['Qatar Airways']);
  assert.deepEqual(missingTokens(k, 'Qatar Airways resumes services starting today (May 25) with a daily flight.'), []);
  assert.deepEqual(missingTokens(k, 'Qatar Airways resumes services starting May 26 with a daily flight.'), ['number:25']);
  assert.deepEqual(missingTokens(keyTokens('Three flights a week.'), '3 flights a week'), []);
  assert.deepEqual(missingTokens(keyTokens('Gulf Air flies daily.', ['Gulf Air']), 'Qatar Airways flies daily.'), ['airline:gulf air']);
  assert.deepEqual(missingTokens(keyTokens('The busiest route.'), 'A popular route.'), ['word:busiest']);
  assert.deepEqual(missingTokens(keyTokens('1,500 passengers'), '1500 passengers'), []);
});

test('locateQuote finds the shortest window carrying every token and both route ends', () => {
  const ends = [placeNames({ iata: 'BAH', name: 'Bahrain International Airport', city: 'Bahrain' }), placeNames({ iata: 'DOH', name: 'Hamad International Airport', city: 'Doha' })];
  const k = keyTokens('Gulf Air planned three daily flights to Doha.', ['Gulf Air']);
  const q = locateQuote(PAGE, k, ends);
  assert.ok(q?.startsWith('Meanwhile, Gulf Air'));
  assert.equal(locateQuote(PAGE, keyTokens('Gulf Air planned four daily flights to Doha.', ['Gulf Air']), ends), null);
  // Too few tokens to locate anything meaningful.
  assert.equal(locateQuote(PAGE, keyTokens('Flights resumed.'), ends), null);
});

test('mentionsPlace: IATA as a case-sensitive word, city, distinctive airport-name word', () => {
  const doh = placeNames({ iata: 'DOH', name: 'Hamad International Airport', city: 'Doha' });
  assert.equal(mentionsPlace('Flights land at DOH.', doh), true);
  assert.equal(mentionsPlace('Flights land at Hamad.', doh), true);
  assert.equal(mentionsPlace('Flights land in doha.', doh), true);
  assert.equal(mentionsPlace('a dohnut shop', doh), false);
  assert.equal(mentionsPlace('International airport', doh), false);
});

test('parseRobots: our group over *, longest match, allow wins ties, wildcards, crawl-delay', () => {
  const r = parseRobots(`User-agent: *\nDisallow: /\n\nUser-agent: Originfacts\nDisallow: /private\nAllow: /private/ok\nDisallow: /*.pdf$\nCrawl-delay: 7`);
  assert.equal(r.isAllowed('https://x.com/news/a'), true);
  assert.equal(r.isAllowed('https://x.com/private/x'), false);
  assert.equal(r.isAllowed('https://x.com/private/ok/1'), true);
  assert.equal(r.isAllowed('https://x.com/a/b.pdf'), false);
  assert.equal(r.crawlDelay, 7);
  const star = parseRobots('User-agent: *\nDisallow: /search\nDisallow:\n');
  assert.equal(star.isAllowed('/search?q=1'), false);
  assert.equal(star.isAllowed('/news'), true);
  assert.equal(parseRobots('').isAllowed('/anything'), true);
});

test('rejectedHost: UGC and flight-search sites are refused, news and airline sites are not', () => {
  assert.match(String(rejectedHost('https://en.wikipedia.org/wiki/X')), /wikipedia/);
  assert.match(String(rejectedHost('https://www.skyscanner.com.au/routes/syd/mel')), /skyscanner/);
  assert.equal(rejectedHost('https://www.qantasnewsroom.com.au/media-releases/x'), null);
});

const AIRLINES = [
  { slug: 'air-india', name: 'Air India', iataCode: 'AI', country: 'India' },
  { slug: 'air-india-express', name: 'Air India Express', iataCode: 'IX', country: 'India' },
  { slug: 'klm', name: 'KLM Royal Dutch Airlines', iataCode: 'KL', country: 'Netherlands' },
  { slug: 'all-nippon-airways', name: 'All Nippon Airways', iataCode: 'NH', country: 'Japan' },
  { slug: 'qatar-airways', name: 'Qatar Airways', iataCode: 'QR', country: 'Qatar' },
];

test('resolveAirline: by name only — never collapses Air India Express into Air India', () => {
  assert.equal((resolveAirline('Air India Express', AIRLINES) as { airline: { slug: string } }).airline.slug, 'air-india-express');
  assert.equal((resolveAirline('Air India', AIRLINES) as { airline: { slug: string } }).airline.slug, 'air-india');
  assert.equal((resolveAirline('KLM', AIRLINES) as { airline: { slug: string } }).airline.slug, 'klm');
  assert.equal((resolveAirline('ANA', AIRLINES) as { airline: { slug: string } }).airline.slug, 'all-nippon-airways');
  assert.ok('reason' in resolveAirline('Vistara', AIRLINES));
});

test('formatPublished', () => {
  assert.equal(formatPublished('2023-05-25T08:00:00Z'), '25 May 2023');
  assert.equal(formatPublished('yesterday'), null);
});

test('buildGuide: only verified claims, every paragraph and FAQ cites a listed source, no guide without an operator', () => {
  const route = {
    slug: 'bah-to-doh',
    origin: { iata: 'BAH', name: 'Bahrain International Airport', city: 'Bahrain', country: 'Bahrain' },
    destination: { iata: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar' },
    carriers: [{ slug: 'qatar-airways', name: 'Qatar Airways', iataCode: 'QR', country: 'Qatar' }],
  };
  const src = (url: string) => ({ url, title: 'T', site_name: 'Pub', published: '2026-04-27', fetched_at: '2026-10-05T00:00:00Z' });
  const claims = [
    { category: 'operator' as const, text: 'Qatar Airways flies daily to Bahrain from 1 May', airlines: ['Qatar Airways'], status: 'verified', verified_quote: 'q', source: src('https://a.example/1') },
    { category: 'history' as const, text: 'Flights resumed on 25 May 2023.', date: '2023-05-25', status: 'verified', verified_quote: 'q', source: src('https://b.example/2') },
    { category: 'ground' as const, text: 'Buses leave from zone 4A.', airport: 'BAH', status: 'verified', verified_quote: 'q', source: src('https://c.example/3') },
    { category: 'history' as const, text: 'Dropped claim 2017.', status: 'dropped', reasons: ['quote not on page'] },
    { category: 'airport' as const, text: 'Needs judge 2014.', status: 'needs-judge', verified_quote: 'q', source: src('https://d.example/4') },
  ];
  const { guide } = buildGuide(route, claims, AIRLINES, { minClaims: 3, today: '2026-10-05', fareAirlines: ['QR'] });
  assert.ok(guide);
  const ids = new Set(guide.sources.map((s) => s.id));
  const cited = [guide.intro.sources, ...guide.operating_airlines.map((a) => a.sources), ...guide.sections.flatMap((s) => s.paragraphs.map((p) => p.sources)), ...guide.faqs.map((f) => f.sources)];
  for (const c of cited) assert.ok(c.length > 0 && c.every((id) => ids.has(id)));
  assert.deepEqual(guide.operating_airlines.map((a) => a.iata), ['QR']);
  assert.equal(guide.sources.length, 3);
  assert.ok(!JSON.stringify(guide).includes('Needs judge'));
  assert.ok(!JSON.stringify(guide).includes('Dropped claim'));
  assert.equal(guide.sections.find((s) => s.id === 'route-history')?.paragraphs[0].text, 'Flights resumed on 25 May 2023.');

  const none = buildGuide(route, claims.filter((c) => c.category !== 'operator'), AIRLINES, { minClaims: 1, today: '2026-10-05' });
  assert.equal(none.guide, null);
  const thin = buildGuide(route, claims.slice(0, 1), AIRLINES, { minClaims: 3, today: '2026-10-05' });
  assert.equal(thin.guide, null);
});

test('operatorQuoteProblem: codeshare and non-service quotes are refused', () => {
  assert.equal(operatorQuoteProblem('Qantas flies daily between Sydney and Singapore.'), null);
  assert.match(String(operatorQuoteProblem('Qantas sells codeshare seats on flights operated by Emirates.')), /codeshare/);
  assert.match(String(operatorQuoteProblem('Qantas and Singapore Airlines are partners in Sydney.')), /flight or service/);
});

test('operatorIata: ceased carriers and foreign carriers off the route record are dropped', () => {
  const route = {
    slug: 'kul-to-sin',
    origin: { iata: 'KUL', name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', country: 'Malaysia' },
    destination: { iata: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore' },
    carriers: [],
  };
  const airlines = [
    { slug: 'silkair', name: 'SilkAir', iataCode: 'MI', country: 'Singapore' },
    { slug: 'ethiopian-airlines', name: 'Ethiopian Airlines', iataCode: 'ET', country: 'Ethiopia' },
  ];
  assert.match(String((operatorIata('SilkAir', route, airlines) as { reason: string }).reason), /ceased/);
  assert.match(String((operatorIata('Ethiopian Airlines', route, airlines) as { reason: string }).reason), /fifth-freedom/);
});

test('buildGuide: operator claims from undated or stale sources are dropped', () => {
  const route = {
    slug: 'bah-to-doh',
    origin: { iata: 'BAH', name: 'Bahrain International Airport', city: 'Bahrain', country: 'Bahrain' },
    destination: { iata: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar' },
    carriers: [{ slug: 'qatar-airways', name: 'Qatar Airways', iataCode: 'QR', country: 'Qatar' }],
  };
  const op = (published: string | null) => ({
    category: 'operator' as const, text: 'Qatar Airways flies to Bahrain.', airlines: ['Qatar Airways'], status: 'verified', verified_quote: 'q',
    source: { url: `https://a.example/${published}`, title: 'T', site_name: 'P', published, fetched_at: '2026-10-05T00:00:00Z' },
  });
  assert.equal(buildGuide(route, [op('2023-01-01')], AIRLINES, { minClaims: 1, today: '2026-10-05' }).guide, null);
  assert.equal(buildGuide(route, [op(null)], AIRLINES, { minClaims: 1, today: '2026-10-05' }).guide, null);
  assert.ok(buildGuide(route, [op('2026-03-01')], AIRLINES, { minClaims: 1, today: '2026-10-05' }).guide);
});

test('buildGuide: a partial operator list (fare data shows another carrier) is not published as the list', () => {
  const route = {
    slug: 'bah-to-doh',
    origin: { iata: 'BAH', name: 'Bahrain International Airport', city: 'Bahrain', country: 'Bahrain' },
    destination: { iata: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar' },
    carriers: [{ slug: 'qatar-airways', name: 'Qatar Airways', iataCode: 'QR', country: 'Qatar' }],
  };
  const claims = [{
    category: 'operator' as const, text: 'Qatar Airways flies to Bahrain.', airlines: ['Qatar Airways'], status: 'verified', verified_quote: 'q',
    source: { url: 'https://a.example/1', title: 'T', site_name: 'P', published: '2026-03-01', fetched_at: '2026-10-05T00:00:00Z' },
  }];
  const partial = buildGuide(route, claims, AIRLINES, { minClaims: 1, today: '2026-10-05', fareAirlines: ['GF', 'QR'] });
  assert.deepEqual(partial.guide?.operating_airlines, []);
  assert.match(String(partial.guide?.intro.text), /include Qatar Airways/);
  assert.doesNotMatch(String(partial.guide?.intro.text), /nonstop/);
  assert.equal(partial.guide?.faqs.length, 0);
  assert.deepEqual(partial.missingOperators, ['GF']);
  const full = buildGuide(route, claims, AIRLINES, { minClaims: 1, today: '2026-10-05', fareAirlines: ['QR'] });
  assert.deepEqual(full.guide?.operating_airlines.map((a) => a.iata), ['QR']);
});

test('otherAirportCodes: a claim about Western Sydney (WSI) is not about SYD', () => {
  assert.deepEqual(otherAirportCodes('Air New Zealand flies between Auckland and WSI.', ['AKL', 'SYD']), ['WSI']);
  assert.deepEqual(otherAirportCodes('Flights between AKL and SYD in NSW.', ['AKL', 'SYD']), []);
});

test('entities: proper names in a claim must be in the quote; route-end names and airlines are checked elsewhere', () => {
  const k = keyTokens('The AirportLink bus runs between Auckland Airport and Puhinui Station.', [], [], ['auckland', 'AKL']);
  assert.deepEqual(new Set(k.entities), new Set(['airportlink', 'puhinui']));
  assert.deepEqual(missingTokens(k, 'The orange AirportLink bus service carries passengers to Puhinui Station.'), []);
  assert.deepEqual(missingTokens(k, 'The orange bus service carries passengers to Puhinui Station.'), ['name:airportlink']);
  assert.deepEqual(keyTokens('Three daily flights in May.').entities, []);
});
