#!/usr/bin/env node
/**
 * Is it actually on main?
 *
 *   node ops/verify-shipped.mjs <sha> [<sha>...]
 *   git log --format=%H -5 feat/my-branch | xargs node ops/verify-shipped.mjs
 *
 * A change is done when it is reachable from main. Not when it is committed,
 * not when it is pushed, not when a PR is open, and not when a PR that used to
 * contain it has merged.
 *
 * Reachability is checked by hash first, then by patch-id via `git cherry`,
 * because rebasing and cherry-picking rewrite hashes. Hash-only reporting cried
 * wolf on four commits within an hour of this script being written — and a
 * checker nobody believes is worse than no checker at all.
 *
 * Patch-id still misses a commit whose content changed during a rebase — a
 * conflict resolution alters the patch, so nothing upstream matches it. That is
 * left as STRANDED on purpose. The two failure directions are not symmetric:
 * a false STRANDED costs a manual check, a false ON MAIN is the exact mistake
 * this exists to prevent.
 *
 * This exists because "pushed" was mistaken for "done" three times in one week:
 *
 *   - Six CMS commits ran in production while main described a system that ran
 *     nowhere, including a divergent deploy config.
 *   - Three commits were pushed to a branch after the PR containing it had
 *     already merged, so they went nowhere while being reported as shipped —
 *     one of them a contrast fix described as live.
 *   - A mock data file survived five deletions because everyone involved
 *     believed it was gone.
 *
 * Every one was recoverable and none was noticed by the person who caused it.
 * A push succeeds loudly and lands nowhere quietly, which is the worst possible
 * shape for a mistake.
 */
import { execFileSync } from 'node:child_process';

const BASE = process.env.VERIFY_BASE ?? 'main';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

const shas = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (shas.length === 0) {
  console.error('Usage: node ops/verify-shipped.mjs <sha> [<sha>...]');
  console.error('   or: git log --format=%H -5 <branch> | xargs node ops/verify-shipped.mjs');
  process.exit(2);
}

// Compare against the remote's main, not a local ref that may itself be stale —
// a local main lagging behind origin is how this looks fine and is not.
let base;
try {
  git(['fetch', 'origin', BASE, '--quiet']);
  base = `origin/${BASE}`;
} catch {
  base = BASE;
  console.warn(`Warning: could not fetch origin/${BASE}; comparing against the local ref, which may be stale.`);
}

const rows = [];
for (const sha of shas) {
  let subject = '';
  let shipped = false;
  let known = true;
  try {
    subject = git(['log', '-1', '--format=%s', sha]);
  } catch {
    known = false;
  }
  let via = 'sha';
  if (known) {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', sha, base], { stdio: 'ignore' });
      shipped = true;
    } catch {
      // Rebase and cherry-pick rewrite SHAs, so an exact-hash check reports a
      // false STRANDED for work that did ship. `git cherry` compares patch-ids:
      // a leading '-' means an equivalent change is already upstream. Without
      // this the tool cries wolf on every rebased branch, and a checker nobody
      // believes is worse than no checker.
      try {
        const out = git(['cherry', base, sha, `${sha}^`]);
        if (out.startsWith('-')) {
          shipped = true;
          via = 'patch';
        }
      } catch {
        /* Root commit, or an unreachable parent — leave it stranded. */
      }
    }
  }
  rows.push({ sha: sha.slice(0, 9), subject, shipped, known, via });
}

const width = Math.max(...rows.map((r) => r.subject.length), 20);
for (const r of rows) {
  if (!r.known) {
    console.log(`  ${r.sha}  UNKNOWN    (not an object in this repository)`);
    continue;
  }
  const state = r.shipped ? (r.via === 'patch' ? `ON ${base} (rebased)` : `ON ${base}`) : 'STRANDED';
  console.log(`  ${r.sha}  ${state.padEnd(base.length + 13)}  ${r.subject.slice(0, width)}`);
}

const stranded = rows.filter((r) => r.known && !r.shipped);
const unknown = rows.filter((r) => !r.known);
console.log('');
if (stranded.length || unknown.length) {
  console.error(
    `${stranded.length} stranded, ${unknown.length} unknown, ${rows.length - stranded.length - unknown.length} on ${base}. ` +
      'Do not report these as done.',
  );
  process.exit(1);
}
console.log(`All ${rows.length} commit(s) are on ${base}.`);
