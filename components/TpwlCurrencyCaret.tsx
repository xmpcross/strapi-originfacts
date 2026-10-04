'use client';

import { useEffect } from 'react';

/**
 * Gives the Travelpayouts widget's currency switcher a visible dropdown caret,
 * drawn just before the currency code.
 *
 * The widget renders it as a bare text button ("USD", "AUD"…) inside Shadow DOM,
 * so the caret rules in globals.css (`[data-testid="localization-button-*"]::after`)
 * never reach it, and on the light /flight-search hero it did not read as a
 * dropdown. This injects the caret, in dark ink, into the widget's shadow root.
 */
const CARET_CSS = `
  [data-testid="localization-button-currencies"],
  [data-testid="localization-button-languages"] {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #07142b !important;
  }
  [data-testid="localization-button-currencies"]::before,
  [data-testid="localization-button-languages"]::before {
    content: "";
    width: 7px;
    height: 7px;
    margin-top: -3px;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    transform: rotate(45deg);
    opacity: 0.75;
  }
  /* Any icon the widget draws in the switcher: same dark ink as the text. */
  [class*="LocalizationDropdown-module__root"] svg,
  [class*="LocalizationDropdown-module__root"] svg * {
    color: #07142b !important;
    fill: currentColor !important;
  }
`;

export default function TpwlCurrencyCaret({ containerId = 'tpwl-search' }: { containerId?: string }) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const seen = new WeakSet<ShadowRoot>();

    const injectInto = (root: ShadowRoot) => {
      if (!seen.has(root)) {
        const style = document.createElement('style');
        style.setAttribute('data-currency-caret', '');
        style.textContent = CARET_CSS;
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
