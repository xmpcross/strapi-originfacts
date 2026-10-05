/**
 * Shared helpers for the route-research pipeline (see README.md).
 *
 * Nothing in here writes to Strapi: routes and airlines are read with public
 * GETs (or from a saved response with --routes-file / --airlines-file).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');
/** Gitignored audit folder: raw Gemini responses, fetched page text, verification logs. */
export const DATA = path.join(HERE, 'data');
/** Committed: verified claims with their exact quotes, one file per route. */
export const CLAIMS_DIR = path.join(HERE, 'claims');
export const GUIDES_DIR = path.join(REPO, 'content', 'route-guides');
export const USAGE_LOG = path.join(DATA, 'usage.jsonl');

/** Same identifying UA as ops/fetch/browser.ts: who we are, with a contact URL. */
export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ' +
  'Originfacts/1.0 (+https://www.originfacts.com/about)';

export const STRAPI = (process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');

export function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function readJson(p, fallback = undefined) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw e;
  }
}

export function writeJson(p, v) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Routes, read-only, from a saved /api/routes response or Strapi. Cached in data/. */
export async function loadRoutes(file = arg('routes-file')) {
  const cache = path.join(DATA, 'strapi-routes.json');
  if (file) return readJson(file).data ?? readJson(file);
  if (fs.existsSync(cache)) return readJson(cache);
  const out = [];
  for (let page = 1; ; page++) {
    const q =
      'populate[origin]=true&populate[destination]=true&populate[carriers]=true' +
      `&pagination[pageSize]=250&pagination[page]=${page}`;
    const res = await fetch(`${STRAPI}/api/routes?${q}`);
    if (!res.ok) throw new Error(`Strapi /api/routes returned ${res.status}`);
    const j = await res.json();
    out.push(...j.data);
    if (page >= j.meta.pagination.pageCount) break;
  }
  writeJson(cache, out);
  return out;
}

/** Every Strapi airline (name, slug, iataCode, country), read-only. Cached in data/. */
export async function loadAirlines(file = arg('airlines-file')) {
  const cache = path.join(DATA, 'strapi-airlines.json');
  if (file) return readJson(file).data ?? readJson(file);
  if (fs.existsSync(cache)) return readJson(cache);
  const out = [];
  for (let page = 1; ; page++) {
    const q =
      'fields[0]=name&fields[1]=slug&fields[2]=iataCode&fields[3]=country' +
      `&pagination[pageSize]=250&pagination[page]=${page}`;
    const res = await fetch(`${STRAPI}/api/airlines?${q}`);
    if (!res.ok) throw new Error(`Strapi /api/airlines returned ${res.status}`);
    const j = await res.json();
    out.push(...j.data);
    if (page >= j.meta.pagination.pageCount) break;
  }
  writeJson(cache, out);
  return out;
}

/** Whitespace, quote marks, dashes and case folded so a quote can be found in page text. */
export function norm(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF\u00AD]/g, '')
    .replace(/[‘’‛′`´]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/ | | /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function logUsage(entry) {
  ensureDir(DATA);
  fs.appendFileSync(USAGE_LOG, `${JSON.stringify(entry)}\n`);
}

export function readUsage() {
  if (!fs.existsSync(USAGE_LOG)) return [];
  return fs
    .readFileSync(USAGE_LOG, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/** Gemini key from the environment or .env.local. Never printed, logged or put in a URL. */
export function geminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const env = fs.readFileSync(path.join(REPO, '.env.local'), 'utf8');
    const m = env.match(/^GEMINI_API_KEY=(.*)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    /* fall through */
  }
  throw new Error('GEMINI_API_KEY is not set (env or .env.local)');
}

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiStop extends Error {}

/**
 * One generateContent call. Records usageMetadata, whether it was grounded and
 * how many web search queries Google ran, for every call, in data/usage.jsonl.
 * Billing / quota / auth errors throw GeminiStop: the run stops, it does not retry.
 */
export async function gemini({ model, prompt, grounded, slug, kind, rawPath, thinkingLevel = null }) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(grounded ? { tools: [{ google_search: {} }] } : {}),
    // Gemini 3.x: thinking_level minimal | low | medium | high (default medium-ish). ~90 % of pilot cost was thinking.
    ...(thinkingLevel ? { generationConfig: { thinkingConfig: { thinkingLevel } } } : {}),
  };
  const started = Date.now();
  const res = await fetch(`${GEMINI}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey() },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  const um = json.usageMetadata ?? {};
  const cand = json.candidates?.[0];
  const gm = cand?.groundingMetadata;
  const entry = {
    ts: new Date().toISOString(),
    slug,
    kind,
    model,
    http: res.status,
    grounded: !!grounded,
    thinking_level: thinkingLevel,
    web_search_queries: gm?.webSearchQueries?.length ?? 0,
    grounding_chunks: gm?.groundingChunks?.length ?? 0,
    prompt_tokens: um.promptTokenCount ?? 0,
    candidates_tokens: um.candidatesTokenCount ?? 0,
    thoughts_tokens: um.thoughtsTokenCount ?? 0,
    tool_use_prompt_tokens: um.toolUsePromptTokenCount ?? 0,
    total_tokens: um.totalTokenCount ?? 0,
    finish: cand?.finishReason ?? null,
    ms: Date.now() - started,
    error: json.error ? { code: json.error.code, status: json.error.status, message: json.error.message } : null,
  };
  logUsage(entry);
  if (rawPath) writeJson(rawPath, { request: body, model, response: json, usage: entry });
  if (!res.ok || json.error) {
    const msg = `${json.error?.status ?? res.status}: ${json.error?.message ?? 'no body'}`;
    if (
      [401, 403, 429].includes(res.status) ||
      /billing|quota|RESOURCE_EXHAUSTED|PERMISSION_DENIED|exceeded/i.test(msg)
    ) {
      throw new GeminiStop(`Gemini billing/quota/auth problem — stopping: ${msg}`);
    }
    throw new Error(`Gemini error ${msg}`);
  }
  const text = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('');
  return { text, json, grounding: gm ?? null, usage: entry };
}

/** First JSON object in a model reply (tolerates ```json fences and leading prose). */
export function parseJsonReply(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf('{');
  const end = src.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(src.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function routeLabel(r) {
  const o = r.origin;
  const d = r.destination;
  return {
    from: o.city || o.name,
    to: d.city || d.name,
    o: `${o.name} (${o.iata}) in ${o.city || ''}${o.country ? `, ${o.country}` : ''}`,
    d: `${d.name} (${d.iata}) in ${d.city || ''}${d.country ? `, ${d.country}` : ''}`,
  };
}
