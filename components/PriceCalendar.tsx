'use client';

import { useEffect, useRef } from 'react';
import { useCurrency } from './useCurrency';

/**
 * TravelPayouts "Price Calendar" widget (tpscr.com).
 *
 * Pre-populated with origin/destination IATA codes when provided — the widget
 * reads `origin_iata` / `destination_iata` from its script URL and pre-fills
 * the form. Clicks on the calendar push users to `searchUrl` (our WL).
 *
 * The widget is a third-party script that injects its own DOM into the
 * container. We append the script on mount and clear the container on
 * route change so it re-initializes with new origin/destination.
 */
export default function PriceCalendar({
  origin,
  destination,
}: {
  origin?: string;
  destination?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { currency, ready } = useCurrency();

  useEffect(() => {
    // Wait for the display currency so the widget loads once, in that currency.
    if (!ready || !containerRef.current) return;
    const container = containerRef.current;

    const params = new URLSearchParams({
      currency: currency.toLowerCase(),
      trs: '401311',
      shmarker: '314807',
      // Travelpayouts white-label host (registered WL domain for marker
      // 314807). Must be flights.originfacts.com — pointing the marker
      // redirect at www.originfacts.com makes tpscr.com/r return Forbidden.
      searchUrl: 'flights.originfacts.com/flights',
      locale: 'en',
      powered_by: 'false',
      one_way: 'false',
      only_direct: 'false',
      period: 'year',
      range: '7,14',
      primary: '#014fd3',
      color_background: '#f0f2f4',
      dark: '#07142b',
      light: '#FFFFFF',
      achieve: '#03721e',
      promo_id: '4041',
      campaign_id: '100',
    });
    // TP widgets pre-fill via various param names depending on template.
    // Pass all common variants — widgets ignore unknown params.
    if (origin) {
      const o = origin.toUpperCase();
      params.set('origin', o);
      params.set('origin_iata', o);
      params.set('origin_code', o);
    }
    if (destination) {
      const d = destination.toUpperCase();
      params.set('destination', d);
      params.set('destination_iata', d);
      params.set('destination_code', d);
    }

    const script = document.createElement('script');
    script.async = true;
    script.charset = 'utf-8';
    script.src = `https://tpscr.com/content?${params.toString()}`;
    container.appendChild(script);

    // Widget renders into a Shadow DOM (<tp-cascoon>…<template shadowrootmode="open">),
    // so external stylesheets don't apply. Inject our font overrides into the shadow root
    // as it appears. CSS custom properties (--font-inter) inherit through
    // the shadow boundary, so we can reference the site's Next/font variables.
    const FONT_CSS = `
      :host, :host *:not(svg):not(svg *) {
        font-family: var(--font-inter), 'Inter', system-ui, sans-serif !important;
      }
      :host h1, :host h2, :host h3, :host h4, :host h5, :host h6,
      :host .calendar_info_direction,
      :host .year-cell__label,
      :host .year-cell__value {
        letter-spacing: -0.01em;
      }
      .root .calendar-layout--border,
      :host .root .calendar-layout--border {
        border: 0 !important;
      }
      .cascoon--l .root .calendar-content,
      .cascoon--m .root .calendar-content {
        padding: 0 20px 0 !important;
      }
      .cascoon--l .root .calendar-layout--gapped .calendar-content,
      .cascoon--m .root .calendar-layout--gapped .calendar-content {
        padding-top: 20px !important;
      }
      .root .calendar-wrapper .calendar-header {
        /* --primary-light isn't a site-wide var yet; fallback to a light
           tint of the brand blue so the header still picks up a visible
           background. Override --primary-light on the page or :host to
           customise. */
        background-color: var(--primary-light, #e6effd) !important;
        padding: 12px 20px !important;
      }
    `;

    const injected = new WeakSet<ShadowRoot>();
    const inject = () => {
      container.querySelectorAll<HTMLElement>('tp-cascoon, [id^="tp-cascoon-component"]').forEach((host) => {
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
  }, [origin, destination, currency, ready]);

  return <div ref={containerRef} className="tp-price-calendar" data-testid="price-calendar" />;
}
