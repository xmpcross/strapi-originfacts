#!/usr/bin/env node
// Drafts the written guide content for destination pages. Claude researches
// each destination with web search first, so named places, transit lines and
// climate figures come from sources rather than recall; the sources are kept
// with the draft for review.
//
//   --type city       Cities and non-continent regions (Tuscany, Patagonia…):
//                     intro + five sections (where to stay, things to do,
//                     getting around, when to visit, practical tips), TL;DR,
//                     key facts, FAQs. Replaces the description.
//   --type country    Countries already carry a researched description; this
//                     adds a "Getting around" section to it, a TL;DR and FAQs.
//   --type continent  Rewrites the description (intro, overview, history,
//                     getting around, when to visit, travel notes, facts),
//                     plus TL;DR, key facts and FAQs.
//
// Two steps, so nothing reaches the live sites unreviewed:
//
//   node ops/generate-destination-guides.mjs --type city               # draft into ops/destination-guides/city/
//   node ops/generate-destination-guides.mjs --type city --slugs perth # draft some
//   node ops/generate-destination-guides.mjs --type city --overwrite   # redraft existing drafts
//   node ops/generate-destination-guides.mjs --type city --write       # push drafts to Strapi
//   node ops/generate-destination-guides.mjs --type city --restore     # put back what --write replaced
//
// --write stores each field's previous value in the draft (`previous`) before
// the first write, which is what --restore puts back.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile('/opt/strapi-cms-git/backend/ai-writer-cli/.env');

const STRAPI_URL = (process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');
const STRAPI_WRITE_TOKEN = process.env.STRAPI_WRITE_TOKEN || process.env.STRAPI_API_TOKEN || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_MODEL = process.env.DESTINATION_GUIDE_MODEL || 'claude-opus-5-5';
const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'];

const args = parseArgs(process.argv.slice(2));
const type = String(args.type || '');
const slugFilter = args.slugs ? new Set(String(args.slugs).split(',').map((s) => s.trim()).filter(Boolean)) : null;
const overwrite = Boolean(args.overwrite);
const write = Boolean(args.write);
const restore = Boolean(args.restore);
const concurrency = Number(args.concurrency || 3);

if (!['city', 'country', 'continent'].includes(type)) fatal('--type must be city, country or continent.');
if (!write && !restore && !ANTHROPIC_API_KEY) fatal('ANTHROPIC_API_KEY is not set.');
if ((write || restore) && !STRAPI_WRITE_TOKEN) fatal('STRAPI_WRITE_TOKEN or STRAPI_API_TOKEN is required to write.');

const OUT_DIR = path.join(ROOT, 'ops', 'destination-guides', type);
fs.mkdirSync(OUT_DIR, { recursive: true });

/* ---------------------------------------------------------------- prompts */

const RULES = `Research before writing. Use web search to confirm every named place, transport line, airport transfer option and climate figure you include. Prefer official sources (tourism boards, transport operators, airport websites, national weather services) and Wikipedia for stable facts. If you cannot confirm something, leave it out.

Hard rules — these pages are live editorial claims:
- No prices, fares, fees, opening hours, ticket costs or exchange rates. They change and we cannot keep them current.
- No hotel, restaurant or bar names. Hotels are covered by a live widget elsewhere on the page.
- Nothing time-sensitive: no "new in 2026", openings, closures, renovations, events with dates, or current construction.
- No visa or entry rules.
- No invented statistics. Only give a number (population, temperature, distance, travel time) if a source you found states it; round it ("about 30 minutes", "around 2 million").
- No superlatives you cannot source ("best", "most beautiful"), no brochure tone, no filler like "something for everyone", "vibrant tapestry", "hidden gem", "bustling".
- Write about this destination only. Every paragraph should be impossible to reuse for another destination by swapping the name.
- British English spelling. Plain prose, second person sparingly.`;

const SOURCES = {
  type: 'array',
  description: 'The pages you relied on.',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['url', 'title'],
    properties: { url: { type: 'string' }, title: { type: 'string' } },
  },
};
const KEY_FACTS = {
  type: 'array',
  description: '4-6 quick facts a traveller would check first.',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['label', 'value'],
    properties: { label: { type: 'string' }, value: { type: 'string' } },
  },
};
const FAQS = {
  type: 'array',
  description: '5-6 questions a traveller to this destination actually searches, each answered in 30-60 words.',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['q', 'a'],
    properties: { q: { type: 'string' }, a: { type: 'string' } },
  },
};

const TYPES = {
  city: {
    system: `You write city guides for Originfacts, an editorial travel site. Readers are planning a trip and want the specifics of this one place: which districts, which sights, which train line from the airport, which months are wet.

${RULES}

If the destination is a state, island or region rather than a single city, write about it as such (main towns instead of districts).`,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['intro', 'whereToStay', 'thingsToDo', 'gettingAround', 'whenToVisit', 'practicalTips', 'tldr', 'keyFacts', 'faqs', 'sources'],
      properties: {
        intro: { type: 'string', description: '45-70 words. What defines the place for a visitor: setting, character, what people come for. Shown as the page lead.' },
        whereToStay: { type: 'string', description: '120-170 words of prose. Name 3-4 real districts or neighbourhoods (or towns, for a region) and who each suits (first visit, nightlife, families, short stopover near the airport) and why.' },
        thingsToDo: { type: 'string', description: '130-180 words of prose. 5-7 specific named sights, areas or day trips, each with one concrete detail.' },
        gettingAround: { type: 'string', description: '110-160 words of prose. How to get from the main airport(s) to the centre (named rail/bus/road options and rough travel times), and the public transport system by name.' },
        whenToVisit: { type: 'string', description: '100-150 words of prose. Climate type, seasons with approximate temperature ranges in °C, wet/dry or hot/cold months, crowd patterns, recurring annual festivals (by month, no specific dates).' },
        practicalTips: { type: 'array', items: { type: 'string' }, description: '4-6 short tips (one sentence each) specific to this place: local transport card name, plug type, tipping custom, safety or etiquette notes.' },
        tldr: { type: 'string', description: '40-60 words. Direct answer to "what do I need to know about visiting": where to stay, getting in from the airport, best months.' },
        keyFacts: KEY_FACTS,
        faqs: FAQS,
        sources: SOURCES,
      },
    },
    prompt: (d, airports) =>
      [
        `Destination: ${d.name}${regionName(d.countryCode) ? `, ${regionName(d.countryCode)}` : ''}`,
        airports.length
          ? `Airports we list for it: ${airports.map((a) => `${a.name} (${a.iata})`).join('; ')}`
          : 'We list no airport for it; find how most visitors arrive.',
        '',
        'Research it, then return the guide as JSON.',
      ].join('\n'),
    bounds: { intro: [35, 85], whereToStay: [100, 200], thingsToDo: [110, 210], gettingAround: [90, 190], whenToVisit: [80, 180], tldr: [30, 75] },
    toFields: (d, g) => ({
      description: [
        g.intro.trim(),
        `## Where to stay in ${d.name}\n\n${g.whereToStay.trim()}`,
        `## Things to do in ${d.name}\n\n${g.thingsToDo.trim()}`,
        `## Getting around ${d.name}\n\n${g.gettingAround.trim()}`,
        `## When to visit ${d.name}\n\n${g.whenToVisit.trim()}`,
        `## Practical tips for ${d.name}\n\n${g.practicalTips.map((t) => `- ${t.trim()}`).join('\n')}`,
      ].join('\n\n'),
      tldr: g.tldr.trim(),
      keyFacts: g.keyFacts,
      faqs: g.faqs,
    }),
  },

  country: {
    system: `You add to country guides on Originfacts, an editorial travel site. The guide already has an overview, visa notes, attractions, climate, facts and official resources (given to you). You write what it lacks: how travellers get around the country, a short summary, and the questions travellers ask.

${RULES}

Do not repeat the existing guide's sentences. Keep anything you say consistent with it unless your sources show it is wrong; in that case leave the point out.`,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['gettingAround', 'tldr', 'faqs', 'sources'],
      properties: {
        gettingAround: { type: 'string', description: '120-170 words of prose. The main international gateway airport(s) by name; how travellers move between the main cities (named rail operators or lines, domestic flights, long-distance buses, ferries, driving side and road conditions); what works in the main cities.' },
        tldr: { type: 'string', description: '40-60 words. Direct answer to "what do I need to know about visiting": main gateway, how to get around, best months, one distinctive practical point.' },
        faqs: FAQS,
        sources: SOURCES,
      },
    },
    prompt: (d, airports) =>
      [
        `Country: ${d.name}`,
        airports.length ? `Some airports we list there: ${airports.slice(0, 12).map((a) => `${a.name} (${a.iata})`).join('; ')}` : '',
        '',
        'The existing guide:',
        '"""',
        stripSection(d.description || '', 'Getting around'),
        '"""',
        '',
        'Research, then return the additions as JSON.',
      ].join('\n'),
    bounds: { gettingAround: [100, 200], tldr: [30, 75] },
    toFields: (d, g) => ({
      description: `${stripSection(d.description || '', 'Getting around').trim()}\n\n## Getting around ${d.name}\n\n${g.gettingAround.trim()}`,
      tldr: g.tldr.trim(),
      faqs: g.faqs,
    }),
  },

  continent: {
    system: `You write continent guides for Originfacts, an editorial travel site. Readers are planning travel across the continent and want the specifics: which hubs connect it, how people move between countries, which months suit which subregions, and the history they will see on the ground.

${RULES}

The current guide is given to you. Keep what is accurate and specific, fix or drop what your sources contradict, and replace generic statements with researched ones. Do not copy its sentences unchanged.`,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['intro', 'overview', 'history', 'gettingAround', 'whenToVisit', 'travelNotes', 'interestingFacts', 'tldr', 'keyFacts', 'faqs', 'sources'],
      properties: {
        intro: { type: 'string', description: '45-70 words. What defines the continent for a traveller. Shown as the page lead.' },
        overview: { type: 'string', description: '110-160 words of prose. Geography (bounds, major ranges, rivers, coastlines), subregions by name, and the scale of the continent for a traveller.' },
        history: { type: 'string', description: '110-160 words of prose. The ancient and later history a visitor meets on the ground, tied to named, visitable sites (with the country each is in).' },
        gettingAround: { type: 'string', description: '110-160 words of prose. Main international hub airports by name and IATA code, how travellers cross between countries (named rail networks, ferries, low-cost carriers, overland routes), and where distances make flying necessary.' },
        whenToVisit: { type: 'string', description: '110-160 words of prose. Seasons by subregion with months and approximate °C ranges, monsoon/wet seasons, and recurring holiday peaks by month that affect travel.' },
        travelNotes: { type: 'string', description: '80-120 words of prose. Practical differences across the continent: currencies (shared ones by name), plug types in major countries, languages that help, driving side differences. No visa or entry rules.' },
        interestingFacts: { type: 'array', items: { type: 'string' }, description: 'Exactly 5 short, verifiable facts specific to the continent (7-14 words each).' },
        tldr: { type: 'string', description: '40-60 words. Direct answer to "what do I need to know about travelling in this continent": main hubs, distances, how to move between countries, seasons.' },
        keyFacts: KEY_FACTS,
        faqs: FAQS,
        sources: SOURCES,
      },
    },
    prompt: (d) => [`Continent: ${d.name}`, '', 'The current guide:', '"""', d.description || '', '"""', '', 'Research, then return the rewritten guide as JSON.'].join('\n'),
    bounds: { intro: [35, 85], overview: [90, 190], history: [90, 190], gettingAround: [90, 190], whenToVisit: [90, 190], travelNotes: [60, 150], tldr: [30, 75] },
    toFields: (d, g) => ({
      description: [
        g.intro.trim(),
        `## Overview\n\n${g.overview.trim()}`,
        `## History and Ancient Civilizations\n\n${g.history.trim()}`,
        `## Getting around ${d.name}\n\n${g.gettingAround.trim()}`,
        `## When to visit ${d.name}\n\n${g.whenToVisit.trim()}`,
        `## Travel Notes\n\n${g.travelNotes.trim()}`,
        `## Interesting Facts About ${d.name}\n\n${g.interestingFacts.map((f) => `- ${f.trim()}`).join('\n')}`,
      ].join('\n\n'),
      tldr: g.tldr.trim(),
      keyFacts: g.keyFacts,
      faqs: g.faqs,
    }),
  },
};

const T = TYPES[type];

/* ---------------------------------------------------------------- Claude */

async function draftGuide(d, airports) {
  const messages = [{ role: 'user', content: T.prompt(d, airports) }];
  const searched = [];
  // Server-side web search can pause a long turn; resume it by sending the
  // partial assistant turn back unchanged.
  for (let turn = 0; turn < 6; turn++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        // On a refusal the API re-runs the request on a fallback model it picks.
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        fallbacks: 'default',
        max_tokens: 16000,
        system: T.system,
        messages,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: type === 'country' ? 5 : 8 }],
        output_config: { effort: 'high', format: { type: 'json_schema', schema: T.schema } },
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 400)}`);
    const msg = await res.json();

    for (const block of msg.content) {
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) if (r.url) searched.push({ url: r.url, title: r.title || '' });
      }
    }

    if (msg.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: msg.content });
      continue;
    }
    if (msg.stop_reason === 'refusal') throw new Error('Claude declined this request.');
    if (msg.stop_reason === 'max_tokens') throw new Error('Response hit max_tokens.');

    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return { guide: JSON.parse(text), searched, usage: msg.usage };
  }
  throw new Error('Web search did not finish in 6 turns.');
}

/* ---------------------------------------------------------------- review */

const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;

/** Flags for the reviewer; a draft with flags is still saved. */
function review(g) {
  const flags = [];
  for (const [k, [lo, hi]] of Object.entries(T.bounds)) {
    const n = words(g[k]);
    if (n < lo || n > hi) flags.push(`${k}: ${n} words (want ${lo}-${hi})`);
  }
  if (g.practicalTips && (g.practicalTips.length < 4 || g.practicalTips.length > 6)) flags.push(`practicalTips: ${g.practicalTips.length}`);
  if (g.faqs.length < 4) flags.push(`faqs: ${g.faqs.length}`);
  if (g.interestingFacts && g.interestingFacts.length !== 5) flags.push(`interestingFacts: ${g.interestingFacts.length}`);
  if (g.keyFacts && g.keyFacts.length < 4) flags.push(`keyFacts: ${g.keyFacts.length}`);
  const { sources: _sources, ...content } = g;
  const all = JSON.stringify(content);
  const banned = [
    [/[$€£¥฿]\s?\d|\d+\s?(?:USD|AUD|EUR|GBP|THB|baht|dollars|euros|pounds)\b/i, 'price'],
    [/\b20(?:2[5-9]|3\d)\b/, 'year'],
    [/\b(?:newly|recently) (?:opened|reopened|launched)|opening (?:in|soon)|under construction\b/i, 'time-sensitive'],
    [/\bvisas?\b/i, 'visa'],
    [/hidden gem|vibrant tapestry|something for everyone|bustling|world-class|must-see/i, 'filler'],
  ];
  for (const [re, label] of banned) {
    const m = all.match(re);
    if (m) flags.push(`${label}: "${m[0]}"`);
  }
  return flags;
}

/* ---------------------------------------------------------------- Strapi */

async function strapi(pathname, init = {}) {
  const res = await fetch(`${STRAPI_URL}${pathname}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      // Reads are public; the write token is scoped to writes and 403s on reads.
      ...(init.method && init.method !== 'GET' ? { Authorization: `Bearer ${STRAPI_WRITE_TOKEN}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Strapi ${res.status} on ${pathname}: ${(await res.text()).slice(0, 240)}`);
  return res.json();
}

async function listDestinations() {
  const strapiType = type === 'country' ? 'country' : type === 'city' ? '$in' : 'region';
  const q = type === 'city'
    ? 'filters[type][$in][0]=city&filters[type][$in][1]=region'
    : `filters[type][$eq]=${strapiType}`;
  const r = await strapi(`/api/destinations?${q}&pagination[pageSize]=500&sort=name:asc`);
  const isContinent = (d) => d.type === 'region' && CONTINENTS.includes(d.name);
  return r.data.filter((d) => (type === 'continent' ? isContinent(d) : !isContinent(d)));
}

async function listAirports(d) {
  const params = { 'pagination[pageSize]': '50', 'fields[0]': 'name', 'fields[1]': 'iata', 'fields[2]': 'countryCode' };
  if (type === 'city') params['filters[city][$eqi]'] = d.name;
  else if (type === 'country' && d.countryCode) params['filters[countryCode][$eqi]'] = d.countryCode;
  else return [];
  const r = await strapi(`/api/airports?${new URLSearchParams(params)}`);
  return (r.data || []).filter((a) => !d.countryCode || a.countryCode === d.countryCode);
}

/* ------------------------------------------------------------------ main */

const draftPath = (slug) => path.join(OUT_DIR, `${slug}.json`);

async function draftOne(d) {
  if (!overwrite && fs.existsSync(draftPath(d.slug))) return `${d.slug}: draft exists, skipped`;
  const airports = await listAirports(d);
  const { guide, searched, usage } = await draftGuide(d, airports);
  const draft = {
    slug: d.slug,
    documentId: d.documentId,
    name: d.name,
    type,
    generatedAt: new Date().toISOString(),
    model: CLAUDE_MODEL,
    flags: review(guide),
    fields: T.toFields(d, guide),
    sources: guide.sources,
    searched: dedupeBy(searched, (s) => s.url),
    usage,
  };
  fs.writeFileSync(draftPath(d.slug), JSON.stringify(draft, null, 2) + '\n');
  return `${d.slug}: drafted${draft.flags.length ? `, flags: ${draft.flags.join('; ')}` : ''}`;
}

async function writeOne(d) {
  const file = draftPath(d.slug);
  if (!fs.existsSync(file)) return `${d.slug}: no draft, skipped`;
  const draft = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (restore) {
    if (!draft.previous) return `${d.slug}: never written, nothing to restore`;
    await strapi(`/api/destinations/${d.documentId}`, { method: 'PUT', body: JSON.stringify({ data: draft.previous }) });
    return `${d.slug}: restored`;
  }
  if (!draft.previous) {
    draft.previous = Object.fromEntries(Object.keys(draft.fields).map((k) => [k, d[k] ?? null]));
    fs.writeFileSync(file, JSON.stringify(draft, null, 2) + '\n');
  }
  await strapi(`/api/destinations/${d.documentId}`, { method: 'PUT', body: JSON.stringify({ data: draft.fields }) });
  return `${d.slug}: written`;
}

const destinations = (await listDestinations()).filter((d) => !slugFilter || slugFilter.has(d.slug));
if (slugFilter && destinations.length !== slugFilter.size) {
  const found = new Set(destinations.map((d) => d.slug));
  console.warn(`Not a ${type}: ${[...slugFilter].filter((s) => !found.has(s)).join(', ')}`);
}
const job = write || restore ? writeOne : draftOne;
let failed = 0;
await pool(destinations, concurrency, async (d) => {
  try {
    console.log(await job(d));
  } catch (error) {
    failed++;
    console.error(`${d.slug}: FAILED ${error.message}`);
  }
});
if (failed) process.exitCode = 1;

/* --------------------------------------------------------------- helpers */

/** Drops one `## <heading>…` section (and its body) from a markdown guide. */
function stripSection(md, headingPrefix) {
  const blocks = md.split(/\n{2,}/);
  const out = [];
  let skipping = false;
  for (const block of blocks) {
    if (/^##\s/.test(block.trim())) skipping = block.trim().replace(/^##\s+/, '').startsWith(headingPrefix);
    if (!skipping) out.push(block);
  }
  return out.join('\n\n');
}

async function pool(items, size, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift());
  }));
}

function dedupeBy(items, key) {
  const seen = new Set();
  return items.filter((item) => (seen.has(key(item)) ? false : seen.add(key(item))));
}

function regionName(code) {
  if (!code) return '';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || '';
  } catch {
    return '';
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw.startsWith('--')) continue;
    const [key, ...rest] = raw.slice(2).split('=');
    if (rest.length) out[key] = rest.join('=');
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[key] = argv[++i];
    else out[key] = true;
  }
  return out;
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
