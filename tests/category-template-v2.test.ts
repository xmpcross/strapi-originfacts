import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_TEMPLATE_V2_DEFAULT,
  CATEGORY_TEMPLATE_V2_EXCLUDED,
  CATEGORY_V2_STANDFIRSTS,
  categoryUsesTemplateV2,
} from '../lib/category-template-v2';
import { categoryStats, destinationChips, toCard } from '../components/category-v2/view';
import { matchesQuery } from '../components/category-v2/search';
import type { StrapiArticle } from '../lib/strapi';

const article = (slug: string, over: Partial<StrapiArticle> = {}): StrapiArticle => ({
  id: slug.length,
  title: slug.replace(/-/g, ' '),
  slug,
  content: '',
  publishedAt: '2026-10-04T08:00:00.000Z',
  updatedAt: '2026-10-04T08:00:00.000Z',
  ...over,
});

test('category v2: the default for every category except destinations', () => {
  assert.equal(CATEGORY_TEMPLATE_V2_DEFAULT, true);
  assert.deepEqual([...CATEGORY_TEMPLATE_V2_EXCLUDED], ['destinations']);
  for (const slug of ['hotels', 'HOTELS', 'flights', 'travel-tips', 'car-rentals']) {
    assert.equal(categoryUsesTemplateV2(slug), true, slug);
  }
  assert.equal(categoryUsesTemplateV2('destinations'), false);
});

test('category v2: every v2 category in the nav has a standfirst', () => {
  for (const slug of ['hotels', 'flights', 'travel-tips', 'car-rentals']) {
    assert.ok(CATEGORY_V2_STANDFIRSTS[slug], slug);
  }
});

test('category v2: standfirsts make no first-hand or ranking claims', () => {
  for (const text of Object.values(CATEGORY_V2_STANDFIRSTS)) {
    assert.doesNotMatch(text, /slept in|first-hand|expert|tested|walked|we stayed|\bbest\b/i);
  }
});

test('category v2: destination chips count each article once and need two articles', () => {
  const perth = { id: 1, name: 'Perth', slug: 'perth', type: 'city' as const };
  const bali = { id: 2, name: 'Bali', slug: 'bali', type: 'region' as const };
  const cards = [
    article('a', { destinations: [perth, perth] }),
    article('b', { destinations: [perth, bali] }),
    article('c', { destinations: [] }),
  ].map(toCard);
  assert.deepEqual(destinationChips(cards), [{ slug: 'perth', name: 'Perth', count: 2 }]);
});

test('category v2: stats are counted and drop what has no data', () => {
  const cards = [
    article('a', { readingTimeMinutes: 9, destinations: [{ id: 1, name: 'Perth', slug: 'perth' }] }),
    article('b', { readingTimeMinutes: 6, publishedAt: '2026-09-04T08:00:00.000Z' }),
  ].map(toCard);
  const stats = categoryStats(2, cards);
  assert.deepEqual(
    stats.map((s) => s.label),
    ['articles', 'destination covered', 'average read', 'newest article'],
  );
  assert.equal(stats[2].value, '8 min');
  assert.deepEqual(categoryStats(0, []), []);
});

test('category v2: search matches title and destination, ignoring case and accents', () => {
  const card = toCard(article('cheap-hotels-tokyo', { destinations: [{ id: 1, name: 'Japan', slug: 'japan' }] }));
  assert.equal(matchesQuery(card, 'TOKYO'), true);
  assert.equal(matchesQuery(card, 'japan hotels'), true);
  assert.equal(matchesQuery(card, 'tōkyō'), true);
  assert.equal(matchesQuery(card, 'paris'), false);
});
