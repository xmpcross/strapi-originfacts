import fs from 'node:fs';

/** @type {import('next').NextConfig} */
const strapiHost = new URL(
  process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com'
).hostname;

// Pages retired on 5 Oct 2026 (data/removed-pages.json): 51 thin airport pages,
// the 84 route pages that used one of them as an endpoint, and 72 more thin
// route pages. Their CMS
// records are deleted, so each URL gets a permanent (301) redirect to its
// directory. The bare IATA form (/airports/ams) is covered too. These sit
// before every dynamic route, so they still apply if a record is re-created.
const retired = JSON.parse(fs.readFileSync(new URL('./data/removed-pages.json', import.meta.url), 'utf8'));
const retiredRedirects = [
  ...retired.airports.flatMap(({ iata, slug }) => [
    { source: `/airports/${slug}`, destination: '/airports', statusCode: 301 },
    { source: `/airports/${iata.toLowerCase()}`, destination: '/airports', statusCode: 301 },
  ]),
  ...retired.routes.map((slug) => ({ source: `/flight-routes/${slug}`, destination: '/flight-routes', statusCode: 301 })),
];

const nextConfig = {
  reactStrictMode: true,
  // deploy-originfacts.sh builds into .next-build (NEXT_DIST_DIR) while the
  // live server keeps serving .next, then swaps the directories in. `next
  // start` runs without the variable and reads .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  allowedDevOrigins: ['preview.fxnstudio.com', '51.161.208.188'],
  // Markdown and JSON read from disk at request time. The paths are built with
  // join(process.cwd(), …) rather than written as literals, so Next's file
  // tracer cannot follow them and would leave these out of the serverless
  // bundle — the loaders catch their own errors, so the result is a green
  // build serving pages with no airline reviews and no legal text.
  outputFileTracingIncludes: {
    '/**': [
      './content/airline-facts/**',
      './content/airline-reviews/**',
      './content/legal/**',
      './content/pages/**',
      './data/airline-refs/**',
      './data/airline-status/**',
      './data/route-facts/**',
    ],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: strapiHost },
      { protocol: 'https', hostname: 'cms.fxnstudio.com' },
      { protocol: 'https', hostname: 'strapi.fxnstudio.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async redirects() {
    return [
      ...retiredRedirects,
      // Canonical host: redirect bare domain (originfacts.com) to www.originfacts.com
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'originfacts.com' }],
        destination: 'https://www.originfacts.com/:path*',
        permanent: true,
      },
      // Hotels top-level route -> Category listing permanent 301
      { source: '/hotels', destination: '/category/hotels', permanent: true },
      // Travel Resources merged into Travel Tips on 2026-05-02.
      { source: '/category/travel-resources', destination: '/category/travel-tips', permanent: true },
      // /airports/hubs renamed to /airports/top-100-airports (5 Oct 2026). Next.js
      // carries the query string across on its own.
      { source: '/airports/hubs', destination: '/airports/top-100-airports', permanent: true },
      // Car Rental → Car Rentals (category renamed in Strapi, 2026-05-20).
      { source: '/category/car-rental', destination: '/category/car-rentals', permanent: true },
      // Two articles covered airport-vs-city car rentals (2026-09 AdSense
      // audit). The longer one with worked scenarios is canonical; the other
      // is hidden from every listing (HIDDEN_ARTICLE_SLUGS in lib/strapi.ts)
      // and its URL redirects here.
      {
        source: '/articles/airport-vs-city-car-rentals-which-saves-money',
        destination: '/articles/airport-vs-city-car-rentals-cheaper',
        permanent: true,
      },
      // Retired 5 Oct 2026 after a fact-check: the "2026 openings" it listed
      // were fictional, cancelled or already open. Hidden from listings via
      // HIDDEN_ARTICLE_SLUGS in lib/strapi.ts.
      {
        source: '/articles/melbourne-design-hotels-opening-2026',
        destination: '/destinations/melbourne',
        permanent: true,
      },
      // Retired hard-coded author profiles (4 Oct 2026) point at the default
      // CMS author.
      { source: '/authors/elena-rostova', destination: '/authors/k-spellman', permanent: true },
      { source: '/authors/marcus-vance', destination: '/authors/k-spellman', permanent: true },
      { source: '/authors/originfacts-team', destination: '/authors/k-spellman', permanent: true },
      // Author profiles come from the CMS since 4 Oct 2026; the hard-coded
      // founder profile is retired (the CMS describes K Spellman as founder).
      { source: '/authors/kritin-vashist', destination: '/authors/k-spellman', permanent: true },
      { source: '/authors/kritin', destination: '/authors/k-spellman', permanent: true },
      // Staging → production: bounce every /flights visit on the
      // originfacts.fxnstudio.com host over to www.originfacts.com so
      // bookings go through the production TravelPayouts affiliate config.
      // (Vercel prod doesn't match this host predicate, so the rule is a
      // no-op there.) Must precede the /flights/:slug+ rule below.
      {
        source: '/flights/:path*',
        has: [{ type: 'host', value: 'originfacts.fxnstudio.com' }],
        destination: 'https://www.originfacts.com/flights/:path*',
        permanent: false,
      },
      // Old /flights/<slug> route-detail pages → /flight-routes/<slug>. Must come before
      // the bare /flights rule so detail slugs don't try to hit the search widget.
      { source: '/flights/:slug+', destination: '/flight-routes/:slug+', permanent: true },
      // Search page renamed back to /flight-search on 2026-07-26 (it briefly
      // carried that name before). Old /flights URL 301s across.
      { source: '/flights', destination: '/flight-search', permanent: true },
      { source: '/fly', destination: '/flight-search', permanent: true },
      // TPWL whitelabel (wl_id=16677) is configured with Results Page URL pointing at
      // the bare origin, so submitting the search form lands on / with ?flightSearch=…
      // — bounce it to /flight-search where the #tpwl-tickets container lives.
      // Soft redirect (permanent:false) — the proper fix is to clear the resultsURL in
      // the TP admin so search rendering stays in-place.
      {
        source: '/',
        has: [{ type: 'query', key: 'flightSearch' }],
        destination: '/flight-search',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
