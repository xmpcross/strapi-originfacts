import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_FILTERS,
  activePills,
  applyFilters,
  dateFacet,
  facetOptions,
  filtersToHref,
  isFiltering,
  matchesDate,
  parseFilters,
  type ArticleFilters,
  type IndexCard,
} from '../components/article-index/filters';

const NOW = Date.parse('2026-10-05T00:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const card = (slug: string, over: Partial<IndexCard> = {}): IndexCard => ({
  slug,
  title: slug.replace(/-/g, ' '),
  excerpt: null,
  date: null,
  dateIso: daysAgo(1),
  readingMinutes: null,
  image: null,
  imageAlt: slug,
  destinations: [],
  category: null,
  author: null,
  ...over,
});

const hotels = { slug: 'hotels', name: 'Hotels' };
const flights = { slug: 'flights', name: 'Flights' };
const japan = { slug: 'japan', name: 'Japan' };
const tokyo = { slug: 'tokyo', name: 'Tokyo' };
const thailand = { slug: 'thailand', name: 'Thailand' };

const CARDS: IndexCard[] = [
  card('tokyo-hotels', { category: hotels, destinations: [japan, tokyo], dateIso: daysAgo(5), excerpt: 'Where to stay near Shinjuku' }),
  card('bangkok-hotels', { category: hotels, destinations: [thailand], dateIso: daysAgo(60) }),
  card('cheap-flights-japan', { category: flights, destinations: [japan], dateIso: daysAgo(200) }),
  card('old-flight-tips', { category: flights, destinations: [], dateIso: daysAgo(500) }),
  card('undated', { category: null, dateIso: null }),
];

test('parseFilters: reads comma-separated and repeated params, drops junk', () => {
  const f = parseFilters(new URLSearchParams('category=Hotels,flights&category=hotels&destination=japan&destination=bad%20slug&q=%20tokyo%20&published=90d&sort=oldest'));
  assert.deepEqual(f.categories, ['hotels', 'flights']);
  assert.deepEqual(f.destinations, ['japan']);
  assert.equal(f.q, 'tokyo');
  assert.equal(f.date, '90d');
  assert.equal(f.sort, 'oldest');

  const g = parseFilters({ published: 'yesterday', sort: 'random', page: '2' });
  assert.equal(g.date, null);
  assert.equal(g.sort, 'newest');
  assert.equal(isFiltering(g), false);
});

test('filtersToHref: round-trips, keeps ?page= only when unfiltered', () => {
  assert.equal(filtersToHref(EMPTY_FILTERS), '/all-articles');
  assert.equal(filtersToHref(EMPTY_FILTERS, 3), '/all-articles?page=3');
  const f = { ...EMPTY_FILTERS, categories: ['hotels', 'flights'], destinations: ['japan'], q: 'tokyo inn', date: '30d' as const };
  const href = filtersToHref(f, 3);
  assert.equal(href, '/all-articles?q=tokyo+inn&category=hotels,flights&destination=japan&published=30d');
  assert.deepEqual(parseFilters(new URLSearchParams(href.split('?')[1])), f);
});

test('applyFilters: OR within a group, AND across groups', () => {
  const slugs = (f: Partial<typeof EMPTY_FILTERS>) => applyFilters(CARDS, { ...EMPTY_FILTERS, ...f }, NOW).map((c) => c.slug);
  assert.deepEqual(slugs({ categories: ['hotels'] }), ['tokyo-hotels', 'bangkok-hotels']);
  assert.deepEqual(slugs({ destinations: ['japan', 'thailand'] }), ['tokyo-hotels', 'bangkok-hotels', 'cheap-flights-japan']);
  assert.deepEqual(slugs({ categories: ['hotels'], destinations: ['japan'] }), ['tokyo-hotels']);
  assert.deepEqual(slugs({ categories: ['flights'], destinations: ['thailand'] }), []);
});

test('applyFilters: text search covers title, excerpt and destination names, accent-insensitive', () => {
  const slugs = (q: string) => applyFilters(CARDS, { ...EMPTY_FILTERS, q }, NOW).map((c) => c.slug);
  assert.deepEqual(slugs('shinjuku'), ['tokyo-hotels']);
  assert.deepEqual(slugs('THAILAND'), ['bangkok-hotels']);
  assert.deepEqual(slugs('japan flights'), ['cheap-flights-japan']);
  assert.deepEqual(slugs('tōkyō'), ['tokyo-hotels']);
});

test('applyFilters: sort oldest reverses, undated sorts last when newest', () => {
  const newest = applyFilters(CARDS, EMPTY_FILTERS, NOW).map((c) => c.slug);
  assert.deepEqual(newest, ['tokyo-hotels', 'bangkok-hotels', 'cheap-flights-japan', 'old-flight-tips', 'undated']);
  const oldest = applyFilters(CARDS, { ...EMPTY_FILTERS, sort: 'oldest' }, NOW).map((c) => c.slug);
  assert.deepEqual(oldest, [...newest].reverse());
});

test('date ranges: bucketed against the supplied clock; undated never matches a range', () => {
  assert.equal(matchesDate(CARDS[0], '30d', NOW), true);
  assert.equal(matchesDate(CARDS[1], '30d', NOW), false);
  assert.equal(matchesDate(CARDS[1], '90d', NOW), true);
  assert.equal(matchesDate(CARDS[2], '12m', NOW), true);
  assert.equal(matchesDate(CARDS[3], 'older', NOW), true);
  assert.equal(matchesDate(CARDS[3], '12m', NOW), false);
  assert.equal(matchesDate(CARDS[4], 'older', NOW), false);
  assert.deepEqual(dateFacet(CARDS, EMPTY_FILTERS, NOW), { '30d': 1, '90d': 2, '12m': 3, older: 1 });
});

test('facetOptions: counts ignore their own group but respect the others', () => {
  const f = { ...EMPTY_FILTERS, categories: ['hotels'], destinations: ['japan'] };
  const cats = facetOptions(CARDS, f, NOW, 'categories');
  // Within Japan: 1 hotel article, 1 flights article.
  assert.deepEqual(cats.map((o) => [o.slug, o.count]), [['flights', 1], ['hotels', 1]]);
  const dests = facetOptions(CARDS, f, NOW, 'destinations');
  // Within Hotels: japan 1, tokyo 1, thailand 1.
  assert.deepEqual(Object.fromEntries(dests.map((o) => [o.slug, o.count])), { japan: 1, tokyo: 1, thailand: 1 });
  // Counts with no filters equal the archive totals.
  const all = facetOptions(CARDS, EMPTY_FILTERS, NOW, 'destinations');
  assert.deepEqual(all.map((o) => [o.slug, o.count]), [['japan', 2], ['thailand', 1], ['tokyo', 1]]);
});

test('facetOptions: an unknown selected slug is kept with a zero count', () => {
  const f = { ...EMPTY_FILTERS, categories: ['nope'] };
  const cats = facetOptions(CARDS, f, NOW, 'categories');
  assert.deepEqual(cats.find((o) => o.slug === 'nope'), { slug: 'nope', name: 'nope', count: 0 });
  assert.equal(applyFilters(CARDS, f, NOW).length, 0);
});

test('activePills: one per value, each removes only itself', () => {
  const f = { ...EMPTY_FILTERS, q: 'tokyo', categories: ['hotels', 'flights'], date: '90d' as const, sort: 'oldest' as const };
  const pills = activePills(f, { 'categories:hotels': 'Hotels', 'categories:flights': 'Flights' });
  assert.deepEqual(pills.map((p) => p.label), ['“tokyo”', 'Hotels', 'Flights', 'Last 90 days', 'Oldest first']);
  const afterHotels = pills[1].remove(f);
  assert.deepEqual(afterHotels.categories, ['flights']);
  assert.equal(afterHotels.q, 'tokyo');
  let cleared: ArticleFilters = f;
  for (const p of activePills(f, {})) cleared = p.remove(cleared);
  assert.equal(isFiltering(cleared), false);
});
