import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.originfacts.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ['AhrefsSiteAudit', 'AhrefsBot', 'SEBot-WA', 'SE Ranking', 'SE Ranking bot'],
        allow: '/',
        disallow: ['/cdn-cgi/', '/go'],
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/cdn-cgi/', '/go'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
