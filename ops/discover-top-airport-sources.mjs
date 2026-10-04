#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const HUB_FILE = path.join(ROOT, 'lib', 'hub-airports.ts');
const OUT_DIR = path.join(ROOT, 'data', 'airport-sources');
const REPORT_DIR = path.join(ROOT, 'ops', 'airport-reports');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });

function readHubIatas() {
  const text = fs.readFileSync(HUB_FILE, 'utf8');
  const body = text.match(/HUB_AIRPORT_IATAS\s*=\s*\[([\s\S]*?)\]\s+as const/)?.[1] || '';
  return [...body.matchAll(/'([A-Z]{3})'/g)].map((m) => m[1]);
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function queryWikidata(iatas) {
  const values = iatas.map((iata) => `"${iata}"`).join(' ');
  const sparql = `
SELECT ?iata ?airport ?airportLabel ?officialWebsite ?article WHERE {
  VALUES ?iata { ${values} }
  ?airport wdt:P238 ?iata.
  OPTIONAL { ?airport wdt:P856 ?officialWebsite. }
  OPTIONAL {
    ?article schema:about ?airport;
      schema:isPartOf <https://en.wikipedia.org/>.
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`;
  const url = new URL('https://query.wikidata.org/sparql');
  url.searchParams.set('query', sparql);
  url.searchParams.set('format', 'json');

  const res = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'originfacts-airport-source-discovery/1.0 (https://www.originfacts.com)',
    },
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function preferByIata(bindings) {
  const byIata = new Map();
  for (const row of bindings) {
    const iata = row.iata?.value;
    if (!iata) continue;
    const existing = byIata.get(iata) || {
      iata,
      wikidataUrl: row.airport?.value || '',
      name: row.airportLabel?.value || '',
      officialWebsiteUrl: '',
      wikipediaUrl: '',
      sourceNotes: 'Wikidata P238 IATA lookup; official website from Wikidata P856 when present.',
    };
    if (!existing.officialWebsiteUrl && row.officialWebsite?.value) {
      existing.officialWebsiteUrl = row.officialWebsite.value;
    }
    if (!existing.wikipediaUrl && row.article?.value) {
      existing.wikipediaUrl = row.article.value;
    }
    byIata.set(iata, existing);
  }
  return byIata;
}

async function main() {
  const iatas = readHubIatas();
  const all = new Map();
  const chunkSize = 25;
  for (let i = 0; i < iatas.length; i += chunkSize) {
    const chunk = iatas.slice(i, i + chunkSize);
    process.stdout.write(`Wikidata ${i + 1}-${Math.min(i + chunkSize, iatas.length)} ... `);
    const json = await queryWikidata(chunk);
    const found = preferByIata(json.results?.bindings || []);
    for (const [iata, row] of found) all.set(iata, row);
    console.log(`${found.size}/${chunk.length}`);
  }

  const rows = iatas.map((iata) => (
    all.get(iata) || {
      iata,
      wikidataUrl: '',
      name: '',
      officialWebsiteUrl: '',
      wikipediaUrl: '',
      sourceNotes: 'No Wikidata match found by IATA code.',
    }
  ));

  const jsonOut = {};
  for (const row of rows) {
    jsonOut[row.iata] = {
      officialWebsiteUrl: row.officialWebsiteUrl || null,
      wikipediaUrl: row.wikipediaUrl || null,
      wikidataUrl: row.wikidataUrl || null,
      sourceNotes: row.sourceNotes,
    };
  }

  const jsonPath = path.join(OUT_DIR, 'top-100-official-links.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2) + '\n');

  const csvHeaders = ['iata', 'name', 'officialWebsiteUrl', 'wikipediaUrl', 'wikidataUrl', 'sourceNotes'];
  const csv = [
    csvHeaders.join(','),
    ...rows.map((row) => csvHeaders.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n') + '\n';
  const csvPath = path.join(REPORT_DIR, 'top-100-airport-source-candidates.csv');
  fs.writeFileSync(csvPath, csv);

  const officialCount = rows.filter((row) => row.officialWebsiteUrl).length;
  const wikiCount = rows.filter((row) => row.wikipediaUrl).length;
  console.log(`\nOfficial websites: ${officialCount}/${rows.length}`);
  console.log(`Wikipedia sources: ${wikiCount}/${rows.length}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

