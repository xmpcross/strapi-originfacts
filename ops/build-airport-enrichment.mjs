#!/usr/bin/env node
/**
 * Builds data/airport-enrichment/ — per-airport facts from free, open sources
 * for the airport pages (components/airport-v2/AirportGuideV2.tsx). The pages
 * read these files at build/revalidate time; nothing here is called at runtime.
 *
 * Sources (see data/airport-enrichment/README.md for licences):
 *   ourairports   OurAirports airports.csv + runways.csv (public domain), bulk download
 *   wikidata      Wikidata Query Service (CC0), batched SPARQL by ICAO
 *   fares         Travelpayouts Data API /v1/prices/direct (free for partners,
 *                 token in .env.local TRAVELPAYOUTS_API_TOKEN) — destinations
 *                 with a nonstop fare in Aviasales' recent search cache
 *   climate       NASA POWER daily point API (free, no key) — 2016–2025 daily
 *                 values aggregated to monthly normals
 *   computed      distance/direction to the city centre, nearest airports
 *                 with scheduled service (no network)
 *
 * It makes read-only GETs to Strapi for the airport list and route origins.
 * It writes nothing to Strapi.
 *
 *   node ops/build-airport-enrichment.mjs                 # every step
 *   node ops/build-airport-enrichment.mjs --steps ourairports,wikidata,computed
 *   node ops/build-airport-enrichment.mjs --steps fares,climate --only DUB,ORY
 *   node ops/build-airport-enrichment.mjs --network all   # fares + climate for every airport
 *
 * Flags:
 *   --steps     comma list of ourairports,wikidata,fares,climate,computed (default all)
 *   --only      comma list of IATA codes (merged into the existing files)
 *   --network   indexable (default) | all — which airports get the per-airport
 *               network calls (fares, climate). "indexable" = reviewed guides
 *               (PUBLISHED_AIRPORT_IATAS) + airports with route records.
 *   --cache     directory for downloaded source files (default: os tmpdir)
 *   --refresh   re-download cached bulk files
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  airportNamesMatch,
  bearingDeg,
  compass16,
  filterFareEvidence,
  fold,
  haversineKm,
  indexOurAirports,
  joinOurAirports,
  monthlyNormals,
  parseCsv,
  pickOpening,
  pickPatronage,
  pickWikidataItem,
  runwaysFor,
} from '../lib/airport-enrichment-joins.mjs';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'data', 'airport-enrichment');
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const STEPS = new Set((arg('--steps', 'ourairports,wikidata,fares,climate,computed') || '').split(',').filter(Boolean));
const ONLY = arg('--only', null)?.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) ?? null;
const NETWORK = arg('--network', 'indexable');
const CACHE = arg('--cache', path.join(os.tmpdir(), 'airport-enrichment-cache'));
const REFRESH = args.includes('--refresh');
const TODAY = new Date().toISOString().slice(0, 10);
const UA = 'OriginfactsAirportEnrichment/1.0 (https://www.originfacts.com/contact)';

fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[enrich]`, ...a);

loadEnv(path.join(ROOT, '.env.local'));

/* ------------------------------------------------------------------ *
 * IO helpers
 * ------------------------------------------------------------------ */

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

async function fetchRetry(url, init = {}, { tries = 5, label = url } = {}) {
  let wait = 2000;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers || {}) } });
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get('retry-after'));
        const ms = Number.isFinite(ra) && ra > 0 ? ra * 1000 : wait;
        log(`${label}: HTTP ${res.status}, retry in ${Math.round(ms / 1000)}s`);
        await sleep(ms);
        wait *= 2;
        continue;
      }
      return res;
    } catch (e) {
      log(`${label}: ${e.message}, retry in ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      wait *= 2;
    }
  }
  throw new Error(`${label}: gave up after ${tries} tries`);
}

async function cachedDownload(url, name) {
  const file = path.join(CACHE, name);
  if (!REFRESH && fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < 7 * 864e5) return fs.readFileSync(file, 'utf8');
  log(`download ${url}`);
  const res = await fetchRetry(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const text = await res.text();
  fs.writeFileSync(file, text);
  return text;
}

/** Existing output file (to merge --only runs into), or an empty shell. */
function readOut(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(OUT_DIR, name), 'utf8'));
  } catch {
    return { airports: {} };
  }
}

/** One airport per line: readable diffs, no pretty-print bloat. */
function writeOut(name, meta, airports) {
  const keys = Object.keys(airports).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(airports[k])}`).join(',\n');
  const head = JSON.stringify(meta, null, 1).replace(/\n}$/, '');
  fs.writeFileSync(path.join(OUT_DIR, name), `${head},\n"airports":{\n${body}\n}}\n`);
  log(`wrote ${name}: ${keys.length} airports, ${(fs.statSync(path.join(OUT_DIR, name)).size / 1024).toFixed(0)} KB`);
}

/* ------------------------------------------------------------------ *
 * Strapi (read-only)
 * ------------------------------------------------------------------ */

const STRAPI = (process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');

async function strapiAll(collection, query) {
  const out = [];
  for (let page = 1; ; page++) {
    const url = `${STRAPI}/api/${collection}?${query}&pagination[pageSize]=100&pagination[page]=${page}`;
    const res = await fetchRetry(url, {}, { label: `strapi ${collection} p${page}` });
    if (!res.ok) throw new Error(`Strapi ${collection}: HTTP ${res.status}`);
    const json = await res.json();
    out.push(...json.data);
    if (page >= (json.meta?.pagination?.pageCount ?? 1)) break;
  }
  return out;
}

async function loadCmsAirports() {
  const file = path.join(CACHE, `cms-airports-${TODAY}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const fields = ['iata', 'icao', 'name', 'city', 'country', 'countryCode', 'latitude', 'longitude']
    .map((f, i) => `fields[${i}]=${f}`)
    .join('&');
  const rows = await strapiAll('airports', fields);
  fs.writeFileSync(file, JSON.stringify(rows));
  return rows;
}

async function loadRouteOrigins() {
  const file = path.join(CACHE, `cms-route-origins-${TODAY}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = await strapiAll('routes', 'fields[0]=slug&populate[origin][fields][0]=iata');
  const origins = [...new Set(rows.map((r) => r.origin?.iata?.toUpperCase()).filter(Boolean))];
  fs.writeFileSync(file, JSON.stringify(origins));
  return origins;
}

function publishedIatas() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'entity-seo.ts'), 'utf8');
  const block = src.match(/PUBLISHED_AIRPORT_IATAS = new Set\(\[([\s\S]*?)\]\)/);
  return block ? [...block[1].matchAll(/'([A-Z]{3})'/g)].map((m) => m[1]) : [];
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

const cmsRaw = await loadCmsAirports();
const cms = cmsRaw
  .filter((a) => a.iata && /^[A-Za-z]{3}$/.test(a.iata))
  .map((a) => ({ ...a, iata: a.iata.toUpperCase(), icao: a.icao?.trim().toUpperCase() || null }));
const cmsByIata = new Map(cms.map((a) => [a.iata, a]));
const indexable = new Set([...publishedIatas(), ...(await loadRouteOrigins())]);
const selected = ONLY ? cms.filter((a) => ONLY.includes(a.iata)) : cms;
const networkSet = selected.filter((a) => NETWORK === 'all' || indexable.has(a.iata) || ONLY);
log(`${cms.length} CMS airports, ${indexable.size} indexable, ${selected.length} selected, ${networkSet.length} for network steps`);

/* ---------- OurAirports ---------- */

const OA_BASE = 'https://davidmegginson.github.io/ourairports-data';
let oaRows = null;
let oaIndex = null;
async function ourAirports() {
  if (!oaRows) {
    oaRows = parseCsv(await cachedDownload(`${OA_BASE}/airports.csv`, 'airports.csv'));
    oaIndex = indexOurAirports(oaRows);
  }
  return { rows: oaRows, index: oaIndex };
}

if (STEPS.has('ourairports')) {
  const { index } = await ourAirports();
  const runwayRows = parseCsv(await cachedDownload(`${OA_BASE}/runways.csv`, 'runways.csv'));
  const runwaysByRef = new Map();
  for (const r of runwayRows) {
    const list = runwaysByRef.get(r.airport_ref) ?? [];
    list.push(r);
    runwaysByRef.set(r.airport_ref, list);
  }
  const prev = readOut('ourairports.json');
  const airports = ONLY ? { ...prev.airports } : {};
  const misses = {};
  for (const a of selected) {
    const j = joinOurAirports(a, index);
    if (!j.row) {
      misses[j.reason] = (misses[j.reason] ?? 0) + 1;
      delete airports[a.iata];
      continue;
    }
    const r = j.row;
    const { runways, closedCount } = runwaysFor(runwaysByRef.get(r.id) ?? []);
    const num = (v) => (v === '' || v == null ? null : Number(v));
    airports[a.iata] = clean({
      id: Number(r.id),
      ident: r.ident,
      icao: r.icao_code || null,
      iata: r.iata_code || null,
      joinedBy: j.joinedBy,
      supersededIcao: j.supersededIcao,
      name: r.name,
      type: r.type,
      lat: num(r.latitude_deg),
      lon: num(r.longitude_deg),
      elevationFt: num(r.elevation_ft),
      country: r.iso_country,
      municipality: r.municipality || null,
      scheduledService: r.scheduled_service === 'yes',
      homeLink: r.home_link || null,
      wikipediaLink: r.wikipedia_link || null,
      runways,
      closedRunways: closedCount || undefined,
    });
  }
  log('ourairports misses', misses);
  writeOut(
    'ourairports.json',
    {
      source: 'OurAirports',
      sourceUrl: 'https://ourairports.com/data/',
      files: [`${OA_BASE}/airports.csv`, `${OA_BASE}/runways.csv`],
      licence: 'Public domain (OurAirports data is released into the public domain)',
      retrieved: TODAY,
      join: 'ICAO first (icao_code, then ident, then gps_code), accepted when the IATA and the country or name also agree, or the coordinates are within 30 km; IATA only when the record has no ICAO (or one unknown to OurAirports, then coordinates required), with country and name agreeing and coordinates within 30 km',
    },
    airports,
  );
}

/* ---------- Wikidata ---------- */

const WDQS = 'https://query.wikidata.org/sparql';

async function sparql(query, label) {
  const res = await fetchRetry(
    WDQS,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
      body: new URLSearchParams({ query }).toString(),
    },
    { label: `wikidata ${label}` },
  );
  if (!res.ok) throw new Error(`wikidata ${label}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  await sleep(1500);
  return (await res.json()).results.bindings;
}

const qidOf = (uri) => uri?.replace(/^https?:\/\/www\.wikidata\.org\/entity\//, '') ?? null;
const v = (b, k) => b[k]?.value ?? null;

if (STEPS.has('wikidata')) {
  const oa = readOut('ourairports.json').airports;
  const targets = selected
    // The record's ICAO, unless OurAirports does not know it (superseded) or
    // the record has none: then the ICAO of the OurAirports row it joined.
    .map((a) => ({ iata: a.iata, icao: (!oa[a.iata]?.supersededIcao && a.icao) || oa[a.iata]?.icao || null }))
    .filter((a) => a.icao && /^[A-Z0-9]{4}$/.test(a.icao));
  const prev = readOut('wikidata.json');
  const airports = ONLY ? { ...prev.airports } : {};
  const BATCH = 60;
  let matched = 0;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const values = batch.map((a) => JSON.stringify(a.icao)).join(' ');
    const idRows = await sparql(
      `SELECT ?item ?icao ?iata ?dissolved ?label ?website ?enwiki WHERE {
        VALUES ?icao { ${values} }
        ?item wdt:P239 ?icao .
        OPTIONAL { ?item wdt:P238 ?iata }
        OPTIONAL { ?item wdt:P576 ?dissolved }
        OPTIONAL { ?item rdfs:label ?label FILTER(lang(?label) = "en") }
        OPTIONAL { ?item wdt:P856 ?website }
        OPTIONAL { ?enwiki schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      }`,
      `ids ${i}`,
    );
    const cand = new Map();
    for (const b of idRows) {
      const qid = qidOf(v(b, 'item'));
      const c = cand.get(qid) ?? { qid, icao: new Set(), iata: new Set(), dissolved: false, label: null, website: new Set(), enwiki: null };
      c.icao.add(v(b, 'icao'));
      if (v(b, 'iata')) c.iata.add(v(b, 'iata'));
      if (v(b, 'dissolved')) c.dissolved = true;
      c.label ??= v(b, 'label');
      if (v(b, 'website')) c.website.add(v(b, 'website'));
      c.enwiki ??= v(b, 'enwiki');
      cand.set(qid, c);
    }
    const all = [...cand.values()].map((c) => ({ ...c, icao: [...c.icao], iata: [...c.iata], website: [...c.website] }));
    const accepted = new Map();
    for (const a of batch) {
      const pick = pickWikidataItem(a, all.filter((c) => c.icao.map((x) => x.toUpperCase()).includes(a.icao)));
      if (pick) accepted.set(pick.qid, { airport: a, item: pick });
      else delete airports[a.iata];
    }
    if (!accepted.size) continue;
    const items = [...accepted.keys()].map((q) => `wd:${q}`).join(' ');

    const dates = await sparql(
      `SELECT ?item ?prop ?time ?prec WHERE {
        VALUES ?item { ${items} }
        VALUES (?p ?psv ?prop) { (p:P1619 psv:P1619 "P1619") (p:P571 psv:P571 "P571") }
        ?item ?p ?st . ?st ?psv ?tv ; wikibase:rank ?rank .
        FILTER(?rank != wikibase:DeprecatedRank)
        ?tv wikibase:timeValue ?time ; wikibase:timePrecision ?prec .
      }`,
      `dates ${i}`,
    );
    const people = await sparql(
      `SELECT ?item ?prop ?val ?valLabel WHERE {
        VALUES ?item { ${items} }
        VALUES (?wdt ?prop) { (wdt:P137 "operator") (wdt:P127 "owner") (wdt:P138 "namedAfter") (wdt:P931 "placeServed") }
        ?item ?wdt ?val .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }`,
      `labels ${i}`,
    );
    const places = await sparql(
      `SELECT ?item ?place ?coord WHERE {
        VALUES ?item { ${items} }
        ?item wdt:P931 ?place . ?place wdt:P625 ?coord .
      }`,
      `places ${i}`,
    );
    const pax = await sparql(
      `SELECT ?item ?st ?amount ?time ?scoped ?ref WHERE {
        VALUES ?item { ${items} }
        ?item p:P3872 ?st . ?st ps:P3872 ?amount ; wikibase:rank ?rank .
        FILTER(?rank != wikibase:DeprecatedRank)
        OPTIONAL { ?st pq:P585 ?time }
        OPTIONAL { ?st pq:P518 ?part }
        OPTIONAL { ?st pq:P642 ?of }
        BIND(BOUND(?part) || BOUND(?of) AS ?scoped)
        OPTIONAL { ?st prov:wasDerivedFrom/pr:P854 ?ref }
      }`,
      `patronage ${i}`,
    );
    const hubs = await sparql(
      `SELECT ?item ?airline ?airlineLabel ?aiata ?aicao ?dissolved WHERE {
        VALUES ?item { ${items} }
        ?airline p:P113 ?hs . ?hs ps:P113 ?item .
        FILTER NOT EXISTS { ?hs pq:P582 ?ended }
        OPTIONAL { ?airline wdt:P229 ?aiata }
        OPTIONAL { ?airline wdt:P230 ?aicao }
        OPTIONAL { ?airline wdt:P576 ?dissolved }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }`,
      `hubs ${i}`,
    );

    for (const [qid, { airport, item }] of accepted) {
      const mine = (rows) => rows.filter((b) => qidOf(v(b, 'item')) === qid);
      const opening = pickOpening(mine(dates).map((b) => ({ time: v(b, 'time'), precision: Number(v(b, 'prec')), prop: v(b, 'prop') })));
      const labelled = (prop) =>
        uniqBy(
          mine(people)
            .filter((b) => v(b, 'prop') === prop)
            .map((b) => ({ qid: qidOf(v(b, 'val')), label: v(b, 'valLabel') }))
            .filter((x) => x.label && x.label !== x.qid),
          (x) => x.qid,
        );
      const statements = new Map();
      for (const b of mine(pax)) {
        const st = v(b, 'st');
        const s = statements.get(st) ?? { value: Number(v(b, 'amount')), time: v(b, 'time'), scoped: v(b, 'scoped') === 'true', refUrl: null };
        s.refUrl ??= v(b, 'ref');
        statements.set(st, s);
      }
      const patronage = pickPatronage([...statements.values()]);
      const hubAirlines = uniqBy(
        mine(hubs)
          .filter((b) => !v(b, 'dissolved'))
          .map((b) => ({ qid: qidOf(v(b, 'airline')), label: v(b, 'airlineLabel'), iata: v(b, 'aiata'), icao: v(b, 'aicao') }))
          .filter((x) => x.label && x.label !== x.qid),
        (x) => x.qid,
      ).sort((x, y) => x.label.localeCompare(y.label));
      const placeServed = labelled('placeServed').map((p) => {
        const c = mine(places).find((b) => qidOf(v(b, 'place')) === p.qid);
        const m = c && v(c, 'coord').match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/);
        return m ? { ...p, lat: Number(m[2]), lon: Number(m[1]) } : p;
      });
      airports[airport.iata] = clean({
        qid,
        label: item.label,
        icao: airport.icao,
        enwiki: item.enwiki,
        website: item.website.length === 1 ? item.website[0] : undefined,
        opened: opening,
        operators: labelled('operator'),
        owners: labelled('owner'),
        namedAfter: labelled('namedAfter'),
        placeServed,
        patronage,
        hubAirlines,
      });
      matched++;
    }
    log(`wikidata ${Math.min(i + BATCH, targets.length)}/${targets.length}, matched ${matched}`);
  }
  writeOut(
    'wikidata.json',
    {
      source: 'Wikidata',
      sourceUrl: 'https://query.wikidata.org/',
      licence: 'CC0 1.0 (Wikidata structured data)',
      retrieved: TODAY,
      join: 'ICAO (P239) equal to the airport ICAO; any IATA (P238) on the item must equal the airport IATA; dissolved items (P576) skipped; exactly one item must qualify',
      properties: {
        opened: 'date of official opening (P1619), else inception (P571); dropped when values disagree on the year',
        operators: 'operator (P137)',
        owners: 'owned by (P127)',
        namedAfter: 'named after (P138)',
        placeServed: 'place served by transport hub (P931), with its coordinate location (P625)',
        patronage: 'patronage (P3872) with point in time (P585), latest year; statements scoped by P518/P642 skipped',
        hubAirlines: 'airlines whose airline hub (P113) is this airport, without an end time (P582) and not dissolved (P576)',
        website: 'official website (P856), only when the item has exactly one',
      },
    },
    airports,
  );
}

/* ---------- Travelpayouts nonstop fares ---------- */

if (STEPS.has('fares')) {
  const token = process.env.TRAVELPAYOUTS_API_TOKEN;
  if (!token) throw new Error('TRAVELPAYOUTS_API_TOKEN missing from .env.local');
  const tpAirports = JSON.parse(await cachedDownload('https://api.travelpayouts.com/data/en/airports.json', 'tp-airports.json'));
  const tpCities = JSON.parse(await cachedDownload('https://api.travelpayouts.com/data/en/cities.json', 'tp-cities.json'));
  const tpCountries = JSON.parse(await cachedDownload('https://api.travelpayouts.com/data/en/countries.json', 'tp-countries.json'));
  const tpAirlines = JSON.parse(await cachedDownload('https://api.travelpayouts.com/data/en/airlines.json', 'tp-airlines.json'));
  const airportByCode = new Map(tpAirports.map((a) => [a.code, a]));
  const cityByCode = new Map(tpCities.map((c) => [c.code, c]));
  const countryName = new Map(tpCountries.map((c) => [c.code, c.name]));
  const airlineName = new Map(tpAirlines.map((a) => [a.code, a.name_translations?.en || a.name]));

  // Home country per airline code, for filterFareEvidence(): the CMS airline
  // holding the code whose name matches the Travelpayouts name (exactly one).
  const cmsAirlines = await strapiAll('airlines', 'fields[0]=slug&fields[1]=name&fields[2]=iataCode&fields[3]=country');
  const homeOf = (code) => {
    const tp = airlineName.get(code);
    const hits = cmsAirlines.filter((x) => x.iataCode?.toUpperCase() === code && tp && airportNamesMatch(x.name, tp) && x.country);
    return hits.length === 1 ? hits[0].country : null;
  };

  const prev = readOut('fares.json');
  const airports = ONLY || NETWORK !== 'all' ? { ...prev.airports } : {};
  const usedAirlines = new Set();
  const rawDir = path.join(CACHE, `fares-raw-${TODAY}`);
  fs.mkdirSync(rawDir, { recursive: true });
  let n = 0;
  for (const a of networkSet) {
    // Raw responses are kept for the day so the derivation can be re-run
    // without calling the API again.
    const rawFile = path.join(rawDir, `${a.iata}.json`);
    let json;
    if (fs.existsSync(rawFile)) json = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
    else {
      const url = `https://api.travelpayouts.com/v1/prices/direct?origin=${a.iata}&destination=-&currency=usd`;
      const res = await fetchRetry(url, { headers: { 'X-Access-Token': token } }, { label: `fares ${a.iata}` });
      await sleep(700); // limit is 180/min per token; stay well under it
      if (!res.ok) {
        log(`fares ${a.iata}: HTTP ${res.status}`);
        continue;
      }
      json = await res.json();
      fs.writeFileSync(rawFile, JSON.stringify(json));
    }
    n++;
    if (!json.success) {
      log(`fares ${a.iata}: not successful`);
      continue;
    }
    const dests = [];
    for (const [code, offers] of Object.entries(json.data ?? {})) {
      if (code === a.iata) continue;
      const ap = airportByCode.get(code);
      const city = cityByCode.get(ap?.city_code ?? code);
      const cc = ap?.country_code ?? city?.country_code ?? null;
      const name = city?.name_translations?.en || city?.name || ap?.name_translations?.en || ap?.name;
      if (!name || (ap?.city_code ?? code) === a.iata) continue;
      const carriers = [...new Set(Object.values(offers).map((o) => o.airline).filter((x) => /^[A-Z0-9]{2}$/.test(x ?? '')))];
      if (carriers.length) dests.push({ code, name, cc, country: cc ? countryName.get(cc) ?? null : null, airlines: carriers });
    }
    const { kept, excluded } = filterFareEvidence(dests, { originCountry: a.country ?? null, homeOf });
    const airlines = {};
    for (const d of kept) for (const c of d.airlines) {
      airlines[c] = (airlines[c] ?? 0) + 1;
      usedAirlines.add(c);
    }
    kept.sort((x, y) => (x.cc ?? '').localeCompare(y.cc ?? '') || x.name.localeCompare(y.name));
    if (kept.length) {
      airports[a.iata] = clean({
        retrieved: TODAY,
        destinations: kept.map(({ country, ...d }) => d),
        airlines,
        excluded: excluded.length ? excluded : undefined,
      });
    } else delete airports[a.iata];
    if (n % 25 === 0) log(`fares ${n}/${networkSet.length}`);
  }
  for (const x of Object.values(airports)) for (const c of Object.keys(x.airlines ?? {})) usedAirlines.add(c);
  const names = {};
  for (const c of [...usedAirlines].sort()) if (airlineName.get(c)) names[c] = airlineName.get(c);
  const countries = {};
  for (const x of Object.values(airports)) for (const d of x.destinations) if (d.cc && countryName.get(d.cc)) countries[d.cc] = countryName.get(d.cc);
  writeOut(
    'fares.json',
    {
      source: 'Travelpayouts Data API — cheapest nonstop fares (/v1/prices/direct)',
      sourceUrl: 'https://support.travelpayouts.com/hc/en-us/articles/203956163-Aviasales-Data-API',
      licence: 'Travelpayouts partner Data API (free for partners); data from Aviasales search cache',
      retrieved: TODAY,
      meaning:
        'Destinations for which Aviasales users found a nonstop fare from this airport in the days before retrieval, with the airline named on the cheapest such fare (it can be the selling partner on a codeshare). Not a schedule; not a complete list of routes or airlines.',
      filter:
        'An airline named on only one fare from the airport, whose home country (CMS airline holding the code with a matching name) is neither the airport\'s nor the destination\'s, is excluded as a likely codeshare or data error; destinations left with no airline are dropped. Exclusions are kept per airport under "excluded".',
      airlineNames: names,
      countryNames: countries,
    },
    airports,
  );
}

/* ---------- NASA POWER climate ---------- */

if (STEPS.has('climate')) {
  const oa = readOut('ourairports.json').airports;
  const prev = readOut('climate.json');
  const airports = { ...prev.airports };
  const START = '20160101';
  const END = '20251231';
  let n = 0;
  for (const a of networkSet) {
    // OurAirports coordinates first: the record's are rounded and some point at the city.
    const lat = oa[a.iata]?.lat ?? a.latitude;
    const lon = oa[a.iata]?.lon ?? a.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    if (!ONLY && airports[a.iata]?.period === `${START}-${END}` && !REFRESH) continue;
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR&community=AG&longitude=${lon.toFixed(3)}&latitude=${lat.toFixed(3)}&start=${START}&end=${END}&format=JSON`;
    const res = await fetchRetry(url, {}, { label: `climate ${a.iata}` });
    await sleep(1000);
    n++;
    if (!res.ok) {
      log(`climate ${a.iata}: HTTP ${res.status}`);
      continue;
    }
    const p = (await res.json()).properties?.parameter;
    if (!p?.T2M_MAX) continue;
    const months = monthlyNormals(p.T2M_MAX, p.T2M_MIN, p.PRECTOTCORR);
    if (months.some((m) => m.hiC == null || m.loC == null)) continue;
    airports[a.iata] = { lat: Number(lat.toFixed(3)), lon: Number(lon.toFixed(3)), period: `${START}-${END}`, months: months.map((m) => [m.hiC, m.loC, m.precipMm]) };
    if (n % 25 === 0) log(`climate ${n}/${networkSet.length}`);
  }
  writeOut(
    'climate.json',
    {
      source: 'NASA POWER (Prediction Of Worldwide Energy Resources), daily point API v2, MERRA-2 based',
      sourceUrl: 'https://power.larc.nasa.gov/',
      licence: 'NASA open data — free to use, no restrictions; cite NASA Langley Research Center POWER Project',
      retrieved: TODAY,
      period: '2016-01-01 to 2025-12-31 (10 full years)',
      columns: ['mean daily maximum °C', 'mean daily minimum °C', 'mean monthly precipitation mm'],
      resolution: 'Gridded reanalysis (about 0.5° × 0.625°), not an airport weather station',
    },
    airports,
  );
}

/* ---------- Computed ---------- */

if (STEPS.has('computed')) {
  const { rows } = await ourAirports();
  const oa = readOut('ourairports.json').airports;
  const wd = readOut('wikidata.json').airports;
  const cityCoords = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'destination-coordinates.json'), 'utf8')).cities;
  const scheduled = rows
    .filter((r) => r.scheduled_service === 'yes' && /^[A-Z]{3}$/.test(r.iata_code) && ['large_airport', 'medium_airport', 'small_airport'].includes(r.type))
    .map((r) => ({ iata: r.iata_code, name: r.name, municipality: r.municipality, lat: Number(r.latitude_deg), lon: Number(r.longitude_deg), ident: r.ident }));
  const prev = readOut('computed.json');
  const airports = ONLY ? { ...prev.airports } : {};
  const slug = (s) => fold(s).replace(/ /g, '-');
  for (const a of selected) {
    const lat = oa[a.iata]?.lat ?? a.latitude;
    const lon = oa[a.iata]?.lon ?? a.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const entry = {};

    // City centre: the OSM city-centre point the destination guides use, else
    // Wikidata's "place served" when there is exactly one and its name is the
    // record's city. Either is dropped if it is over 100 km away.
    let city = null;
    const c = a.city ? cityCoords[slug(a.city)] : null;
    if (c) city = { name: a.city, lat: c.lat, lon: c.lng, source: 'osm', ref: c.osm };
    const served = wd[a.iata]?.placeServed?.filter((p) => typeof p.lat === 'number') ?? [];
    // Coordinates given to one decimal or less are a region/country centroid
    // (Singapore Q334 is 1.3, 103.8), not a city centre.
    const precise = (x) => Math.abs(x * 10 - Math.round(x * 10)) > 1e-9;
    if (!city && served.length === 1 && a.city && fold(served[0].label) === fold(a.city) && (precise(served[0].lat) || precise(served[0].lon))) {
      city = { name: served[0].label, lat: served[0].lat, lon: served[0].lon, source: 'wikidata', ref: served[0].qid };
    }
    if (city) {
      const km = haversineKm(lat, lon, city.lat, city.lon);
      if (km <= 100) {
        // Direction of the airport as seen from the city centre.
        entry.cityCentre = {
          name: city.name,
          km: Math.round(km * 10) / 10,
          compass: compass16(bearingDeg(city.lat, city.lon, lat, lon)),
          source: city.source,
          ref: city.ref,
        };
      }
    }

    const own = oa[a.iata]?.ident;
    entry.nearestScheduled = scheduled
      .filter((s) => s.iata !== a.iata && s.ident !== own)
      .map((s) => ({ iata: s.iata, name: s.name, municipality: s.municipality || undefined, km: Math.round(haversineKm(lat, lon, s.lat, s.lon)) }))
      .sort((x, y) => x.km - y.km)
      .slice(0, 1)
      .filter((s) => s.km <= 400);
    airports[a.iata] = clean(entry);
  }
  writeOut(
    'computed.json',
    {
      source: 'Calculated by Originfacts from airport coordinates',
      retrieved: TODAY,
      cityCentre:
        'Great-circle distance and 16-point compass direction of the airport from the city centre. City centre = OpenStreetMap Nominatim point in data/destination-coordinates.json (ODbL), else the Wikidata "place served" (P931) coordinates when there is exactly one and it is the record city. Dropped beyond 100 km.',
      nearestScheduled: 'The nearest other OurAirports airport with scheduled service and an IATA code, within 400 km, great-circle distance',
    },
    airports,
  );
}

writeMeta();

function writeMeta() {
  const files = ['ourairports.json', 'wikidata.json', 'fares.json', 'climate.json', 'computed.json'];
  const meta = { generatedBy: 'ops/build-airport-enrichment.mjs', updated: TODAY, files: {} };
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'));
      meta.files[f] = { retrieved: j.retrieved, airports: Object.keys(j.airports).length, bytes: fs.statSync(path.join(OUT_DIR, f)).size };
    } catch {
      /* not built yet */
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
}

/* ---------- utils ---------- */

function uniqBy(list, key) {
  const seen = new Set();
  return list.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Drop null/undefined/empty-array fields to keep the files small. */
function clean(o) {
  return Object.fromEntries(Object.entries(o).filter(([, x]) => x != null && !(Array.isArray(x) && x.length === 0)));
}

