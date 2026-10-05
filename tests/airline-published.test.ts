import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PUBLISHED_AIRLINE_GUIDES, PUBLISHED_AIRLINE_MIN_MANUAL_FACTS } from '../lib/airline-tier';
import { airlineHasCeased } from '../lib/airline-status';

// The allowlist decides which airline pages are indexed and enter the sitemap.
// It once drifted to every carrier in the facts store (the ops/autogen-*.mjs
// scripts rewrite it), which put ~430 near-identical pages in the index.

function manualFacts(node: unknown): number {
  if (Array.isArray(node)) return node.reduce<number>((n, v) => n + manualFacts(v), 0);
  if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    const own =
      typeof o.verified_by === 'string' && o.verified_by.startsWith('manual') && o.source_url && o.verified_at ? 1 : 0;
    return own + Object.values(o).reduce<number>((n, v) => n + manualFacts(v), 0);
  }
  return 0;
}

test('published airline guides: each has a facts file with enough manually verified facts', () => {
  for (const slug of PUBLISHED_AIRLINE_GUIDES) {
    const file = path.join(process.cwd(), 'content', 'airline-facts', `${slug}.json`);
    assert.ok(fs.existsSync(file), `${slug}: no content/airline-facts/${slug}.json`);
    const n = manualFacts(JSON.parse(fs.readFileSync(file, 'utf8')));
    assert.ok(
      n >= PUBLISHED_AIRLINE_MIN_MANUAL_FACTS,
      `${slug}: ${n} manually verified facts, needs ${PUBLISHED_AIRLINE_MIN_MANUAL_FACTS}`,
    );
  }
});

test('published airline guides: none has a sourced cessation date', () => {
  for (const slug of PUBLISHED_AIRLINE_GUIDES) assert.equal(airlineHasCeased(slug), false, `${slug} has ceased`);
});
