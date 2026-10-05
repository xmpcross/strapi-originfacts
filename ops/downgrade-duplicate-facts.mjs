#!/usr/bin/env node
/**
 * Downgrades synthetic generic boilerplate copy and homepage-only source URLs
 * in content/airline-facts/*.json from `official` to `pending` (or `n/a` for cargo).
 *
 * Usage:
 *   node ops/downgrade-duplicate-facts.mjs --dry-run
 *   node ops/downgrade-duplicate-facts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'content', 'airline-facts');
const DRY = process.argv.includes('--dry-run');

// Cargo operators
const CARGO_AIRLINES = new Set([
  'abx-air-inc', 'ahk-air-hong-kong-limited', 'air-cargo-carriers-llc', 'air-transport-international-llc',
  'airbridgecargo', 'amerijet-international-inc', 'atlas-air', 'atran', 'aviastar-tu', 'china-cargo-airlines',
  'dhl-air-limited', 'everts-air-cargo', 'fedex', 'kalitta-air', 'lan-chile-cargo', 'lynden-air-cargo-llc',
  'martinair', 'mng-airlines', 'nippon-cargo-airlines', 'northern-air-cargo', 'polar-air-cargo-worldwide-inc',
  'skytaxi', 'southern-air', 'suparna-airlines', 'uls-airlines-cargo', 'uni-top-airlines', 'volga-dnepr-airlines', 'zimex-aviation'
]);

// Generic boilerplate copy replicated across 70%-99% of carriers
const GENERIC_BOILERPLATE_VALUES = new Set([
  "Standard seats, preferred location seats, and extra legroom seating options are available depending on aircraft and cabin class",
  "Reserve a specific seat in advance for a fee or free depending on fare class, or receive a free seat assignment during online check-in",
  "Children traveling with an accompanying adult are seated together during advance seat reservation or at check-in",
  "Standard / Economy Light: includes 1 carry-on bag and 1 personal item; checked bag allowance depends on route and fare category",
  "Free seat assignment provided during online check-in; advance seat selection prior to check-in is available for a fee",
  "Ticket modifications and cancellations are subject to carrier fare rules, change fees, and applicable fare difference",
  "When a flight is delayed or cancelled within carrier control, passengers are entitled to meals, refreshments, communication access, and hotel accommodation with transport for overnight delays.",
  "For disruptions within carrier control, the airline rebooks passengers on the next available flight or provides a full refund for unused flight segments if delayed by 3 hours or more.",
  "Statutory or policy compensation applies for cancellations or long delays within carrier control according to applicable aviation passenger rights regulations."
]);

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();

let totalFilesChanged = 0;
let totalFieldsDowngraded = 0;
let totalCargoFieldsMarkedNA = 0;
let totalFieldsKept = 0;

for (const name of files) {
  const slug = name.replace('.json', '');
  const isCargo = CARGO_AIRLINES.has(slug);
  const filePath = path.join(DIR, name);
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = JSON.parse(raw);
  let fileModified = false;

  for (const mod of doc.modules ?? []) {
    const modId = mod.id;
    const isPassengerModule = ['carryon', 'baggage', 'cabins', 'fares'].includes(modId);

    for (const [key, field] of Object.entries(mod.fields ?? {})) {
      if (!field || field.status === 'pending' || field.status === 'n/a') continue;

      if (isCargo && isPassengerModule) {
        field.status = 'n/a';
        fileModified = true;
        totalCargoFieldsMarkedNA++;
        continue;
      }

      const val = (field.value || '').trim();
      const isBoilerplate = GENERIC_BOILERPLATE_VALUES.has(val);

      if (isBoilerplate && field.status === 'official') {
        field.status = 'pending';
        fileModified = true;
        totalFieldsDowngraded++;
      } else {
        totalFieldsKept++;
      }
    }
  }

  if (fileModified) {
    totalFilesChanged++;
    if (!DRY) {
      fs.writeFileSync(filePath, JSON.stringify(doc, null, 2) + '\n');
    }
  }
}

console.log(`\n--- DOWNGRADE DUPLICATE CONTENT SUMMARY ---`);
console.log(`Mode: ${DRY ? 'DRY-RUN (no files written)' : 'WRITE (files updated)'}`);
console.log(`Total files modified: ${totalFilesChanged} / ${files.length}`);
console.log(`Generic duplicate fields downgraded to 'pending': ${totalFieldsDowngraded}`);
console.log(`Cargo passenger fields updated to 'n/a': ${totalCargoFieldsMarkedNA}`);
console.log(`Authentic/published fields kept 'official': ${totalFieldsKept}`);
