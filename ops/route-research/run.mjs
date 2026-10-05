#!/usr/bin/env node
/**
 * The whole pipeline in one command: research (Gemini + Google Search
 * grounding) → verify against fetched sources → build guide files.
 *
 *   node ops/route-research/run.mjs --routes syd-to-mel,kul-to-sin --dry-run
 *   node ops/route-research/run.mjs --routes syd-to-mel,kul-to-sin
 *   node ops/route-research/run.mjs --all --limit 25           routes without a guide yet
 *
 * Flags:
 *   --routes a,b      explicit route slugs            --all     every Strapi route without a guide file
 *   --limit N         at most N routes                --dry-run print the plan, call nothing
 *   --model M         default gemini-3.6-flash        --max-grounded N  cap on grounded requests (default 40, counts usage.jsonl)
 *   --no-judge        skip the semantic check (located quotes are then not published)
 *   --min-claims N    verified claims needed for a guide (default 3)
 *
 * A billing / quota / auth error from Gemini (HTTP 401/403/429,
 * RESOURCE_EXHAUSTED…) stops the run with exit code 2; nothing is retried.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { arg, GUIDES_DIR, HERE, loadRoutes, readUsage, REPO } from './lib.mjs';

const TOPICS = ['operators', 'history', 'origin_airport', 'destination_airport', 'transport', 'practical'];
const KINDS_PER_ROUTE = TOPICS.length; // grounded prose calls; + 1 structuring call without search
const MODEL = arg('model', 'gemini-3.6-flash');
const MAX_GROUNDED = Number(arg('max-grounded', 40));
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity;
const DRY = !!arg('dry-run');
const JUDGE = !arg('no-judge');

const routes = await loadRoutes();
let slugs;
if (arg('all')) {
  slugs = routes.map((r) => r.slug).filter((s) => !fs.existsSync(path.join(GUIDES_DIR, `${s}.json`)));
} else {
  slugs = String(arg('routes', '')).split(',').filter(Boolean);
}
const unknown = slugs.filter((s) => !routes.some((r) => r.slug === s));
if (unknown.length) {
  console.error(`not Strapi routes: ${unknown.join(', ')}`);
  process.exit(1);
}
slugs = slugs.slice(0, LIMIT);
if (!slugs.length) {
  console.error('no routes: pass --routes a,b or --all');
  process.exit(1);
}

const usage = readUsage();
const usedGrounded = usage.filter((u) => u.grounded).length;
const ok = usage.filter((u) => u.grounded && u.http === 200);
const avgSearches = ok.length ? ok.reduce((n, u) => n + u.web_search_queries, 0) / ok.length : null;
const avgIn = ok.length ? ok.reduce((n, u) => n + u.prompt_tokens + u.tool_use_prompt_tokens, 0) / ok.length : null;
const avgOut = ok.length ? ok.reduce((n, u) => n + u.candidates_tokens + u.thoughts_tokens, 0) / ok.length : null;
const planned = slugs.length * KINDS_PER_ROUTE;
const fresh = slugs.reduce(
  (n, s) => n + TOPICS.filter((k) => !fs.existsSync(path.join(HERE, 'data', 'research', s, `${k}.json`)) || !JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'research', s, `${k}.json`), 'utf8')).parsed).length,
  0,
);

console.log(`Route research plan — model ${MODEL}${DRY ? ' (DRY RUN: no Gemini call, no fetch, no write)' : ''}`);
console.log(`  routes (${slugs.length}): ${slugs.join(', ')}`);
console.log(`  grounded requests: ${fresh} new (of ${planned}; saved responses are reused)`);
console.log(`  budget: ${usedGrounded} already logged, cap ${MAX_GROUNDED} → room for ${Math.max(0, MAX_GROUNDED - usedGrounded)}`);
console.log(
  avgSearches === null
    ? `  searches: unknown until the first successful grounded call (Google runs several queries per request; the free 5,000/month is per search)`
    : `  searches: ~${Math.round(fresh * avgSearches)} (observed ${avgSearches.toFixed(1)} per request)`,
);
if (avgIn !== null) console.log(`  tokens: ~${Math.round(fresh * avgIn)} in / ~${Math.round(fresh * avgOut)} out incl. thinking (observed averages)`);
console.log(`  non-grounded calls: ${slugs.length} structuring${JUDGE ? ` + up to ${slugs.length} semantic checks` : ''}`);
if (fresh > Math.max(0, MAX_GROUNDED - usedGrounded)) console.log('  WARNING: plan exceeds the grounded-request cap; the run will stop at the cap.');
if (DRY) process.exit(0);

const node = process.execPath;
const step = (cmd, args) => {
  console.log(`\n$ ${path.basename(cmd)} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: REPO, env: process.env });
  if (r.status === 2) {
    console.error('STOPPED: Gemini billing/quota/auth problem or budget cap (see above). Nothing further was run.');
    process.exit(2);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
};
const list = slugs.join(',');
step(node, [path.join(HERE, 'gemini-research.mjs'), '--routes', list, '--model', MODEL, '--max-grounded', String(MAX_GROUNDED)]);
step(node, [path.join(HERE, 'verify-sources.mjs'), '--routes', list, '--model', MODEL, ...(JUDGE ? ['--judge'] : [])]);
step(path.join(REPO, 'node_modules', '.bin', 'tsx'), [path.join(HERE, 'build-guides.ts'), '--routes', list, '--min-claims', String(arg('min-claims', 3))]);
console.log(`\nDone. Usage log: ${path.relative(REPO, path.join(HERE, 'data', 'usage.jsonl'))} — node ops/route-research/usage.mjs for totals.`);
