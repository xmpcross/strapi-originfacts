import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_STORIES,
  HERO_SECONDARY,
  LATEST_COUNT,
  categoryCounts,
  homeFaqs,
  selectHomeStories,
} from '../lib/home-page';
import type { StrapiArticle } from '../lib/strapi';

const cats = {
  flights: { id: 1, name: 'Flights', slug: 'flights' },
  hotels: { id: 2, name: 'Hotels', slug: 'hotels' },
  tips: { id: 3, name: 'Travel Tips', slug: 'travel-tips' },
  cars: { id: 4, name: 'Car Rentals', slug: 'car-rentals' },
  dest: { id: 5, name: 'Destinations', slug: 'destinations' },
};

let id = 0;
const article = (slug: string, cat: keyof typeof cats, daysAgo: number): StrapiArticle => ({
  id: ++id,
  title: slug,
  slug,
  content: '',
  publishedAt: new Date(Date.UTC(2026, 9, 5) - daysAgo * 86_400_000).toISOString(),
  updatedAt: '2026-10-05T00:00:00.000Z',
  category: cats[cat],
});

function fixture(): StrapiArticle[] {
  const rows: StrapiArticle[] = [];
  for (let i = 0; i < 12; i++) rows.push(article(`flight-${i}`, 'flights', i * 0.5));
  for (let i = 0; i < 10; i++) rows.push(article(`hotel-${i}`, 'hotels', 0.1 + i * 0.7));
  for (let i = 0; i < 9; i++) rows.push(article(`tip-${i}`, 'tips', 0.2 + i * 0.9));
  for (let i = 0; i < 6; i++) rows.push(article(`car-${i}`, 'cars', 2 + i));
  // Old, inactive category with too few stories for a band.
  for (let i = 0; i < 2; i++) rows.push(article(`dest-${i}`, 'dest', 90 + i));
  // Index order should not matter.
  return rows.reverse();
}

test('never shows a story twice and fills the hero and latest grid newest-first', () => {
  const sel = selectHomeStories(fixture());
  const all = [sel.lead!, ...sel.secondary, ...sel.latest, ...sel.bands.flatMap((b) => b.stories), ...sel.recentList];
  const slugs = all.map((a) => a.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(sel.lead?.slug, 'flight-0');
  assert.equal(sel.secondary.length, HERO_SECONDARY);
  assert.equal(sel.latest.length, LATEST_COUNT);
  const heroAndLatest = [sel.lead!, ...sel.secondary, ...sel.latest].map((a) => Date.parse(a.publishedAt));
  assert.deepEqual(heroAndLatest, [...heroAndLatest].sort((a, b) => b - a));
});

test('category bands rank by recent activity and skip categories that cannot fill a band', () => {
  const sel = selectHomeStories(fixture());
  const bandSlugs = sel.bands.map((b) => b.slug);
  assert.ok(!bandSlugs.includes('destinations'));
  assert.equal(bandSlugs[0], 'flights');
  for (const b of sel.bands) {
    assert.equal(b.stories.length, CATEGORY_STORIES);
    assert.ok(b.stories.every((a) => a.category?.slug === b.slug));
    assert.ok(b.intro.length > 0);
  }
});

test('empty index renders nothing rather than throwing', () => {
  const sel = selectHomeStories([]);
  assert.equal(sel.lead, null);
  assert.deepEqual(sel.secondary, []);
  assert.deepEqual(sel.bands, []);
});

test('categoryCounts counts what is in the index', () => {
  const counts = categoryCounts(fixture());
  assert.deepEqual(
    counts.map((c) => [c.slug, c.count]),
    [['flights', 12], ['hotels', 10], ['travel-tips', 9], ['car-rentals', 6], ['destinations', 2]],
  );
});

test('FAQ answers carry only computed numbers', () => {
  const faqs = homeFaqs({ topics: ['flights', 'hotels'], airlineGuides: 16, airportGuides: 30 });
  assert.ok(faqs.length >= 4 && faqs.length <= 6);
  const text = faqs.map((f) => f.a).join(' ');
  assert.match(text, /16 airline guides and 30 airport guides/);
  assert.match(text, /grouped into flights and hotels\./);
  // No other digits besides the computed counts.
  assert.deepEqual(text.match(/\d+/g), ['16', '30']);
});
