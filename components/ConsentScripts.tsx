'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { applyConsentMode, useConsent } from '@/lib/consent';

/**
 * Every optional third-party script on the site, each loaded only once the
 * visitor has granted its cookie category (see lib/consent.ts). Nothing here is
 * in the server HTML: consent is read on the client, so a visitor who has not
 * decided, or who rejected, gets none of these requests. Granting a category
 * mid-session renders the matching scripts straight away, without a reload;
 * withdrawing one reloads the page (lib/consent.ts saveConsent).
 *
 * Category map:
 *   analytics → Google Tag Manager (GTM-T7MWHNST), Google Analytics 4
 *               (G-TY066MKR0Z), Ahrefs Web Analytics
 *   marketing → Travelpayouts Drive (tp-em.com, account 401311), Takeads
 *               Convertlink, GetYourGuide partner widget script
 *               (the banner's "Advertising / Personalisation" category)
 *
 * Not here, on purpose: the Travelpayouts white-label flight search
 * (components/TpwlLoader.tsx) is the search tool on /flight-search itself,
 * and plain affiliate links (/go redirects) are not scripts.
 */
export default function ConsentScripts({ takeadsPlatformId }: { takeadsPlatformId?: string }) {
  const consent = useConsent();
  const analytics = consent?.categories.analytics === true;
  const marketing = consent?.categories.marketing === true;

  // Keep Consent Mode in step with the stored choice (the layout's
  // consent-default block starts everything at denied).
  useEffect(() => {
    if (consent) applyConsentMode(consent.categories);
  }, [consent]);

  // Child effects run before this component's own, so the GTM snippet carries
  // its own consent update to be sure it precedes the gtm.js event.
  const consentUpdate = consent
    ? `window.gtag&&window.gtag('consent','update',${JSON.stringify({
        ad_storage: marketing ? 'granted' : 'denied',
        ad_user_data: marketing ? 'granted' : 'denied',
        ad_personalization: marketing ? 'granted' : 'denied',
        analytics_storage: analytics ? 'granted' : 'denied',
      })});`
    : '';

  return (
    <>
      {analytics && (
        <>
          {/* Google Tag Manager */}
          <Script id="gtm" strategy="afterInteractive">{`${consentUpdate}
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-T7MWHNST');`}</Script>
          {/* Google Analytics 4 */}
          <Script
            id="ga4-loader"
            strategy="afterInteractive"
            src="https://www.googletagmanager.com/gtag/js?id=G-TY066MKR0Z"
          />
          <Script id="ga4-init" strategy="afterInteractive">{`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-TY066MKR0Z');`}</Script>
          {/* Ahrefs Web Analytics */}
          <Script
            id="ahrefs-analytics"
            strategy="afterInteractive"
            src="https://analytics.ahrefs.com/analytics.js"
            data-key="KbPcf3YVlIhEJPDxFrNztQ"
          />
        </>
      )}
      {marketing && (
        <>
          {/* Travelpayouts Drive (account 401311) */}
          <Script
            id="tp-drive"
            strategy="afterInteractive"
            src="https://tp-em.com/NDAxMzEx.js?t=401311"
            data-cmp-ab="2"
          />
          {/* GetYourGuide partner script: renders the activity widgets on destination pages */}
          <Script
            id="gyg-widget"
            strategy="afterInteractive"
            src="https://widget.getyourguide.com/dist/pa.umd.production.min.js"
            data-gyg-partner-id="H8Y3KHZ"
          />
          {/* Takeads link converter (Convertlink). Loaded when idle: it was the
              largest main-thread cost on mobile (SEO audit Oct 2026). */}
          {takeadsPlatformId && (
            <Script
              id="convertlink"
              strategy="lazyOnload"
              src={`https://convertlink.com/script/${takeadsPlatformId}/bundle.js`}
            />
          )}
        </>
      )}
    </>
  );
}
