import { SITE_URL } from '@/lib/entity-seo';
import { listAuthorSlugsWithArticles, listAuthors, mediaUrl, type StrapiAuthor } from '@/lib/strapi';

/**
 * Author profiles come from the CMS `authors` collection (name, photo, bio,
 * role, links). Bylines follow each article's CMS author; articles without one,
 * and the directory pages (airports, airlines, routes, destinations,
 * countries), are bylined DEFAULT_AUTHOR_SLUG.
 *
 * The hard-coded profiles that used to live here (Kritin Vashist, Elena
 * Rostova, Marcus Vance, the Editorial Desk) were retired on 4 Oct 2026; their
 * URLs redirect to /authors/k-spellman (next.config.mjs).
 */
export interface AuthorProfile {
  slug: string;
  name: string;
  jobTitle: string;
  role: string;
  bio: string;
  longBio?: string;
  avatar: string;
  email?: string;
  socials?: {
    x?: string;
    linkedin?: string;
    website?: string;
  };
  expertise: string[];
}

export const DEFAULT_AUTHOR_SLUG = 'k-spellman';

const PLACEHOLDER_AVATAR = '/brand/authors/originfacts-team.svg';

/** Used only when the CMS cannot be reached. */
const FALLBACK_AUTHOR: AuthorProfile = {
  slug: DEFAULT_AUTHOR_SLUG,
  name: 'K Spellman',
  jobTitle: 'Founder & Editor',
  role: 'Founder & Editor',
  bio: 'K Spellman is the founder and editor of Originfacts.',
  avatar: PLACEHOLDER_AVATAR,
  expertise: [],
};

function toProfile(a: StrapiAuthor): AuthorProfile {
  const bio = (a.bio ?? '').trim();
  const firstParagraph = bio.split(/\n\s*\n/)[0]?.trim() || bio;
  const title = a.role?.trim() || (a.slug === DEFAULT_AUTHOR_SLUG ? 'Founder & Editor' : 'Contributor');
  return {
    slug: a.slug,
    name: a.name,
    jobTitle: title,
    role: title,
    bio: firstParagraph,
    longBio: bio && bio !== firstParagraph ? bio : undefined,
    avatar: mediaUrl(a.avatar ?? null) || PLACEHOLDER_AVATAR,
    // The CMS email is a personal inbox: never published.
    socials: {
      ...(a.twitter ? { x: a.twitter } : {}),
      ...(a.linkedin ? { linkedin: a.linkedin } : {}),
      ...(a.website ? { website: a.website } : {}),
    },
    expertise: a.credentials ? a.credentials.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : [],
  };
}

async function cmsProfiles(): Promise<AuthorProfile[]> {
  const authors = await listAuthors().catch(() => [] as StrapiAuthor[]);
  return authors.filter((a) => a.slug && a.name).map(toProfile);
}

/** The byline for a CMS author slug; DEFAULT_AUTHOR_SLUG when unset or unknown. */
export async function resolveAuthor(slug?: string | null): Promise<AuthorProfile> {
  const profiles = await cmsProfiles();
  const wanted = (slug || DEFAULT_AUTHOR_SLUG).toLowerCase();
  return (
    profiles.find((p) => p.slug === wanted) ??
    profiles.find((p) => p.slug === DEFAULT_AUTHOR_SLUG) ??
    FALLBACK_AUTHOR
  );
}

/** An author page by slug, or null (routing must not fall back). */
export async function getAuthorBySlug(slug: string): Promise<AuthorProfile | null> {
  const profiles = await cmsProfiles();
  return profiles.find((p) => p.slug === slug.toLowerCase().trim()) ?? null;
}

/** Authors shown in lists and the sitemap: the default byline plus anyone with an article. */
export async function getAllAuthors(): Promise<AuthorProfile[]> {
  const [profiles, withArticles] = await Promise.all([
    cmsProfiles(),
    listAuthorSlugsWithArticles().catch(() => new Set<string>()),
  ]);
  const listed = profiles.filter((p) => p.slug === DEFAULT_AUTHOR_SLUG || withArticles.has(p.slug));
  return listed.length > 0 ? listed : [FALLBACK_AUTHOR];
}

export function authorPersonJsonLd(author: AuthorProfile): Record<string, unknown> {
  const authorUrl = `${SITE_URL}/authors/${author.slug}`;
  const sameAsList = [author.socials?.x, author.socials?.linkedin, author.socials?.website].filter(
    (s): s is string => Boolean(s),
  );
  const image = author.avatar.startsWith('http') ? author.avatar : `${SITE_URL}${author.avatar}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${authorUrl}#person`,
    name: author.name,
    jobTitle: author.jobTitle,
    description: author.bio,
    url: authorUrl,
    image,
    worksFor: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Originfacts',
      url: SITE_URL,
    },
    ...(sameAsList.length > 0 ? { sameAs: sameAsList } : {}),
    ...(author.expertise.length > 0 ? { knowsAbout: author.expertise } : {}),
  };
}
