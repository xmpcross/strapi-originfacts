#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STRAPI_URL = (process.env.NEXT_PUBLIC_STRAPI_URL || process.env.STRAPI_URL || 'https://strapi.fxnstudio.com').replace(/\/$/, '');
const OUT_DIR = path.join(ROOT, 'ops', 'airport-reports');
const HUB_FILE = path.join(ROOT, 'lib', 'hub-airports.ts');
const SOURCE_FILE = path.join(ROOT, 'data', 'airport-sources', 'top-100-official-links.json');

fs.mkdirSync(OUT_DIR, { recursive: true });

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function hasHeading(text, heading) {
  return new RegExp(`^##\\s+${heading}\\b`, 'im').test(text || '');
}

function sourceUrls(text) {
  return [...new Set((text || '').match(/https?:\/\/[^\s)]+/g) || [])];
}

function readDiscoveredSources() {
  if (!fs.existsSync(SOURCE_FILE)) return {};
  return JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
}

function sourceUrlsForAirport(iata, about, sourceIndex) {
  const discovered = sourceIndex[iata] || {};
  return [...new Set([
    ...sourceUrls(about),
    discovered.officialWebsiteUrl,
    discovered.wikipediaUrl,
    discovered.wikidataUrl,
  ].filter(Boolean))];
}

function readHubIatas() {
  const text = fs.readFileSync(HUB_FILE, 'utf8');
  const body = text.match(/HUB_AIRPORT_IATAS\s*=\s*\[([\s\S]*?)\]\s+as const/)?.[1] || '';
  return [...body.matchAll(/'([A-Z]{3})'/g)].map((m) => m[1]);
}

async function strapi(pathname, params = {}) {
  const url = new URL(`${STRAPI_URL}/api/${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
    else url.searchParams.set(key, String(value));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Strapi ${res.status} on ${url}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function fetchAirport(iata) {
  const res = await strapi('airports', {
    'filters[iata][$eqi]': iata,
    populate: 'heroImage',
    'pagination[pageSize]': 1,
  });
  return res.data?.[0] || null;
}

async function fetchRouteSummary(iata) {
  const res = await strapi('routes', {
    'filters[origin][iata][$eqi]': iata,
    'populate[origin]': 'true',
    'populate[destination]': 'true',
    'populate[carriers]': 'true',
    'pagination[pageSize]': 100,
  }).catch(() => ({ data: [] }));

  const destinations = new Set();
  const countries = new Set();
  const carriers = new Set();
  for (const route of res.data || []) {
    if (route.destination?.iata) destinations.add(route.destination.iata);
    if (route.destination?.country) countries.add(route.destination.country);
    for (const carrier of route.carriers || []) {
      if (carrier?.name) carriers.add(carrier.name);
    }
  }
  return {
    routes: res.data?.length || 0,
    destinations: destinations.size,
    countries: countries.size,
    carriers: carriers.size,
  };
}

function gradeAirport(airport, routeSummary, urls = []) {
  if (!airport) return { score: 0, status: 'missing_in_strapi', missing: ['airport record'] };

  const about = airport.about || '';
  const missing = [];
  if (wordCount(about) < 450) missing.push('450+ words of unique about content');
  if (!hasHeading(about, 'Overview')) missing.push('Overview section');
  if (!hasHeading(about, 'Airlines')) missing.push('Airlines section');
  if (!/terminal|runway/i.test(about)) missing.push('terminal/runway details');
  if (!airport.heroImage) missing.push('hero image');
  if (!airport.icao) missing.push('ICAO');
  if (!airport.latitude || !airport.longitude) missing.push('coordinates');
  if (!airport.timezone) missing.push('timezone');
  if (routeSummary.routes < 3) missing.push('3+ tracked routes');
  if (routeSummary.carriers < 2) missing.push('2+ tracked carriers');
  if (urls.length < 2) missing.push('2+ official/source URLs in content');

  const checks = 11 - missing.length;
  const score = Math.max(0, Math.round((checks / 11) * 100));
  const status = score >= 80 ? 'ready_review' : score >= 55 ? 'needs_enrichment' : 'thin_or_sparse';
  return { score, status, missing };
}

async function main() {
  const iatas = readHubIatas();
  const sourceIndex = readDiscoveredSources();
  const rows = [];
  for (const [index, iata] of iatas.entries()) {
    process.stdout.write(`[${index + 1}/${iatas.length}] ${iata} ... `);
    const airport = await fetchAirport(iata);
    const routes = airport ? await fetchRouteSummary(iata) : { routes: 0, destinations: 0, countries: 0, carriers: 0 };
    const urls = sourceUrlsForAirport(iata, airport?.about, sourceIndex);
    const grade = gradeAirport(airport, routes, urls);
    console.log(`${grade.status} (${grade.score})`);
    rows.push({
      rank: index + 1,
      iata,
      name: airport?.name || '',
      city: airport?.city || '',
      country: airport?.country || '',
      icao: airport?.icao || '',
      aboutWords: wordCount(airport?.about),
      hasHero: airport?.heroImage ? 'yes' : 'no',
      sourceUrlCount: urls.length,
      routes: routes.routes,
      destinations: routes.destinations,
      countries: routes.countries,
      carriers: routes.carriers,
      uniquenessScore: grade.score,
      status: grade.status,
      missing: grade.missing.join('; '),
    });
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(',')),
  ].join('\n') + '\n';

  const out = path.join(OUT_DIR, 'top-100-airport-uniqueness-audit.csv');
  fs.writeFileSync(out, csv);

  const summary = rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  console.log('\nSummary:', summary);
  console.log(`CSV: ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
