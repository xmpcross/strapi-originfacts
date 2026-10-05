#!/usr/bin/env node
/**
 * Step 1 — grounded research. For each route, three Gemini calls with the
 * google_search tool (operators today, dated history, airport access). Each
 * asks for JSON claims with a verbatim quote and a source URL.
 *
 * Grounding metadata decides the sources: each claim is mapped to the
 * groundingChunks whose groundingSupports cover its text, and those
 * vertexaisearch redirect URLs are resolved (one GET to Google, not followed
 * to the target) to the real page URL. URLs the model wrote itself are kept
 * as a fallback candidate only. Nothing is published from this step;
 * verify-sources.mjs decides what survives.
 *
 *   node ops/route-research/gemini-research.mjs --routes syd-to-mel,kul-to-sin
 *     [--model gemini-3.6-flash] [--max-grounded 40] [--kinds operators,history,airports]
 *     [--force]   re-ask even when a saved response exists
 *
 * Raw requests/responses (no key) → data/research/<slug>/<kind>.json
 * Per-call usage → data/usage.jsonl     Claims → data/research/<slug>/claims.json
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  arg, DATA, gemini, GeminiStop, loadRoutes, parseJsonReply, readJson, readUsage, routeLabel, sleep, writeJson, norm,
} from './lib.mjs';

const MODEL = arg('model', 'gemini-3.6-flash');
const MAX_GROUNDED = Number(arg('max-grounded', 40));
const KINDS = String(arg('kinds', 'operators,history,airports')).split(',');
const FORCE = !!arg('force');
const slugs = String(arg('routes', '')).split(',').filter(Boolean);
if (!slugs.length) {
  console.error('usage: --routes slug,slug');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

const RULES = `
Rules:
- You MUST run Google Search before answering; do not answer from memory. Every source_url must be a page your searches returned. Only include a claim if a page you found states it. No claim from memory.
- "quote" must be copied VERBATIM (character for character, one or two consecutive sentences, no ellipsis, no paraphrase) from the page in "source_url". It must contain every number, date and airline name used in "text".
- "text" is one plain factual sentence in British English, no marketing language, no superlatives unless the quote states them.
- Prefer airline and airport press releases or official pages, government sources and established news or aviation-trade outlets. Do NOT use Wikipedia, forums, Reddit, Quora, Tripadvisor, social media, flight-search / booking / route-map sites (Skyscanner, Kayak, Expedia, Google Flights, FlightConnections, Trip.com, Wego, etc.) or AI-generated content farms.
- If you find nothing reliable, return an empty claims array. Fewer, well-sourced claims are better than many.
- Reply with ONLY a JSON object, no prose:
{"claims":[{"category":"<category>","text":"...","date":"YYYY-MM-DD | YYYY-MM | YYYY | null","airlines":["airline names named in text"],"airport":"<IATA of the airport the claim is about, or null>","quote":"...","source_url":"https://..."}]}`;

function prompts(r) {
  const L = routeLabel(r);
  const pair = `${L.o} and ${L.d}`;
  return {
    operators: `Today is ${today}. Which airlines currently operate scheduled nonstop passenger flights between ${pair}, with their own aircraft (the operating carrier, not airlines that only sell codeshare seats)? List EVERY airline that does, one claim each (category "operator"), naming the airline and saying it flies between these two airports nonstop or directly. Each operator claim needs a page dated 2025 or 2026 (news article, airline or airport media release) whose quote names the airline and both cities or airports; undated booking or marketing pages are not acceptable for operator claims. If a city has several airports, only flights to/from the airports named above count. Add claims (category "seasonal") for any service a source says is seasonal, newly launched in 2025–2026, or announced to start or end.
${RULES}`,
    history: `Today is ${today}. Find notable, dated history of nonstop air service between ${pair}: when particular airlines launched, suspended, resumed or dropped the route, and any notable milestones a source records for this specific city pair. Category "history". Each claim needs a date.
${RULES}`,
    airports: `Today is ${today}. For a traveller flying between ${pair}: for EACH of the two airports, how do you get between the airport and the city centre by public transport (train, metro, airport bus — give the service name as the airport or operator states it)? Category "ground", with "airport" set to the IATA code. Also, if the airport's official site or an established outlet states it, when the airport or its main passenger terminal opened (category "airport").
${RULES}`,
  };
}

/** Map claims to the grounding chunks whose supports cover their text. */
function mapClaimsToChunks(claims, gm) {
  const supports = gm?.groundingSupports ?? [];
  const tok = (s) => new Set(norm(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter((t) => t.length > 2));
  return claims.map((c) => {
    const ct = norm(c.text);
    const cq = norm(c.quote);
    const ctok = tok(`${c.text}`);
    const idx = new Set();
    for (const s of supports) {
      const seg = norm(s.segment?.text ?? '').replace(/\\"/g, '"');
      if (seg.length < 12) continue;
      const hit =
        seg.includes(ct) ||
        (cq && seg.includes(cq.slice(0, 80))) ||
        (seg.length > 30 && (ct.includes(seg) || cq.includes(seg))) ||
        (() => {
          const st = tok(seg);
          let n = 0;
          for (const t of ctok) if (st.has(t)) n++;
          return ctok.size > 0 && n / ctok.size >= 0.7;
        })();
      if (hit) for (const i of s.groundingChunkIndices ?? []) idx.add(i);
    }
    return { ...c, grounding_chunks: [...idx].sort((a, b) => a - b) };
  });
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

async function main() {
  const routes = await loadRoutes();
  const bySlug = new Map(routes.map((r) => [r.slug, r]));
  for (const slug of slugs) {
    const r = bySlug.get(slug);
    if (!r?.origin || !r?.destination) {
      console.error(`${slug}: not a route in Strapi — skipped`);
      continue;
    }
    const dir = path.join(DATA, 'research', slug);
    const all = [];
    const P = prompts(r);
    for (const kind of KINDS) {
      const raw = path.join(dir, `${kind}.json`);
      const retryRaw = raw.replace(/\.json$/, '-retry.json');
      let saved = null;
      if (!FORCE) for (const f of [raw, retryRaw]) if (!saved?.parsed && fs.existsSync(f)) saved = readJson(f);
      let parsed = saved?.parsed ?? null;
      let attempts = 0;
      while (!parsed && attempts < 2) {
        const used = readUsage().filter((u) => u.grounded).length;
        if (used >= MAX_GROUNDED) throw new GeminiStop(`grounded-request budget reached (${used}/${MAX_GROUNDED})`);
        attempts++;
        const rawFile = attempts > 1 ? retryRaw : raw;
        const { text, grounding, usage } = await gemini({
          model: MODEL, prompt: P[kind], grounded: true, slug, kind: attempts > 1 ? `${kind}-retry` : kind, rawPath: rawFile,
        });
        const reply = parseJsonReply(text);
        console.log(
          `${slug} ${kind}: ${usage.prompt_tokens}+${usage.candidates_tokens}(+${usage.thoughts_tokens} thinking) tok, ` +
            `${usage.web_search_queries} searches, ${usage.grounding_chunks} chunks, ${reply?.claims?.length ?? 'unparseable'} claims`,
        );
        if (!reply || !Array.isArray(reply.claims)) continue;
        const chunks = [];
        for (const [i, ch] of (grounding?.groundingChunks ?? []).entries()) {
          const uri = ch.web?.uri ?? null;
          chunks.push({ index: i, title: ch.web?.title ?? null, redirect: uri, url: uri ? await resolveRedirect(uri) : null });
          await sleep(150);
        }
        parsed = {
          chunks,
          web_search_queries: grounding?.webSearchQueries ?? [],
          claims: mapClaimsToChunks(reply.claims, grounding).map((c) => ({
            ...c,
            kind,
            grounding_urls: c.grounding_chunks.map((i) => chunks[i]?.url).filter(Boolean),
          })),
        };
        writeJson(rawFile, { ...readJson(rawFile), parsed });
      }
      if (!parsed) {
        console.error(`${slug} ${kind}: no parseable reply after ${attempts} attempts`);
        continue;
      }
      // Chunks the claim did not map to are still candidates when they share the model URL's host.
      for (const c of parsed.claims) {
        let host = null;
        try {
          host = new URL(c.source_url).hostname.replace(/^www\./, '');
        } catch {
          /* model gave no usable URL */
        }
        c.same_host_chunk_urls = host
          ? parsed.chunks.filter((ch) => ch.url && new URL(ch.url).hostname.replace(/^www\./, '') === host).map((ch) => ch.url)
          : [];
        all.push(c);
      }
    }
    writeJson(path.join(dir, 'claims.json'), { slug, model: MODEL, researched_at: today, claims: all });
  }
}

main().catch((e) => {
  console.error(e instanceof GeminiStop ? `STOP: ${e.message}` : e);
  process.exit(e instanceof GeminiStop ? 2 : 1);
});
