#!/usr/bin/env node
/**
 * Downgrade auto-generated airline facts from `official` to `pending`.
 *
 * Every one of the 3,148 fact fields in content/airline-facts/ carried
 * `"status": "official"`, but 3,016 of them were written by the ingest pass with
 * `verified_by: "automated_provenance"` — not read off a carrier's site. What
 * they assert is a single default replicated across the fleet:
 *
 *   carryon_bag_dimensions   432 of 434 airlines say "55 x 40 x 20 cm"
 *   weight_economy           432 of 432 say "7 kg (15 lbs)"
 *   weight_business_first    432 of 432 say "14 kg (30 lbs) total across 2 pieces"
 *
 * Their citations were constructed, not found: 374 of 582 distinct source_urls
 * are `<official_website>/baggage`, and of 24 sampled, 13 were dead (404,
 * timeout or NXDOMAIN). Some point at the wrong carrier entirely — American
 * Airlines cited usairways.com/baggage, Hunnu Air cited airmauritanie.mr.
 *
 * `official` is the status the renderer trusts: lib/airline-facts.ts gates on
 * `isOfficial` and stamps published modules "Verified <date>". Moving these to
 * `pending` makes them stop rendering through machinery that already exists,
 * without deleting the ingest output — re-verify a field by hand, set it back
 * to `official` with a real source_url, and it returns.
 *
 * Usage:
 *   node ops/downgrade-unverified-facts.mjs --dry-run   # report + sample diff
 *   node ops/downgrade-unverified-facts.mjs             # write
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'content/airline-facts';
const DRY = process.argv.includes('--dry-run');
const AUTO = 'automated_provenance';

let files = 0;
let downgraded = 0;
let kept = 0;
let sample = null;

for (const name of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
  const path = join(DIR, name);
  const raw = readFileSync(path, 'utf8');
  const doc = JSON.parse(raw);
  let touched = 0;

  for (const mod of doc.modules ?? []) {
    for (const field of Object.values(mod.fields ?? {})) {
      if (field.verified_by === AUTO && field.status === 'official') {
        field.status = 'pending';
        touched += 1;
        downgraded += 1;
      } else if (field.status === 'official') {
        kept += 1;
      }
    }
  }

  if (touched > 0) {
    files += 1;
    if (!sample) sample = { name, before: raw, after: JSON.stringify(doc, null, 2) + '\n' };
    if (!DRY) writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
  }
}

console.log(`${DRY ? '[dry-run] would downgrade' : 'downgraded'} ${downgraded} fields across ${files} files`);
console.log(`kept official (manually verified): ${kept}`);

if (DRY && sample) {
  const b = sample.before.split('\n');
  const a = sample.after.split('\n');
  console.log(`\nsample diff — ${sample.name}:`);
  for (let i = 0, shown = 0; i < Math.max(b.length, a.length) && shown < 8; i += 1) {
    if (b[i] !== a[i]) {
      console.log(`  - ${b[i]?.trim()}`);
      console.log(`  + ${a[i]?.trim()}`);
      shown += 1;
    }
  }
}
