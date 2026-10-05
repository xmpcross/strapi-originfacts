'use client';

import { useSyncExternalStore } from 'react';

/**
 * Cookie-consent store shared by the banner (components/CookieConsent.tsx), the
 * third-party script loader (components/ConsentScripts.tsx) and anything that
 * has to wait for consent (e.g. the GetYourGuide activity widget).
 *
 * The stored format is unchanged from the original banner, so choices made
 * before this module existed still apply:
 *   localStorage['originfacts.consent.v1'] =
 *     { version: 1, decidedAt: ISO string, categories: { essential, analytics, marketing } }
 */

export const CONSENT_STORAGE_KEY = 'originfacts.consent.v1';
/** Fired on window after a choice is saved; detail is the ConsentState. */
export const CONSENT_EVENT = 'originfacts:consent';
/** Fired on window to reopen the banner in its settings view. */
export const CONSENT_REOPEN_EVENT = 'originfacts:consent:reopen';

export type ConsentCategory = 'essential' | 'analytics' | 'marketing';
export type ConsentCategories = Record<ConsentCategory, boolean>;

export type ConsentState = {
  version: 1;
  decidedAt: string;
  categories: ConsentCategories;
};

export const ALL_OFF: ConsentCategories = { essential: true, analytics: false, marketing: false };
export const ALL_ON: ConsentCategories = { essential: true, analytics: true, marketing: true };

type GtagFn = (...args: unknown[]) => void;

/** Google Consent Mode v2 update. A no-op until window.gtag exists (layout's consent-default script defines it). */
export function applyConsentMode(categories: ConsentCategories) {
  if (typeof window === 'undefined') return;
  const gtag = (window as unknown as { gtag?: GtagFn }).gtag;
  if (typeof gtag !== 'function') return;
  gtag('consent', 'update', {
    ad_storage: categories.marketing ? 'granted' : 'denied',
    ad_user_data: categories.marketing ? 'granted' : 'denied',
    ad_personalization: categories.marketing ? 'granted' : 'denied',
    analytics_storage: categories.analytics ? 'granted' : 'denied',
  });
}

let cachedRaw: string | null | undefined;
let cachedState: ConsentState | null = null;

function parse(raw: string | null): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed?.version !== 1 || typeof parsed.categories !== 'object' || !parsed.categories) return null;
    return {
      version: 1,
      decidedAt: String(parsed.decidedAt ?? ''),
      categories: {
        essential: true,
        analytics: parsed.categories.analytics === true,
        marketing: parsed.categories.marketing === true,
      },
    };
  } catch {
    return null;
  }
}

/** The saved choice, or null if the visitor has not decided (or storage is unavailable). */
export function readStoredConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedState = parse(raw);
  }
  return cachedState;
}

// Fallback when localStorage throws (private mode etc.): keep the choice for this page view.
let memoryState: ConsentState | null = null;

export function getConsent(): ConsentState | null {
  return readStoredConsent() ?? memoryState;
}

/**
 * First-party cookies set by the analytics/advertising scripts. Removed when the
 * visitor withdraws consent (third-party cookies on other domains cannot be
 * removed from here; the scripts are simply no longer loaded).
 */
const ANALYTICS_COOKIE = /^(_ga|_ga_.*|_gid|_gat.*|_dc_gtm_.*)$/;
const MARKETING_COOKIE = /^(_gcl_.*|_fbp|tp_.*|_tp.*|gyg.*|_gyg.*|ta_.*|cl_.*)$/i;

function deleteCookies(match: RegExp) {
  const host = window.location.hostname;
  const parts = host.split('.');
  const domains = [''];
  for (let i = 0; i < parts.length - 1; i++) domains.push('; domain=.' + parts.slice(i).join('.'));
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0]?.trim();
    if (!name || !match.test(name)) continue;
    for (const d of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;
    }
  }
}

/** Save a choice, update Consent Mode and notify listeners. Withdrawing a category reloads the page so its scripts are gone. */
export function saveConsent(categories: ConsentCategories) {
  const previous = getConsent()?.categories ?? null;
  const next: ConsentCategories = {
    essential: true,
    analytics: categories.analytics === true,
    marketing: categories.marketing === true,
  };
  const payload: ConsentState = { version: 1, decidedAt: new Date().toISOString(), categories: next };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / disabled storage */
  }
  memoryState = payload;
  applyConsentMode(next);

  const withdrewAnalytics = previous?.analytics === true && !next.analytics;
  const withdrewMarketing = previous?.marketing === true && !next.marketing;
  if (!next.analytics) deleteCookies(ANALYTICS_COOKIE);
  if (!next.marketing) deleteCookies(MARKETING_COOKIE);

  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: payload }));

  // A script that has already run cannot be unloaded; a fresh document is the
  // only way to stop it. Reload so it is not present for the rest of the visit.
  if (withdrewAnalytics || withdrewMarketing) window.location.reload();
}

export function reopenConsentSettings() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONSENT_STORAGE_KEY) onChange();
  };
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Current consent (null = undecided). Always null during SSR and hydration, so nothing optional is in the server HTML. */
export function useConsent(): ConsentState | null {
  return useSyncExternalStore(subscribe, getConsent, () => null);
}
