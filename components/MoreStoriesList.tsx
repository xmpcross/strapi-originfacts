import Link from 'next/link';

/**
 * Plain links to the articles a destination's card grid doesn't show. The grids
 * show the first 4–8 articles; without this, the rest had no link from their own
 * destination page (Australia linked 2 of its 18 articles).
 */
export default function MoreStoriesList({
  articles,
  title,
}: {
  articles: { id: number; slug: string; title: string }[];
  title: string;
}) {
  if (articles.length === 0) return null;
  return (
    <nav aria-label={title} className="mt-8" data-testid="more-stories">
      <h3 className="text-lg font-bold text-forest-900">{title}</h3>
      <ul className="mt-3 grid gap-x-8 gap-y-2 text-base text-forest-900/80 sm:grid-cols-2">
        {articles.map((article) => (
          <li key={article.id}>
            <Link href={`/articles/${article.slug}`} className="hover:text-primary-emphasis hover:underline">
              {article.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
