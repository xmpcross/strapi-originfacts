'use client';

import type { ReactNode } from 'react';
import { grantMarketingConsent, useConsent } from '@/lib/consent';

/**
 * Consent gate for the Travelpayouts / Aviasales search tools (white-label
 * flight search, price calendar, schedule, car search).
 *
 * Measured with Playwright (Oct 2026): as soon as they load, these widgets set
 * Snowplow cookies on .originfacts.com (_sp_id.*, _sp_ses.*), tpwl_currency /
 * tpwl_locale, a `nuid` cookie on avsplow.com, Snowplow queues in localStorage,
 * and send our marker (shmarker 314807, trs 401311) to tpscr.com. So they belong
 * to the "Advertising / Personalisation" category, like GetYourGuide.
 *
 * Until that category is granted this renders a placeholder in the same box
 * (callers pass the widget's min-heights, so nothing shifts when it swaps); the
 * button grants the category and the widget mounts straight away. During SSR and
 * hydration consent is unknown, so the placeholder is always what the server
 * HTML contains.
 */
export function TpConsentPlaceholder({
  tool,
  partnerHref,
  className = '',
  id,
}: {
  /** Lower-case name used in the button, e.g. "flight search". */
  tool: string;
  /** Plain link that works without the widget (optional). */
  partnerHref?: string;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      data-testid="tp-consent-placeholder"
      className={`flex flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-forest-900/20 bg-white/80 px-4 py-4 text-center text-sm text-forest-900/75 ${className}`}
    >
      <p className="max-w-xl">
        This {tool} is provided by our partner Travelpayouts (Aviasales) and sets cookies.
      </p>
      <button
        type="button"
        onClick={grantMarketingConsent}
        className="inline-flex min-h-9 items-center rounded-full bg-primary-emphasis px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-highlight"
        data-testid="tp-consent-allow"
      >
        Load {tool} (allows advertising cookies)
      </button>
      {partnerHref && (
        <a
          href={partnerHref}
          target="_blank"
          rel="sponsored nofollow noopener"
          className="text-sm font-medium text-primary-emphasis underline underline-offset-2 hover:text-primary-highlight"
          data-testid="tp-consent-partner-link"
        >
          Or search on flights.originfacts.com, our partner&rsquo;s site
        </a>
      )}
    </div>
  );
}

/** Renders `children` (the widget) once advertising consent is given, otherwise the placeholder. */
export default function TpConsentGate({
  tool,
  partnerHref,
  className = '',
  children,
}: {
  tool: string;
  partnerHref?: string;
  /** Box classes, normally the widget's min-heights per breakpoint. Applied in both states. */
  className?: string;
  children: ReactNode;
}) {
  const consent = useConsent();
  if (consent?.categories.marketing) return <div className={className}>{children}</div>;
  return <TpConsentPlaceholder tool={tool} partnerHref={partnerHref} className={className} />;
}
