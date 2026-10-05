#!/usr/bin/env node
/**
 * Clears the placeholder phone number "+1 800 555 0199" from the airline fact
 * store (content/airline-facts/*.json).
 *
 * ops/autogen-all-facts.mjs and ops/autogen-all-strapi-facts.mjs fell back to
 * that number when a carrier had no phone, and wrote it with a note calling it
 * the carrier's "official customer support line". It is a fictional 555
 * number, so per the store's rule 1 (a failed lookup writes null + pending)
 * every such field becomes:
 *
 *   value: null, status: "pending", notes: "No verified phone yet."
 *
 * A field is cleaned when its value is exactly the placeholder, or when its
 * notes mention it. Fields with status "official" or "disputed" are never
 * touched (they are reported instead), and no other key or field changes.
 *
 * Deterministic: same input, same output; files are rewritten in the store's
 * own format (2-space JSON + trailing newline), only when something changed.
 *
 *   node ops/clean-placeholder-phones.mjs           # dry run: report only
 *   node ops/clean-placeholder-phones.mjs --write   # apply
 */
import fs from 'node:fs';
import path from 'node:path';

const PLACEHOLDER = '+1 800 555 0199';
const NEUTRAL_NOTE = 'No verified phone yet.';
const PROTECTED = new Set(['official', 'disputed']);
const DIR = path.resolve(process.cwd(), 'content/airline-facts');
const write = process.argv.includes('--write');

const mentionsPlaceholder = (s) => typeof s === 'string' && s.includes(PLACEHOLDER);

let filesChanged = 0;
let fieldsChanged = 0;
const skipped = [];

for (const name of fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
  const file = path.join(DIR, name);
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.includes(PLACEHOLDER)) continue;
  const doc = JSON.parse(raw);
  let changed = 0;

  for (const mod of doc.modules ?? []) {
    for (const [key, field] of Object.entries(mod.fields ?? {})) {
      if (!field || typeof field !== 'object') continue;
      if (field.value !== PLACEHOLDER && !mentionsPlaceholder(field.notes)) continue;
      if (PROTECTED.has(field.status)) {
        skipped.push(`${name} ${mod.id}.${key} (status ${field.status})`);
        continue;
      }
      field.value = null;
      field.status = 'pending';
      field.notes = NEUTRAL_NOTE;
      changed++;
    }
  }

  if (!changed) continue;
  const out = JSON.stringify(doc, null, 2) + '\n';
  if (out.includes(PLACEHOLDER)) skipped.push(`${name}: placeholder remains outside a cleanable field`);
  filesChanged++;
  fieldsChanged += changed;
  if (write) fs.writeFileSync(file, out);
}

console.log(
  `${write ? 'Cleaned' : 'Would clean'} ${fieldsChanged} field(s) in ${filesChanged} file(s).` +
    (write ? '' : ' Re-run with --write to apply.'),
);
if (skipped.length) {
  console.log(`Left untouched (${skipped.length}):`);
  for (const s of skipped) console.log(`  ${s}`);
}
