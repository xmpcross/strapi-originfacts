import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.originfacts.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ['AhrefsSiteAudit', 'AhrefsBot', 'SEBot-WA', 'SE Ranking', 'SE Ranking bot'],
        allow: '/',
        disallow: ['/cdn-cgi/'],
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/cdn-cgi/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
