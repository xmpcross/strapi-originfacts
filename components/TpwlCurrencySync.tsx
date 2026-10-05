'use client';

import { useEffect } from 'react';
import { useConsent } from '@/lib/consent';
import { isCurrency, toCurrency } from '@/lib/currency';
import { setCurrency, useCurrency } from '@/components/useCurrency';
import { tpwlCurrencyCode, writeTpwlCurrencyCookie } from '@/lib/tpwl-currency';

/**
 * Makes the header currency picker the only currency control of the
 * Travelpayouts flight search on /flight-search (form and in-page results).
 *
 * - Hides the widget's own currency switcher (it renders in Shadow DOM, so the
 *   rule is injected into the shadow root), and the settings row it sits in
 *   when that row holds nothing else. The language switcher stays styled with
 *   a caret, but our white label offers English only, so the widget does not
 *   render one today.
 * - Hands the header currency to the widget: writes its tpwl_currency cookie,
 *   and when the SDK is already running sets `window.TPWL_CONFIGURATION`, which
 *   makes it re-read the cookie and re-run an open search in that currency, in
 *   place (see lib/tpwl-currency.ts). Only once advertising consent lets the
 *   widget load; without it this writes nothing.
 * - Should the widget's own currency ever change (its onCurrencyChange hook,
 *   `tpwlCurrencyChange`), the header follows.
 */
const WIDGET_CSS = `
  [data-testid="localization-button-currencies"],
  [class*="module__settings___"]:not(:has([data-testid="localization-button-languages"])) {
    display: none !important;
  }
  [data-testid="localization-button-languages"] {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #07142b !important;
  }
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
`;

type TpwlWindow = Window & {
  TPWL_CONFIGURATION?: Record<string, unknown>;
  tpwlCurrencyChange?: (code: string) => void;
};

function useWidgetCss(containerId: string) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const seen = new WeakSet<ShadowRoot>();

    const injectInto = (root: ShadowRoot) => {
      if (!seen.has(root)) {
        const style = document.createElement('style');
        style.setAttribute('data-of-tpwl-currency', '');
        style.textContent = WIDGET_CSS;
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
}

/** The currency the widget currently shows, read from its (hidden) switcher. */
function widgetCurrency(containerId: string): string | null {
  const root = document.getElementById(containerId)?.shadowRoot;
  const code = root?.querySelector('[data-testid="localization-button-currencies"]')?.textContent?.trim().toUpperCase();
  return code && /^[A-Z]{3}$/.test(code) ? code : null;
}

export default function TpwlCurrencySync({ containerId = 'tpwl-search' }: { containerId?: string }) {
  const allowed = useConsent()?.categories.marketing === true;
  const { currency, ready } = useCurrency();
  useWidgetCss(containerId);

  useEffect(() => {
    if (!allowed || !ready) return;
    const w = window as TpwlWindow;
    const code = tpwlCurrencyCode(currency);
    writeTpwlCurrencyCookie(currency);

    // SDK not started yet: it reads the cookie when it does.
    if (!w.TPWL_CONFIGURATION) return;
    // The form may not have rendered yet: apply once it shows another currency.
    const apply = () => {
      const shown = widgetCurrency(containerId);
      if (!shown) return false;
      // Any write to TPWL_CONFIGURATION makes the SDK re-resolve its currency
      // (cookie first), which also re-runs a search that is on screen.
      if (shown !== code && w.TPWL_CONFIGURATION) w.TPWL_CONFIGURATION.defaultCurrency = code;
      return true;
    };
    if (apply()) return;
    const timer = window.setInterval(() => {
      if (apply()) window.clearInterval(timer);
    }, 300);
    const stop = window.setTimeout(() => window.clearInterval(timer), 15_000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [allowed, ready, currency, containerId]);

  // TPWL_BACKEND_CONFIGURATION.onCurrencyChange names this global.
  useEffect(() => {
    const w = window as TpwlWindow;
    w.tpwlCurrencyChange = (next: string) => {
      if (isCurrency(next)) setCurrency(toCurrency(next));
    };
    return () => {
      delete w.tpwlCurrencyChange;
    };
  }, []);

  return null;
}
