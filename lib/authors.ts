import { SITE_URL } from '@/lib/entity-seo';

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

export const DEFAULT_AUTHOR: AuthorProfile = {
  slug: 'kritin-vashist',
  name: 'Kritin Vashist',
  jobTitle: 'Founder & Editor-in-Chief',
  role: 'Founder & Managing Editor',
  bio: 'Travel journalist, aviation researcher, and founder of Originfacts. Specializes in commercial airline economics, route development, airport hub infrastructure, and cultural origin histories.',
  longBio:
    'Kritin Vashist leads Originfacts as Founder and Editor-in-Chief, establishing rigorous editorial standards across all aviation, destination, and transportation research. Combining digital media expertise with deep route logistics analysis, Kritin oversees primary data verification pipelines, carrier fare evaluations, and cultural origin guides, ensuring travelers receive factual, independent travel intelligence before booking flights.',
  avatar: '/brand/authors/kritin-vashist.svg',
  email: 'contact@originfacts.com',
  socials: {
    x: 'https://x.com/realoriginfacts',
    linkedin: 'https://www.linkedin.com/company/143027896/',
  },
  expertise: [
    'Aviation History',
    'Airline Economics',
    'Airport Hub Infrastructure',
    'Flight Route Analysis',
    'Destination Heritage',
  ],
};

export const AUTHORS: Record<string, AuthorProfile> = {
  'kritin-vashist': DEFAULT_AUTHOR,
  kritin: DEFAULT_AUTHOR,
  'elena-rostova': {
    slug: 'elena-rostova',
    name: 'Elena Rostova',
    jobTitle: 'Senior Aviation & Transport Analyst',
    role: 'Senior Aviation Editor',
    bio: 'Commercial aviation analyst and travel writer with over a decade of experience covering airline fleet strategies, cabin products, airport transfer hubs, and passenger rights.',
    longBio:
      'Elena Rostova serves as Senior Aviation Editor at Originfacts, specializing in commercial airline operations, fleet strategies, and global airport transfer infrastructure. Bringing over a decade of transport analysis experience, Elena authors comprehensive carrier breakdowns, cabin product reviews, and flight route evaluations to help travelers optimize layover schedules and assess ticket values.',
    avatar: '/brand/authors/elena-rostova.svg',
    email: 'contact@originfacts.com',
    socials: {
      x: 'https://x.com/realoriginfacts',
      linkedin: 'https://www.linkedin.com/company/143027896/',
    },
    expertise: [
      'Commercial Airlines',
      'Cabin Products & Seats',
      'Airport Operations',
      'Long-Haul Flight Routes',
      'Passenger Protection Rules',
    ],
  },
  'marcus-vance': {
    slug: 'marcus-vance',
    name: 'Marcus Vance',
    jobTitle: 'Destinations & Cultural History Lead',
    role: 'Destinations Editor',
    bio: 'Historical researcher and travel writer focusing on origin stories, urban geography, cultural heritage, and immersive destination guides across Europe, Asia, and the Americas.',
    longBio:
      'Marcus Vance directs destination research and cultural history coverage at Originfacts, bridging historical urban geography with modern travel planning. Marcus analyzes regional heritage, local transit links, and seasonal visiting windows across Europe, Asia, and the Americas, providing readers with authoritative background context and practical itinerary structures before embarking on international journeys.',
    avatar: '/brand/authors/marcus-vance.svg',
    email: 'contact@originfacts.com',
    socials: {
      x: 'https://x.com/realoriginfacts',
      linkedin: 'https://www.linkedin.com/company/143027896/',
    },
    expertise: [
      'Cultural Heritage',
      'Urban Geography',
      'European Destinations',
      'Historical Travel Guides',
      'Regional Gastronomy',
    ],
  },
  'originfacts-team': {
    slug: 'originfacts-team',
    name: 'Originfacts Editorial Desk',
    jobTitle: 'Editorial Research & Verification Desk',
    role: 'Editorial Desk',
    bio: 'The central editorial desk at Originfacts responsible for routine route verification, airport data updates, hotel inventory audits, and factual accuracy compliance.',
    longBio:
      'The Originfacts Editorial Desk maintains site-wide factual accuracy by continuously auditing commercial airport databases, flight route schedules, and carrier policy updates. Operating under strict verification guidelines, our central research team cross-references all published aviation metrics against primary civil aviation sources to guarantee transparent, reliable travel guidance for global readers.',
    avatar: '/brand/authors/originfacts-team.svg',
    email: 'contact@originfacts.com',
    socials: {
      x: 'https://x.com/realoriginfacts',
      linkedin: 'https://www.linkedin.com/company/143027896/',
    },
    expertise: [
      'Fact Verification',
      'Flight Route Auditing',
      'Airport Code Registries',
      'Travel Data Compliance',
    ],
  },
  'k-spellman': {
    slug: 'k-spellman',
    name: 'K Spellman',
    jobTitle: 'Contributing Editorial Researcher',
    role: 'Contributing Researcher',
    bio: 'Travel and destination researcher contributing to destination guides, airport reviews, and flight intelligence at Originfacts.',
    longBio:
      'K Spellman is an editorial contributor and researcher at Originfacts, focusing on destination guides, airport transport logistics, and comprehensive travel reviews.',
    avatar: '/brand/authors/originfacts-team.svg',
    email: 'contact@originfacts.com',
    socials: {
      x: 'https://x.com/realoriginfacts',
      linkedin: 'https://www.linkedin.com/company/143027896/',
    },
    expertise: [
      'Destination Guides',
      'Airport Logistics',
      'Travel Reviews',
      'Editorial Research',
    ],
  },
};

/**
 * Authors with a public profile. Every post is bylined K Spellman (editorial
 * decision, 4 Oct 2026); Kritin Vashist stays as founder. The Elena Rostova,
 * Marcus Vance and Editorial Desk pages redirect to K Spellman (next.config).
 */
export function getAllAuthors(): AuthorProfile[] {
  return [AUTHORS['k-spellman']!, DEFAULT_AUTHOR];
}

/**
 * Look up an author page by its slug, or null when no such author exists.
 *
 * This used to fall back to DEFAULT_AUTHOR, which made the `notFound()` guard in
 * app/authors/[slug] unreachable: every slug resolved, so /authors/<anything>
 * returned HTTP 200 rendering a real profile. That is an unbounded soft-404
 * surface — verified live before this change, /authors/does-not-exist-xyz
 * answered 200.
 *
 * Byline resolution still wants a fallback, and still gets one: that is
 * `resolveAuthor()` below. Routing must not.
 */
export function getAuthorBySlug(slug: string): AuthorProfile | null {
  const key = slug.toLowerCase().trim();
  return AUTHORS[key] ?? null;
}

export function resolveAuthor(rawNameOrSlug?: string | null): AuthorProfile {
  // Bylines: every post is K Spellman, whatever the caller passes.
  void rawNameOrSlug;
  return AUTHORS['k-spellman']!;
}

export function authorPersonJsonLd(author: AuthorProfile): Record<string, unknown> {
  const authorUrl = `${SITE_URL}/authors/${author.slug}`;
  const sameAsList: string[] = [];
  if (author.socials?.x) sameAsList.push(author.socials.x);
  if (author.socials?.linkedin) sameAsList.push(author.socials.linkedin);
  if (author.socials?.website) sameAsList.push(author.socials.website);

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${authorUrl}#person`,
    name: author.name,
    jobTitle: author.jobTitle,
    description: author.bio,
    url: authorUrl,
    image: `${SITE_URL}${author.avatar}`,
    worksFor: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Originfacts',
      url: SITE_URL,
    },
    ...(author.email ? { email: `mailto:${author.email}` } : {}),
    ...(sameAsList.length > 0 ? { sameAs: sameAsList } : {}),
    knowsAbout: author.expertise,
  };
}
