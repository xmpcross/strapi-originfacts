import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSENT_EVENT,
  CONSENT_STORAGE_KEY,
  getConsent,
  grantMarketingConsent,
  saveConsent,
  type ConsentState,
} from '../lib/consent';

// Minimal browser stand-ins: lib/consent.ts only touches localStorage,
// dispatchEvent, location.reload/hostname and document.cookie.
type Fake = { store: Map<string, string>; events: ConsentState[]; reloads: number };
const fake: Fake = { store: new Map(), events: [], reloads: 0 };

const g = globalThis as Record<string, unknown>;
g.window = {
  localStorage: {
    getItem: (k: string) => (fake.store.has(k) ? fake.store.get(k)! : null),
    setItem: (k: string, v: string) => void fake.store.set(k, String(v)),
    removeItem: (k: string) => void fake.store.delete(k),
    key: (i: number) => [...fake.store.keys()][i] ?? null,
    get length() {
      return fake.store.size;
    },
  },
  location: { hostname: 'www.originfacts.com', reload: () => void fake.reloads++ },
  dispatchEvent: (e: Event) => {
    if (e.type === CONSENT_EVENT) fake.events.push((e as CustomEvent<ConsentState>).detail);
    return true;
  },
};
g.document = { cookie: '' };

beforeEach(() => {
  fake.store.clear();
  fake.events.length = 0;
  fake.reloads = 0;
});

function stored(): ConsentState {
  const raw = fake.store.get(CONSENT_STORAGE_KEY);
  assert.ok(raw, 'consent was not written');
  return JSON.parse(raw) as ConsentState;
}

test('consent: a placeholder grant on a fresh visit records a choice with only advertising on', () => {
  assert.equal(getConsent(), null, 'undecided before');
  grantMarketingConsent();
  const s = stored();
  assert.equal(s.version, 1);
  assert.deepEqual(s.categories, { essential: true, analytics: false, marketing: true });
  assert.ok(s.decidedAt, 'decidedAt set');
  // The banner shows only while getConsent() is null, and closes on CONSENT_EVENT.
  assert.ok(getConsent(), 'a choice now exists, so the banner is not shown again');
  assert.equal(fake.events.length, 1, 'CONSENT_EVENT fired once (closes an open banner)');
  assert.deepEqual(fake.events[0].categories, s.categories);
  assert.equal(fake.reloads, 0, 'granting does not reload');
});

test('consent: a placeholder grant keeps an earlier analytics choice as it was', () => {
  saveConsent({ essential: true, analytics: true, marketing: false });
  grantMarketingConsent();
  assert.deepEqual(stored().categories, { essential: true, analytics: true, marketing: true });
});

test('consent: Reject all records a choice with everything optional off', () => {
  saveConsent({ essential: true, analytics: false, marketing: false });
  assert.deepEqual(stored().categories, { essential: true, analytics: false, marketing: false });
  assert.equal(fake.events.length, 1);
});
