import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFaqGroups, faqAnswerText, faqsForSchema, type FaqCounts } from '../lib/faq';

const COUNTS: FaqCounts = { articles: 120, airlines: 300, airlineCountries: 90, verifiedAirlineGuides: 12, airports: 4000 };
const NONE: FaqCounts = { articles: 0, airlines: 0, airlineCountries: 0, verifiedAirlineGuides: 0, airports: 0 };

test('faq: question and group ids are unique (they are page anchors)', () => {
  const groups = buildFaqGroups(COUNTS);
  const ids = [...groups.map((g) => g.id), ...groups.flatMap((g) => g.items.map((i) => i.id))];
  assert.equal(new Set(ids).size, ids.length);
});

test('faq: schema is built from the same text the page renders', () => {
  const groups = buildFaqGroups(COUNTS);
  const schema = faqsForSchema(groups);
  const items = groups.flatMap((g) => g.items);
  assert.equal(schema.length, items.length);
  items.forEach((item, i) => {
    assert.equal(schema[i].q, item.q);
    assert.equal(schema[i].a, faqAnswerText(item.a));
    assert.ok(schema[i].a.length > 20, `answer too short: ${item.id}`);
  });
});

test('faq: counts appear only when known', () => {
  const withCounts = faqsForSchema(buildFaqGroups(COUNTS)).map((f) => f.a).join(' ');
  assert.match(withCounts, /300 passenger airlines from 90 countries, and 12 of them have a verified policy guide/);
  assert.match(withCounts, /4,000 airports/);

  const without = buildFaqGroups(NONE);
  const text = faqsForSchema(without).map((f) => f.a).join(' ');
  assert.ok(!/\b0 (airlines|airports|published)/.test(text));
  assert.ok(!without.flatMap((g) => g.items).some((i) => i.id === 'how-many-airlines'));
});

test('faq: internal links point at known routes', () => {
  const known = new Set([
    '/about', '/methodology', '/contact', '/authors', '/search', '/sitemap', '/feed.xml', '/all-articles',
    '/destinations', '/countries', '/airlines', '/airports', '/airports/top-100-airports', '/flight-routes', '/flight-search',
    '/legal/contact', '/legal/disclaimer', '/legal/affiliate-disclosure', '/legal/privacy', '/legal/cookies',
    '/legal/accessibility',
  ]);
  for (const g of buildFaqGroups(COUNTS)) {
    for (const item of g.items) {
      for (const s of item.a) {
        if (typeof s === 'string' || !('href' in s)) continue;
        if (s.href.startsWith('mailto:')) continue;
        assert.ok(known.has(s.href), `${item.id}: unexpected link ${s.href}`);
      }
    }
  }
});
