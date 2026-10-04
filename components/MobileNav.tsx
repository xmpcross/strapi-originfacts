'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

type NavItem = { label: string; href?: string; children?: NavItem[] };

const NAV_TREE: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Destinations', href: '/destinations' },
  { label: 'Flight Search', href: '/flight-search' },
  { label: 'Airlines', href: '/airlines' },
  {
    label: 'Airports',
    href: '/airports',
    children: [{ label: 'Top 100 Airports', href: '/airports/hubs' }],
  },
  {
    label: 'Blog',
    href: '/all-articles',
    children: [
      { label: 'Flights', href: '/category/flights' },
      { label: 'Hotels', href: '/hotels' },
      { label: 'Car Rentals', href: '/category/car-rentals' },
      { label: 'Travel Tips', href: '/category/travel-tips' },
    ],
  },
  { label: 'Trending', href: '/hot-posts' },
  { label: 'Search', href: '/search' },
  { label: 'Contact', href: '/contact' },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portal target only available client-side after hydration.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        data-testid="mobile-nav-trigger"
        className="ml-auto inline-flex h-10 w-10 items-center justify-center text-forest-950 lg:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
          aria-hidden
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && mounted &&
        createPortal(
          <MobileNavDrawer onClose={() => setOpen(false)} />,
          document.body,
        )}
    </>
  );
}

function MobileNavDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[#ffffff] lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation"
      data-testid="mobile-nav-drawer"
    >
      <div className="flex items-center justify-between border-b border-forest-900/10 px-6 py-3">
        <span className="font-urbanist text-base font-bold uppercase tracking-wider text-forest-950">
          Menu
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="flex h-10 w-10 items-center justify-center rounded-full text-forest-900 transition hover:bg-forest-900/5"
          data-testid="mobile-nav-close"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <nav
        aria-label="Mobile menu"
        className="flex-1 overflow-y-auto px-6 py-6"
        data-testid="mobile-nav-list"
      >
        <ul className="flex flex-col gap-1">
          {NAV_TREE.map((item) => (
            <MobileNavItem key={item.label} item={item} onClose={onClose} />
          ))}
        </ul>
      </nav>
    </div>
  );
}

function MobileNavItem({
  item,
  onClose,
  level = 0,
}: {
  item: NavItem;
  onClose: () => void;
  level?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = !!item.children && item.children.length > 0;

  const sizeClass =
    level === 0
      ? 'text-xl sm:text-2xl'
      : level === 1
        ? 'text-lg sm:text-xl'
        : 'text-base sm:text-lg';

  return (
    <li>
      <div className="flex items-center gap-3 border-b border-forest-900/10 py-3">
        {item.href ? (
          <Link
            href={item.href}
            onClick={onClose}
            className={`font-urbanist ${sizeClass} flex-1 font-bold capitalize leading-none tracking-tight text-forest-950 transition hover:text-primary-emphasis`}
          >
            <span className="inline-flex items-baseline gap-2">
              {item.label}
              <span aria-hidden className="text-primary-emphasis">//</span>
            </span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => hasChildren && setExpanded((v) => !v)}
            className={`font-urbanist ${sizeClass} flex-1 text-left font-bold capitalize leading-none tracking-tight text-forest-950`}
          >
            <span className="inline-flex items-baseline gap-2">
              {item.label}
              <span aria-hidden className="text-primary-emphasis">//</span>
            </span>
          </button>
        )}

        {hasChildren && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
            className="flex h-8 w-8 items-center justify-center text-forest-900/60 transition hover:text-forest-950"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-5 w-5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>

      {hasChildren && expanded && (
        <ul
          className="flex flex-col gap-1 pl-5"
          data-testid={`mobile-submenu-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {item.children!.map((child) => (
            <MobileNavItem
              key={child.label}
              item={child}
              onClose={onClose}
              level={level + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
