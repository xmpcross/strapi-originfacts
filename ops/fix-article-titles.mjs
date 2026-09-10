#!/usr/bin/env node
/**
 * Apply the article title corrections from the September 2026 AdSense audit.
 *
 * The edits live in data/editorial/title-fixes.json so they can be reviewed as
 * a diff before anything is written. Nothing is changed unless --apply is
 * passed; the default run prints a before/after table and exits.
 *
 *   node ops/fix-article-titles.mjs            # dry run — show the diff
 *   node ops/fix-article-titles.mjs --apply    # write to Strapi
 *
 * Needs STRAPI_API_TOKEN (write access to Articles) and optionally
 * NEXT_PUBLIC_STRAPI_URL. Slugs are never changed — every URL stays put.
 *
 * Strapi 5 keeps a draft and a published version of each article. The PUT
 * below targets the published document (`?status=published`) so the change
 * is live immediately and the draft is brought in line with it.
 */
import fs from 'node:fs';
import path from 'node:path';

const STRAPI = (process.env.NEXT_PUBLIC_STRAPI_URL || process.env.STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');
const TOKEN = process.env.STRAPI_API_TOKEN;
const APPLY = process.argv.includes('--apply');
const FIXES = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'editorial', 'title-fixes.json'), 'utf8'));

if (APPLY && !TOKEN) {
  console.error('STRAPI_API_TOKEN is required with --apply');
  process.exit(1);
}

const headers = { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };

async function getArticle(slug) {
  const url = `${STRAPI}/api/articles?filters[slug][$eq]=${encodeURIComponent(slug)}&fields[0]=title&fields[1]=seoTitle&fields[2]=slug&fields[3]=publishedAt`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} fetching ${slug}`);
  const json = await res.json();
  const row = json.data?.[0];
  return row ? (row.attributes ? { id: row.id, documentId: row.documentId, ...row.attributes } : row) : null;
}

let changed = 0;
let failed = 0;
for (const fix of FIXES) {
  const current = await getArticle(fix.slug);
  if (!current) {
    console.log(`✗ ${fix.slug}: not found in Strapi`);
    failed++;
    continue;
  }
  const data = {};
  if (fix.title !== undefined && fix.title !== current.title) data.title = fix.title;
  if (fix.seoTitle !== undefined && fix.seoTitle !== current.seoTitle) data.seoTitle = fix.seoTitle;
  if (Object.keys(data).length === 0) {
    console.log(`= ${fix.slug}: already up to date`);
    continue;
  }
  console.log(`\n${fix.slug}  (${fix.reason})`);
  if (data.title) console.log(`  title:    ${current.title}\n         →  ${data.title}`);
  if (data.seoTitle) console.log(`  seoTitle: ${current.seoTitle ?? '(empty)'}\n         →  ${data.seoTitle}`);
  if (!APPLY) continue;

  const res = await fetch(`${STRAPI}/api/articles/${current.documentId}?status=published`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ data }),
  });
  if (res.ok) {
    changed++;
    console.log('  ✓ written');
  } else {
    failed++;
    console.log(`  ✗ ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

console.log(APPLY ? `\n${changed} updated, ${failed} failed` : `\nDry run — ${FIXES.length} fixes listed. Re-run with --apply to write them.`);
process.exit(failed ? 1 : 0);
