'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ALL_OFF,
  ALL_ON,
  CONSENT_EVENT,
  CONSENT_REOPEN_EVENT,
  getConsent,
  reopenConsentSettings,
  saveConsent,
  type ConsentCategories,
  type ConsentState,
  type ConsentCategory,
} from '@/lib/consent';

type View = 'banner' | 'settings';

const CHECKBOX_CLASS =
  'mt-1 h-4 w-4 shrink-0 rounded-[0.2rem] border-forest-900/40 data-[state=checked]:border-primary-emphasis data-[state=checked]:bg-primary-emphasis data-[state=checked]:text-white disabled:opacity-60';

export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('banner');
  const [categories, setCategories] = useState<ConsentCategories>(ALL_OFF);

  useEffect(() => {
    // Consent Mode for a stored choice is applied by <ConsentScripts />.
    const existing = getConsent();
    if (!existing) {
      setOpen(true);
      setView('banner');
    } else {
      setCategories(existing.categories);
    }

    const onReopen = () => {
      const cur = getConsent();
      if (cur) setCategories(cur.categories);
      setView('settings');
      setOpen(true);
    };
    // Any saved choice closes the banner, including one made outside it: the
    // in-page "Load …" placeholders (GetYourGuide, Travelpayouts) grant their
    // category through the store, and the visitor has then made a choice.
    const onSaved = (e: Event) => {
      const saved = (e as CustomEvent<ConsentState>).detail ?? getConsent();
      if (saved) setCategories(saved.categories);
      setOpen(false);
    };
    window.addEventListener(CONSENT_REOPEN_EVENT, onReopen);
    window.addEventListener(CONSENT_EVENT, onSaved);
    return () => {
      window.removeEventListener(CONSENT_REOPEN_EVENT, onReopen);
      window.removeEventListener(CONSENT_EVENT, onSaved);
    };
  }, []);

  if (!open) return null;

  const acceptAll = () => {
    saveConsent(ALL_ON);
    setCategories(ALL_ON);
    setOpen(false);
  };
  const rejectAll = () => {
    saveConsent(ALL_OFF);
    setCategories(ALL_OFF);
    setOpen(false);
  };
  const saveChoices = () => {
    const next = { ...categories, essential: true };
    saveConsent(next);
    setOpen(false);
  };
  const toggle = (key: ConsentCategory) => {
    if (key === 'essential') return;
    setCategories((c) => ({ ...c, [key]: !c[key] }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4 sm:px-6 sm:pb-6"
      data-testid="cookie-consent"
    >
      <div className="mx-auto max-w-4xl rounded-2xl border border-forest-900/15 bg-paper p-5 shadow-2xl shadow-forest-900/15 sm:p-6">
        {view === 'banner' ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex-1 text-sm text-forest-900">
              <p id="cookie-consent-title" className="font-semibold">We use cookies</p>
              <p className="mt-1 text-forest-900/75">
                Originfacts uses essential cookies to run the site. With your permission we may also use cookies for analytics and personalised advertising.
                Read our <Link href="/legal/cookies" className="underline hover:text-primary-emphasis">Cookie Policy</Link> for details.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <Button
                type="button"
                onClick={() => setView('settings')}
                variant="outline"
                className="h-10 rounded-full border-forest-900/20 bg-white px-4 text-sm font-medium text-forest-900 shadow-none hover:border-forest-900/40 hover:bg-white hover:text-forest-900"
                data-testid="cookie-consent-settings"
              >
                Settings
              </Button>
              <Button
                type="button"
                onClick={rejectAll}
                variant="outline"
                className="h-10 rounded-full border-forest-900/20 bg-white px-4 text-sm font-medium text-forest-900 shadow-none hover:border-forest-900/40 hover:bg-white hover:text-forest-900"
                data-testid="cookie-consent-reject"
              >
                Reject all
              </Button>
              <Button
                type="button"
                onClick={acceptAll}
                className="h-10 rounded-full bg-primary-emphasis px-4 text-sm font-semibold text-white shadow-none hover:bg-primary-highlight"
                data-testid="cookie-consent-accept"
              >
                Accept all
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-forest-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="cookie-consent-title" className="font-semibold">Cookie settings</p>
                <p className="mt-1 text-forest-900/75">
                  Choose which categories of cookies you allow. You can change these any time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setView('banner')}
                className="text-xs uppercase tracking-widest text-forest-900/60 hover:text-forest-900"
                aria-label="Back"
              >
                Back
              </button>
            </div>

            <ul className="mt-4 space-y-3">
              <li className="flex items-start justify-between gap-4 rounded-xl border border-forest-900/10 bg-white p-3">
                <div>
                  <p className="font-medium">Essential</p>
                  <p className="mt-1 text-forest-900/70">Required for the site to function (security, navigation, consent storage). Always on.</p>
                </div>
                <Checkbox
                  checked
                  disabled
                  aria-label="Essential cookies (required)"
                  className={CHECKBOX_CLASS}
                />
              </li>
              <li className="flex items-start justify-between gap-4 rounded-xl border border-forest-900/10 bg-white p-3">
                <div>
                  <p className="font-medium">Analytics</p>
                  <p className="mt-1 text-forest-900/70">Help us understand how readers use the site so we can improve content and navigation.</p>
                </div>
                <Checkbox
                  checked={categories.analytics}
                  onCheckedChange={() => toggle('analytics')}
                  aria-label="Analytics cookies"
                  className={CHECKBOX_CLASS}
                  data-testid="cookie-consent-analytics"
                />
              </li>
              <li className="flex items-start justify-between gap-4 rounded-xl border border-forest-900/10 bg-white p-3">
                <div>
                  <p className="font-medium">Advertising / Personalisation</p>
                  <p className="mt-1 text-forest-900/70">Used by advertising and affiliate partners (Travelpayouts, Takeads, GetYourGuide) to attribute bookings, show more relevant offers and measure performance. Also needed for the GetYourGuide activity widgets.</p>
                </div>
                <Checkbox
                  checked={categories.marketing}
                  onCheckedChange={() => toggle('marketing')}
                  aria-label="Advertising cookies"
                  className={CHECKBOX_CLASS}
                  data-testid="cookie-consent-marketing"
                />
              </li>
            </ul>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                onClick={rejectAll}
                variant="outline"
                className="h-10 rounded-full border-forest-900/20 bg-white px-4 text-sm font-medium text-forest-900 shadow-none hover:border-forest-900/40 hover:bg-white hover:text-forest-900"
              >
                Reject all
              </Button>
              <Button
                type="button"
                onClick={saveChoices}
                className="h-10 rounded-full bg-primary-emphasis px-4 text-sm font-semibold text-white shadow-none hover:bg-primary-highlight"
                data-testid="cookie-consent-save"
              >
                Save choices
              </Button>
              <Button
                type="button"
                onClick={acceptAll}
                className="h-10 rounded-full bg-forest-900 px-4 text-sm font-semibold text-white shadow-none hover:bg-forest-700"
              >
                Accept all
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Tiny button you can drop in any footer/legal page so users can re-open consent settings. */
export function CookieSettingsButton({ className }: { className?: string }) {
  const cls = className ?? 'hover:text-secondary';
  return (
    <button
      type="button"
      onClick={reopenConsentSettings}
      className={cls}
      data-testid="cookie-consent-reopen"
    >
      Cookie settings
    </button>
  );
}
