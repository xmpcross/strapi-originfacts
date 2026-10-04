#!/usr/bin/env node
/**
 * Stage 2 — candidate extraction.
 *
 *   npm run extract -- --carrier ryanair
 *
 * Reads the archive and nothing else. No network, ever: the whole point of
 * separating stage 1 was that extraction can be re-run a hundred times against
 * the same bytes without touching a carrier's servers.
 *
 * It does NOT write fact files. It writes a candidate list — every measurement
 * found in the article body, with the sentence it came from and the page it
 * came from. A person turns candidates into fields.
 *
 * That division is deliberate. A regex can find "3" and "23kg"; it cannot know
 * that Ryanair sells checked allowance as purchasable tiers while Qantas
 * includes it in the fare, and that difference decides which schema field a
 * number belongs to. Every value this pipeline has published without a human
 * deciding that has been wrong — EAQ, 151 countries, a mock baggage table.
 * The extractor's job is to find the evidence and stop.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const CAPTURES = path.resolve(import.meta.dirname, '..', '..', 'data', 'captures');

type Selectors = Record<string, { article: string | null; note?: string }>;

/** One measurement, with enough context for a person to judge it. */
type Candidate = {
  kind: 'dimensions' | 'weight' | 'count' | 'money' | 'duration';
  raw: string;
  /** The sentence it appeared in — the thing that makes it judgeable. */
  sentence: string;
  page_key: string;
  source_url: string;
};

type CandidateFile = {
  carrier_key: string;
  extracted_at: string;
  /** The capture set this was read from, so a re-run can be compared. */
  capture_date: string;
  pages: {
    page_key: string;
    source_url: string;
    content_hash: string;
    article_chars: number;
    /** Which capture set these bytes came from — a date folder, or "manual". */
    capture_set: string;
  }[];
  candidates: Candidate[];
  /** Pages that had a capture but yielded nothing, and why. */
  skipped: { page_key: string; reason: string }[];
};

const PATTERNS: { kind: Candidate['kind']; re: RegExp }[] = [
  // 40 x 30 x 20 cm  /  55x40x20cm
  { kind: 'dimensions', re: /(?<![\d.,])\d{1,3}\s*[x×]\s*\d{1,3}\s*[x×]\s*\d{1,3}\s*(?:cm|mm|in|inches)\b/gi },
  // The negative lookbehind is load-bearing. Without it "50 pounds (22.68 kg)"
  // yields "68 kg" — the fractional tail of a decimal read as a whole number —
  // and because that substring genuinely occurs in the page, auto-verification
  // would confirm a figure the carrier never published.
  { kind: 'weight', re: /(?<![\d.,])\d{1,3}(?:\.\d{1,2})?\s*(?:kg|kilograms?|lbs?|pounds?)\b/gi },
  // Counts must be bare integers about things, not the leading digits of a
  // duration. "up to 2.5 hours pre-departure" was yielding "up to 2", and a
  // change-deadline masquerading as a bag count is exactly the kind of wrong
  // number that survives review because it looks plausible.
  {
    kind: 'count',
    re: /\b(?:up to|maximum of|max(?:imum)?|no more than)\s+\d{1,2}\b(?![.,]\d)(?!\s*(?:hours?|hrs?|h\b|minutes?|mins?|days?|weeks?|months?|years?|%|cm|kg|mm))/gi,
  },
  // Two guards, both load-bearing, both learned the hard way.
  //
  // Thousands separators: `\d{1,4}` stopped at the comma, so Qantas's Montreal
  // Convention limit of EUR161,593 was read as "EUR161" and its Australian
  // domestic limit of A$265,785 as "$265". A leading fragment of a number is
  // the mirror of the decimal tail above, and it is worse in one way — the
  // fragment is a genuine substring of the source, so citation checking
  // confirms it. Match the whole grouped number, and refuse to stop in the
  // middle of one.
  //
  // Currency prefix: A$210 and US$210 are different amounts and this page
  // carries both, three sentences apart. Dropping the prefix produced "$210"
  // for each — a value that cannot be published because it no longer says what
  // it is worth.
  // Durations are excluded from `count` above, because "up to 2.5 hours" was
  // being read as a bag count. That guard was right and is kept — but it left
  // check-in unextractable for every carrier, since a check-in rule IS a
  // duration. Qantas's page carries eight of them (24 hours online, 30/45/60
  // minutes at the airport by flight type, 90 before an international
  // departure) and yielded no candidates at all. A separate kind keeps the two
  // apart instead of making one pattern serve both badly.
  {
    kind: 'duration',
    re: /(?<![\d.,])\d{1,3}(?:\.\d{1,2})?\s*(?:hours?|hrs?|minutes?|mins?|days?)\b(?![\d,])/gi,
  },
  {
    kind: 'money',
    re: /(?<![A-Za-z0-9])(?:(?:A|US|NZ|CA|HK|SG)?[£€$]|EUR|GBP|AUD|USD|NZD|CAD)\s?(?:\d{1,3}(?:,\d{3})+|\d{1,6})(?:\.\d{1,2})?(?![\d,])/gi,
  },
];

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?:])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseArgs(argv: string[]): { carrier?: string; date?: string; report: boolean; concurrency: number } {
  const out: { carrier?: string; date?: string; report: boolean; concurrency: number } = { report: false, concurrency: 4 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--carrier') out.carrier = argv[++i];
    else if (argv[i] === '--date') out.date = argv[++i];
    else if (argv[i] === '--report') out.report = true;
    else if (argv[i] === '--concurrency') out.concurrency = Number(argv[++i]);
    else if (argv[i].startsWith('--concurrency=')) out.concurrency = Number(argv[i].split('=')[1]);
  }
  if (!Number.isInteger(out.concurrency) || out.concurrency < 1) out.concurrency = 4;
  return out;
}

/**
 * The review view: candidates grouped by page, deduplicated by value, each with
 * the sentence it came from.
 *
 * Promoting a candidate to a field is a judgement about what a reader is
 * asking, and that judgement needs the sentence, not the number. "23kg" alone
 * is unusable; "Passengers can purchase up to 1 checked bags of 23kg" says it
 * is a purchasable tier rather than an included allowance, which is a different
 * schema field entirely.
 */
function printReport(file: CandidateFile): void {
  for (const page of file.pages) {
    const rows = file.candidates.filter((c) => c.page_key === page.page_key);
    if (!rows.length) continue;
    console.log(`\n${page.page_key}  —  ${page.source_url}`);
    console.log('─'.repeat(96));
    const seen = new Set<string>();
    for (const c of rows) {
      const key = `${c.kind}|${c.raw.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`  [${c.kind.padEnd(10)}] ${c.raw}`);
      console.log(`      "${c.sentence.length > 150 ? `${c.sentence.slice(0, 150)}…` : c.sentence}"`);
    }
  }
  if (file.skipped.length) {
    console.log('\nNot extracted:');
    for (const s of file.skipped) console.log(`  ${s.page_key.padEnd(24)}${s.reason}`);
  }
}

type PageSource = { page_key: string; set: string; dir: string; meta: any };
type PageExtraction = {
  page?: CandidateFile['pages'][number];
  candidates: Candidate[];
  skipped: CandidateFile['skipped'];
};

/**
 * Every page of this carrier we hold usable bytes for, and where each came from.
 *
 * Manual captures live in `captures/manual/<carrier>` rather than a dated
 * folder, because a human-saved page is evidence that cannot be regenerated —
 * a dated folder is a re-runnable snapshot and would be overwritten. That split
 * is deliberate, but it means neither location holds the whole picture for a
 * carrier that is partly blocked: Qantas answers robots.txt with an HTTP/2
 * reset from this host, so all six of its dated entries are `robots_unavailable`
 * while all six manual captures are good. Reading one directory found the
 * failures and reported nothing to extract.
 *
 * So resolve per page, not per carrier. An automated `ok` capture wins where
 * one exists — it is fresher and its provenance is machine-recorded end to end
 * — and a manual capture fills in where automation could not reach. A failed
 * automated probe never shadows good manual bytes, which is the same rule the
 * archiver already applies within a page's own history.
 */
async function resolvePageSources(carrier: string): Promise<PageSource[]> {
  const dates = (await fs.readdir(CAPTURES).catch(() => []))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  // Newest dated folder holding this carrier, then the manual set.
  const sets: { set: string; dir: string }[] = [];
  for (const d of dates) {
    const dir = path.join(CAPTURES, d, carrier);
    if (await fs.stat(dir).then(() => true).catch(() => false)) {
      sets.push({ set: d, dir });
      break;
    }
  }
  const manualDir = path.join(CAPTURES, 'manual', carrier);
  if (await fs.stat(manualDir).then(() => true).catch(() => false)) {
    sets.push({ set: 'manual', dir: manualDir });
  }

  const byPage = new Map<string, PageSource>();
  for (const { set, dir } of sets) {
    const metas = (await fs.readdir(dir)).filter((f) => f.endsWith('.meta.json'));
    for (const metaFile of metas) {
      const meta = JSON.parse(await fs.readFile(path.join(dir, metaFile), 'utf8'));
      const pageKey = meta.page_key as string;
      const existing = byPage.get(pageKey);
      const usable = ['ok', 'manual'].includes(meta.capture_status);
      // First usable capture wins; otherwise keep the first seen so the skip
      // reason still names a real status rather than disappearing.
      if (existing && (['ok', 'manual'].includes(existing.meta.capture_status) || !usable)) continue;
      byPage.set(pageKey, { page_key: pageKey, set, dir, meta });
    }
  }
  return [...byPage.values()].sort((a, b) => a.page_key.localeCompare(b.page_key));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.carrier) {
    console.error('Usage: npm run extract -- --carrier <carrier_key> [--date YYYY-MM-DD]');
    process.exitCode = 1;
    return;
  }

  const selectors = JSON.parse(
    await fs.readFile(path.resolve(import.meta.dirname, 'selectors.json'), 'utf8'),
  ) as Selectors;
  const selector = selectors[args.carrier]?.article;
  if (!selector) {
    console.error(
      `No article selector for "${args.carrier}" in selectors.json.\n` +
        'Extraction reads the article body only — page chrome on these sites carries dimensions\n' +
        'and weights of its own, and a figure pulled from a country picker is worse than none.\n' +
        `Add one, or note why it cannot be derived yet.`,
    );
    process.exitCode = 1;
    return;
  }
  const articleSelector = selector;

  const allSources = await resolvePageSources(args.carrier);
  const sources = args.date
    ? allSources.filter((s) => s.set === args.date)
    : allSources;
  if (!sources.length) {
    console.error(`No captures for ${args.carrier}. Run the fetcher, or ingest manual captures, first.`);
    process.exitCode = 1;
    return;
  }

  // Candidates are written beside the freshest set the run actually read, so a
  // re-run of the same set overwrites rather than accumulating.
  const setsUsed = [...new Set(sources.map((s) => s.set))].sort().reverse();
  const date = setsUsed.join('+');
  const dir = sources.find((s) => s.set === setsUsed[0])!.dir;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const out: CandidateFile = {
    carrier_key: args.carrier,
    extracted_at: `${new Date().toISOString().slice(0, 19)}Z`,
    capture_date: date,
    pages: [],
    candidates: [],
    skipped: [],
  };

  try {
    async function extractSource(source: PageSource): Promise<PageExtraction> {
      const { meta, page_key: pageKey } = source;

      if (!['ok', 'manual'].includes(meta.capture_status)) {
        return { candidates: [], skipped: [{ page_key: pageKey, reason: `capture_status is "${meta.capture_status}"` }] };
      }

      const htmlPath = path.join(source.dir, `${pageKey}.html`);
      const html = await fs.readFile(htmlPath, 'utf8').catch(() => null);
      if (html === null) {
        return { candidates: [], skipped: [{ page_key: pageKey, reason: 'no archived HTML beside the meta' }] };
      }

      const page = await context.newPage();
      let article: string | null = null;
      try {
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        article = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el ? (el as HTMLElement).innerText : null;
        }, articleSelector);
      } finally {
        await page.close().catch(() => undefined);
      }

      // A selector that stops matching is a silent data-loss bug — the page
      // would still parse, just with nothing in it. Say so instead.
      if (article === null) {
        return { candidates: [], skipped: [{ page_key: pageKey, reason: `selector "${articleSelector}" matched nothing` }] };
      }

      const text = article.replace(/\s+/g, ' ').trim();
      const pageRecord = {
        page_key: pageKey,
        source_url: meta.url,
        content_hash: meta.content_hash,
        article_chars: text.length,
        capture_set: source.set,
      };

      const seen = new Set<string>();
      const candidates: Candidate[] = [];
      for (const sentence of sentencesOf(text)) {
        for (const { kind, re } of PATTERNS) {
          for (const m of sentence.match(re) ?? []) {
            const key = `${pageKey}|${kind}|${m.toLowerCase()}|${sentence}`;
            if (seen.has(key)) continue;
            seen.add(key);
            candidates.push({
              kind,
              raw: m.trim(),
              sentence: sentence.length > 400 ? `${sentence.slice(0, 400)}…` : sentence,
              page_key: pageKey,
              source_url: meta.url,
            });
          }
        }
      }
      return { page: pageRecord, candidates, skipped: [] };
    }

    for (let i = 0; i < sources.length; i += args.concurrency) {
      const batch = sources.slice(i, i + args.concurrency);
      const results = await Promise.all(batch.map(extractSource));
      for (const result of results) {
        if (result.page) out.pages.push(result.page);
        out.candidates.push(...result.candidates);
        out.skipped.push(...result.skipped);
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  const outPath = path.join(dir, 'candidates.json');
  await fs.writeFile(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

  console.log(`${args.carrier} — captures from ${date}\n`);
  for (const p of out.pages) {
    const n = out.candidates.filter((c) => c.page_key === p.page_key).length;
    console.log(
      `  ${p.page_key.padEnd(24)}${String(p.article_chars).padStart(6)} chars article  ` +
        `${String(n).padStart(2)} candidate(s)  [${p.capture_set}]`,
    );
  }
  for (const s of out.skipped) console.log(`  ${s.page_key.padEnd(24)}skipped — ${s.reason}`);

  const byKind = new Map<string, number>();
  for (const c of out.candidates) byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);
  console.log(`\n${out.candidates.length} candidate(s): ${[...byKind].map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`\nWritten to ${outPath}`);
  console.log('Nothing was written to content/airline-facts/ — a person turns candidates into fields.');

  if (args.report) printReport(out);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
