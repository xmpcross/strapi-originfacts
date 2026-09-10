#!/usr/bin/env node
/**
 * Snapshot operating status for the airline directory from Wikidata.
 *
 * The directory was ingested from an IATA code list, which carries no notion
 * of whether a carrier still flies. This script asks Wikidata for every entity
 * that holds an IATA (P229) or ICAO (P230) airline designator together with
 * its "dissolved, abolished or demolished" date (P576), then matches those
 * against the airlines in Strapi and writes the ones that have ceased to
 * data/airline-status/wikidata.json.
 *
 * Matching is deliberately conservative — IATA codes are recycled, and the
 * Strapi rows themselves carry some wrong codes (Air Berlin is stored under
 * the designators of its LGW subsidiary; Kulula's IATA is two Cyrillic letters).
 * A carrier is marked as ceased only when:
 *
 *   1. a Wikidata entity shares one of its designators, its name overlaps, AND
 *      either the normalised names are identical or both IATA and ICAO agree;
 *      AND no entity sharing a designator with an overlapping name is still
 *      active (no P576) — or
 *   2. no designator matches at all, exactly one Wikidata entity has the
 *      identical normalised name, it carries a P576 date, and either its label
 *      is literally the Strapi name or the Strapi row has no usable designator.
 *
 * Anything that fails both rules is left unlabelled. Missing is honest;
 * a wrong "ceased" banner on a flying carrier is not.
 *
 * Every entry records the Wikidata item URL and the retrieval date so the page
 * can cite it. Re-run to refresh:
 *
 *   node ops/fetch-airline-status-wikidata.mjs
 *
 * Reads NEXT_PUBLIC_STRAPI_URL from the environment (falls back to the
 * production CMS) and needs no token — the airline collection is public.
 */
import fs from 'node:fs';
import path from 'node:path';

const STRAPI = (process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');
const OUT = path.join(process.cwd(), 'data', 'airline-status', 'wikidata.json');
const UA = 'originfacts.com airline-status snapshot (contact@originfacts.com)';

const SPARQL = `
SELECT ?item ?itemLabel ?iata ?icao ?dissolved WHERE {
  { ?item wdt:P229 ?iata . } UNION { ?item wdt:P230 ?icao . }
  OPTIONAL { ?item wdt:P229 ?iata . }
  OPTIONAL { ?item wdt:P230 ?icao . }
  OPTIONAL { ?item wdt:P576 ?dissolved . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

const GENERIC = new Set([
  'the', 'airline', 'airlines', 'airway', 'airways', 'aviation', 'air', 'ltd', 'limited', 'inc', 'co',
  'company', 'sa', 'ag', 'plc', 'llc', 'international', 'linhas', 'aereas', 'com', 'de', 'of',
]);

function normalise(name) {
  const ascii = (name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ');
  return ascii
    .split(/\s+/)
    .filter((t) => t && !GENERIC.has(t));
}

const asciiCode = (c) => {
  const v = (c || '').trim().toUpperCase();
  return /^[A-Z0-9]{2,3}$/.test(v) ? v : '';
};

async function fetchStrapiAirlines() {
  const out = [];
  for (let page = 1; ; page++) {
    const url =
      `${STRAPI}/api/airlines?pagination[page]=${page}&pagination[pageSize]=200` +
      `&fields[0]=name&fields[1]=slug&fields[2]=iataCode&fields[3]=icaoCode&sort=name`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`Strapi ${res.status} for ${url}`);
    const json = await res.json();
    for (const row of json.data) out.push(row.attributes ? { id: row.id, ...row.attributes } : row);
    const pg = json.meta?.pagination;
    if (!pg || page >= pg.pageCount) break;
  }
  return out;
}

async function fetchWikidata() {
  const res = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(SPARQL), {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  const json = await res.json();
  const byItem = new Map();
  for (const b of json.results.bindings) {
    const item = b.item.value;
    const row = byItem.get(item) ?? {
      item,
      label: b.itemLabel?.value ?? '',
      iata: new Set(),
      icao: new Set(),
      dissolved: b.dissolved?.value?.slice(0, 10) ?? null,
    };
    if (b.iata?.value) row.iata.add(asciiCode(b.iata.value));
    if (b.icao?.value) row.icao.add(asciiCode(b.icao.value));
    if (b.dissolved?.value && !row.dissolved) row.dissolved = b.dissolved.value.slice(0, 10);
    byItem.set(item, row);
  }
  return [...byItem.values()].map((r) => ({ ...r, tokens: normalise(r.label), iata: [...r.iata].filter(Boolean), icao: [...r.icao].filter(Boolean) }));
}

function overlaps(a, b) {
  return a.some((t) => b.includes(t));
}

function match(airline, wd) {
  const iata = asciiCode(airline.iataCode);
  const icao = asciiCode(airline.icaoCode);
  const tokens = normalise(airline.name);
  const joined = tokens.join(' ');
  if (!joined) return null;

  const byCode = wd.filter((w) => (iata && w.iata.includes(iata)) || (icao && w.icao.includes(icao)));
  const overlap = byCode.filter((w) => overlaps(tokens, w.tokens));
  const active = overlap.filter((w) => !w.dissolved);
  const strong = overlap.filter(
    (w) => w.dissolved && (w.tokens.join(' ') === joined || (iata && icao && w.iata.includes(iata) && w.icao.includes(icao))),
  );
  if (strong.length && !active.length) {
    const best = strong.find((w) => w.tokens.join(' ') === joined) ?? strong[0];
    return { ...best, match: 'designator+name' };
  }
  if (overlap.length) return null; // a designator matched something we could not resolve — leave it alone

  // Name-only fallback. Accepted only when the Wikidata label is literally the
  // Strapi name (Air Berlin) or the Strapi row has no usable designator at all
  // (Kulula, whose IATA is stored as two Cyrillic letters). "Southern Air" vs
  // "Southern Airways" or "Northwest" vs "Northwest Airlines" must not match.
  const sameName = wd.filter((w) => w.tokens.join(' ') === joined);
  if (sameName.length === 1 && sameName[0].dissolved) {
    const w = sameName[0];
    const literal = w.label.trim().toLowerCase() === (airline.name || '').trim().toLowerCase();
    if (literal || (!iata && !icao)) return { ...w, match: 'name' };
  }
  return null;
}

const [airlines, wd] = await Promise.all([fetchStrapiAirlines(), fetchWikidata()]);
const retrieved = new Date().toISOString().slice(0, 10);
const ceased = {};
for (const a of airlines) {
  const m = match(a, wd);
  if (!m) continue;
  ceased[a.slug] = {
    name: a.name,
    iata: asciiCode(a.iataCode) || null,
    icao: asciiCode(a.icaoCode) || null,
    ceasedOn: m.dissolved,
    wikidata: m.item,
    wikidataLabel: m.label,
    match: m.match,
  };
}

const sorted = Object.fromEntries(Object.entries(ceased).sort(([a], [b]) => a.localeCompare(b)));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: 'Wikidata — dissolved, abolished or demolished date (P576) on entities holding an IATA (P229) or ICAO (P230) airline designator',
      sourceUrl: 'https://query.wikidata.org/',
      retrieved,
      strapiAirlines: airlines.length,
      wikidataEntities: wd.length,
      ceased: sorted,
    },
    null,
    2,
  ) + '\n',
);
console.log(`${Object.keys(sorted).length} of ${airlines.length} airlines matched a Wikidata dissolution date → ${path.relative(process.cwd(), OUT)}`);
