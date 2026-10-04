import Link from 'next/link';
import Image from 'next/image';
import { SECTIONS } from '@/lib/sections';
import { getLegalDoc } from '@/lib/legal';

const BOTTOM_BAR_SLUGS = ['privacy', 'terms', 'cookies', 'affiliate-disclosure'];

export default function Footer() {
  const year = new Date().getFullYear();
  const bottomLegal = BOTTOM_BAR_SLUGS
    .map((slug) => getLegalDoc(slug))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  return (
    <footer className="mt-24 border-t border-primary-emphasis/10 bg-forest-950 text-white" data-testid="site-footer">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-[50fr_20fr_20fr_10fr]">
        <div>
          <Link href="/" aria-label="Originfacts home" className="inline-block" data-testid="footer-logo-link">
            <Image
              src="/footer-logo.svg"
              alt="Originfacts"
              width={300}
              height={167}
              className="h-10 w-auto !rounded-none"
            />
          </Link>
          <p className="mt-3 max-w-sm text-white/75">
            The facts behind every place worth visiting — plus the latest on flights, hotels, airlines, airports and destinations.
          </p>
          <ul className="mt-5 flex items-center gap-3" data-testid="footer-social">
            <li>
              <a
                href="https://x.com/realoriginfacts"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Originfacts on X"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-secondary-emphasis hover:text-secondary-emphasis"
                data-testid="footer-social-x"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.967 6.817H1.677l7.73-8.835L1.255 2.25h6.83l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </li>
            <li>
              <a
                href="https://www.facebook.com/originfacts/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Originfacts on Facebook"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-secondary-emphasis hover:text-secondary-emphasis"
                data-testid="footer-social-facebook"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M22 12.06C22 6.48 17.52 2 11.94 2 6.36 2 1.88 6.48 1.88 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.78v-2.91h2.54V9.84c0-2.51 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46H15.1c-1.24 0-1.62.77-1.62 1.56v1.87h2.76l-.44 2.91h-2.32V22c4.78-.76 8.52-4.92 8.52-9.94z" />
                </svg>
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/company/143027896/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Originfacts on LinkedIn"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-secondary-emphasis hover:text-secondary-emphasis"
                data-testid="footer-social-linkedin"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.8 0 0 .78 0 1.75v20.5C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.75V1.75C24 .78 23.2 0 22.22 0z" />
                </svg>
              </a>
            </li>
            <li>
              <a
                href="https://www.reddit.com/r/Originfacts/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Originfacts on Reddit"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-secondary-emphasis hover:text-secondary-emphasis"
                data-testid="footer-social-reddit"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.74c.69 0 1.25.56 1.25 1.25a1.25 1.25 0 0 1-2.5.01c0-.69.56-1.26 1.25-1.26zm-5.01 1.4c2.62 0 4.99.87 6.66 2.23a1.81 1.81 0 0 1 2.4 2.75c0 .05.01.1.01.15 0 2.68-3.15 4.85-7.06 4.85s-7.06-2.17-7.06-4.85c0-.05 0-.1.01-.15a1.81 1.81 0 0 1 2.4-2.75C7.02 7.01 9.39 6.14 12 6.14zm-3.8 4.15a1.25 1.25 0 0 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm7.6 0a1.25 1.25 0 0 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm-3.8 4.66c-1 0-1.98.11-2.85.35-.25.07-.4.32-.33.57.06.2.24.34.45.34l.12-.02c.77-.21 1.65-.32 2.54-.32.89 0 1.77.11 2.54.32l.12.02c.21 0 .39-.14.45-.34a.46.46 0 0 0-.33-.57c-.87-.24-1.85-.35-2.85-.35z" />
                </svg>
              </a>
            </li>
            <li>
              <a
                href="/feed.xml"
                aria-label="Originfacts RSS feed"
                title="RSS feed"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-secondary-emphasis hover:text-secondary-emphasis"
                data-testid="footer-social-rss"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M4.252 11.105a8.643 8.643 0 0 1 8.643 8.643h-2.882a5.761 5.761 0 0 0-5.761-5.761zM4.252 5.343A14.404 14.404 0 0 1 18.657 19.748h-2.882A11.523 11.523 0 0 0 4.252 8.225zM6.413 16.146a2.16 2.16 0 1 1-4.321 0 2.16 2.16 0 0 1 4.321 0z" />
                </svg>
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="editorial-h text-lg capitalize tracking-normal text-secondary-emphasis">Company</h4>
          <ul className="mt-3 space-y-2 text-sm text-white/80" data-testid="footer-company">
            <li><Link href="/" className="hover:text-secondary">Home</Link></li>
            <li><Link href="/about" className="hover:text-secondary">About</Link></li>
            <li><Link href="/articles" className="hover:text-secondary">Blog</Link></li>
            <li><Link href="/sitemap" className="hover:text-secondary">Site Map</Link></li>
            <li><Link href="/contact" className="hover:text-secondary">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="editorial-h text-lg capitalize tracking-normal text-secondary-emphasis">Discover</h4>
          <ul className="mt-3 space-y-2 text-sm text-white/80" data-testid="footer-travel-index">
            <li><Link href="/flight-search" className="hover:text-secondary">Flight Search</Link></li>
            <li><Link href="/category/hotels" className="hover:text-secondary">Hotels</Link></li>
            <li><Link href="/countries" className="hover:text-secondary">Countries</Link></li>
            <li><Link href="/airlines" className="hover:text-secondary">Airlines</Link></li>
            <li><Link href="/airports" className="hover:text-secondary">Airports</Link></li>
            <li><Link href="/flight-routes" className="hover:text-secondary">Flight Routes</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="editorial-h text-lg capitalize tracking-normal text-secondary-emphasis">Topics</h4>
          <ul className="mt-3 space-y-2 text-sm text-white/80" data-testid="footer-topics">
            {SECTIONS.map((section) => (
              <li key={section.slug}>
                <Link href={`/category/${section.slug}`} className="hover:text-secondary">
                  {section.title}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/hot-posts" className="hover:text-secondary">
                Trending
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <div>
            © {year} Originfacts. All rights reserved.
          </div>
          <nav aria-label="Legal" data-testid="footer-bottom-legal">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {bottomLegal.map((doc) => (
                <li key={doc.slug}>
                  <Link href={`/legal/${doc.slug}`} className="hover:text-secondary">
                    {doc.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
