'use client';

import { useEffect, useRef } from 'react';

/**
 * TravelPayouts "Schedule" widget (tpscr.com).
 *
 * Displays the published schedule for a specific origin → destination route.
 * Origin and destination IATA codes are taken from the props so the same
 * component can be mounted on any /flight-routes/<slug> page without
 * hard-coding airports. Optional `airline` filters the schedule to a
 * single carrier IATA.
 *
 * Mirrors the PriceCalendar pattern: append a script into a container on
 * mount, clear on unmount/route change, inject font CSS into the widget's
 * Shadow DOM so it inherits the site typography.
 */
export default function ScheduleWidget({
  origin,
  destination,
  airline,
}: {
  origin: string;
  destination: string;
  airline?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const params = new URLSearchParams({
      currency: 'usd',
      trs: '401311',
      shmarker: '314807',
      color_button: '#FF0000',
      target_host: 'flights.originfacts.com/flights',
      locale: 'en',
      powered_by: 'false',
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      with_fallback: 'false',
      non_direct_flights: 'true',
      min_lines: '10',
      border_radius: '0',
      color_background: '#FFFFFF',
      color_text: '#000000',
      color_border: '#FFFFFF',
      promo_id: '2811',
      campaign_id: '100',
    });
    if (airline) params.set('airline', airline.toUpperCase());

    const script = document.createElement('script');
    script.async = true;
    script.charset = 'utf-8';
    script.src = `https://tpscr.com/content?${params.toString()}`;
    container.appendChild(script);

    // Same Shadow-DOM font injection trick used by PriceCalendar — TP widgets
    // render into <tp-cascoon>'s shadow root, so external stylesheets don't
    // apply. CSS custom properties inherit through the shadow boundary, so
    // referencing the site's Next/font variables works.
    const FONT_CSS = `
      :host, :host *:not(svg):not(svg *) {
        font-family: var(--font-outfit), 'Outfit', system-ui, sans-serif !important;
      }
    `;
    const injected = new WeakSet<ShadowRoot>();
    const inject = () => {
      container
        .querySelectorAll<HTMLElement>('tp-cascoon, [id^="tp-cascoon-component"]')
        .forEach((host) => {
          const root = host.shadowRoot;
          if (!root || injected.has(root)) return;
          const style = document.createElement('style');
          style.setAttribute('data-site-font', '');
          style.textContent = FONT_CSS;
          root.appendChild(style);
          injected.add(root);
        });
    };
    inject();
    const observer = new MutationObserver(inject);
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      container.innerHTML = '';
    };
  }, [origin, destination, airline]);

  return <div ref={containerRef} className="tp-schedule" data-testid="schedule-widget" />;
}
