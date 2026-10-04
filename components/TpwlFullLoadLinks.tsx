'use client';

import { useEffect } from 'react';

/**
 * Links into /flight-search load the page in full instead of navigating inside
 * the app. The Travelpayouts search form only starts on a fresh document (see
 * TpwlLoader), so an in-app navigation could leave the form empty until a
 * refresh. Catching the click before Next.js does keeps every link on the site
 * working this way, including links inside CMS content.
 *
 * New-tab, modified and download clicks are left to the browser.
 */
export default function TpwlFullLoadLinks() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute('download')) return;
      if (anchor.target && anchor.target !== '_self') return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || url.pathname !== '/flight-search') return;
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(url.href);
    };
    // Capture phase on document runs before React's own click handling.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
