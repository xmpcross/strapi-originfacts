import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CookieConsent from '@/components/CookieConsent';
import ConsentScripts from '@/components/ConsentScripts';
import FixedRightBar from '@/components/FixedRightBar';
import FixedPopularNow from '@/components/FixedPopularNow';
import FixedScrollToTop from '@/components/FixedScrollToTop';
import TpwlFullLoadLinks from '@/components/TpwlFullLoadLinks';
import FixedSocialFollow from '@/components/FixedSocialFollow';
import { DEFAULT_OG_IMAGE } from '@/lib/entity-seo';
import { listSidebarArticles } from '@/lib/strapi';


// The only typeface on the site: body, headings and every section inherit it.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700', '800'],
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
  // No canonical here: every page inherited canonical "/" from the layout, so
  // pages without their own (e.g. /legal/*) told Google they were the homepage.
  // The homepage sets its own in app/page.tsx.
  alternates: {
    types: {
      'application/rss+xml': [{ url: '/feed.xml', title: 'Originfacts RSS' }],
    },
  },
  other: {
    // Affiliate network and SEO tool site verification.
    'mitgo-verification': 'c35b4b6a-ddfe-4741-ab3e-2c1b7538a949',
    'Takeads-verification': 'd5d48ab4-be05-4198-bb51-e1492a80937c',
    'ahrefs-site-verification': '9f39dc9055559be529e3fa6460b115fc2cbbed0f424148902c26a1170c54f046',
  },
};

// Takeads platform ID (public: it appears in the Convertlink script URL, which
// <ConsentScripts /> loads after advertising consent).
const TAKEADS_PLATFORM_ID = (process.env.TAKEADS_PLATFORM_ID ?? '').trim();

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sidebar = await listSidebarArticles(7).catch(() => ({ recent: [], popular: [] }));

  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Optional third-party scripts (GTM, GA4, Ahrefs, Travelpayouts Drive,
            GetYourGuide, Convertlink) load only after cookie consent: see
            components/ConsentScripts.tsx. */}
      </head>
      <body className={`${inter.variable} min-h-screen flex flex-col font-sans font-normal grain`} data-testid="app-shell">
        {/* Google Consent Mode v2 defaults. Loads nothing by itself; the Google
            tags are only added by <ConsentScripts /> once analytics is granted. */}
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
        {/* Travelpayouts white-label SDK is loaded by <TpwlLoader /> on the
            flight-search page itself (the only page with tpwl containers),
            only after advertising consent — see components/TpwlLoader.tsx. */}
        <Header />
        <main className="flex-1">{children}</main>
        <FixedPopularNow articles={sidebar.popular} />
        <FixedRightBar popularPosts={sidebar.popular} />
        <FixedScrollToTop />
        <TpwlFullLoadLinks />
        <FixedSocialFollow />
        <Footer />
        <CookieConsent />
        <ConsentScripts takeadsPlatformId={TAKEADS_PLATFORM_ID || undefined} />
      </body>
    </html>
  );
}
