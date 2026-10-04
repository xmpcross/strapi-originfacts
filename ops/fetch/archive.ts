/**
 * Writing captures to disk.
 *
 * Layout: data/captures/<YYYY-MM-DD>/<carrier_key>/<page_key>.html plus a
 * sibling <page_key>.meta.json. The date is UTC, matching `fetched_at`, so a
 * run started late in the evening in Perth does not land in yesterday's folder.
 *
 * Re-running a day overwrites that day, with one exception: a failed capture
 * never replaces a body that succeeded. Losing a good archive because a carrier
 * happened to be behind a bot wall on the second run would be the worst possible
 * outcome for a pipeline whose entire purpose is to avoid re-hitting these
 * sites. The failure meta is still written, and `body_retained_from` records
 * that the HTML beside it is older than the meta.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CaptureMeta } from './types.js';

/**
 * Anchored to the repo root via this file's own location, not process.cwd().
 * The runner is invoked as `yarn --cwd ops/fetch`, so cwd is ops/fetch and a
 * cwd-relative path would quietly archive into ops/fetch/data/captures.
 */
export const CAPTURES_ROOT = path.resolve(import.meta.dirname, '..', '..', 'data', 'captures');

export function utcDateStamp(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function utcTimestamp(now = new Date()): string {
  return `${now.toISOString().slice(0, 19)}Z`;
}

export function hashText(text: string): string {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function dirFor(dateStamp: string, carrierKey: string): string {
  return path.join(CAPTURES_ROOT, dateStamp, carrierKey);
}

async function readExistingMeta(file: string): Promise<CaptureMeta | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as CaptureMeta;
  } catch {
    return null;
  }
}

/**
 * @param html  null when nothing was fetched (robots, or a hard failure).
 * @returns the meta actually written, which may carry `body_retained_from`.
 */
export async function writeCapture(
  dateStamp: string,
  meta: CaptureMeta,
  html: string | null,
): Promise<CaptureMeta> {
  const dir = dirFor(dateStamp, meta.carrier_key);
  await fs.mkdir(dir, { recursive: true });

  const htmlFile = path.join(dir, `${meta.page_key}.html`);
  const metaFile = path.join(dir, `${meta.page_key}.meta.json`);

  let finalMeta = meta;

  if (meta.capture_status === 'ok' && html !== null) {
    await fs.writeFile(htmlFile, html, 'utf8');
  } else {
    const previous = await readExistingMeta(metaFile);
    const bodyExists = await fs
      .access(htmlFile)
      .then(() => true)
      .catch(() => false);

    if (bodyExists && previous?.capture_status === 'ok') {
      // Keep the good body; record that it predates this meta.
      finalMeta = { ...meta, body_retained_from: previous.fetched_at };
    } else if (html !== null) {
      // No good body to protect — archive what we got, whatever it is. A
      // blocked interstitial on disk is evidence for the person capturing it
      // by hand.
      await fs.writeFile(htmlFile, html, 'utf8');
    }
  }

  await fs.writeFile(metaFile, `${JSON.stringify(finalMeta, null, 2)}\n`, 'utf8');
  return finalMeta;
}
