#!/usr/bin/env node
/**
 * Validates content/airline-facts/*.json against the fact-store contract.
 *
 * Runs as a prebuild step, so a file that breaks the contract fails the build
 * rather than reaching production. That is deliberate: a design mock has
 * already been served publicly under green "Verified" stamps, and the fix for
 * that class of error is structural, not procedural.
 *
 *   node ops/validate-airline-facts.mjs            # validate the store
 *   node ops/validate-airline-facts.mjs --fixtures # run the fixture suite
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseDomain } from 'tldts';

const STORE = path.join(process.cwd(), 'content', 'airline-facts');
const FIXTURES = path.join(process.cwd(), 'ops', 'fixtures', 'airline-facts');

const STATUSES = new Set(['official', 'third_party', 'disputed', 'pending', 'n/a']);

/** Values that look like a phone number or a postal address. */
const PHONE = /(\+\d[\d\s().-]{6,})|(\b\d{2,4}[\s.-]\d{2,4}[\s.-]\d{2,4}\b)|(\b1[38]\s?\d{2}\s?\d{2}\b)/;
const ADDRESS = /\b(street|st\.|road|rd\.|avenue|ave\.|boulevard|drive|lane|suite|level|floor|po box|p\.o\. box)\b/i;

/**
 * Same registrable domain, via the public suffix list.
 *
 * Not label counting: under `.com.au` the last two labels are the public suffix
 * itself, so counting would treat every *.com.au host as one site. And not
 * `endsWith`, which passes `qantas.com.attacker.example` — the lookalike is the
 * whole attack.
 */
function sameSite(a, b) {
  const da = parseDomain(a).domain;
  const db = parseDomain(b).domain;
  return Boolean(da) && da === db;
}

/** A source_url a reader could actually open. */
function isHttpUrl(raw) {
  const v = String(raw).trim();
  if (/[…<>]|\.\.\./.test(v)) return false;
  try {
    return /^https?:$/.test(new URL(v).protocol);
  } catch {
    return false;
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Fact files that git does not know about.
 *
 * Every real fact file is committed — it is reviewed, it is diffed, and it is
 * how a value gets from a source into a page. An untracked .json in the store
 * is therefore a leftover by definition: a scratch copy, a rename that was
 * meant to be temporary, a file someone dropped in to see what it looked like.
 *
 * That is not hypothetical either. The design mock reached production as
 * content/airline-facts/qantas.json, untracked the whole time, which is also
 * why deleting it left no trace in any diff and why five people believing it
 * was gone did not make it gone.
 *
 * Returns null when git cannot answer — not a repository, or git absent from
 * the build image. The rest of the validation still runs; this one check is
 * skipped with a warning rather than failing a build for a reason unrelated to
 * the data.
 */
function trackedFactFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '--', 'content/airline-facts'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return new Set(out.split('\n').filter(Boolean).map((f) => path.basename(f)));
  } catch {
    return null;
  }
}

function validateFile(fileName, raw, errors) {
  const fail = (msg) => errors.push(`${fileName}: ${msg}`);

  // A fixture or sample must be structurally incapable of reaching production.
  if (fileName.startsWith('_')) return fail('sample/fixture files must not live in the fact store');

  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    return fail(`invalid JSON — ${err.message}`);
  }

  if (doc._warning !== undefined) {
    return fail('carries a `_warning` key — mock or placeholder data must never sit in the store');
  }
  if (!doc.official_website) return fail('missing `official_website` (needed to validate contact sources)');
  const officialHost = hostOf(doc.official_website);
  if (!officialHost) return fail(`official_website is not a URL: ${doc.official_website}`);
  if (!Array.isArray(doc.modules)) return fail('`modules` must be an array');

  // Two modules with one id is invisible at render: the page keys them by id
  // in a Map, so the later one silently replaces the earlier and whatever was
  // in the first is simply gone. A hand edit and a scripted append produced
  // exactly this, with both copies passing every other check.
  const seenIds = new Set();
  for (const mod of doc.modules) {
    if (!mod?.id) { fail('a module has no id'); continue; }
    if (seenIds.has(mod.id)) {
      fail(`duplicate module id "${mod.id}" — the renderer keeps only one, silently`);
      continue;
    }
    seenIds.add(mod.id);
    const where = `module "${mod.id}"`;

    for (const [key, field] of Object.entries(mod.fields ?? {})) {
      const at = `${where} field "${key}"`;

      if (!STATUSES.has(field.status)) {
        fail(`${at}: unknown status "${field.status}"`);
        continue;
      }

      if (field.status === 'official') {
        if (!field.source_url) fail(`${at}: status official with no source_url`);
        // Presence was never enough. An official field asserts a citation, and
        // "…" left in from a template asserts one that cannot be opened —
        // which is a broken promise in every module, not only contact. The
        // fetcher rejects placeholder URLs in carriers.json for exactly this
        // reason; the fact store had no equivalent until a real promotion
        // shipped four fields citing an ellipsis.
        else if (!isHttpUrl(field.source_url)) {
          fail(`${at}: source_url is not an http(s) URL — ${JSON.stringify(field.source_url)}`);
        }
        if (!field.verified_at) fail(`${at}: status official with no verified_at`);
        if (field.value === null || field.value === undefined || field.value === '') {
          fail(`${at}: status official with no value`);
        }
      }

      // `disputed` means sources actively conflict — not "unconfirmed". Without
      // this, an unverified field gets marked disputed and the page renders a
      // "sources disagree" block for a disagreement that never happened, which
      // is a false claim about the sources themselves.
      if (field.status === 'disputed') {
        const competing = [...new Set((field.conflicting_values ?? []).map((v) => String(v).trim()).filter(Boolean))];
        if (competing.length < 2) {
          fail(
            `${at}: status disputed requires at least two distinct competing values in conflicting_values ` +
              `(found ${competing.length}). An unconfirmed value is "pending", not "disputed".`,
          );
        }
      }

      // Never widen precision: a year stays a year.
      if (field.verified_at && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(field.verified_at)) {
        fail(`${at}: verified_at "${field.verified_at}" is not YYYY, YYYY-MM or YYYY-MM-DD`);
      }

      // The scam-number rule. A contact phone or address must come from the
      // carrier's own domain — fake airline "customer service" numbers are
      // published as PDFs on university and government hosts precisely because
      // domain authority reads as trustworthy. It is not a signal.
      if (mod.id === 'contact' && field.status === 'official' && typeof field.value === 'string') {
        const looksContact = PHONE.test(field.value) || ADDRESS.test(field.value);
        if (looksContact) {
          const srcHost = hostOf(field.source_url ?? '');
          if (!srcHost || !sameSite(srcHost, officialHost)) {
            fail(
              `${at}: contact value sourced from "${srcHost ?? field.source_url}", ` +
                `which is not the carrier's own domain (${officialHost})`,
            );
          }
        }
      }
    }

    for (const key of mod.required ?? []) {
      if (!(mod.fields ?? {})[key]) fail(`${where}: required field "${key}" is not defined`);
    }
  }
}

function run(dir) {
  if (!fs.existsSync(dir)) return { errors: [], files: 0, gitChecked: false };
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const errors = [];
  const tracked = trackedFactFiles();

  for (const f of files) {
    if (tracked && !tracked.has(f)) {
      errors.push(
        `${f}: untracked in git. Every real fact file is committed; an untracked one is a ` +
          'leftover. Commit it, or delete it.',
      );
      // Still validate its contents — one file can be wrong in several ways,
      // and reporting them together saves a round trip.
    }
    validateFile(f, fs.readFileSync(path.join(dir, f), 'utf8'), errors);
  }

  return { errors, files: files.length, gitChecked: tracked !== null };
}

/**
 * Each fixture states, in its filename, whether it is expected to pass. A
 * fixture that fails the wrong way is itself a failure — a validator with no
 * negative tests only proves it can say yes.
 */
function runFixtures() {
  const files = fs.existsSync(FIXTURES) ? fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.json')) : [];
  let passed = 0;
  const failures = [];

  for (const f of files) {
    const shouldFail = f.startsWith('fail-');
    const errors = [];
    validateFile(f.replace(/^(pass|fail)-/, ''), fs.readFileSync(path.join(FIXTURES, f), 'utf8'), errors);
    const didFail = errors.length > 0;

    if (didFail === shouldFail) {
      passed++;
      console.log(`  ok    ${f}${shouldFail ? `  → ${errors[0].replace(/^[^:]+: /, '')}` : ''}`);
    } else {
      failures.push(`${f}: expected ${shouldFail ? 'failure' : 'pass'}, got ${didFail ? 'failure' : 'pass'}`);
      console.log(`  FAIL  ${f}`);
    }
  }

  console.log(`\n${passed}/${files.length} fixtures behaved as expected.`);
  return failures;
}

const wantFixtures = process.argv.includes('--fixtures');

if (wantFixtures) {
  console.log('Fixture suite\n');
  const failures = runFixtures();
  if (failures.length) {
    console.error(`\n${failures.length} fixture(s) misbehaved:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
} else {
  const { errors, files, gitChecked } = run(STORE);
  if (!gitChecked) {
    console.warn('Warning: git could not be consulted, so the untracked-file check was skipped.');
  }
  if (errors.length) {
    console.error(`Fact store validation failed — ${errors.length} problem(s) across ${files} file(s):\n`);
    for (const e of errors) console.error(`  ${e}`);
    console.error('\nNothing in content/airline-facts/ may render until these are fixed.');
    process.exit(1);
  }
  console.log(`Fact store OK — ${files} file(s) validated.`);
}
