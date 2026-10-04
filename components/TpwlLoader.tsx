'use client';

import { useEffect } from 'react';

export const TPWL_SRC = 'https://tpscr.com/wl_web/main.js?wl_id=16677';

const RELOAD_GUARD_KEY = 'originfacts.tpwl-reload';

type TpwlWindow = Window & {
  /** Set by the inline script in the server HTML: this document was a full load of /flight-search. */
  __ofTpwlSsr?: boolean;
  /** Set once the flight-search page has mounted in this document. */
  __ofTpwlMounted?: boolean;
};

/**
 * Server-rendered part of the Travelpayouts white-label loader.
 *
 * The SDK (main.js) scans the page for #tpwl-search / #tpwl-tickets once, when
 * it executes, and never again. So it has to run exactly once per document, after
 * those containers exist. Putting it in the server HTML as a module script does
 * that: the browser fetches it while the HTML is still arriving (with an early
 * connection to tpscr.com) and runs it once parsing is done, instead of waiting
 * for React to hydrate and inject it.
 *
 * The inline marker tells the client part that the SDK is already on its way.
 * Scripts that React inserts during client-side rendering do not execute, so on
 * an in-app navigation the marker stays unset and the client part takes over.
 */
export function TpwlLoaderHead() {
  return (
    <>
      <link rel="preconnect" href="https://tpscr.com" crossOrigin="anonymous" />
      <script dangerouslySetInnerHTML={{ __html: 'window.__ofTpwlSsr=true;' }} />
      {/* Module scripts are deferred: they run after the document is parsed. */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script type="module" src={TPWL_SRC} data-tpwl-loader="" />
    </>
  );
}

/**
 * Client part. Three cases:
 * - full load of /flight-search: the server-rendered script is running; nothing to do;
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
  useEffect(() => {
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
  }, []);

  return null;
}
