'use client';

import { useEffect } from 'react';

/**
 * Keeps the Travelpayouts search widget's text links readable on the blue
 * /flight-search hero. The widget renders inside Shadow DOM, so page CSS can't
 * reach these links; this injects a small stylesheet into each shadow root
 * under the search container (same approach as TpwlHideCurrency).
 *
 * The colour comes from --tpwl-hero-ink, which globals.css sets on the hero
 * band only while no search is active. CSS custom properties inherit through
 * the shadow boundary, so in the results view (white band, variable unset) the
 * links fall back to the widget's own blue.
 */
const CONTRAST_CSS = `
  [class*="SearchEdit-module__multiRouteBtn"],
  [class*="SearchEdit-module__multiRouteBtn"] *,
  [class*="SearchEdit-module__hotelsText"],
  [class*="LocalizationDropdown-module__btn"] {
    color: var(--tpwl-hero-ink, #1411ec) !important;
  }
`;

export default function TpwlHeroContrast({ containerId = 'tpwl-search' }: { containerId?: string }) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const seen = new WeakSet<ShadowRoot>();

    const injectInto = (root: ShadowRoot) => {
      if (!seen.has(root)) {
        const style = document.createElement('style');
        style.setAttribute('data-hero-contrast', '');
        style.textContent = CONTRAST_CSS;
        root.appendChild(style);
        seen.add(root);
      }
      root.querySelectorAll<HTMLElement>('*').forEach((el) => {
        if (el.shadowRoot) injectInto(el.shadowRoot);
      });
    };

    const inject = () => {
      // The widget attaches its shadow root to the container itself.
      if (container.shadowRoot) injectInto(container.shadowRoot);
      container.querySelectorAll<HTMLElement>('*').forEach((el) => {
        if (el.shadowRoot) injectInto(el.shadowRoot);
      });
    };

    inject();
    const observer = new MutationObserver(inject);
    observer.observe(container, { childList: true, subtree: true });
    // Shadow-root mutations aren't observed above; poll as a backstop.
    const timer = window.setInterval(inject, 700);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [containerId]);

  return null;
}
