#!/usr/bin/env node
/**
 * Rebuilds data/airline-refs/duffel.json from Duffel's airlines endpoint.
 *
 * Duffel's airline list is reference data — it needs no offer request and no
 * booking — and it carries the one field the fact store depends on most:
 * `conditions_of_carriage_url`, a link to the document the carrier is actually
 * bound by. That is the citable primary source behind a baggage or fare figure.
 *
 * Run by hand when the snapshot goes stale; nothing calls Duffel at request
 * time. Offer-derived data is deliberately NOT captured here — an allowance
 * inside an offer is scoped to one route, date and fare, and generalising it to
 * a carrier would be inventing a fact.
 *
 *   DUFFEL_ACCESS_TOKEN=duffel_live_... node ops/fetch-duffel-airlines.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const TOKEN = process.env.DUFFEL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('DUFFEL_ACCESS_TOKEN is not set.');
  process.exit(1);
}

const OUT = path.join(process.cwd(), 'data', 'airline-refs', 'duffel.json');

const all = [];
let after = null;
for (let page = 0; page < 50; page++) {
  const url = new URL('https://api.duffel.com/air/airlines');
  url.searchParams.set('limit', '200');
  if (after) url.searchParams.set('after', after);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Duffel-Version': 'v2', Accept: 'application/json' },
  });
  if (!res.ok) {
    console.error('Duffel returned', res.status, (await res.text()).slice(0, 300));
    process.exit(1);
  }
  const body = await res.json();
  all.push(...body.data);
  after = body.meta?.after;
  if (!after) break;
}

const airlines = {};
for (const a of all) {
  if (!a.iata_code) continue;
  const entry = { name: a.name };
  if (a.conditions_of_carriage_url) entry.conditionsOfCarriageUrl = a.conditions_of_carriage_url;
  if (a.logo_symbol_url) entry.logoSymbolUrl = a.logo_symbol_url;
  // An entry with neither is just a name we already have from Strapi.
  if (!entry.conditionsOfCarriageUrl && !entry.logoSymbolUrl) continue;
  airlines[a.iata_code.toUpperCase()] = entry;
}

const retrieved = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  OUT,
  JSON.stringify(
    { source: 'Duffel Airlines API (api.duffel.com/air/airlines, Duffel-Version v2)', retrieved, airlines },
    null,
    1,
  ) + '\n',
);

const withCoc = Object.values(airlines).filter((a) => a.conditionsOfCarriageUrl).length;
console.log(`${all.length} airlines listed, ${Object.keys(airlines).length} kept, ${withCoc} with conditions of carriage.`);
