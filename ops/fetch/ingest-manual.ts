#!/usr/bin/env node
/**
 * Manual capture ingest — the path for carriers the fetcher cannot reach.
 *
 *   npm run ingest-manual -- --carrier qantas
 *
 * Qantas refuses this host at the transport layer: ERR_HTTP2_PROTOCOL_ERROR
 * from a plain client, from curl, and from a real browser, on both robots.txt
 * and content. Nothing short of a different network changes that, and
 * bypassing bot detection is out of scope. So a person saves the page from
 * their own browser and this turns it into a first-class capture.
 *
 * Manual captures are held to the same standard as automated ones and marked
 * so they can never be mistaken for them:
 *
 *   - Text is extracted through the same browser and the same normalisation,
 *     so content_hash and text_length are directly comparable with an
 *     automated capture of the same page. A quarterly diff works across the
 *     boundary.
 *   - capture_status is "manual", never "ok". An automated ok means a machine
 *     saw that page at that URL; a manual capture means a person says it did.
 *     Different claims, kept apart.
 *   - URL, locale and who captured it are stated in a manifest by the person
 *     who saved the file. Nothing is inferred from filenames.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { hashText, utcTimestamp } from './archive.js';
import { detectCurrencies, MIN_TEXT_LENGTH } from './classify.js';
import type { CaptureMeta } from './types.js';

const MANUAL_ROOT = path.resolve(import.meta.dirname, '..', '..', 'data', 'captures', 'manual');

type ManifestEntry = {
  file: string;
  page_key: string;
  url: string;
  locale: string;
  captured_by: string;
  captured_at: string;
};

const MANIFEST_TEMPLATE = `[
  {
    "file": "baggage_checked.html",
    "page_key": "baggage_checked",
    "url": "https://www.qantas.com/en-au/...",
    "locale": "en-au",
    "captured_by": "your-name",
    "captured_at": "2026-08-24"
  }
]`;

function parseArgs(argv: string[]): { carrier?: string } {
  const out: { carrier?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--carrier') out.carrier = argv[++i];
    else if (argv[i].startsWith('--carrier=')) out.carrier = argv[i].split('=')[1];
  }
  return out;
}

async function main(): Promise<void> {
  const { carrier } = parseArgs(process.argv.slice(2));
  if (!carrier) {
    console.error('Usage: npm run ingest-manual -- --carrier <carrier_key>');
    process.exitCode = 1;
    return;
  }

  const dir = path.join(MANUAL_ROOT, carrier);
  const manifestPath = path.join(dir, 'manifest.json');

  let manifest: ManifestEntry[];
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as ManifestEntry[];
  } catch {
    console.error(`No manifest at ${manifestPath}\n`);
    console.error('Save each page from your browser as "Webpage, Complete" into');
    console.error(`  ${dir}/\n`);
    console.error('then write a manifest.json beside them. Nothing is inferred from filenames —');
    console.error('URL and locale are claims only the person who saved the page can make:\n');
    console.error(MANIFEST_TEMPLATE);
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const rows: CaptureMeta[] = [];

  try {
    for (const entry of manifest) {
      const missing = (['file', 'page_key', 'url', 'locale', 'captured_by', 'captured_at'] as const).filter(
        (k) => !entry[k],
      );
      if (missing.length) {
        console.error(`  ${entry.file ?? '(no file)'} — manifest missing: ${missing.join(', ')}`);
        continue;
      }

      let html: string;
      try {
        html = await fs.readFile(path.join(dir, entry.file), 'utf8');
      } catch {
        console.error(`  ${entry.file} — not found in ${dir}`);
        continue;
      }

      // Same extraction as the automated path, so the hashes are comparable.
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const text = (await page.evaluate(() => document.body?.innerText ?? '')).replace(/\s+/g, ' ').trim();
      const htmlLang = await page.evaluate(() => document.documentElement.getAttribute('lang'));
      await page.close();

      const meta = {
        carrier_key: carrier,
        page_key: entry.page_key,
        url: entry.url,
        locale: entry.locale,
        fetched_at: utcTimestamp(),
        http_status: null,
        final_url: entry.url,
        content_hash: hashText(text),
        text_length: text.length,
        capture_status: 'manual',
        capture_method: 'manual',
        captured_by: entry.captured_by,
        captured_at: entry.captured_at,
        consent_action: 'none_found',
        html_lang: htmlLang && htmlLang.trim() ? htmlLang.trim() : null,
        detected_currencies: detectCurrencies(text),
        redirected: false,
        attempts: 0,
      } as unknown as CaptureMeta;

      await fs.writeFile(path.join(dir, `${entry.page_key}.meta.json`), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
      rows.push(meta);

      const thin = text.length < MIN_TEXT_LENGTH ? '  ** under the text threshold' : '';
      console.log(`  ${entry.page_key.padEnd(24)}${String(text.length).padStart(7)} chars  ${(meta.content_hash ?? "").slice(0, 19)}...${thin}`);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  console.log(`\n${rows.length} manual capture(s) ingested for ${carrier}.`);
  const thin = rows.filter((r) => r.text_length < MIN_TEXT_LENGTH);
  if (thin.length) {
    console.log(`${thin.length} under ${MIN_TEXT_LENGTH} chars — a "Page Source" save misses client-rendered`);
    console.log('content. Re-save with "Webpage, Complete", or copy the rendered DOM from devtools.');
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
