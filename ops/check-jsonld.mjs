#!/usr/bin/env node
// JSON-LD structural gate.
//
// Fetches representative pages from a running instance, extracts every
// <script type="application/ld+json"> block, verifies each parses as JSON
// and carries the required non-empty fields for its @type. Exits non-zero
// on any failure — run it against a local `next start` after building:
//
//   node ops/check-jsonld.mjs http://127.0.0.1:3000 [path ...]
//
// Default paths cover one page per template type. FAQPage blocks are also
// cross-checked against the visible accordion: every schema question must
// appear in the page HTML (no invented questions).

const base = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '');
const paths = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ['/', '/airlines/qantas', '/airports/syd', '/destinations/japan', '/articles', '/flight-search'];

const REQUIRED = {
  Organization: ['name', 'url', 'logo'],
  WebSite: ['name', 'url'],
  Article: ['headline', 'datePublished', 'author', 'publisher'],
  NewsArticle: ['headline', 'datePublished', 'author', 'publisher'],
  HowTo: ['name', 'step'],
  FAQPage: ['mainEntity'],
  BreadcrumbList: ['itemListElement'],
  Airport: ['name', 'iataCode'],
  Airline: ['name'],
  Country: ['name'],
  City: ['name'],
  Place: ['name'],
  Continent: ['name'],
  CollectionPage: ['name'],
  AboutPage: ['name'],
  ContactPage: ['name'],
};

const empty = (v) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

let failures = 0;
let blocks = 0;
const fail = (msg) => { failures++; console.error(`  ✖ ${msg}`); };

for (const path of paths) {
  const res = await fetch(`${base}${path}`).catch(() => null);
  if (!res || res.status !== 200) { fail(`${path}: fetch failed (${res?.status ?? 'network'})`); continue; }
  const html = await res.text();
  const scripts = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  console.log(`${path}: ${scripts.length} JSON-LD block(s)`);
  if (!scripts.length) fail(`${path}: no JSON-LD at all`);
  for (const [, raw] of scripts) {
    blocks++;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      fail(`${path}: unparseable JSON-LD (${e.message}) — ${raw.slice(0, 80)}…`);
      continue;
    }
    for (const node of Array.isArray(data) ? data : [data]) {
      const type = node['@type'];
      const req = REQUIRED[type];
      if (!type) { fail(`${path}: block missing @type`); continue; }
      if (!req) continue; // unknown types are allowed, just not checked
      for (const field of req) {
        if (empty(node[field])) fail(`${path}: ${type}.${field} is empty/missing`);
      }
      if (type === 'FAQPage') {
        for (const q of node.mainEntity ?? []) {
          if (empty(q.name) || empty(q.acceptedAnswer?.text)) {
            fail(`${path}: FAQPage entry with empty question/answer`);
          } else if (!html.includes(q.name.replace(/&/g, '&amp;').replace(/'/g, '&#x27;'))
              && !html.includes(q.name)) {
            fail(`${path}: FAQPage question not visible on page: "${q.name.slice(0, 60)}"`);
          }
        }
      }
      if (type === 'BreadcrumbList') {
        for (const item of node.itemListElement ?? []) {
          if (empty(item.name) || empty(item.item)) fail(`${path}: breadcrumb item incomplete`);
        }
      }
    }
  }
}

console.log(`\nChecked ${blocks} JSON-LD blocks across ${paths.length} pages — ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
