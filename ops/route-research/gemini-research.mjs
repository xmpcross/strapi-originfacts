#!/usr/bin/env node
/**
 * Step 1 — grounded research, in two passes per route.
 *
 * Pass A (grounded): six plain-prose questions with the google_search tool —
 * operators, route history, origin airport, destination airport, transport at
 * each end, and one route-specific practical angle (the depth of
 * content/route-guides/bah-to-doh.json). No JSON is asked for: on
 * gemini-3.6-flash a JSON-only instruction suppressed groundingMetadata and
 * the model invented URLs. Sources come ONLY from groundingMetadata:
 * groundingChunks[].web.uri (a vertexaisearch redirect) is resolved to the
 * final URL (both recorded); aggregator / booking / UGC hosts are discarded
 * (match.mjs REJECTED_HOSTS). URLs written in the model's prose are ignored.
 *
 * Pass B (no search): one structuring call turns the six answers plus the
 * numbered grounded sources and their groundingSupports into JSON claims.
 * Each claim cites source numbers from that list; it cannot add a URL.
 *
 *   node ops/route-research/gemini-research.mjs --routes akl-to-syd[,…]
 *     [--model gemini-3.6-flash] [--thinking low] [--max-grounded N] [--force]
 *
 * Raw requests/responses (no key) → data/research/<slug>/<topic>.json, structure.json
 * Per-call usage → data/usage.jsonl     Claims → data/research/<slug>/claims.json
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  arg, DATA, gemini, GeminiStop, loadRoutes, parseJsonReply, readJson, readUsage, routeLabel, sleep, writeJson,
} from './lib.mjs';
import { rejectedHost } from './match.mjs';

const MODEL = arg('model', 'gemini-3.6-flash');
const MAX_GROUNDED = Number(arg('max-grounded', 40));
// 'minimal' skipped the search entirely on the akl-to-syd test; 'low' searches.
const THINKING = arg('thinking', 'low');
const FORCE = !!arg('force');
const slugs = String(arg('routes', '')).split(',').filter(Boolean);
if (!slugs.length) {
  console.error('usage: --routes slug,slug');
  process.exit(1);
}
const today = new Date().toISOString().slice(0, 10);

const STEER = `Use Google Search. Base the answer on news coverage (aviation trade press such as Australian Aviation, Executive Traveller, Aviation Week, Routesonline, CAPA, ch-aviation, AeroRoutes; national and regional newspapers), airline and airport press releases / newsrooms, and official airport, government and transport-authority pages. Booking and fare sites (Expedia, Skyscanner, Kayak, FlightsFrom, Trip.com, Google Flights, FlightConnections, Kiwi, Wego, Cheapflights, travel agents), Wikipedia, forums and social media are NOT acceptable sources. Give specific facts with exact dates (day, month, year) where sources give them, and name airlines exactly as the sources do. Say plainly if you could not find something.`;

export function topics(r, day = today) {
  const L = routeLabel(r);
  const o = r.origin;
  const d = r.destination;
  const pair = `${L.o} and ${L.d}`;
  return {
    operators: `Today is ${day}. Which airlines currently operate scheduled nonstop passenger flights between ${pair} with their own aircraft (not codeshare-only)? For each, cite a recent (2025–2026) news report or press release that names the airline flying this route, and mention frequency or seasonality if reported. Note any airline that has recently started, ended or announced changes to the route. ${STEER}`,
    history: `What are the notable dated events in the history of nonstop flights between ${pair}: launches, suspensions, resumptions, airlines entering or leaving the route, capacity changes, records? Give each event with its date. ${STEER}`,
    origin_airport: `Facts a traveller should know about ${o.name} (${o.iata}) in ${o.city || ''}, ${o.country || ''}: which terminal(s) international/domestic flights use, when the airport or its current terminal opened, and other notable facts stated on the airport's own website or in news coverage. ${STEER}`,
    destination_airport: `Facts a traveller should know about ${d.name} (${d.iata}) in ${d.city || ''}, ${d.country || ''}: which terminal(s) international/domestic flights use, when the airport or its current terminal opened, and other notable facts stated on the airport's own website or in news coverage. ${STEER}`,
    transport: `How do you get between ${o.name} (${o.iata}) and central ${o.city || o.name}, and between ${d.name} (${d.iata}) and central ${d.city || d.name}, by public transport (train, metro, bus, airport express), taxi and rideshare? Give the service names and where they leave from, as stated by the airports or the transport authorities. ${STEER}`,
    practical: `For travellers between ${L.from} and ${L.to}: what is one route-specific practical question a traveller would ask (for example entry/visa or arrival processing between these two places, alternative ways to travel between them, or which airport in each city is used), and what do official or news sources say? ${STEER}`,
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

async function groundedTopic(slug, topic, prompt, dir) {
  const raw = path.join(dir, `${topic}.json`);
  if (!FORCE && fs.existsSync(raw) && readJson(raw).parsed) return readJson(raw).parsed;
  const used = readUsage().filter((u) => u.grounded).length;
  if (used >= MAX_GROUNDED) throw new GeminiStop(`grounded-request budget reached (${used}/${MAX_GROUNDED})`);
  const { text, grounding, usage } = await gemini({ model: MODEL, prompt, grounded: true, thinkingLevel: THINKING, slug, kind: topic, rawPath: raw });
  const chunks = [];
  for (const [i, ch] of (grounding?.groundingChunks ?? []).entries()) {
    const uri = ch.web?.uri ?? null;
    const url = uri ? await resolveRedirect(uri) : null;
    chunks.push({ index: i, title: ch.web?.title ?? null, redirect: uri, url, rejected: url ? rejectedHost(url) : 'unresolved' });
    await sleep(150);
  }
  const supports = (grounding?.groundingSupports ?? []).map((s) => ({ text: s.segment?.text ?? '', chunks: s.groundingChunkIndices ?? [] }));
  const parsed = { text, chunks, supports, web_search_queries: grounding?.webSearchQueries ?? [] };
  writeJson(raw, { ...readJson(raw), parsed });
  console.log(
    `${slug} ${topic}: ${usage.prompt_tokens}+${usage.candidates_tokens}(+${usage.thoughts_tokens} thinking) tok, ${usage.web_search_queries} searches, ` +
      `${chunks.length} sources (${chunks.filter((c) => !c.rejected).length} usable)`,
  );
  return parsed;
}

const CATEGORIES = 'operator | seasonal | history | airport | ground | practical';

async function structure(slug, r, answers, dir) {
  // Number the usable grounded sources across all topics (one number per final URL).
  const sources = [];
  const numOf = new Map();
  const local = {};
  for (const [topic, a] of Object.entries(answers)) {
    local[topic] = a.chunks.map((c) => {
      if (c.rejected || !c.url) return null;
      if (!numOf.has(c.url)) {
        sources.push({ n: sources.length + 1, url: c.url, redirect: c.redirect, title: c.title, topic });
        numOf.set(c.url, sources.length);
      }
      return numOf.get(c.url);
    });
  }
  const L = routeLabel(r);
  const block = Object.entries(answers)
    .map(([topic, a]) => {
      const sup = a.supports
        .map((s) => ({ text: s.text, ns: [...new Set(s.chunks.map((i) => local[topic][i]).filter(Boolean))] }))
        .filter((s) => s.ns.length);
      return `## ${topic}\n${a.text}\n\nSupported statements:\n${sup.map((s) => `- "${s.text}" → ${s.ns.map((n) => `S${n}`).join(', ')}`).join('\n') || '(none)'}`;
    })
    .join('\n\n');
  const prompt = `You are turning researched notes about the flight route ${L.o} → ${L.d} into individual factual claims for a fact-checked web page.

SOURCES (the only sources you may cite):
${sources.map((s) => `S${s.n}: ${s.title ?? ''} — ${new URL(s.url).hostname}`).join('\n')}

NOTES (with the statements Google tied to each source):
${block}

Rules:
- Only use statements listed under "Supported statements"; cite the S-numbers given for that statement. Never cite a source that is not listed for it, never invent a URL or source.
- One fact per claim, one short sentence, plain British English. Keep to the wording of the supported statement: every name, number and date in your claim must appear in that statement, and add nothing it does not say (no extra dates, frequencies, aircraft or details from elsewhere). Include the year in any dated claim only if the statement gives it.
- State the fact itself; never frame a claim as "X reported" or "on <date> X announced" unless the announcement itself is the fact.
- Categories: ${CATEGORIES}.
  operator = an airline currently flies ${L.from}–${L.to} nonstop with its own aircraft (name the airline and both cities);
  seasonal = a current or announced change to that service (frequency, new/ended service), with its date;
  history = a dated past event on this route (name the airline(s) and both cities, include the year);
  airport = a fact about one of the two airports (set "airport" to its IATA code);
  ground = how to get between one airport and its city (set "airport");
  practical = an answer to a route-specific traveller question: also give "question".
- Skip anything about other airports or routes, codeshare-only arrangements, or carriers no longer flying.
Reply with ONLY JSON: {"claims":[{"category":"...","text":"...","date":"YYYY-MM-DD|YYYY-MM|YYYY|null","airlines":["..."],"airport":"IATA|null","question":"...|null","sources":[1,2]}]}`;
  const { text } = await gemini({ model: MODEL, prompt, grounded: false, thinkingLevel: THINKING, slug, kind: 'structure', rawPath: path.join(dir, 'structure.json') });
  const reply = parseJsonReply(text);
  if (!reply?.claims) throw new Error(`${slug}: structuring reply unparseable`);
  const byN = new Map(sources.map((s) => [s.n, s]));
  const claims = reply.claims.map((c) => {
    const cited = (c.sources ?? []).map((n) => byN.get(Number(n))).filter(Boolean);
    return {
      ...c,
      quote: null,
      grounding_urls: cited.map((s) => s.url),
      grounding_redirects: cited.map((s) => s.redirect),
      cited_unknown_sources: (c.sources ?? []).filter((n) => !byN.has(Number(n))),
      source_url: null,
      same_host_chunk_urls: [],
    };
  });
  return { sources, claims };
}

async function main() {
  const routes = await loadRoutes();
  for (const slug of slugs) {
    const r = routes.find((x) => x.slug === slug);
    if (!r?.origin || !r?.destination) {
      console.error(`${slug}: not a route in Strapi — skipped`);
      continue;
    }
    const dir = path.join(DATA, 'research', slug);
    const answers = {};
    for (const [topic, prompt] of Object.entries(topics(r))) answers[topic] = await groundedTopic(slug, topic, prompt, dir);
    const { sources, claims } = await structure(slug, r, answers, dir);
    const rejected = Object.values(answers).flatMap((a) => a.chunks.filter((c) => c.rejected).map((c) => `${c.url ?? c.redirect}: ${c.rejected}`));
    writeJson(path.join(dir, 'claims.json'), { slug, model: MODEL, researched_at: today, sources, rejected_sources: rejected, claims });
    console.log(`${slug}: ${sources.length} usable grounded sources (${rejected.length} rejected), ${claims.length} claims`);
  }
}

main().catch((e) => {
  console.error(e instanceof GeminiStop ? `STOP: ${e.message}` : e);
  process.exit(e instanceof GeminiStop ? 2 : 1);
});
