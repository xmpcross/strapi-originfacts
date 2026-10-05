#!/usr/bin/env node
/**
 * Totals from data/usage.jsonl, with the cost implied by Google's published
 * paid-tier rates (ai.google.dev/gemini-api/docs/pricing, checked 5 Oct 2026).
 * Thinking tokens bill as output. Grounding: Gemini 3.x bills per search query
 * after 5,000 free per month (shared across 3.x models); this does not know
 * how many of the month's free searches other work has used.
 *
 *   node ops/route-research/usage.mjs [--project-routes 491]
 */
import { arg, readUsage } from './lib.mjs';

const RATES = {
  'gemini-3.6-flash': { in: 0.75, out: 3.75, search: 14 / 1000, note: 'until 31 Dec 2026; $1.50/$7.50 from 1 Jan 2027' },
  'gemini-3.7-flash': { in: 0.75, out: 3.75, search: 14 / 1000, note: 'until 31 Dec 2026' },
  'gemini-3.8-flash': { in: 0.75, out: 3.75, search: 14 / 1000, note: 'until 31 Dec 2026' },
  'gemini-3.5-flash': { in: 1.5, out: 9, search: 14 / 1000, note: '' },
};

const rows = readUsage();
const by = new Map();
for (const u of rows) {
  const k = u.model;
  const t = by.get(k) ?? { calls: 0, grounded: 0, groundedOk: 0, errors: 0, searches: 0, prompt: 0, toolPrompt: 0, out: 0, thinking: 0 };
  t.calls++;
  if (u.grounded) t.grounded++;
  if (u.grounded && u.http === 200) t.groundedOk++;
  if (u.http !== 200) t.errors++;
  t.searches += u.web_search_queries;
  t.prompt += u.prompt_tokens;
  t.toolPrompt += u.tool_use_prompt_tokens;
  t.out += u.candidates_tokens;
  t.thinking += u.thoughts_tokens;
  by.set(k, t);
}
const routes = new Set(rows.filter((u) => u.http === 200 && u.grounded).map((u) => u.slug));
const project = Number(arg('project-routes', 491));
for (const [model, t] of by) {
  const r = RATES[model];
  const tokenCost = r ? ((t.prompt + t.toolPrompt) * r.in + (t.out + t.thinking) * r.out) / 1e6 : null;
  console.log(`${model}: ${t.calls} calls (${t.grounded} grounded, ${t.groundedOk} succeeded, ${t.errors} errors), ${t.searches} searches`);
  console.log(`  tokens: prompt ${t.prompt} + tool-use prompt ${t.toolPrompt}, output ${t.out} + thinking ${t.thinking}`);
  if (r) {
    console.log(`  token cost: $${tokenCost.toFixed(4)} (${r.in}/${r.out} per 1M${r.note ? `, ${r.note}` : ''}); searches: $${(t.searches * r.search).toFixed(2)} if beyond the free 5,000/month, else $0`);
    if (routes.size) {
      const per = routes.size;
      console.log(
        `  projection for ${project} more routes (from ${per} researched): ~${Math.round((t.groundedOk / per) * project)} grounded requests, ` +
          `~${Math.round((t.searches / per) * project)} searches, ~$${((tokenCost / per) * project).toFixed(2)} tokens` +
          ` + $${(((t.searches / per) * project) * r.search).toFixed(2)} searches if none are free`,
      );
    }
  }
}
if (!rows.length) console.log('no Gemini calls logged');
