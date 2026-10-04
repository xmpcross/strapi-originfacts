/**
 * Cookie-consent walls.
 *
 * Several European carrier sites render nothing until a banner is answered.
 * This module answers it — and only ever with reject-non-essential.
 *
 * Where a CMP offers no reject path, the fetcher records `reject_unavailable`
 * and clicks nothing. The page then usually falls under the text threshold and
 * is handed to a person. Consenting to tracking on a carrier's site, on behalf
 * of a company that never visited it, to harvest a page, is not a trade this
 * pipeline makes — a missing capture is the cheaper mistake.
 */
import type { Page } from 'playwright';
import type { ConsentAction } from './types.js';

/**
 * Reject selectors for the CMPs these carriers actually use. Ordered most to
 * least specific — a vendor's own reject control before any generic guess.
 */
const REJECT_SELECTORS = [
  '#onetrust-reject-all-handler',
  '.ot-pc-refuse-all-handler',
  '#CybotCookiebotDialogBodyButtonDecline',
  '#CybotCookiebotDialogBodyButtonDeclineAll',
  '#didomi-notice-disagree-button',
  'button.didomi-continue-without-agreeing',
  '[data-testid="uc-deny-all-button"]',
  '#truste-consent-required',
  '.qc-cmp2-summary-buttons button[mode="secondary"]',
  '#onetrust-pc-btn-handler',
];

/** Text used by banners with no stable selector. Reject wording only. */
const REJECT_TEXT = /^(reject all|reject|decline all|decline|only necessary|necessary only|essential only|strictly necessary|refuse all|continue without accepting|manage.*reject)$/i;

/** Presence of one of these means a banner exists at all. */
const BANNER_SELECTORS = [
  '#onetrust-banner-sdk',
  '#CybotCookiebotDialog',
  '#didomi-notice',
  '#usercentrics-root',
  '#truste-consent-track',
  '.qc-cmp2-container',
  '[id*="cookie" i][class*="banner" i]',
  '[aria-label*="cookie" i][role="dialog"]',
];

/** Consent cookies whose presence confirms a choice was recorded. */
const CONSENT_COOKIES = [
  'OptanonAlertBoxClosed',
  'OptanonConsent',
  'CookieConsent',
  'didomi_token',
  'euconsent-v2',
  'notice_gdpr_prefs',
  'usercentrics',
];

async function bannerVisible(page: Page): Promise<boolean> {
  for (const sel of BANNER_SELECTORS) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) return true;
  }
  return false;
}

async function clickReject(page: Page): Promise<boolean> {
  for (const sel of REJECT_SELECTORS) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 5_000 }).catch(() => undefined);
      return true;
    }
  }

  // Fall back to button text, matching reject wording only. Accept-all controls
  // are never matched by REJECT_TEXT, so this cannot accidentally consent.
  const buttons = page.locator('button, [role="button"], a[role="button"]');
  const count = Math.min(await buttons.count().catch(() => 0), 60);
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    if (!(await btn.isVisible().catch(() => false))) continue;
    const label = ((await btn.innerText().catch(() => '')) || '').trim();
    if (label && REJECT_TEXT.test(label)) {
      await btn.click({ timeout: 5_000 }).catch(() => undefined);
      return true;
    }
  }

  return false;
}

async function consentCookieSet(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies().catch(() => []);
  return cookies.some((c) => CONSENT_COOKIES.some((name) => c.name.includes(name)));
}

/**
 * Dismissal is judged on three independent signals, because no one of them is
 * sufficient on its own: some banners overlay already-rendered content, so the
 * text length never moves; others remove the banner and then load content
 * asynchronously, so the banner disappearing proves nothing yet.
 */
export async function handleConsent(page: Page, textBefore: number): Promise<ConsentAction> {
  if (!(await bannerVisible(page))) return 'none_found';

  const clicked = await clickReject(page);
  if (!clicked) return 'reject_unavailable';

  await page.waitForTimeout(1_200);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);

  const gone = !(await bannerVisible(page));
  const cookie = await consentCookieSet(page);
  const grew = (await page.evaluate(() => (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().length)) > textBefore;

  return gone || cookie || grew ? 'rejected' : 'dismiss_failed';
}
