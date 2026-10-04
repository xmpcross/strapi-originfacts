import Link from 'next/link';
import type { SidebarCategoryTile } from './BlogSidebar';

export default function CategoryShowcase({ tiles }: { tiles: SidebarCategoryTile[] }) {
  if (tiles.length === 0) return null;
  return (
    <section
      className="border-t border-forest-900/10 bg-forest-900/[0.02]"
      data-testid="category-showcase"
    >
      <div className="mx-auto max-w-7xl px-6 py-16">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/category/${t.slug}`}
                className="group flex items-center gap-4 rounded-[0.3rem] border border-forest-900/10 bg-white p-3 transition hover:border-primary-emphasis hover:shadow-sm"
                data-testid={`category-showcase-${t.slug}`}
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[0.3rem] bg-forest-900/5">
                  {t.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.image}
                      alt={t.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-primary-hover to-primary-pressed" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold uppercase tracking-wide text-forest-900 transition group-hover:text-primary-emphasis">
                    {t.name}
                  </h3>
                  <p className="mt-1 text-xs text-forest-900/60">
                    {t.count} {t.count === 1 ? 'Article' : 'Articles'}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
