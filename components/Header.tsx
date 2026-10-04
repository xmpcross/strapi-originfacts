'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import MobileNav from './MobileNav';

const STICKY_THRESHOLD = 80;

export default function Header() {
  const headerRef = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
  }, []);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > STICKY_THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
    <header
      ref={headerRef}
      className={`z-50 border-b border-forest-900/10 bg-white/90 backdrop-blur transition-shadow duration-200 ${
        stuck ? 'fixed top-0 left-0 right-0 shadow-md' : 'relative'
      }`}
      data-testid="site-header"
      data-stuck={stuck ? 'true' : 'false'}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-6 px-6 py-[0.8rem]">
        <Link href="/" className="block shrink-0" data-testid="logo-link" aria-label="Originfacts home">
          <Image
            src="/brand/logo/logo.svg"
            alt="Originfacts"
            width={300}
            height={167}
            priority
            className="h-[3rem] w-auto"
          />
        </Link>

        <MobileNav />

        <div className="ml-auto hidden items-center justify-end gap-2 lg:flex">
          <nav className="hidden md:block" data-testid="primary-nav">
            <ul className="flex items-center justify-end gap-4 font-sans text-[1rem] font-semibold tracking-normal">
              <li data-testid="nav-item-destinations">
                <Link
                  href="/destinations"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-[#000000] transition-colors hover:text-[rgb(1,79,211)]"
                  data-testid="nav-destinations"
                >
                  Destinations
                </Link>
              </li>
              <li data-testid="nav-item-flight-search">
                <Link
                  href="/flight-search"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-[#000000] transition-colors hover:text-[rgb(1,79,211)]"
                  data-testid="nav-resources-flight-search"
                >
                  Flight Search
                </Link>
              </li>
              <li data-testid="nav-item-airlines">
                <Link
                  href="/airlines"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-[#000000] transition-colors hover:text-[rgb(1,79,211)]"
                  data-testid="nav-airlines"
                >
                  Airlines
                </Link>
              </li>
              <li className="group/airports relative" data-testid="nav-item-airports">
                <Link
                  href="/airports"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-[#000000] transition-colors hover:text-[rgb(1,79,211)]"
                  data-testid="nav-airports-all"
                  aria-haspopup="true"
                >
                  Airports
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3 opacity-60"
                    aria-hidden
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </Link>
                <div
                  className="invisible absolute left-0 top-full z-10 pt-1 opacity-0 transition duration-150 group-hover/airports:visible group-hover/airports:opacity-100 group-focus-within/airports:visible group-focus-within/airports:opacity-100"
                  data-testid="nav-airports-submenu"
                >
                  <div
                    role="menu"
                    className="min-w-[200px] rounded-md border border-forest-900/10 bg-paper p-1 shadow-md"
                  >
                    <Link
                      href="/airports/hubs"
                      className="block rounded px-3 py-2 text-base text-[#000000] transition-colors hover:bg-forest-900/5 hover:text-[rgb(1,79,211)]"
                      role="menuitem"
                      data-testid="nav-airports-hubs"
                    >
                      Top 100 Airports
                    </Link>
                  </div>
                </div>
              </li>
              <li
                className="group/allarticles relative"
                data-testid="nav-item-articles"
              >
                <Link
                  href="/articles"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-[#000000] transition-colors hover:text-[rgb(1,79,211)]"
                  data-testid="nav-articles"
                  aria-haspopup="true"
                >
                  Blog
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3 opacity-60"
                    aria-hidden
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </Link>
                <div
                  className="invisible absolute right-0 top-full z-10 pt-1 opacity-0 transition duration-150 group-hover/allarticles:visible group-hover/allarticles:opacity-100 group-focus-within/allarticles:visible group-focus-within/allarticles:opacity-100"
                  data-testid="nav-articles-dropdown"
                >
                  <div
                    role="menu"
                    className="min-w-[220px] rounded-md border border-forest-900/10 bg-paper p-1 shadow-md"
                  >
                    <Link
                      href="/category/flights"
                      className="block rounded px-3 py-2 text-base text-[#000000] transition-colors hover:bg-forest-900/5 hover:text-[rgb(1,79,211)]"
                      role="menuitem"
                      data-testid="nav-flights"
                    >
                      Flights
                    </Link>
                    <Link
                      href="/category/hotels"
                      className="block rounded px-3 py-2 text-base text-[#000000] transition-colors hover:bg-forest-900/5 hover:text-[rgb(1,79,211)]"
                      role="menuitem"
                      data-testid="nav-hotels"
                    >
                      Hotels
                    </Link>
                    <Link
                      href="/category/car-rentals"
                      className="block rounded px-3 py-2 text-base text-[#000000] transition-colors hover:bg-forest-900/5 hover:text-[rgb(1,79,211)]"
                      role="menuitem"
                      data-testid="nav-articles-car-rentals"
                    >
                      Car Rentals
                    </Link>
                    <Link
                      href="/category/travel-tips"
                      className="block rounded px-3 py-2 text-base text-[#000000] transition-colors hover:bg-forest-900/5 hover:text-[rgb(1,79,211)]"
                      role="menuitem"
                      data-testid="nav-articles-travel-tips"
                    >
                      Travel Tips
                    </Link>
                  </div>
                </div>
              </li>
            </ul>
          </nav>

        </div>
      </div>
    </header>
    {stuck && headerHeight > 0 && (
      <div style={{ height: headerHeight }} aria-hidden data-testid="site-header-spacer" />
    )}
    </>
  );
}
