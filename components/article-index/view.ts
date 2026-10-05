import type { StrapiArticle } from '@/lib/strapi';
import { toCard } from '@/components/category-v2/view';
import type { IndexCard } from './filters';

/** Server-side: a CMS article as the plain, serialisable card the archive filters on. */
export function toIndexCard(a: StrapiArticle): IndexCard {
  return {
    ...toCard(a),
    category: a.category?.slug && a.category?.name ? { slug: a.category.slug, name: a.category.name } : null,
    author: a.author?.slug && a.author?.name ? { slug: a.author.slug, name: a.author.name } : null,
  };
}
