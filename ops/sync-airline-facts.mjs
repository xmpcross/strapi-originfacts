#!/usr/bin/env node
import { execSync } from 'node:child_process';
import path from 'node:path';

const cwd = process.cwd();

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

try {
  console.log('=== Starting Automated Airline Fact Sync Pipeline ===');

  // Step 1: Generate fact files from complete Strapi database
  run('node ops/autogen-all-strapi-facts.mjs');

  // Step 2: Fix any Strapi slug mismatches
  run('node ops/fix-strapi-slug-mappings.mjs');
  run('node ops/fix-final-6-slugs.mjs');

  // Step 3: Stage fact files in git
  run('git add content/airline-facts/*.json lib/airline-tier.ts');

  // Step 4: Validate against provenance contract
  run('node ops/validate-airline-facts.mjs');

  console.log('\n✅ All airline policy facts successfully automated, synced, and validated!');
} catch (err) {
  console.error('\n❌ Sync failed:', err.message);
  process.exit(1);
}
