#!/usr/bin/env node
/**
 * Airport guides: Gemini + Google Search grounding → claims → verified quotes.
 *
 * Same design and rules as the route pipeline (README.md in this folder):
 *   1. Grounded research: four plain-prose questions per airport (terminals,
 *      city transport, parking, assistance), steered to the airport's own site
 *      and transport operators. Sources come ONLY from groundingMetadata;
 *      URLs written in the model's prose are ignored.
 *   2. Structuring (no search): the answers + numbered grounded sources → JSON
 *      claims that cite source numbers only.
 *   3. Verification: every cited page is fetched with fetchPage() from
 *      verify-sources.mjs (robots.txt obeyed, 4 s per host, no retries against
 *      a block). A claim is kept only if one or two consecutive sentences on
 *      the page carry every number and proper name in it (locateQuote), and the
 *      page names the airport.
 *
 * It writes no guide. Kept claims, with their page quote, go to
 * data/airports/<iata>/verified.json for a human to read and assemble into
 * content/airport-guides/<iata>.json (prose assembled, not generated).
 *
 *   node ops/route-research/airport-research.mjs --airports KTM,JED [--dry-run]
 *     [--model gemini-3.6-flash] [--max-grounded 40] [--force]
 *
 * Stops (exit 2) on any 401/403/429 or billing/quota reply, and at the
 * grounded-request cap, which counts only airport-research calls.
 */
import path from 'node:path';

import { arg, DATA, gemini, GeminiStop, norm, parseJsonReply, readJson, readUsage, sleep, writeJson } from './lib.mjs';
import { keyTokens, locateQuote, mentionsPlace, rejectedHost, tokenCount } from './match.mjs';
import { fetchPage } from './verify-sources.mjs';

const MODEL = arg('model', 'gemini-3.6-flash');
const THINKING = arg('thinking', 'low');
const MAX_GROUNDED = Number(arg('max-grounded', 40));
const FORCE = !!arg('force');
const DRY = !!arg('dry-run');
// Pass 2 skips the airport's own site (blocked or unreadable for most of these) and
// asks for sources that answer an identified crawler: national news, airlines,
// transport operators and government pages. Saved under <iata>/p2/.
const PASS = Number(arg('pass', 1));
const today = new Date().toISOString().slice(0, 10);

/** Names and official sites as stored in data/airport-sources/top-100-official-links.json. */
const AIRPORTS = {
  KTM: { name: 'Tribhuvan International Airport', city: 'Kathmandu', country: 'Nepal', site: 'https://www.tiairport.com.np', places: ['Tribhuvan', 'Kathmandu', 'TIA', 'KTM'] },
  JED: { name: 'King Abdulaziz International Airport', city: 'Jeddah', country: 'Saudi Arabia', site: 'https://www.kaia.sa', places: ['King Abdulaziz', 'Jeddah', 'KAIA', 'JED'] },
  ALG: { name: 'Houari Boumediene Airport', city: 'Algiers', country: 'Algeria', site: 'https://www.aeroportalger.dz', places: ['Houari Boumediene', 'Algiers', 'Alger', 'ALG'] },
  CUN: { name: 'Cancún International Airport', city: 'Cancún', country: 'Mexico', site: 'https://www.asur.com.mx', places: ['Cancún', 'Cancun', 'CUN'] },
  LOS: { name: 'Murtala Muhammed International Airport', city: 'Lagos', country: 'Nigeria', site: 'https://faan.gov.ng/mmia-lagos/', places: ['Murtala Muhammed', 'Lagos', 'MMIA', 'LOS'] },
  CMB: { name: 'Bandaranaike International Airport', city: 'Colombo', country: 'Sri Lanka', site: 'https://www.airport.lk', places: ['Bandaranaike', 'Colombo', 'Katunayake', 'BIA', 'CMB'] },
  SGN: { name: 'Tan Son Nhat International Airport', city: 'Ho Chi Minh City', country: 'Vietnam', site: 'https://www.vietnamairport.vn/tansonnhatairport/', places: ['Tan Son Nhat', 'Tân Sơn Nhất', 'Ho Chi Minh', 'Saigon', 'SGN'] },
};

/** Pass 2: credible outlets and bodies per country, named to steer the search. */
const LOCAL = {
  KTM: 'The Kathmandu Post, The Himalayan Times, Republica, the Civil Aviation Authority of Nepal (caanepal.gov.np), Nepal Airlines and Sajha Yatayat',
  JED: 'the Saudi Press Agency (spa.gov.sa), Arab News, Saudi Gazette, SAPTCO, the Haramain High Speed Railway (sar.com.sa / hhr.sa), Saudia and the General Authority of Civil Aviation',
  ALG: 'Algérie Presse Service (aps.dz), El Watan, TSA Algérie, SNTF (sntf.dz), ETUSA, Métro d’Alger and Air Algérie; French-language pages are fine',
  CUN: 'ASUR (asur.com.mx), Tren Maya (trenmaya.gob.mx), ADO (ado.com.mx), the Quintana Roo state government, Por Esto, Novedades Quintana Roo and Riviera Maya News; Spanish-language pages are fine',
  CMB: 'Daily FT (ft.lk), Daily Mirror (dailymirror.lk), The Sunday Times Sri Lanka, Daily News (dailynews.lk), the Sri Lanka Transport Board, SriLankan Airlines and Airport & Aviation Services',
  SGN: 'VnExpress International (e.vnexpress.net), Tuoi Tre News, Vietnam News (vietnamnews.vn), SGGP News, Vietnam Airlines, the Airports Corporation of Vietnam (ACV) and the Ho Chi Minh City Department of Transport',
};

const STEER = (a) =>
  PASS === 2
    ? `Use Google Search. The airport's own website cannot be used. Base the answer on ${LOCAL[a.code]}, and other national newspapers, government, airline and transport-operator pages. Booking and fare sites, travel agents, transfer or taxi sellers, hotel sites, unofficial airport guide sites, Wikipedia, forums, blogs and social media are NOT acceptable sources. Give specific facts (names, numbers, places in the terminal, opening dates) exactly as the sources state them, with the date of any news report, and say plainly if you could not find something. Do not guess prices.`
    : `Use Google Search. Prefer the airport's own website (${a.site}) and the official pages of the transport operators, city or national transport authorities, airport operator and government. Booking and fare sites, travel agents, hotel or transfer sellers, Wikipedia, forums, blogs and social media are NOT acceptable sources. Give specific facts (names, numbers, places in the terminal, opening dates) exactly as the sources state them, and say plainly if you could not find something. Do not guess prices.`;

function topics(a) {
  const A = `${a.name} in ${a.city}, ${a.country}`;
  return {
    terminals: `Which terminals does ${A} have, and which flights (international, domestic, particular airlines) use each? When did the current terminal(s) open, and how do passengers move between them? ${STEER(a)}`,
    transport: `How do passengers get between ${A} and central ${a.city}: airport bus or shuttle, metro or train, official taxis (where to find them, fixed or metered fares), and ride-hailing apps that are permitted at the airport? Name the services and where they leave from at the airport. ${STEER(a)}`,
    parking: `What parking does ${A} offer (car parks, short and long stay, rates if officially published), and what are the pick-up and drop-off rules? ${STEER(a)}`,
    assistance: `What does ${A} say about assistance for passengers with reduced mobility, and about practical facilities (Wi-Fi, lounges, prayer rooms, currency exchange) that the airport itself lists? ${STEER(a)}`,
  };
}

/** vertexaisearch redirect → real URL, without fetching the target page. */
async function resolveRedirect(uri) {
  if (!/vertexaisearch\.cloud\.google\.com/.test(uri)) return uri;
  try {
    const res = await fetch(uri, { redirect: 'manual', headers: { 'User-Agent': 'Originfacts/1.0 (+https://www.originfacts.com/about)' } });
    return res.headers.get('location') || null;
  } catch {
    return null;
  }
}

const airportCalls = () => readUsage().filter((u) => u.grounded && String(u.slug).startsWith('airport-')).length;

async function groundedTopic(slug, topic, prompt, dir) {
  const raw = path.join(dir, `${topic}.json`);
  const saved = readJson(raw, null);
  if (!FORCE && saved?.parsed) return saved.parsed;
  if (airportCalls() >= MAX_GROUNDED) throw new GeminiStop(`airport grounded-request budget reached (${MAX_GROUNDED})`);
  const { text, grounding, usage } = await gemini({ model: MODEL, prompt, grounded: true, thinkingLevel: THINKING, slug, kind: PASS === 2 ? `p2-${topic}` : topic, rawPath: raw });
  const chunks = [];
  for (const [i, ch] of (grounding?.groundingChunks ?? []).entries()) {
    const uri = ch.web?.uri ?? null;
    const url = uri ? await resolveRedirect(uri) : null;
    chunks.push({ index: i, title: ch.web?.title ?? null, redirect: uri, url, rejected: url ? rejectedHost(url) : 'unresolved' });
    await sleep(150);
  }
  const supports = (grounding?.groundingSupports ?? []).map((s) => ({ text: s.segment?.text ?? '', chunks: s.groundingChunkIndices ?? [] }));
  const parsed = { text, chunks, supports };
  writeJson(raw, { ...readJson(raw), parsed });
  console.log(`${slug} ${topic}: ${usage.prompt_tokens}+${usage.candidates_tokens}(+${usage.thoughts_tokens} thinking) tok, ${chunks.length} sources (${chunks.filter((c) => !c.rejected).length} usable)`);
  return parsed;
}

async function structure(slug, a, answers, dir) {
  const sources = [];
  const numOf = new Map();
  const local = {};
  for (const [topic, ans] of Object.entries(answers)) {
    local[topic] = ans.chunks.map((c) => {
      if (c.rejected || !c.url) return null;
      if (!numOf.has(c.url)) {
        sources.push({ n: sources.length + 1, url: c.url, title: c.title, topic });
        numOf.set(c.url, sources.length);
      }
      return numOf.get(c.url);
    });
  }
  const block = Object.entries(answers)
    .map(([topic, ans]) => {
      const sup = ans.supports
        .map((s) => ({ text: s.text, ns: [...new Set(s.chunks.map((i) => local[topic][i]).filter(Boolean))] }))
        .filter((s) => s.ns.length);
      return `## ${topic}\nSupported statements:\n${sup.map((s) => `- "${s.text}" → ${s.ns.map((n) => `S${n}`).join(', ')}`).join('\n') || '(none)'}`;
    })
    .join('\n\n');
  const prompt = `You are turning researched notes about ${a.name} (${a.city}) into individual factual claims for a fact-checked airport page.

SOURCES (the only sources you may cite):
${sources.map((s) => `S${s.n}: ${s.title ?? ''} — ${new URL(s.url).hostname}`).join('\n')}

NOTES:
${block}

Rules:
- Only use the supported statements; cite only the S-numbers listed for that statement. Never invent a source.
- One fact per claim, one short sentence, plain British English. Every name, number and date in a claim must appear in its statement; add nothing else.
- Set "section" to one of: terminals | transport | parking | assistance.
- Skip anything about other airports, and anything framed as a rumour, plan or proposal without a date.
Reply with ONLY JSON: {"claims":[{"section":"...","text":"...","sources":[1]}]}`;
  const { text } = await gemini({ model: MODEL, prompt, grounded: false, thinkingLevel: THINKING, slug, kind: 'structure', rawPath: path.join(dir, 'structure.json') });
  const reply = parseJsonReply(text);
  if (!reply?.claims) throw new Error(`${slug}: structuring reply unparseable`);
  const byN = new Map(sources.map((s) => [s.n, s]));
  return {
    sources,
    claims: reply.claims.map((c) => ({ ...c, urls: (c.sources ?? []).map((n) => byN.get(Number(n))?.url).filter(Boolean) })),
  };
}

async function verify(code, a, claims) {
  const place = { iata: code, names: a.places.map(norm) };
  const kept = [];
  const dropped = [];
  for (const c of claims) {
    const k = keyTokens(c.text, [], [], a.places);
    if (tokenCount(k) < 1) {
      dropped.push({ ...c, reason: 'nothing checkable (no number or proper name)' });
      continue;
    }
    let hit = null;
    const reasons = [];
    for (const url of c.urls) {
      const page = await fetchPage(url);
      if (!page.ok) {
        reasons.push(`${url}: ${page.reason}`);
        continue;
      }
      if (!mentionsPlace(page.text, place)) {
        reasons.push(`${url}: page does not name the airport`);
        continue;
      }
      const quote = locateQuote(page.text, k);
      if (quote) {
        hit = { url, final_url: page.final_url, title: page.meta?.title ?? null, quote };
        break;
      }
      reasons.push(`${url}: no sentence carries every number and name`);
    }
    if (hit) kept.push({ section: c.section, text: c.text, ...hit });
    else dropped.push({ ...c, reason: reasons.join(' | ') || 'no usable source' });
  }
  return { kept, dropped };
}

async function main() {
  const codes = String(arg('airports', '')).toUpperCase().split(',').filter(Boolean);
  const unknown = codes.filter((c) => !AIRPORTS[c]);
  if (!codes.length || unknown.length) {
    console.error(`usage: --airports ${Object.keys(AIRPORTS).join(',')}${unknown.length ? ` (unknown: ${unknown})` : ''}`);
    process.exit(1);
  }
  if (DRY) {
    console.log(`${codes.length} airports × 4 grounded + 1 structuring call = ${codes.length * 5} Gemini calls (${codes.length * 4} grounded; cap ${MAX_GROUNDED}, used ${airportCalls()}). Model ${MODEL}, thinking ${THINKING}.`);
    return;
  }
  for (const code of codes) {
    const a = { ...AIRPORTS[code], code };
    const slug = `airport-${code.toLowerCase()}`;
    const dir = path.join(DATA, 'airports', code.toLowerCase(), ...(PASS === 2 ? ['p2'] : []));
    const answers = {};
    for (const [topic, prompt] of Object.entries(topics(a))) answers[topic] = await groundedTopic(slug, topic, prompt, dir);
    const { sources, claims } = await structure(slug, a, answers, dir);
    const { kept, dropped } = await verify(code, a, claims);
    writeJson(path.join(dir, 'verified.json'), { iata: code, model: MODEL, researched_at: today, sources, kept, dropped });
    const bySection = kept.reduce((m, c) => ({ ...m, [c.section]: (m[c.section] ?? 0) + 1 }), {});
    console.log(`${code}: ${sources.length} sources, ${claims.length} claims → ${kept.length} verified ${JSON.stringify(bySection)}`);
  }
}

main().catch((e) => {
  console.error(e instanceof GeminiStop ? `STOP: ${e.message}` : e);
  process.exit(e instanceof GeminiStop ? 2 : 1);
});
