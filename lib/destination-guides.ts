/**
 * Written city guides, kept in the repo while the new city layout is piloted
 * on a few pages. A city with a guide here renders CityGuidePage instead of
 * the default template, and the guide's fields take the place of the CMS
 * ones. Drafts come from ops/generate-destination-guides.mjs and are reviewed
 * before they are added.
 */
import type { StrapiDestination } from '@/lib/strapi';
import athens from '@/data/destination-guides/athens.json';
import bangkok from '@/data/destination-guides/bangkok.json';
import perth from '@/data/destination-guides/perth.json';

export type GuideSource = { url: string; title: string };

export type DestinationGuide = {
  /** Markdown: an intro paragraph, then `## ` sections. */
  description: string;
  tldr: string;
  keyFacts: { label: string; value: string }[];
  faqs: { q: string; a: string }[];
  sources: GuideSource[];
};

const GUIDES: Record<string, DestinationGuide> = { athens, bangkok, perth };

export function getDestinationGuide(slug: string): DestinationGuide | null {
  return GUIDES[slug] ?? null;
}

/** The destination with the guide's written fields in place of the CMS ones. */
export function withGuide(destination: StrapiDestination, guide: DestinationGuide | null): StrapiDestination {
  if (!guide) return destination;
  return {
    ...destination,
    description: guide.description,
    tldr: guide.tldr,
    keyFacts: guide.keyFacts,
    faqs: guide.faqs,
  };
}
