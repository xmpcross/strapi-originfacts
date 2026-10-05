'use client';

import { grantMarketingConsent, reopenConsentSettings, useConsent } from '@/lib/consent';

/**
 * Shown inside the GetYourGuide activity widget box until the visitor allows
 * the "Advertising / Personalisation" category: the GetYourGuide partner script
 * (loaded by <ConsentScripts />) only runs after that consent, so without it the
 * widget would otherwise stay empty. The "Powered by GetYourGuide" link next to
 * it is a plain affiliate link and works either way.
 */
export default function GygConsentNotice() {
  const consent = useConsent();
  if (consent?.categories.marketing) return null;

  return (
    <div className="mb-4 rounded-lg border border-forest-900/10 bg-white p-4 text-sm text-forest-900/75" data-testid="gyg-consent-notice">
      <p>
        The live activity list is loaded from GetYourGuide, our affiliate partner, which can set cookies
        and record that you came from Originfacts. It loads only if you allow advertising cookies.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={grantMarketingConsent}
          className="inline-flex h-9 items-center rounded-full bg-primary-emphasis px-4 text-sm font-semibold text-white transition hover:bg-primary-highlight"
          data-testid="gyg-consent-allow"
        >
          Load activities (allows advertising cookies)
        </button>
        <button
          type="button"
          onClick={reopenConsentSettings}
          className="inline-flex h-9 items-center rounded-full border border-forest-900/20 bg-white px-4 text-sm font-medium text-forest-900 transition hover:border-forest-900/40"
        >
          Cookie settings
        </button>
      </div>
    </div>
  );
}
