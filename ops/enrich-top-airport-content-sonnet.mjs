#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const AUDIT_FILE = path.join(ROOT, 'ops', 'airport-reports', 'top-100-airport-uniqueness-audit.csv');
const SOURCE_FILE = path.join(ROOT, 'data', 'airport-sources', 'top-100-official-links.json');
const OUT_DIR = path.join(ROOT, 'ops', 'airport-reports');

loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile('/opt/strapi-cms-git/backend/ai-writer-cli/.env');

const STRAPI_URL = (process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'https://strapi.fxnstudio.com').replace(/\/$/, '');
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const args = parseArgs(process.argv.slice(2));
const status = args.status || 'needs_enrichment';
const limit = Number(args.limit || 0);
const write = flagEnabled(args.write);
const overwrite = flagEnabled(args.overwrite);
const iataFilter = args.iata ? new Set(args.iata.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)) : null;

if (!ANTHROPIC_API_KEY) fatal('ANTHROPIC_API_KEY is not set.');
if (write && !STRAPI_API_TOKEN) fatal('STRAPI_API_TOKEN or STRAPI_TOKEN is required with --write.');

fs.mkdirSync(OUT_DIR, { recursive: true });

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw.startsWith('--')) continue;
    if (raw.includes('=')) {
      const [key, ...valueParts] = raw.slice(2).split('=');
      out[key] = valueParts.join('=');
      continue;
    }
    const key = raw.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function flagEnabled(value) {
  if (value === true) return true;
  if (typeof value !== 'string') return false;
  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

function loadEnvFile(filename) {
  if (!fs.existsSync(filename)) return;
  for (const line of fs.readFileSync(filename, 'utf8').split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function fatal(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCsv(text) {
  const [head, ...lines] = text.trim().split(/\n/);
  const headers = splitCsvLine(head);
  return lines.map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] || '']));
  });
}

function splitCsvLine(line) {
  const out = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (c === '"') {
      quoted = !quoted;
    } else if (c === ',' && !quoted) {
      out.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  out.push(current);
  return out;
}

function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function sourceUrlsFor(code, sources) {
  const row = sources[code] || {};
  return [row.officialWebsiteUrl, row.wikipediaUrl, row.wikidataUrl].filter(Boolean);
}

async function strapi(pathname, init = {}) {
  const res = await fetch(`${STRAPI_URL}${pathname}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(STRAPI_API_TOKEN ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Strapi ${res.status} on ${pathname}: ${(await res.text()).slice(0, 240)}`);
  return res.json();
}

async function fetchAirport(iata) {
  const params = new URLSearchParams();
  params.set('filters[iata][$eqi]', iata);
  for (const [index, field] of ['id', 'documentId', 'iata', 'icao', 'name', 'city', 'country', 'countryCode', 'region', 'latitude', 'longitude', 'timezone', 'about'].entries()) {
    params.append(`fields[${index}]`, field);
  }
  params.set('pagination[pageSize]', '1');
  const res = await strapi(`/api/airports?${params.toString()}`);
  return res.data?.[0] || null;
}

async function fetchRouteSummary(iata) {
  const params = new URLSearchParams();
  params.set('filters[origin][iata][$eqi]', iata);
  params.set('populate[origin]', 'true');
  params.set('populate[destination]', 'true');
  params.set('populate[carriers]', 'true');
  params.set('pagination[pageSize]', '15');
  const res = await strapi(`/api/routes?${params.toString()}`).catch(() => ({ data: [] }));
  const destinations = [];
  const countries = new Set();
  const carriers = new Set();
  for (const route of res.data || []) {
    if (route.destination?.name || route.destination?.iata) destinations.push(route.destination?.name || route.destination?.iata);
    if (route.destination?.country) countries.add(route.destination.country);
    for (const carrier of route.carriers || []) if (carrier?.name) carriers.add(carrier.name);
  }
  return {
    routeCount: res.data?.length || 0,
    destinations: [...new Set(destinations)].slice(0, 8),
    countries: [...countries].slice(0, 8),
    carriers: [...carriers].slice(0, 10),
  };
}

function buildPrompt(airport, routes, sources) {
  return `Write a unique airport guide content block for Originfacts.

Airport:
- IATA: ${airport.iata}
- ICAO: ${airport.icao || 'unknown'}
- Name: ${airport.name}
- City: ${airport.city || 'unknown'}
- Country: ${airport.country || 'unknown'}
- Region: ${airport.region || 'unknown'}
- Time zone: ${airport.timezone || 'unknown'}
- Coordinates: ${typeof airport.latitude === 'number' && typeof airport.longitude === 'number' ? `${airport.latitude}, ${airport.longitude}` : 'unknown'}

Tracked route context:
- Route count: ${routes.routeCount}
- Destinations: ${routes.destinations.join(', ') || 'none currently tracked'}
- Carriers: ${routes.carriers.join(', ') || 'none currently tracked'}
- Destination countries: ${routes.countries.join(', ') || 'none currently tracked'}

Official/source URLs:
${sources.map((url) => `- ${url}`).join('\n') || '- none'}

Existing content:
${airport.about || '(empty)'}

Return strict JSON only:
{
  "about": "Markdown content, 520-700 words, exactly these headings in this order: ## Overview, ## Airlines, ## Terminals and transfers, ## Ground transport and trip planning, ## Practical planning notes, ## Official sources. No bullets. No invented live fares, passenger totals, schedules, construction dates, lounge names, or policies. Use cautious wording when exact details are not in the supplied source data. Make each section specific to this airport, city, region, routes, geography and role. Include the source URLs as plain URLs only in the Official sources section."
}`;
}

async function callSonnet(airport, routes, sources) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1800,
      temperature: 0.3,
      system: 'You write factual, non-promotional airport guide content. You avoid unsupported specifics and return only valid JSON.',
      messages: [{ role: 'user', content: buildPrompt(airport, routes, sources) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 240)}`);
  const json = await res.json();
  const text = (json.content || []).map((b) => b.type === 'text' ? b.text : '').join('').trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed.about) throw new Error('Sonnet response missing about');
  return parsed.about.trim();
}

async function main() {
  const auditRows = parseCsv(fs.readFileSync(AUDIT_FILE, 'utf8'));
  const sources = fs.existsSync(SOURCE_FILE) ? JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8')) : {};
  let candidates = auditRows.filter((row) => row.status === status);
  if (iataFilter) candidates = candidates.filter((row) => iataFilter.has(row.iata));
  if (limit > 0) candidates = candidates.slice(0, limit);

  const generatedRows = [];
  console.log(`Airport Sonnet enrichment: ${candidates.length} candidate(s), model=${CLAUDE_MODEL}, write=${write ? 'yes' : 'no'}`);
  for (const [index, row] of candidates.entries()) {
    const code = row.iata.toUpperCase();
    process.stdout.write(`[${index + 1}/${candidates.length}] ${code} ... `);
    try {
      const airport = await fetchAirport(code);
      if (!airport) throw new Error('not found in Strapi');
      const existingWords = wordCount(airport.about);
      if (existingWords >= 450 && !overwrite) {
        console.log(`skip (${existingWords} words already)`);
        continue;
      }
      const routes = await fetchRouteSummary(code);
      const sourceUrls = sourceUrlsFor(code, sources);
      const about = await callSonnet(airport, routes, sourceUrls);
      const words = wordCount(about);
      const ok = words >= 450 && /^## Overview/m.test(about) && /^## Airlines/m.test(about) && /^## Official sources/m.test(about);
      if (!ok) throw new Error(`generated content failed local checks (${words} words)`);
      if (write) {
        await strapi(`/api/airports/${airport.documentId ?? airport.id}`, {
          method: 'PUT',
          body: JSON.stringify({ data: { about } }),
        });
      }
      generatedRows.push({
        iata: code,
        name: airport.name,
        existingWords,
        generatedWords: words,
        written: write ? 'yes' : 'no',
        about,
      });
      console.log(`${write ? 'updated' : 'generated'} (${words} words)`);
    } catch (error) {
      generatedRows.push({
        iata: code,
        name: row.name,
        existingWords: row.aboutWords,
        generatedWords: '',
        written: 'no',
        about: `ERROR: ${error.message}`,
      });
      console.log(`failed: ${error.message}`);
    }
  }

  const out = path.join(OUT_DIR, `top-airport-sonnet-enrichment-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
  const headers = ['iata', 'name', 'existingWords', 'generatedWords', 'written', 'about'];
  fs.writeFileSync(out, [headers.join(','), ...generatedRows.map((row) => headers.map((h) => csvEscape(row[h])).join(','))].join('\n') + '\n');
  console.log(`CSV: ${out}`);
}

main().catch((error) => fatal(error.message));
