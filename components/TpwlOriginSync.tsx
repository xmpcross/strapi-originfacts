'use client';

import { useEffect } from 'react';
import { setVisitorOrigin } from '@/lib/visitor-origin';

/**
 * Keeps the "Popular flight searches" and "cheap flights by destination" sections
 * on /flight-search in step with the From city of the search form at the top.
 *
 * The form is the Travelpayouts widget, rendered in Shadow DOM. It prefills From
 * from the visitor's IP (in the visitor's own browser, so it sees their real
 * address) and shows the chosen airport code in a hint next to the field. This
 * reads that hint and, whenever the code changes, hands the new origin to the
 * visitor-origin store (setVisitorOrigin), which the two sections subscribe to.
 *
 * Only a changed airport code counts: while someone is typing, the hint still
 * shows the previous code, so a half-typed "Lond" never reaches the sections.
 */
const ORIGIN_INPUT = 'input[data-testid="default-search-origin-input"]';
const HINT = '[data-testid^="place-picker-value-hint-"]';

function readOrigin(root: ShadowRoot): { iata: string; input: HTMLInputElement } | null {
  const input = root.querySelector<HTMLInputElement>(ORIGIN_INPUT);
  const hint = input?.parentElement?.querySelector<HTMLElement>(HINT);
  if (!input || !hint) return null;
  const code = (hint.textContent ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? { iata: code, input } : null;
}

export default function TpwlOriginSync({ containerId = 'tpwl-search' }: { containerId?: string }) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    let lastIata = '';
    let settle: number | undefined;

    const sync = () => {
      const root = container.shadowRoot;
      const found = root ? readOrigin(root) : null;
      if (!found || found.iata === lastIata) return;
      lastIata = found.iata;
      // The field text ("London, United Kingdom") lands a moment after the hint.
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        const city = found.input.value.split(',')[0].trim();
        if (city) setVisitorOrigin({ iata: found.iata, name: city });
      }, 250);
    };

    sync();
    const observer = new MutationObserver(sync);
    const watch = () => {
      if (container.shadowRoot) observer.observe(container.shadowRoot, { childList: true, subtree: true, characterData: true, attributes: true });
    };
    watch();
    // The shadow root may not exist yet on first run, and input values are not observable.
    const timer = window.setInterval(() => {
      watch();
      sync();
    }, 700);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      window.clearTimeout(settle);
    };
  }, [containerId]);

  return null;
}
