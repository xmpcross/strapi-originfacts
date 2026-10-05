#!/usr/bin/env node
/**
 * Step 2 — verify every researched claim against the source page itself.
 *
 * For each claim, candidate sources are tried in order: the pages Google's
 * grounding returned for that claim, other grounding pages on the same host
 * as the URL the model wrote, then the model's URL. Each page is fetched once
 * (cached in data/pages/), politely:
 *   - identifying User-Agent (ops/fetch's, with a contact URL)
 *   - robots.txt obeyed for every host, including each redirect hop; an
 *     unreadable robots.txt (5xx / network) fails closed
 *   - one request at a time, ≥ 4 s between requests to the same host
 *     (longer if robots.txt asks), no retries against a block, no bypassing
 * A claim is kept only if its quote is on the page and carries every number,
 * date, month, airline name and strong word in the claim (match.mjs). A quote
 * the model wrote that is not on the page may be replaced by one located on
 * the page; located quotes are marked and need the semantic check (--judge,
 * one non-grounded Gemini call per route) or they are not published.
 *
 *   node ops/route-research/verify-sources.mjs --routes syd-to-mel[,…]
 *     [--claims-file <claims.json>]   verify a hand-made claims file (fixtures)
 *     [--judge] [--model gemini-3.6-flash] [--out <file>]
 *
 * Output: data/verified/<slug>.json (every claim, kept or dropped with reasons).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { arg, DATA, gemini, GeminiStop, loadAirlines, loadRoutes, parseJsonReply, readJson, sleep, USER_AGENT, writeJson } from './lib.mjs';
import {
  extractMeta, htmlToText, keyTokens, operatorQuoteProblem, otherAirportCodes, locateQuote, mentionsPlace, missingTokens, parseRobots, placeNames, quoteOnPage, rejectedHost, tokenCount,
} from './match.mjs';

const HOST_GAP_MS = 4000;
const MAX_CRAWL_DELAY_MS = 30_000;
const TIMEOUT_MS = 20_000;
const MAX_BYTES = 5_000_000;
const ROUTE_CATEGORIES = new Set(['operator', 'seasonal', 'history']);
const CATEGORIES = new Set([...ROUTE_CATEGORIES, 'airport', 'ground']);

/* ------------------------------------------------------------- fetching */

const lastHit = new Map();
const robotsCache = new Map();

async function politeWait(host, extraMs = 0) {
  const gap = Math.max(HOST_GAP_MS, Math.min(extraMs, MAX_CRAWL_DELAY_MS));
  const wait = (lastHit.get(host) ?? 0) + gap - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

async function robotsFor(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  const host = new URL(origin).host;
  await politeWait(host);
  let r;
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10_000) });
    if (res.status >= 500) r = 'unavailable';
    else if (res.status >= 400) r = parseRobots('');
    else r = parseRobots(await res.text());
  } catch {
    r = 'unavailable';
  }
  robotsCache.set(origin, r);
  return r;
}

const BLOCK_SIGNS = /just a moment\.\.\.|cf-challenge|captcha|access denied|attention required|enable javascript and cookies|px-captcha|datadome/i;

/** Fetch a page (cached). Returns { ok, url, final_url, text, meta } or { ok:false, reason }. */
export async function fetchPage(url) {
  const file = path.join(DATA, 'pages', `${crypto.createHash('sha1').update(url).digest('hex')}.json`);
  if (fs.existsSync(file)) return readJson(file);
  let current = url;
  let result;
  for (let hop = 0; hop < 6; hop++) {
    const u = new URL(current);
    if (!/^https?:$/.test(u.protocol)) {
      result = { ok: false, reason: 'not http(s)' };
      break;
    }
    const robots = await robotsFor(u.origin);
    if (robots === 'unavailable') {
      result = { ok: false, reason: `robots.txt unavailable (${u.host})` };
      break;
    }
    if (!robots.isAllowed(current)) {
      result = { ok: false, reason: `robots.txt disallows (${u.host})` };
      break;
    }
    await politeWait(u.host, (robots.crawlDelay ?? 0) * 1000);
    let res;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9', 'Accept-Language': 'en' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      result = { ok: false, reason: `network error (${e.name})` };
      break;
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current).toString();
      continue;
    }
    const type = res.headers.get('content-type') ?? '';
    if ([401, 403, 429].includes(res.status)) {
      result = { ok: false, reason: `blocked (HTTP ${res.status})` };
      break;
    }
    if (res.status !== 200) {
      result = { ok: false, reason: `HTTP ${res.status}` };
      break;
    }
    if (!/text\/html|application\/xhtml|text\/plain/i.test(type)) {
      result = { ok: false, reason: `unsupported content type (${type.split(';')[0] || 'none'})` };
      break;
    }
    const body = (await res.text()).slice(0, MAX_BYTES);
    const text = /html/i.test(type) ? htmlToText(body) : body;
    if (text.length < 500 && BLOCK_SIGNS.test(body)) {
      result = { ok: false, reason: 'blocked (bot interstitial)' };
      break;
    }
    result = { ok: true, url, final_url: current, fetched_at: new Date().toISOString(), meta: /html/i.test(type) ? extractMeta(body) : {}, text };
    break;
  }
  result ??= { ok: false, reason: 'too many redirects' };
  result.url ??= url;
  writeJson(file, result);
  return result;
}

/* ------------------------------------------------------------ verifying */

function candidates(c) {
  const seen = new Set();
  const out = [];
  const add = (u, origin) => {
    if (!u || typeof u !== 'string' || seen.has(u)) return;
    seen.add(u);
    out.push({ url: u, origin });
  };
  for (const u of c.grounding_urls ?? []) add(u, 'grounding');
  for (const u of c.same_host_chunk_urls ?? []) add(u, 'grounding-same-host');
  add(c.source_url, 'model');
  return out;
}

/** Verify one claim. Pure apart from fetchPage (injectable for tests). */
export async function verifyClaim(c, ctx, fetcher = fetchPage) {
  const reasons = [];
  if (!CATEGORIES.has(c.category)) return { ...c, status: 'dropped', reasons: [`unknown category ${c.category}`] };
  const k = keyTokens(c.text, c.airlines ?? [], ctx.knownAirlines);
  const isRoute = ROUTE_CATEGORIES.has(c.category);
  const ends = isRoute ? ctx.ends : null;
  const place = !isRoute && c.airport ? ctx.ends.find((e) => e.iata === String(c.airport).toUpperCase()) : null;
  if (!isRoute && !place) return { ...c, status: 'dropped', reasons: ['airport claim not about either end of the route'] };
  if (!(c.airlines ?? []).length && /\b(the airline|the carrier)('s)?\b/i.test(c.text)) return { ...c, status: 'dropped', reasons: ['claim refers to "the airline" without naming it'] };
  const stray = otherAirportCodes(c.text, ctx.ends.map((e) => e.iata));
  if (stray.length) return { ...c, status: 'dropped', reasons: [`claim is about another airport (${stray.join(', ')})`] };
  if (c.category === 'history' && !/\b(19|20)\d{2}\b/.test(c.text)) return { ...c, status: 'dropped', reasons: ['history claim has no year in its text'] };
  if (c.category === 'operator' && !(c.airlines ?? []).length) return { ...c, status: 'dropped', reasons: ['operator claim names no airline'] };
  const list = candidates(c);
  if (!list.length) return { ...c, status: 'dropped', reasons: ['no source URL'] };
  for (const cand of list) {
    const bad = rejectedHost(cand.url);
    if (bad) {
      reasons.push(`${cand.url}: ${bad}`);
      continue;
    }
    const page = await fetcher(cand.url);
    if (!page.ok) {
      reasons.push(`${cand.url}: ${page.reason}`);
      continue;
    }
    if (rejectedHost(page.final_url)) {
      reasons.push(`${cand.url}: redirected to ${rejectedHost(page.final_url)}`);
      continue;
    }
    const title = page.meta?.title ?? '';
    const placeOk = (q) =>
      (c.category !== 'operator' || !operatorQuoteProblem(q)) &&
      isRoute
        ? (mentionsPlace(q, ends[0]) || mentionsPlace(title, ends[0])) && (mentionsPlace(q, ends[1]) || mentionsPlace(title, ends[1]))
        : mentionsPlace(q, place) || mentionsPlace(title, place) || mentionsPlace(page.text.slice(0, 3000), place);
    let quote = null;
    let origin = null;
    if (c.quote && quoteOnPage(page.text, c.quote)) {
      const miss = missingTokens(k, c.quote);
      if (miss.length) reasons.push(`${cand.url}: quote on page but missing ${miss.join(', ')}`);
      else if (c.category === 'operator' && operatorQuoteProblem(c.quote)) reasons.push(`${cand.url}: ${operatorQuoteProblem(c.quote)}`);
      else if (!placeOk(c.quote)) reasons.push(`${cand.url}: quote on page but does not name the route ends`);
      else {
        quote = c.quote;
        origin = 'model';
      }
    } else {
      reasons.push(`${cand.url}: quote not on page`);
    }
    if (!quote) {
      const located = locateQuote(page.text, k, ends);
      if (located && placeOk(located)) {
        quote = located;
        origin = 'located';
      }
    }
    if (quote) {
      return {
        ...c,
        status: origin === 'model' ? 'verified' : 'needs-judge',
        quote_origin: origin,
        verified_quote: quote,
        key_tokens: k,
        source: { url: page.final_url, requested_url: cand.url, origin: cand.origin, title: page.meta?.title ?? null, site_name: page.meta?.siteName ?? null, published: page.meta?.published ?? null, fetched_at: page.fetched_at },
        reasons,
      };
    }
    if (tokenCount(k) < 2 && !c.quote) reasons.push(`${cand.url}: too few checkable tokens to locate a quote`);
  }
  return { ...c, status: 'dropped', key_tokens: k, reasons };
}

/** One non-grounded call: does each located quote state its claim? */
async function judge(slug, items, model) {
  const prompt = `For each numbered pair, answer whether the QUOTE, read on its own, states everything the CLAIM says (no extra facts in the claim, same meaning, same airline, same dates, same direction/route). Be strict. Reply with ONLY JSON: {"results":[{"n":1,"supported":true|false,"why":"short reason"}]}

${items.map((c, i) => `${i + 1}. CLAIM: ${c.text}\n   QUOTE: ${c.verified_quote}`).join('\n\n')}`;
  const { text } = await gemini({ model, prompt, grounded: false, slug, kind: 'judge', rawPath: path.join(DATA, 'research', slug, 'judge.json') });
  return parseJsonReply(text)?.results ?? [];
}

async function main() {
  const slugs = String(arg('routes', '')).split(',').filter(Boolean);
  const claimsFile = arg('claims-file');
  const routes = await loadRoutes();
  const airlines = await loadAirlines();
  const knownAirlines = airlines.map((a) => a.name).filter(Boolean);
  const model = arg('model', 'gemini-3.6-flash');
  for (const slug of slugs) {
    const r = routes.find((x) => x.slug === slug);
    if (!r) {
      console.error(`${slug}: not a route`);
      continue;
    }
    const src = claimsFile || path.join(DATA, 'research', slug, 'claims.json');
    if (!fs.existsSync(src)) {
      console.error(`${slug}: no research at ${src}`);
      continue;
    }
    const research = readJson(src);
    // Gemini 3 can return grounding redirect URLs inside its JSON instead of in
    // groundingMetadata. Resolve them now (they expire); the target is not fetched here.
    for (const c of research.claims) {
      if (/vertexaisearch\.cloud\.google\.com/.test(c.source_url ?? '')) {
        try {
          const res = await fetch(c.source_url, { redirect: 'manual', headers: { 'User-Agent': USER_AGENT } });
          c.source_url_redirect = c.source_url;
          c.source_url = res.headers.get('location') || null;
        } catch {
          c.source_url = null;
        }
        await sleep(150);
      }
    }
    const ctx = { ends: [placeNames(r.origin), placeNames(r.destination)], knownAirlines };
    const out = [];
    for (const c of research.claims) {
      const v = await verifyClaim(c, ctx);
      console.log(`${slug} [${v.status}] ${c.category}: ${c.text.slice(0, 90)}${v.status === 'dropped' ? `\n    ↳ ${v.reasons.at(-1)}` : ''}`);
      out.push(v);
    }
    const located = out.filter((c) => c.status === 'needs-judge');
    if (located.length && arg('judge')) {
      const results = await judge(slug, located, model);
      located.forEach((c, i) => {
        const r = results.find((x) => x.n === i + 1);
        c.judge = r ?? null;
        c.status = r?.supported === true ? 'verified' : 'dropped';
        if (c.status === 'dropped') c.reasons.push(`semantic check: ${r?.why ?? 'no answer'}`);
      });
    }
    const file = arg('out') || path.join(DATA, 'verified', `${slug}.json`);
    writeJson(file, { slug, verified_at: new Date().toISOString().slice(0, 10), claims: out });
    const n = (s) => out.filter((c) => c.status === s).length;
    const expected = out.filter((c) => c.expect);
    if (expected.length) {
      const failed = expected.filter((c) => c.expect !== c.status);
      for (const c of expected) console.log(`  ${c.expect === c.status ? 'PASS' : 'FAIL'} expect=${c.expect} got=${c.status} — ${c.why ?? c.text}`);
      if (failed.length) process.exitCode = 1;
    }
    console.log(`${slug}: ${out.length} claims → ${n('verified')} verified, ${n('needs-judge')} need the semantic check, ${n('dropped')} dropped → ${path.relative(process.cwd(), file)}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e instanceof GeminiStop ? `STOP: ${e.message}` : e);
    process.exit(e instanceof GeminiStop ? 2 : 1);
  });
}
