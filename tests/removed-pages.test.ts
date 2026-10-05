import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { THIN_AIRPORT_IATAS } from '../lib/entity-seo';

const removed = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'removed-pages.json'), 'utf8')) as {
  airports: { iata: string; slug: string }[];
  routes: string[];
};
const guided = new Set(
  fs.readdirSync(path.join(process.cwd(), 'content', 'airport-guides')).map((f) => f.replace('.json', '').toUpperCase()),
);

test('removed pages: 35 airports and 148 routes (76 + 72 thin routes), unique', () => {
  assert.equal(removed.airports.length, 35);
  assert.equal(new Set(removed.airports.map((a) => a.iata)).size, 35);
  assert.equal(new Set(removed.airports.map((a) => a.slug)).size, 35);
  assert.equal(removed.routes.length, 148);
  assert.equal(new Set(removed.routes).size, 148);
});

test('removed pages: same airports as the noindex list, none with a sourced guide', () => {
  assert.deepEqual(new Set(removed.airports.map((a) => a.iata)), THIN_AIRPORT_IATAS);
  for (const a of removed.airports) assert.ok(!guided.has(a.iata), `${a.iata} has a guide`);
});

test('removed pages: every route has both ends as normal route slugs, and slugs are URL-safe', () => {
  for (const r of removed.routes) assert.match(r, /^[a-z]{3}-to-[a-z]{3}$/, r);
  for (const a of removed.airports) assert.match(a.slug, /^[a-z0-9-]+$/, a.slug);
});

test('removed pages: the Top 100 airports are never retired', () => {
  const hubs = fs.readFileSync(path.join(process.cwd(), 'lib', 'hub-airports.ts'), 'utf8');
  for (const a of removed.airports) assert.ok(!new RegExp(`'${a.iata}'`).test(hubs), `${a.iata} is on the Top 100 list`);
});
