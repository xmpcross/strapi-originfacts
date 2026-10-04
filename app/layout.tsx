import type { Metadata } from 'next';
import { Figtree, Inter, Outfit, Plus_Jakarta_Sans, Urbanist } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CookieConsent from '@/components/CookieConsent';
import FixedRightBar from '@/components/FixedRightBar';
import FixedPopularNow from '@/components/FixedPopularNow';
import FixedScrollToTop from '@/components/FixedScrollToTop';
import FixedSocialFollow from '@/components/FixedSocialFollow';
import { ADSENSE_CLIENT, ADSENSE_ENABLED } from '@/lib/adsense';
import { DEFAULT_OG_IMAGE } from '@/lib/entity-seo';
import { listSidebarArticles } from '@/lib/strapi';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const urbanist = Urbanist({
  subsets: ['latin'],
  variable: '--font-urbanist',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

// Site-wide default font. Every Tailwind font-* utility resolves to this via
// the tailwind.config.ts fontFamily map.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

// Heading-only typeface. Wired into globals.css h1–h6 rule.
const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.originfacts.com'),
  title: {
    default: 'Originfacts — The facts behind every place worth visiting',
    template: '%s · Originfacts',
  },
  description:
    'The facts behind every place worth visiting — plus the latest on flights, hotels, airlines, airports and destinations.',
  // Default share image for every page that doesn't set its own (home, hubs,
  // about, contact, legal…). Pages defining their own `openGraph` replace this
  // block wholesale (Next merges per top-level key), so those routes fall back
  // to DEFAULT_OG_IMAGE explicitly where their entity has no image.
  openGraph: {
    type: 'website',
    siteName: 'Originfacts',
    locale: 'en_US',
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Originfacts — The facts behind every place worth visiting',
      },
    ],
  },
  twitter: { card: 'summary_large_image', images: [DEFAULT_OG_IMAGE] },
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': [{ url: '/feed.xml', title: 'Originfacts RSS' }],
    },
  },
  other: {
    // Affiliate network site verification. Unlike the Impact tag below, these
    // are plain name/content pairs, so they go through the metadata API rather
    // than being hand-written into the body.
    'mitgo-verification': 'c35b4b6a-ddfe-4741-ab3e-2c1b7538a949',
    'Takeads-verification': 'd5d48ab4-be05-4198-bb51-e1492a80937c',
    'verify-admitad': 'f0703eb480',
    'ahrefs-site-verification': '9f39dc9055559be529e3fa6460b115fc2cbbed0f424148902c26a1170c54f046',
    ...(ADSENSE_ENABLED ? { 'google-adsense-account': ADSENSE_CLIENT } : {}),
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sidebar = await listSidebarArticles(7).catch(() => ({ recent: [], popular: [] }));

  return (
    <html lang="en" className={`${inter.variable} ${urbanist.variable} ${jakarta.variable} ${figtree.variable}`}>
      <head>
        {/* Impact.com site verification (second tag). Written verbatim with `value`,
            as Impact provides it; the metadata API would rewrite `value` to `content`. */}
        <meta {...({ name: 'impact-site-verification', value: '766261aa-958f-4a83-998f-3674e1686da0' } as Record<string, string>)} />
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-T7MWHNST');`,
          }}
        />
        {/* End Google Tag Manager */}
        <script
          {...({ nowprocket: '', 'nitro-exclude': '' } as Record<string, string>)}
          type="text/javascript"
          id="sa-dynamic-optimization"
          data-uuid="5dd6702c-eaa5-420e-a784-a4685d29cc71"
          src="https://dashboard.searchatlas.com/scripts/dynamic_optimization.js"
          async
        />
        <script
          async
          defer
          src="https://widget.getyourguide.com/dist/pa.umd.production.min.js"
          data-gyg-partner-id="H8Y3KHZ"
        />
        {/* Ahrefs Web Analytics */}
        <script src="https://analytics.ahrefs.com/analytics.js" data-key="KbPcf3YVlIhEJPDxFrNztQ" async />
      </head>
      <body className={`${inter.variable} ${urbanist.variable} ${outfit.variable} ${jakarta.variable} ${figtree.variable} min-h-screen flex flex-col font-sans font-normal grain`} data-testid="app-shell">
        {/* Impact.com site verification — raw tag (React 19 hoists it into <head>).
            Kept as the verbatim <meta name=… value=…> Impact provides; not routed
            through Next's metadata API, which would rewrite `value` to `content`. */}
        <meta {...({ name: 'impact-site-verification', value: '3604ebda-47ea-4c1a-ad1e-8d7976f411ce' } as Record<string, string>)} />
        <Script id="consent-default" strategy="beforeInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            wait_for_update: 500
          });
        `}</Script>
        {/* Google Analytics 4 — gtag.js loader + init for G-TY066MKR0Z. The
            consent-default block above runs first and keeps analytics_storage
            denied until the cookie banner grants consent, so this tag is
            GDPR-friendly out of the box. */}
        <Script
          id="ga4-loader"
          async
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-TY066MKR0Z"
        />
        <Script id="ga4-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-TY066MKR0Z');
        `}</Script>
        {/* AdSense loader — plain <script async>; React 19 hoists it into <head>
            so it sits exactly as the AdSense snippet expects. */}
        {ADSENSE_ENABLED && (
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
        {/* Travelpayouts white-label SDK is loaded by <TpwlLoader /> on the
            flight-search page itself (the only page with tpwl containers) so
            it re-initialises on client-side navigation — see
            components/TpwlLoader.tsx. */}
        <Header />
        <main className="flex-1">{children}</main>
        <FixedPopularNow articles={sidebar.popular} />
        <FixedRightBar popularPosts={sidebar.popular} />
        <FixedScrollToTop />
        <FixedSocialFollow />
        <Footer />
        <CookieConsent />
        <script src="https://convertlink.com/script/7295bcfa-4dc7-4794-8b6c-4434f5945457/bundle.js" />
      </body>
    </html>
  );
}
