'use client';

import { useEffect } from 'react';
import { STORED_MARKETING_CONSENT_JS, useConsent } from '@/lib/consent';
import { TpConsentPlaceholder } from '@/components/TpConsentGate';

export const TPWL_SRC = 'https://tpscr.com/wl_web/main.js?wl_id=16677';

const RELOAD_GUARD_KEY = 'originfacts.tpwl-reload';

type TpwlWindow = Window & {
  /** Set by the inline script in the server HTML: this document was a full load of /flight-search. */
  __ofTpwlSsr?: boolean;
  /** Set once the flight-search page has mounted in this document. */
  __ofTpwlMounted?: boolean;
};

/** id of the consent placeholder in the search box on /flight-search. */
export const TPWL_PLACEHOLDER_ID = 'tpwl-consent-placeholder';

/**
 * Server-rendered part of the Travelpayouts white-label loader. Render it after
 * #tpwl-search and #tpwl-tickets.
 *
 * The SDK (main.js) scans the page for #tpwl-search / #tpwl-tickets once, when
 * it executes, and never again. So it has to run exactly once per document, after
 * those containers exist. The SDK sets cookies and sends identifiers to
 * Travelpayouts (see TpConsentGate), so it may only start once the visitor has
 * allowed "Advertising / Personalisation".
 *
 * This inline script runs while the HTML is parsed, right after the containers:
 * if the stored choice already allows advertising, it starts the SDK without
 * waiting for React to hydrate (the speed the old unconditional module script
 * gave), hides the consent placeholder so it does not stack above the form, and
 * sets the marker that tells the client part the SDK is on its way. Without
 * consent it does nothing and no request reaches tpscr.com.
 */
export function TpwlConsentedBoot() {
  const js = `(function(){if(!${STORED_MARKETING_CONSENT_JS})return;window.__ofTpwlSsr=true;var p=document.getElementById(${JSON.stringify(
    TPWL_PLACEHOLDER_ID,
  )});if(p)p.style.display='none';var s=document.createElement('script');s.type='module';s.src=${JSON.stringify(
    TPWL_SRC,
  )};s.setAttribute('data-tpwl-loader','');document.head.appendChild(s);})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

/**
 * Client part. Does nothing until advertising consent is given (granting it on
 * the page's placeholder starts the SDK at once, the containers are already in
 * the DOM). Then three cases:
 * - full load of /flight-search with consent already stored: TpwlConsentedBoot
 *   started the SDK; nothing to do;
 * - first visit through an in-app link in this document: inject the SDK once;
 * - the page mounting again in the same document (back to it through a link, or
 *   with the Back button): the SDK has already run and will not scan the new
 *   containers, so the search form would stay empty until a refresh. Reload to
 *   get a fresh document. A short session guard stops a reload loop.
 *
 * Links into /flight-search do a full page load (TpwlFullLoadLinks), so the third
 * case is mostly the Back button.
 */
export default function TpwlLoader() {
  const allowed = useConsent()?.categories.marketing === true;

  useEffect(() => {
    if (!allowed) return;
    const w = window as TpwlWindow;
    const container = document.getElementById('tpwl-search');

    if (w.__ofTpwlMounted) {
      if (container && !container.shadowRoot) {
        let recent = false;
        try {
          recent = Date.now() - Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0) < 10_000;
          sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
        } catch {
          /* storage off: still reload once */
        }
        if (!recent) window.location.reload();
      }
      return;
    }
    w.__ofTpwlMounted = true;

    if (w.__ofTpwlSsr) return;

    const script = document.createElement('script');
    script.type = 'module';
    script.src = TPWL_SRC;
    script.setAttribute('data-tpwl-loader', '');
    document.head.appendChild(script);
  }, [allowed]);

  return null;
}

/**
 * Consent placeholder for the search box on /flight-search, shown until
 * advertising consent is given. Sits beside #tpwl-search (which stays in the
 * DOM, empty, so the SDK finds it whenever it starts). Min-heights match the
 * search form's rendered height per width (Playwright, Oct 2026).
 */
export function TpwlSearchPlaceholder({ partnerHref }: { partnerHref: string }) {
  const allowed = useConsent()?.categories.marketing === true;
  if (allowed) return null;
  return (
    <TpConsentPlaceholder
      id={TPWL_PLACEHOLDER_ID}
      tool="flight search"
      partnerHref={partnerHref}
      className="min-h-[405px] sm:min-h-[356px] xl:min-h-[146px]"
    />
  );
}
