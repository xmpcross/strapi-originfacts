import Link from 'next/link';

export type DirectoryLinkGroup = {
  title: string;
  links: { href: string; label: string }[];
};

/**
 * Plain, server-rendered link list used as the <Suspense> fallback for the
 * interactive directories. Those read useSearchParams(), so on a static page
 * Next emits only the fallback in the HTML — without this, crawlers saw zero
 * links to the pages beneath each hub. Replaced by the interactive directory
 * once it hydrates.
 */
export default function DirectoryLinkList({ groups, label }: { groups: DirectoryLinkGroup[]; label: string }) {
  return (
    <nav aria-label={label} className="mt-10 space-y-8" data-testid="directory-link-list">
      {groups
        .filter((g) => g.links.length > 0)
        .map((group) => (
          <section key={group.title}>
            <h2 className="text-2xl font-bold text-forest-950">{group.title}</h2>
            <ul className="mt-4 grid gap-x-6 gap-y-2 text-base text-forest-900/80 sm:grid-cols-2 lg:grid-cols-4">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-primary-emphasis">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </nav>
  );
}
