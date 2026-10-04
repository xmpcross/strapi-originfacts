#!/usr/bin/env node
// Aviation-data reconciliation harness.
//
// Compares the Strapi aviation dataset against authoritative references and
// emits a reviewable, confidence-sorted diff. NEVER writes to the dataset.
//
// References used (no LLM recall — every row cites its source):
//   - OpenFlights airline registry (public dataset, includes historical
//     carriers): https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat
//   - Wikidata (P229 IATA / P230 ICAO / P17 country), queried per IATA code
//     with ALL candidates returned and matched by name — the entity URL is
//     the citation.
//   - Internal consistency (region ↔ country) cites the repo's own region map.
//
// Checks:
//   1. IATA well-formed (2 alnum), ICAO well-formed (3 alpha), both present
//   2. IATA/ICAO pair matches the reference registry
//   3. legalName is the entity itself, not a different airline sharing the code
//   4. country of registration matches the reference
//   5. region is consistent with country (internal map)
//   6. route carriers geographically plausible (foreign carrier on a domestic
//      route = almost certainly a stale/codeshare join)
//
// Usage:
//   node validate-aviation-data.mjs [--out report.md] [--json report.json]
//        [--gate baseline.json]   # exit 1 on violations not in the baseline
//        [--only slug1,slug2]     # limit to specific airline slugs (debug)
//
// Env: STRAPI_URL, STRAPI_API_TOKEN

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const OUT = opt('--out');
const JSON_OUT = opt('--json');
const GATE = opt('--gate');
const ONLY = opt('--only')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;

const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:8888';
const TOKEN = process.env.STRAPI_API_TOKEN;
if (!TOKEN) {
  console.error('STRAPI_API_TOKEN not set');
  process.exit(2);
}
const UA = 'originfacts-data-integrity/1.0 (https://originfacts.com)';

/* ---------------- Strapi ---------------- */

async function strapiAll(pathname, params) {
  const out = [];
  let page = 1;
  while (true) {
    const q = `${params}&pagination[page]=${page}&pagination[pageSize]=200`;
    const res = await fetch(`${STRAPI_URL}/api/${pathname}?${q}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`Strapi ${res.status} on ${pathname}`);
    const j = await res.json();
    out.push(...(j.data || []));
    if (!j.data || j.data.length < 200) break;
    page++;
  }
  return out;
}

/* ---------------- name matching (shared with enrich fix) ---------------- */

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function nameScore(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(na.split(' '));
  const tb = nb.split(' ');
  const overlap = tb.filter((t) => ta.has(t)).length;
  return overlap / Math.max(tb.length, ta.size);
}
const NAME_MATCH = 0.6;

/* ---------------- country-name normalisation ----------------
 * Synonyms between sources ("United States of America" vs "United States").
 * This is string normalisation, not aviation knowledge. */
const COUNTRY_ALIASES = {
  'united states of america': 'united states',
  usa: 'united states',
  "people's republic of china": 'china',
  'republic of china': 'taiwan',
  'republic of korea': 'south korea',
  korea: 'south korea',
  'republic of ireland': 'ireland',
  'kingdom of the netherlands': 'netherlands',
  'russian federation': 'russia',
  'czech republic': 'czechia',
  'hong kong s.a.r.': 'hong kong',
  burma: 'myanmar',
  'reunion island': 'reunion',
  réunion: 'reunion',
};
const cNorm = (s) => {
  const n = norm(s);
  return COUNTRY_ALIASES[n] || n;
};

/* ---------------- region map (mirror of ingest-travelpayouts.js) -------- */
function buildRegionMap() {
  const map = {};
  const add = (region, names) => names.forEach((n) => (map[cNorm(n)] = region));
  add('Oceania', ['Australia', 'New Zealand', 'Fiji', 'Papua New Guinea', 'Samoa', 'Tonga', 'Vanuatu', 'Solomon Islands', 'New Caledonia', 'French Polynesia', 'Kiribati', 'Nauru', 'Tuvalu', 'Guam', 'Cook Islands']);
  add('Asia', ['Japan', 'China', 'South Korea', 'North Korea', 'Taiwan', 'Hong Kong', 'Macau', 'Singapore', 'Malaysia', 'Indonesia', 'Thailand', 'Vietnam', 'Philippines', 'Cambodia', 'Laos', 'Myanmar', 'Brunei', 'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan', 'Mongolia', 'Maldives', 'Afghanistan', 'Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Uzbekistan', 'Timor-Leste', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Yemen', 'Iraq', 'Iran', 'Israel', 'Jordan', 'Lebanon', 'Syria', 'Palestine']);
  add('Europe', ['United Kingdom', 'Ireland', 'France', 'Germany', 'Spain', 'Portugal', 'Italy', 'Netherlands', 'Belgium', 'Luxembourg', 'Switzerland', 'Austria', 'Denmark', 'Sweden', 'Norway', 'Finland', 'Iceland', 'Poland', 'Czechia', 'Slovakia', 'Hungary', 'Romania', 'Bulgaria', 'Greece', 'Cyprus', 'Malta', 'Croatia', 'Slovenia', 'Serbia', 'Bosnia and Herzegovina', 'Montenegro', 'North Macedonia', 'Albania', 'Estonia', 'Latvia', 'Lithuania', 'Ukraine', 'Belarus', 'Russia', 'Moldova', 'Turkey', 'Georgia', 'Armenia', 'Azerbaijan', 'Kosovo', 'Faroe Islands', 'Gibraltar', 'Monaco', 'San Marino', 'Andorra']);
  add('North America', ['United States', 'Canada', 'Mexico', 'Guatemala', 'Belize', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Dominican Republic', 'Haiti', 'Jamaica', 'Puerto Rico', 'Bahamas', 'Barbados', 'Trinidad and Tobago', 'Greenland', 'Aruba', 'Curacao', 'Curaçao', 'Cayman Islands', 'Bermuda', 'Saint Lucia', 'Grenada', 'Antigua and Barbuda', 'Dominica', 'Saint Kitts and Nevis', 'Saint Vincent and the Grenadines', 'Guadeloupe', 'Martinique']);
  add('South America', ['Brazil', 'Argentina', 'Chile', 'Uruguay', 'Paraguay', 'Bolivia', 'Peru', 'Ecuador', 'Colombia', 'Venezuela', 'Guyana', 'Suriname', 'French Guiana', 'Falkland Islands']);
  add('Africa', ['South Africa', 'Egypt', 'Morocco', 'Tunisia', 'Algeria', 'Libya', 'Nigeria', 'Kenya', 'Ethiopia', 'Tanzania', 'Uganda', 'Rwanda', 'Ghana', 'Senegal', "Côte d'Ivoire", 'Ivory Coast', 'Cameroon', 'Mozambique', 'Zambia', 'Zimbabwe', 'Botswana', 'Namibia', 'Angola', 'Madagascar', 'Mauritius', 'Seychelles', 'Djibouti', 'Somalia', 'Sudan', 'South Sudan', 'Chad', 'Niger', 'Mali', 'Mauritania', 'Gambia', 'Guinea', 'Sierra Leone', 'Liberia', 'Burkina Faso', 'Benin', 'Togo', 'Gabon', 'Republic of the Congo', 'Democratic Republic of the Congo', 'Central African Republic', 'Equatorial Guinea', 'Eritrea', 'Malawi', 'Lesotho', 'Eswatini', 'Comoros', 'Cape Verde', 'Cabo Verde', 'Reunion', 'Burundi']);
  return map;
}
const REGION_BY_COUNTRY = buildRegionMap();

/* ---------------- references ---------------- */

// OpenFlights airlines.dat — CSV: id,"name","alias","iata","icao","callsign","country","active"
async function loadOpenFlights() {
  const url = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat';
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`OpenFlights fetch ${res.status}`);
  const text = await res.text();
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    // naive CSV split is fine here — fields with commas are quoted
    const fields = line.match(/("([^"]*)"|[^,]+)/g)?.map((f) => f.replace(/^"|"$/g, '').trim());
    if (!fields || fields.length < 8) continue;
    const [id, name, , iata, icao, , country, active] = fields;
    rows.push({
      id,
      name,
      iata: iata === '\\N' || iata === '-' ? '' : iata.toUpperCase(),
      icao: icao === '\\N' ? '' : icao.toUpperCase(),
      country: country === '\\N' ? '' : country,
      active: active === 'Y',
    });
  }
  const byIata = new Map();
  for (const r of rows) {
    if (!r.iata) continue;
    if (!byIata.has(r.iata)) byIata.set(r.iata, []);
    byIata.get(r.iata).push(r);
  }
  return { rows, byIata, url };
}

// Wikidata: all candidates per IATA code, chunked VALUES query.
async function loadWikidata(iataCodes) {
  const byIata = new Map();
  const chunks = [];
  for (let i = 0; i < iataCodes.length; i += 60) chunks.push(iataCodes.slice(i, i + 60));
  let n = 0;
  for (const chunk of chunks) {
    const values = chunk.map((c) => `"${c}"`).join(' ');
    const query = `
      SELECT ?a ?aLabel ?iata ?icao ?countryLabel WHERE {
        VALUES ?iata { ${values} }
        ?a wdt:P229 ?iata .
        OPTIONAL { ?a wdt:P230 ?icao }
        OPTIONAL { ?a wdt:P17 ?country }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }`;
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA } });
    if (!res.ok) {
      console.error(`  wikidata chunk failed: ${res.status} (continuing — affected codes stay unverified)`);
      continue;
    }
    const j = await res.json();
    for (const b of j.results?.bindings ?? []) {
      const code = b.iata?.value?.toUpperCase();
      if (!code) continue;
      if (!byIata.has(code)) byIata.set(code, []);
      byIata.get(code).push({
        entity: b.a?.value || '',
        name: b.aLabel?.value || '',
        icao: (b.icao?.value || '').toUpperCase(),
        country: b.countryLabel?.value || '',
      });
    }
    n++;
    process.stderr.write(`  wikidata: ${n}/${chunks.length} chunks\r`);
    await new Promise((r) => setTimeout(r, 1200)); // be polite to WDQS
  }
  process.stderr.write('\n');
  return byIata;
}

/* ---------------- main ---------------- */

console.error('Loading Strapi dataset…');
let airlines = await strapiAll(
  'airlines',
  'fields[0]=name&fields[1]=slug&fields[2]=iataCode&fields[3]=icaoCode&fields[4]=legalName&fields[5]=country&fields[6]=region',
);
if (ONLY) airlines = airlines.filter((a) => ONLY.includes(a.slug));
const routes = ONLY
  ? []
  : await strapiAll(
      'routes',
      'fields[0]=slug&populate[origin][fields][0]=iata&populate[origin][fields][1]=country&populate[destination][fields][0]=iata&populate[destination][fields][1]=country&populate[carriers][fields][0]=slug&populate[carriers][fields][1]=name&populate[carriers][fields][2]=iataCode&populate[carriers][fields][3]=country',
    );
console.error(`  ${airlines.length} airlines, ${routes.length} routes`);

console.error('Loading OpenFlights registry…');
const of = await loadOpenFlights();
console.error(`  ${of.rows.length} registry rows`);

console.error('Loading Wikidata candidates…');
const iataCodes = [...new Set(airlines.map((a) => (a.iataCode || '').toUpperCase()).filter((c) => /^[A-Z0-9]{2}$/.test(c)))];
const wd = await loadWikidata(iataCodes);
console.error(`  candidates for ${wd.size}/${iataCodes.length} IATA codes`);

const findings = []; // {confidence, type, record, field, current, reference, source, note}
const unverified = [];
const CONF_ORDER = { high: 0, medium: 1, low: 2 };
const add = (f) => findings.push(f);

/* ----- airline checks ----- */
for (const a of airlines) {
  const rec = `airline:${a.slug}`;
  const iata = (a.iataCode || '').toUpperCase();
  const icao = (a.icaoCode || '').toUpperCase();

  // 1. format/presence
  if (!iata) add({ confidence: 'medium', record: rec, field: 'iataCode', current: '(empty)', reference: '2-char IATA required', source: 'format rule', note: 'missing IATA' });
  else if (!/^[A-Z0-9]{2}$/.test(iata)) add({ confidence: 'high', record: rec, field: 'iataCode', current: iata, reference: '2 alphanumeric chars', source: 'format rule', note: 'malformed IATA' });
  if (!icao) add({ confidence: 'medium', record: rec, field: 'icaoCode', current: '(empty)', reference: '3-letter ICAO required', source: 'format rule', note: 'missing ICAO' });
  else if (!/^[A-Z]{3}$/.test(icao)) add({ confidence: 'high', record: rec, field: 'icaoCode', current: icao, reference: '3 alphabetic chars', source: 'format rule', note: 'malformed ICAO' });

  // Resolve reference identity by NAME among candidates sharing the IATA code.
  const wdCands = wd.get(iata) || [];
  const ofCands = of.byIata.get(iata) || [];
  const wdMatch = wdCands.map((c) => ({ c, s: nameScore(a.name, c.name) })).filter((x) => x.s >= NAME_MATCH).sort((x, y) => y.s - x.s)[0]?.c ?? null;
  const ofMatch = ofCands.map((c) => ({ c, s: nameScore(a.name, c.name) })).filter((x) => x.s >= NAME_MATCH).sort((x, y) => y.s - x.s)[0]?.c ?? null;

  if (!wdMatch && !ofMatch) {
    unverified.push({ record: rec, note: `no reference entity matches name "${a.name}" under IATA ${iata || '(none)'} (${wdCands.length} wikidata / ${ofCands.length} openflights candidates for the code)` });
  } else {
    const refIcao = wdMatch?.icao || ofMatch?.icao || '';
    const bothAgree = wdMatch && ofMatch && wdMatch.icao && ofMatch.icao && wdMatch.icao === ofMatch.icao;
    const src = wdMatch ? wdMatch.entity : `${of.url} (row: ${ofMatch?.name})`;
    // 2. ICAO pair vs registry
    if (icao && refIcao && icao !== refIcao) {
      add({ confidence: bothAgree ? 'high' : 'medium', record: rec, field: 'icaoCode', current: icao, reference: refIcao, source: src, note: `registry ICAO for "${a.name}" (${iata})` });
    }
    // 4. country vs registry
    const refCountry = wdMatch?.country || ofMatch?.country || '';
    if (a.country && refCountry && cNorm(a.country) !== cNorm(refCountry)) {
      const agree = wdMatch?.country && ofMatch?.country && cNorm(wdMatch.country) === cNorm(ofMatch.country);
      add({ confidence: agree ? 'high' : 'medium', record: rec, field: 'country', current: a.country, reference: refCountry, source: src, note: 'registration country per registry' });
    }
  }

  // 3. legalName belongs to a DIFFERENT airline sharing the code
  if (a.legalName && nameScore(a.name, a.legalName) < NAME_MATCH) {
    const stranger =
      wdCands.find((c) => nameScore(a.legalName, c.name) >= 0.9 && nameScore(a.name, c.name) < NAME_MATCH) ||
      ofCands.find((c) => nameScore(a.legalName, c.name) >= 0.9 && nameScore(a.name, c.name) < NAME_MATCH);
    if (stranger) {
      add({ confidence: 'high', record: rec, field: 'legalName', current: a.legalName, reference: `(legal name of a different carrier sharing IATA ${iata})`, source: stranger.entity || of.url, note: `"${a.legalName}" is a distinct airline on the ${iata} code — wrong-entity enrichment` });
    } else {
      add({ confidence: 'low', record: rec, field: 'legalName', current: a.legalName, reference: '(should correspond to the record name)', source: 'name-similarity heuristic', note: `legal name shares no tokens with "${a.name}" — review` });
    }
  }

  // 5. region ↔ country internal consistency
  if (a.country && a.region) {
    const expected = REGION_BY_COUNTRY[cNorm(a.country)];
    if (expected && expected !== a.region) {
      add({ confidence: 'high', record: rec, field: 'region', current: a.region, reference: expected, source: 'internal region map (ingest-travelpayouts.js)', note: `country "${a.country}" maps to ${expected}` });
    }
  }
}

/* ----- route-carrier geography ----- */
for (const r of routes) {
  const o = r.origin, d = r.destination;
  if (!o || !d) continue;
  const domestic = o.country && d.country && cNorm(o.country) === cNorm(d.country);
  for (const c of r.carriers || []) {
    const iata = (c.iataCode || '').toUpperCase();
    // Use the REFERENCE country when the record name matches one, since the
    // stored country may itself be polluted.
    const wdMatch = (wd.get(iata) || []).map((x) => ({ x, s: nameScore(c.name, x.name) })).filter((y) => y.s >= NAME_MATCH).sort((x, y) => y.s - x.s)[0]?.x ?? null;
    const country = wdMatch?.country || c.country || '';
    if (!country) continue;
    const rel = cNorm(country) === cNorm(o.country) || cNorm(country) === cNorm(d.country);
    if (!rel && domestic) {
      add({ confidence: 'high', record: `route:${r.slug}`, field: `carrier:${c.slug}`, current: `${c.name} (${country})`, reference: `domestic ${o.country} route — foreign carriers cannot operate it`, source: wdMatch?.entity || 'route geography rule', note: 'stale/codeshare or recycled-IATA join' });
    } else if (!rel) {
      add({ confidence: 'low', record: `route:${r.slug}`, field: `carrier:${c.slug}`, current: `${c.name} (${country})`, reference: `${o.country}↔${d.country} route`, source: wdMatch?.entity || 'route geography rule', note: 'carrier country matches neither endpoint (fifth-freedom routes exist — review)' });
    }
  }
}

findings.sort((a, b) => CONF_ORDER[a.confidence] - CONF_ORDER[b.confidence] || a.record.localeCompare(b.record));

/* ----- outputs ----- */
const lines = [];
lines.push('# Aviation data integrity report');
lines.push('');
lines.push(`Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/validate-aviation-data.mjs\` — READ-ONLY reconciliation; no records were modified.`);
lines.push(`Dataset: ${airlines.length} airlines, ${routes.length} routes. References: OpenFlights registry + Wikidata (entity URL cited per row). ${unverified.length} record(s) unverified (no confident reference match — NOT guessed).`);
lines.push('');
lines.push(`**${findings.length} suspected errors** (${findings.filter((f) => f.confidence === 'high').length} high / ${findings.filter((f) => f.confidence === 'medium').length} medium / ${findings.filter((f) => f.confidence === 'low').length} low):`);
lines.push('');
lines.push('| Confidence | Record | Field | Current | Reference value | Source | Note |');
lines.push('|---|---|---|---|---|---|---|');
for (const f of findings) {
  const esc = (s) => String(s).replace(/\|/g, '\\|');
  lines.push(`| ${f.confidence.toUpperCase()} | \`${f.record}\` | ${esc(f.field)} | ${esc(f.current)} | ${esc(f.reference)} | ${esc(f.source)} | ${esc(f.note)} |`);
}
if (unverified.length) {
  lines.push('');
  lines.push('## Unverified records');
  lines.push('');
  lines.push('No reference entity matched these records confidently. Per policy these are NOT guessed — verify manually.');
  lines.push('');
  for (const u of unverified) lines.push(`- \`${u.record}\` — ${u.note}`);
}
lines.push('');
const report = lines.join('\n');
if (OUT) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, report + '\n');
  console.error(`report → ${OUT}`);
} else {
  console.log(report);
}
const keys = findings.map((f) => `${f.record}:${f.field}`);
if (JSON_OUT) {
  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify({ generated: new Date().toISOString(), findings, unverified }, null, 1));
  console.error(`json → ${JSON_OUT}`);
}
console.error(`SUMMARY: high=${findings.filter((f) => f.confidence === 'high').length} medium=${findings.filter((f) => f.confidence === 'medium').length} low=${findings.filter((f) => f.confidence === 'low').length} unverified=${unverified.length}`);

/* ----- gate mode ----- */
if (GATE) {
  let baseline = [];
  try {
    baseline = JSON.parse(fs.readFileSync(GATE, 'utf8')).knownViolationKeys || [];
  } catch {
    console.error(`gate: baseline ${GATE} missing/unreadable — treating all HIGH findings as new`);
  }
  const baseSet = new Set(baseline);
  const newHigh = findings.filter((f) => f.confidence === 'high' && !baseSet.has(`${f.record}:${f.field}`));
  if (newHigh.length) {
    console.error(`\nGATE FAILED: ${newHigh.length} NEW high-confidence violation(s) not in baseline:`);
    for (const f of newHigh.slice(0, 20)) console.error(`  - ${f.record} ${f.field}: "${f.current}" → ref "${f.reference}"`);
    process.exit(1);
  }
  console.error('gate: no new high-confidence violations.');
}
