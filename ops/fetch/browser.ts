/**
 * Playwright lifecycle and page loading.
 *
 * Carrier sites are captured with a real browser because several render their
 * baggage tables client-side; a plain HTTP fetch archives an empty shell.
 */
import { chromium, type Browser, type BrowserContext, type Page, type Response } from 'playwright';

/**
 * Identifies us, with a contact URL, and keeps the platform token so pages take
 * their normal rendering path.
 *
 * This is the shape well-behaved crawlers use — Googlebot's own UA carries a
 * Chrome token for the same reason. It is identification, not disguise: nothing
 * here is rotated, randomised, or stripped to slip past a filter. A site that
 * refuses this UA is recorded as `blocked` and left for manual capture.
 */
export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ' +
  'Originfacts/1.0 (+https://www.originfacts.com/about)';

/** Subresources we never need and that cost the host bandwidth to serve. */
const SKIP_RESOURCE_TYPES = new Set(['image', 'media', 'font']);

export async function openBrowser(): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1366, height: 900 },
    // Carrier pages routinely gate content behind a locale/consent cookie; a
    // fresh context per run keeps captures independent of each other.
    javaScriptEnabled: true,
  });

  await context.route('**/*', (route) => {
    if (SKIP_RESOURCE_TYPES.has(route.request().resourceType())) return route.abort();
    return route.continue();
  });

  return { browser, context };
}

export type LoadResult = {
  page: Page;
  response: Response | null;
};

/**
 * Navigate and settle. `domcontentloaded` then an explicit idle wait, rather
 * than `networkidle` as the navigation condition — analytics beacons on these
 * sites can keep the network busy indefinitely and time the whole capture out.
 */
export async function loadPage(context: BrowserContext, url: string, timeoutMs = 45_000): Promise<LoadResult> {
  const page = await context.newPage();
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
    /* Busy analytics; the DOM is already usable. */
  });
  return { page, response };
}

/** Body text as rendered, whitespace collapsed. The hash is taken over this. */
export async function extractText(page: Page): Promise<string> {
  const raw = await page.evaluate(() => document.body?.innerText ?? '');
  return raw.replace(/\s+/g, ' ').trim();
}

export async function readHtmlLang(page: Page): Promise<string | null> {
  const lang = await page.evaluate(() => document.documentElement.getAttribute('lang'));
  return lang && lang.trim() ? lang.trim() : null;
}
