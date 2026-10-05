import Link from 'next/link';
import Image from 'next/image';
import { SECTIONS } from '@/lib/sections';
import { getLegalDoc } from '@/lib/legal';
import { CookieSettingsButton } from '@/components/CookieConsent';

const BOTTOM_BAR_SLUGS = ['privacy', 'terms', 'cookies', 'affiliate-disclosure'];

const SOCIAL = [
  {
    id: 'x',
    label: 'Originfacts on X',
    href: 'https://x.com/realoriginfacts',
    path:
      'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.967 6.817H1.677l7.73-8.835L1.255 2.25h6.83l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  {
    id: 'facebook',
    label: 'Originfacts on Facebook',
    href: 'https://www.facebook.com/originfacts/',
    path:
      'M22 12.06C22 6.48 17.52 2 11.94 2 6.36 2 1.88 6.48 1.88 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.78v-2.91h2.54V9.84c0-2.51 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46H15.1c-1.24 0-1.62.77-1.62 1.56v1.87h2.76l-.44 2.91h-2.32V22c4.78-.76 8.52-4.92 8.52-9.94z',
  },
  {
    id: 'linkedin',
    label: 'Originfacts on LinkedIn',
    href: 'https://www.linkedin.com/company/143027896/',
    path:
      'M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.8 0 0 .78 0 1.75v20.5C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.75V1.75C24 .78 23.2 0 22.22 0z',
  },
  {
    id: 'instagram',
    label: 'Originfacts on Instagram',
    href: 'https://www.instagram.com/originfacts/',
    path:
      'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
  },
  {
    id: 'reddit',
    label: 'Originfacts on Reddit',
    href: 'https://www.reddit.com/r/Originfacts/',
    path:
      'M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.74c.69 0 1.25.56 1.25 1.25a1.25 1.25 0 0 1-2.5.01c0-.69.56-1.26 1.25-1.26zm-5.01 1.4c2.62 0 4.99.87 6.66 2.23a1.81 1.81 0 0 1 2.4 2.75c0 .05.01.1.01.15 0 2.68-3.15 4.85-7.06 4.85s-7.06-2.17-7.06-4.85c0-.05 0-.1.01-.15a1.81 1.81 0 0 1 2.4-2.75C7.02 7.01 9.39 6.14 12 6.14zm-3.8 4.15a1.25 1.25 0 0 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm7.6 0a1.25 1.25 0 0 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm-3.8 4.66c-1 0-1.98.11-2.85.35-.25.07-.4.32-.33.57.06.2.24.34.45.34l.12-.02c.77-.21 1.65-.32 2.54-.32.89 0 1.77.11 2.54.32l.12.02c.21 0 .39-.14.45-.34a.46.46 0 0 0-.33-.57c-.87-.24-1.85-.35-2.85-.35z',
  },
] as const;

const RSS_PATH =
  'M4.252 11.105a8.643 8.643 0 0 1 8.643 8.643h-2.882a5.761 5.761 0 0 0-5.761-5.761zM4.252 5.343A14.404 14.404 0 0 1 18.657 19.748h-2.882A11.523 11.523 0 0 0 4.252 8.225zM6.413 16.146a2.16 2.16 0 1 1-4.321 0 2.16 2.16 0 0 1 4.321 0z';

const COMPANY_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/authors', label: 'Authors' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/all-articles', label: 'Topics' },
  { href: '/sitemap', label: 'Site Map' },
  { href: '/contact', label: 'Contact' },
];

const DISCOVER_LINKS = [
  { href: '/flight-search', label: 'Flight Search' },
  { href: '/category/hotels', label: 'Hotels' },
  { href: '/countries', label: 'Countries' },
  { href: '/airlines', label: 'Airlines' },
  { href: '/airports', label: 'Airports' },
  { href: '/flight-routes', label: 'Flight Routes' },
];

const socialButton =
  'inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white transition hover:border-sand-300 hover:bg-sand-300 hover:text-forest-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand-300';
const linkClass =
  'text-white/75 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand-300';
const headingClass = 'text-xs font-bold uppercase tracking-widest text-sand-300';

export default function Footer() {
  const year = new Date().getFullYear();
  const bottomLegal = BOTTOM_BAR_SLUGS
    .map((slug) => getLegalDoc(slug))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  return (
    <footer className="bg-forest-950 text-white" data-testid="site-footer">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 min-[1176px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] min-[1176px]:gap-14 min-[1176px]:px-6 min-[1176px]:py-20">
        <div>
          <Link href="/" aria-label="Originfacts home" className="inline-block" data-testid="footer-logo-link">
            <Image
              src="/brand/logo/logo-footer.svg"
              alt="Originfacts"
              width={342}
              height={188}
              className="h-12 w-auto !rounded-none"
            />
          </Link>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/75">
            The facts behind every place worth visiting — plus the latest on flights, hotels, airlines, airports and destinations.
          </p>
          <ul className="mt-6 flex flex-wrap items-center gap-3" data-testid="footer-social">
            {SOCIAL.map((s) => (
              <li key={s.id}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className={socialButton}
                  data-testid={`footer-social-${s.id}`}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path d={s.path} />
                  </svg>
                </a>
              </li>
            ))}
            <li>
              <a
                href="/feed.xml"
                aria-label="Originfacts RSS feed"
                title="RSS feed"
                className={socialButton}
                data-testid="footer-social-rss"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d={RSS_PATH} />
                </svg>
              </a>
            </li>
          </ul>

          <h4 className={`${headingClass} mt-10`}>Topics</h4>
          <ul className="mt-4 flex flex-wrap gap-2" data-testid="footer-topics">
            {SECTIONS.map((section) => (
              <li key={section.slug}>
                <Link
                  href={`/category/${section.slug}`}
                  className="inline-flex h-9 items-center rounded-full border border-white/20 px-4 text-sm font-medium text-white transition hover:border-sand-300 hover:bg-sand-300 hover:text-forest-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand-300"
                >
                  {section.title}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/hot-posts"
                className="inline-flex h-9 items-center rounded-full border border-sand-300/60 px-4 text-sm font-medium text-sand-300 transition hover:bg-sand-300 hover:text-forest-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand-300"
              >
                Trending
              </Link>
            </li>
          </ul>
        </div>
        <nav aria-label="Company">
          <h4 className={headingClass}>Company</h4>
          <ul className="mt-5 space-y-3 text-base" data-testid="footer-company">
            {COMPANY_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Discover">
          <h4 className={headingClass}>Discover</h4>
          <ul className="mt-5 space-y-3 text-base" data-testid="footer-travel-index">
            {DISCOVER_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-6 text-xs text-white/60 min-[1176px]:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div>© {year} Originfacts. All rights reserved.</div>
          <nav aria-label="Legal" data-testid="footer-bottom-legal">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {bottomLegal.map((doc) => (
                <li key={doc.slug}>
                  <Link href={`/legal/${doc.slug}`} className="transition-colors hover:text-white">
                    {doc.title}
                  </Link>
                </li>
              ))}
              <li>
                <CookieSettingsButton className="transition-colors hover:text-white" />
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
