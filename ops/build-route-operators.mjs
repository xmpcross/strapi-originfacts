#!/usr/bin/env node
/**
 * Rebuilds data/route-facts/operators.json — the evidence lib/route-carriers.ts
 * uses to decide whether a carrier attached to a Strapi route is credible.
 *
 * Strapi route `carriers` were ingested from the TravelPayouts routes dump by
 * IATA code (ai-writer-cli/ingest-travelpayouts.js). The routes that are live
 * today were created before that script learned to skip codeshare rows, and
 * the dump is an old snapshot whose codes have since been recycled (DJ was
 * Virgin Blue's, US was US Airways'). The CMS resolved each code to whoever
 * holds it now. This script re-reads the same dump and records, per route:
 *
 *   pairs[ORIGIN-DEST].operating   codes the dump lists as operating the pair
 *   pairs[ORIGIN-DEST].codeshare   codes it lists only as a marketing codeshare
 *   networks[CODE]                 countries the code's operating network
 *                                  touches (TravelPayouts country names), for
 *                                  codes on a route or in route-facts/all.json
 *
 * It reads the dump from disk and makes one read-only GET to Strapi for the
 * route list. It writes nothing to Strapi.
 *
 *   node ops/build-route-operators.mjs [--tp-dir DIR] [--routes routes.json]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

const TP_DIR = arg('--tp-dir', '/opt/strapi-cms-git/backend/ai-writer-cli/tp-data');
const ROUTES_FILE = arg('--routes', null);
const OUT = path.join(process.cwd(), 'data', 'route-facts', 'operators.json');

const read = (f) => JSON.parse(fs.readFileSync(path.join(TP_DIR, f), 'utf8'));
const dump = read('routes.json');
const airports = read('airports.json');
const countries = read('countries.json');

async function loadRoutes() {
  if (ROUTES_FILE) return JSON.parse(fs.readFileSync(ROUTES_FILE, 'utf8')).data;
  const base = (process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');
  const url = `${base}/api/routes?fields[0]=slug&populate[origin][fields][0]=iata&populate[destination][fields][0]=iata&populate[carriers][fields][0]=iataCode&pagination[pageSize]=1000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Strapi returned ${res.status}`);
  return (await res.json()).data;
}

const routes = await loadRoutes();
const countryName = new Map(countries.map((c) => [c.code, c.name]));
const airportCountry = new Map(airports.map((a) => [a.code, countryName.get(a.country_code) ?? a.country_code]));

const wanted = new Set(routes.map((r) => `${r.origin?.iata}-${r.destination?.iata}`.toUpperCase()));
// Networks for every code on a route, plus every code with a route-facts
// profile (airline pages' "where they fly" comes from that file, by code).
let factCodes = [];
try {
  factCodes = Object.keys(JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'route-facts', 'all.json'), 'utf8')));
} catch {
  /* no route-facts file */
}
const codes = new Set(
  [...routes.flatMap((r) => (r.carriers ?? []).map((c) => (c.iataCode ?? '').toUpperCase())), ...factCodes].filter(Boolean),
);

const pairs = {};
const networks = new Map();
for (const row of dump) {
  const code = (row.airline_iata || '').toUpperCase();
  const o = (row.departure_airport_iata || '').toUpperCase();
  const d = (row.arrival_airport_iata || '').toUpperCase();
  if (!code || !o || !d) continue;
  const key = `${o}-${d}`;
  if (wanted.has(key)) {
    pairs[key] ??= { operating: new Set(), codeshare: new Set() };
    pairs[key][row.codeshare ? 'codeshare' : 'operating'].add(code);
  }
  if (codes.has(code) && !row.codeshare) {
    if (!networks.has(code)) networks.set(code, new Set());
    for (const ap of [o, d]) {
      const c = airportCountry.get(ap);
      if (c) networks.get(code).add(c);
    }
  }
}

const sorted = (s) => [...s].sort();
const out = {
  source: 'TravelPayouts routes/airports/countries dump (the data Strapi routes were ingested from)',
  dumpFile: path.join(TP_DIR, 'routes.json'),
  dumpModified: fs.statSync(path.join(TP_DIR, 'routes.json')).mtime.toISOString().slice(0, 10),
  built: new Date().toISOString().slice(0, 10),
  pairs: Object.fromEntries(
    Object.keys(pairs)
      .sort()
      .map((k) => {
        const operating = sorted(pairs[k].operating);
        // A code that also operates the pair is not codeshare-only.
        const codeshare = sorted(pairs[k].codeshare).filter((c) => !pairs[k].operating.has(c));
        return [k, { operating, codeshare }];
      }),
  ),
  networks: Object.fromEntries([...networks.keys()].sort().map((k) => [k, sorted(networks.get(k))])),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
// One pair / network per line: readable diffs when the snapshot is rebuilt.
const block = (obj) =>
  '{\n' + Object.entries(obj).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n }';
const head = Object.entries(out)
  .filter(([k]) => k !== 'pairs' && k !== 'networks')
  .map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
fs.writeFileSync(OUT, `{\n${head.join(',\n')},\n "pairs": ${block(out.pairs)},\n "networks": ${block(out.networks)}\n}\n`);
console.log(`routes ${routes.length}, pairs found ${Object.keys(out.pairs).length}, carrier networks ${networks.size} → ${OUT}`);
