#!/usr/bin/env node
/**
 * Stage 2b — draft a fact file from extracted candidates.
 *
 *   npm run draft -- --carrier finnair
 *
 * Writes content/airline-facts/<slug>.json with EVERY field pending and every
 * candidate recorded as evidence, with the sentence it came from.
 *
 * It does not invent field names, and that restraint is the whole design. A
 * generator that split "23 kg" into `checked_allowance_economy` would be
 * asserting that the carrier has an included economy allowance — a claim about
 * the product, made by a regex. Ryanair sells checked bags as purchasable
 * tiers; Finnair includes them by fare type; Air Canada varies them by route.
 * Those need different fields, and the difference is judgement.
 *
 * So each module gets one pending field holding the module's evidence. A person
 * reading it decides what the fields are, splits it, and promotes what they can
 * source. The validator then refuses anything `official` without a source_url
 * and a verified_at.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pageEntry, type Carrier } from './types.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

/** Which module each captured page contributes evidence to. */
const PAGE_TO_MODULE: Record<string, { id: string; title: string }> = {
  baggage_checked: { id: 'baggage', title: 'Checked baggage' },
  baggage_fees: { id: 'baggage', title: 'Checked baggage' },
  baggage_carryon: { id: 'carryon', title: 'Carry-on' },
  fare_conditions: { id: 'fares', title: 'What the cheapest fare includes' },
  checkin: { id: 'checkin', title: 'Check-in and airport cutoffs' },
  conditions_of_carriage: { id: 'rights', title: 'If your flight is delayed or cancelled' },
};

type Candidate = { kind: string; raw: string; sentence: string; page_key: string; source_url: string };
type CandidateFile = {
  carrier_key: string;
  capture_date: string;
  extracted_at?: string;
  pages: { page_key: string; source_url: string; article_chars: number; capture_set?: string }[];
  candidates: Candidate[];
  skipped: { page_key: string; reason: string }[];
};

function parseArgs(argv: string[]): { carrier?: string } {
  const out: { carrier?: string } = {};
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--carrier') out.carrier = argv[++i];
  return out;
}

/**
 * The most recently *extracted* candidate set for this carrier.
 *
 * Ordering by folder name and taking the first that parses was wrong twice
 * over. Manual captures live in `captures/manual/<carrier>`, which no date
 * regex matches, so a carrier whose only usable bytes were human-saved looked
 * like it had no candidates at all. And a dated folder can hold a stale
 * `candidates.json` written by an earlier run that found nothing — Qantas had
 * exactly that, an empty file dated today sitting in front of 179 real
 * candidates — so "newest folder that parses" is not the same question as
 * "newest extraction".
 *
 * Rank on `extracted_at`, which is the thing actually being asked about.
 */
async function latestCandidates(carrier: string): Promise<{ file: CandidateFile; date: string } | null> {
  const capturesDir = path.join(ROOT, 'data', 'captures');
  const sets = (await fs.readdir(capturesDir).catch(() => [])).filter(
    (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) || d === 'manual',
  );

  const found: { file: CandidateFile; date: string }[] = [];
  for (const d of sets) {
    const f = path.join(capturesDir, d, carrier, 'candidates.json');
    try {
      found.push({ file: JSON.parse(await fs.readFile(f, 'utf8')) as CandidateFile, date: d });
    } catch {
      /* no candidates in this set */
    }
  }
  if (!found.length) return null;

  found.sort((a, b) => (a.file.extracted_at ?? '').localeCompare(b.file.extracted_at ?? ''));
  return found[found.length - 1];
}

/** Distinct by kind+value, keeping the first sentence that produced it. */
function dedupe(rows: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return rows.filter((c) => {
    const k = `${c.kind}|${c.raw.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function evidenceNote(rows: Candidate[], pages: string[]): string {
  const lines = rows.map((c) => `  • ${c.raw}  — "${c.sentence.length > 240 ? `${c.sentence.slice(0, 240)}…` : c.sentence}"`);
  return (
    `${rows.length} candidate measurement(s) extracted from ${pages.join(', ')}. ` +
    'Field names are NOT inferred: how these split into fields is a judgement about the ' +
    "carrier's product, not a parse. Split this into real fields, then promote only what you " +
    `can source.\n${lines.join('\n')}`
  );
}

async function main(): Promise<void> {
  const { carrier } = parseArgs(process.argv.slice(2));
  if (!carrier) {
    console.error('Usage: npm run draft -- --carrier <carrier_key>');
    process.exitCode = 1;
    return;
  }

  const found = await latestCandidates(carrier);
  if (!found) {
    console.error(`No candidates.json for ${carrier}. Run \`npm run extract -- --carrier ${carrier}\` first.`);
    process.exitCode = 1;
    return;
  }
  const { file } = found;

  const carriers = JSON.parse(await fs.readFile(path.join(import.meta.dirname, 'carriers.json'), 'utf8')) as Carrier[];
  const entry = carriers.find((c) => c.carrier_key === carrier);
  const anyUrl = entry && Object.values(entry.pages).map(pageEntry).find(Boolean);
  if (!anyUrl) {
    console.error(`No URL for ${carrier} in carriers.json, so official_website cannot be derived.`);
    process.exitCode = 1;
    return;
  }
  const officialWebsite = new URL(anyUrl.url).origin;

  // Group evidence by module, preserving which page each candidate came from.
  const byModule = new Map<string, { title: string; rows: Candidate[]; pages: Set<string> }>();
  for (const c of file.candidates) {
    const m = PAGE_TO_MODULE[c.page_key];
    if (!m) continue;
    const g = byModule.get(m.id) ?? { title: m.title, rows: [], pages: new Set<string>() };
    g.rows.push(c);
    g.pages.add(c.page_key);
    byModule.set(m.id, g);
  }

  const modules = [];
  for (const [id, { title, rows, pages }] of byModule) {
    const uniq = dedupe(rows);
    modules.push({
      id,
      title,
      required: ['unassigned_evidence'],
      fields: {
        unassigned_evidence: {
          value: null,
          status: 'pending',
          notes: evidenceNote(uniq, [...pages]),
        },
      },
    });
  }

  // Modules whose page was captured but yielded nothing say so, rather than
  // being absent — an absent module reads as "not applicable".
  for (const s of file.skipped) {
    const m = PAGE_TO_MODULE[s.page_key];
    if (!m || modules.some((x) => x.id === m.id)) continue;
    modules.push({
      id: m.id,
      title: m.title,
      required: ['unassigned_evidence'],
      fields: {
        unassigned_evidence: {
          value: null,
          status: 'pending',
          notes: `No evidence. The ${s.page_key} capture was not usable: ${s.reason}.`,
        },
      },
    });
  }

  const out = { slug: carrier, official_website: officialWebsite, modules };
  const dest = path.join(ROOT, 'content', 'airline-facts', `${carrier}.json`);
  await fs.writeFile(dest, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

  console.log(`${carrier}: ${modules.length} module(s), all pending, from ${file.capture_date} captures`);
  for (const m of modules) {
    const n = (m.fields.unassigned_evidence.notes.match(/\n  • /g) ?? []).length;
    console.log(`  ${m.id.padEnd(10)}${n} candidate(s)`);
  }
  console.log(`\nWritten to ${dest}`);
  console.log('Nothing is official. Split the evidence into fields, then promote what you can source.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
