'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { mediaUrl, type StrapiArticle } from '@/lib/strapi';

// Matches FixedPopularNow: hide on destination detail pages so the country
// hero + facts panel get full width.
const HIDE_PATTERNS = [/^\/destinations\/[^/]+$/];

type BarItem = {
  label: string;
  href?: string;
  icon: 'user' | 'menu' | 'search' | 'lightning' | 'cart';
  count?: number;
  /** When set, clicking this item runs the handler instead of navigating. */
  onClickKey?: 'open-sidebar';
};

const ITEMS: BarItem[] = [
  { label: 'Contact', href: '/contact', icon: 'user' },
  { label: 'Sidebar', icon: 'menu', onClickKey: 'open-sidebar' },
  { label: 'Search', href: '/search', icon: 'search' },
  { label: 'Trending', href: '/hot-posts', icon: 'lightning' },
];

type NavItem = { label: string; href?: string; children?: NavItem[] };

// Mirrors the top-nav-bar menu so the overlay matches what's in the header.
const NAV_TREE: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Destinations', href: '/destinations' },
  { label: 'Flights', href: '/category/flights' },
  { label: 'Hotels', href: '/category/hotels' },
  {
    label: 'More Articles',
    href: '/articles',
    children: [
      { label: 'Car Rentals', href: '/category/car-rentals' },
      { label: 'Travel Tips', href: '/category/travel-tips' },
    ],
  },
  {
    label: 'Resources',
    children: [
      { label: 'Flight Search', href: '/flight-search' },
      { label: 'Airlines', href: '/airlines' },
      {
        label: 'Airports',
        href: '/airports',
        children: [{ label: 'Top 100 Airports', href: '/airports/hubs' }],
      },
    ],
  },
];

export default function FixedRightBar({
  popularPosts = [],
}: {
  popularPosts?: StrapiArticle[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hidden = pathname ? HIDE_PATTERNS.some((re) => re.test(pathname)) : false;

  // Close on Esc + lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  if (hidden) return null;

  return (
    <>
      <div
        className="pointer-events-none fixed right-[50px] top-[200px] z-40 hidden lg:block"
        data-testid="fixed-right-bar"
      >
        <ul className="pointer-events-auto flex flex-col items-center gap-[10px]">
          {ITEMS.map((item) => {
            const inner = (
              <span className="relative flex h-[60px] w-[60px] items-center justify-center rounded-full bg-white text-forest-900 shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition hover:text-primary-emphasis">
                <BarIcon name={item.icon} />
                {typeof item.count === 'number' && (
                  <span
                    className="absolute -top-1 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-secondary-emphasis text-[11px] font-bold text-forest-900"
                    aria-hidden
                  >
                    {item.count}
                  </span>
                )}
              </span>
            );
            return (
              <li key={item.label} className="group relative">
                {item.onClickKey === 'open-sidebar' ? (
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label={item.label}
                    aria-expanded={open}
                    data-testid="fixed-right-bar-sidebar-trigger"
                  >
                    {inner}
                  </button>
                ) : (
                  <Link href={item.href ?? '#'} aria-label={item.label}>
                    {inner}
                  </Link>
                )}
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-full top-1/2 mr-5 -translate-y-1/2 translate-x-2 whitespace-nowrap rounded-full bg-white px-4 py-1.5 font-urbanist text-[11px] font-bold uppercase tracking-wider text-forest-900 opacity-0 shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition group-hover:translate-x-0 group-hover:opacity-100"
                >
                  {item.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {open && <SidebarPanel popularPosts={popularPosts} onClose={close} />}
    </>
  );
}

function SidebarPanel({
  popularPosts,
  onClose,
}: {
  popularPosts: StrapiArticle[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Site navigation"
      data-testid="fixed-right-bar-sidebar"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close menu"
        className="absolute right-8 top-8 flex h-11 w-11 items-center justify-center rounded-full text-forest-900 transition hover:bg-forest-900/5"
        data-testid="fixed-right-bar-sidebar-close"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7"
          aria-hidden
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className="mx-auto flex w-full max-w-7xl items-center gap-12 px-12 py-16 lg:px-16">
        <nav
          aria-label="Sidebar navigation"
          className="flex flex-1 flex-col items-end pr-12 text-right"
        >
          <ul className="flex flex-col items-end gap-3 border-r border-forest-900/10 pr-12">
            {NAV_TREE.map((item) => (
              <SidebarNavItem key={item.label} item={item} onClose={onClose} />
            ))}
          </ul>
        </nav>

        <aside className="hidden flex-1 max-w-md lg:block" aria-label="Popular posts">
          <h2 className="flex items-center gap-3 font-urbanist text-[11px] font-bold uppercase tracking-widest text-forest-900">
            Popular
            <span aria-hidden className="h-px w-10 bg-forest-900/20" />
          </h2>
          <ul className="mt-5 divide-y divide-forest-900/10">
            {popularPosts.slice(0, 4).map((post) => (
              <li key={post.id} className="py-4 first:pt-0 last:pb-0">
                <SidebarPanelPostRow article={post} onClick={onClose} />
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function SidebarNavItem({
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
  // Font scales down per nesting level so submenus read clearly without
  // overwhelming the parent.
  const sizeClass =
    level === 0
      ? 'text-[clamp(2rem,3.5vw+0.5rem,3rem)]'
      : level === 1
        ? 'text-[clamp(1.25rem,1.2vw+0.75rem,1.75rem)]'
        : 'text-[clamp(1rem,0.8vw+0.75rem,1.4rem)]';

  return (
    <li className="w-full">
      <div className="flex items-center justify-end gap-3">
        {item.href ? (
          <Link
            href={item.href}
            onClick={onClose}
            className={`font-urbanist ${sizeClass} font-bold capitalize leading-none tracking-tight text-forest-950 transition hover:text-primary-emphasis`}
          >
            {item.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => hasChildren && setExpanded((v) => !v)}
            className={`font-urbanist ${sizeClass} font-bold capitalize leading-none tracking-tight text-forest-950 transition hover:text-primary-emphasis`}
          >
            {item.label}
          </button>
        )}
        {hasChildren && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
            className="flex h-7 w-7 items-center justify-center text-forest-900/60 transition hover:text-forest-950"
            data-testid={`sidebar-submenu-toggle-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
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
          className="mt-3 flex flex-col items-end gap-2 pr-2"
          data-testid={`sidebar-submenu-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {item.children!.map((child) => (
            <SidebarNavItem
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

function SidebarPanelPostRow({
  article,
  onClick,
}: {
  article: StrapiArticle;
  onClick: () => void;
}) {
  const img = mediaUrl(article.coverImage ?? null);
  const category = article.category?.name;
  const dateStr = article.publishedAt
    ? format(new Date(article.publishedAt), 'd MMM yyyy')
    : '';
  return (
    <Link
      href={`/articles/${article.slug}`}
      onClick={onClick}
      className="group grid grid-cols-[80px_minmax(0,1fr)] items-center gap-4"
    >
      <div className="overflow-hidden rounded-[0.3rem] bg-forest-900/5">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={article.coverImage?.alternativeText || article.title}
            className="aspect-square h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="aspect-square bg-gradient-to-br from-primary-hover to-primary-pressed" />
        )}
      </div>
      <div className="min-w-0">
        <div className="font-urbanist text-[10px] font-bold uppercase tracking-wider text-primary-emphasis">
          {category && <span>{category}</span>}
          {category && dateStr && <span aria-hidden className="mx-1 text-forest-900/40">✱</span>}
          {dateStr && <span className="text-forest-900/55">{dateStr}</span>}
        </div>
        <h3 className="mt-1 line-clamp-2 font-urbanist text-base font-bold leading-snug text-forest-950 transition group-hover:text-primary-emphasis">
          {article.title}
        </h3>
      </div>
    </Link>
  );
}

function BarIcon({ name }: { name: BarItem['icon'] }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor' as const,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-[18px] w-[18px]',
    'aria-hidden': true,
  };
  switch (name) {
    case 'user':
      return (
        <svg {...common}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'menu':
      return (
        <svg {...common}>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case 'lightning':
      return (
        <svg {...common}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'cart':
      return (
        <svg {...common}>
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
        </svg>
      );
  }
}
