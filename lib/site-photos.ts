/**
 * Real photographs used on the About and Contact pages.
 *
 * These replace the CMS destination hero images those pages used to borrow,
 * which were AI-generated. Every file here is a real photograph from Unsplash,
 * published under the standard Unsplash License (free for commercial use, no
 * Unsplash+ / premium images), downloaded on 5 Oct 2026 and self-hosted from
 * public/images/places/. Attribution is not required by the licence; the pages
 * credit each photographer anyway so the provenance stays visible.
 *
 * `alt` describes what is actually in the frame. `slug` matches the
 * /destinations/<slug> guide the caption links to.
 */

export type SitePhoto = {
  slug: string;
  /** Country name as shown in captions. */
  name: string;
  /** Self-hosted file under /public. */
  src: string;
  width: number;
  height: number;
  alt: string;
  /**
   * CSS object-position for crops that cut the photo hard (e.g. a wide band):
   * where the subject sits in the frame. Defaults to centre.
   */
  focus?: string;
  /** What and where, per the photographer's own title and location tag. */
  place: string;
  photographer: string;
  photographerUrl: string;
  /** The photo's page on Unsplash. */
  sourceUrl: string;
  license: 'Unsplash License';
};

const UTM = '?utm_source=originfacts&utm_medium=referral';

function unsplash(p: Omit<SitePhoto, 'license' | 'photographerUrl' | 'sourceUrl'> & { handle: string; id: string; pageSlug: string }): SitePhoto {
  const { handle, id, pageSlug, ...rest } = p;
  return {
    ...rest,
    photographerUrl: `https://unsplash.com/@${handle}${UTM}`,
    sourceUrl: `https://unsplash.com/photos/${pageSlug}-${id}${UTM}`,
    license: 'Unsplash License',
  };
}

export const SITE_PHOTOS = {
  japan: unsplash({
    slug: 'japan',
    name: 'Japan',
    src: '/images/places/japan.jpg',
    width: 1800,
    height: 1013,
    alt: 'Snow-capped Mount Fuji under orange-lit clouds',
    // The peak sits in the lower third of the frame.
    focus: '50% 78%',
    place: 'Mount Fuji, Shizuoka, Japan',
    photographer: 'Jayesh Patel',
    handle: 'jayescapes',
    id: 'zHRlfpTGXx8',
    pageSlug: 'snow-capped-mount-fuji-at-sunrise-with-vibrant-clouds',
  }),
  thailand: unsplash({
    slug: 'thailand',
    name: 'Thailand',
    src: '/images/places/thailand.jpg',
    width: 1200,
    height: 1800,
    alt: 'Wat Arun temple on the Chao Phraya river in Bangkok, with a long-tail boat passing',
    place: 'Wat Arun, Bangkok, Thailand',
    photographer: 'Teodor Kuduschiev',
    handle: 'teodorpk',
    id: 'wd3tQvk0WXA',
    pageSlug: 'wat-arun-temple-on-chao-phraya-river-bangkok',
  }),
  'united-kingdom': unsplash({
    slug: 'united-kingdom',
    name: 'United Kingdom',
    src: '/images/places/united-kingdom.jpg',
    width: 1800,
    height: 1200,
    alt: 'Looking up at a tower of Tower Bridge in London and its blue suspension chains',
    place: 'Tower Bridge, London, UK',
    photographer: 'Bruno Martins',
    handle: 'brunus',
    id: 'PRQpl-3xD6c',
    pageSlug: 'a-bridge-with-a-tower-in-the-background',
  }),
  germany: unsplash({
    slug: 'germany',
    name: 'Germany',
    src: '/images/places/germany.jpg',
    width: 1800,
    height: 1350,
    alt: 'The Brandenburg Gate in Berlin, its columns topped by the Quadriga statue',
    place: 'Brandenburg Gate, Berlin, Germany',
    photographer: 'feinschliff',
    handle: 'feinschliff',
    id: 'E2FMrGuVrXc',
    pageSlug: 'brandenburg-gate-with-columns-and-statues',
  }),
  singapore: unsplash({
    slug: 'singapore',
    name: 'Singapore',
    src: '/images/places/singapore.jpg',
    width: 1800,
    height: 957,
    alt: 'Marina Bay Sands lit up at night, reflected in Marina Bay, seen from Jubilee Bridge',
    place: 'Marina Bay Sands from Jubilee Bridge, Singapore',
    photographer: 'Stuart Breckenridge',
    handle: 'stuartbreckenridge',
    id: 'VhIyvLkjdio',
    pageSlug: 'marina-bay-sands-singapore',
  }),
  'united-states': unsplash({
    slug: 'united-states',
    name: 'United States',
    src: '/images/places/united-states.jpg',
    width: 1800,
    height: 1199,
    alt: 'The Manhattan skyline with the Empire State Building, behind brick apartment blocks in New York City',
    place: 'Manhattan skyline, New York City, USA',
    photographer: 'Matthew Moloney',
    handle: 'mattmoloney',
    id: 'n6TdKxVxmN4',
    pageSlug: 'new-york-city-skyline-with-empire-state-building-visible',
  }),
  'south-korea': unsplash({
    slug: 'south-korea',
    name: 'South Korea',
    src: '/images/places/south-korea.jpg',
    width: 1800,
    height: 1002,
    alt: 'A two-storey gate pavilion at Gyeongbokgung Palace in Seoul, with a mountain behind',
    place: 'Gyeongbokgung Palace, Seoul, South Korea',
    photographer: 'MINSUN KIM',
    handle: 'maroonsun',
    id: '4BdMGBvOXZk',
    pageSlug: 'a-large-building-with-a-tall-tower-on-top-of-it',
  }),
  australia: unsplash({
    slug: 'australia',
    name: 'Australia',
    src: '/images/places/australia.jpg',
    width: 1800,
    height: 1350,
    alt: 'The Sydney Opera House seen from the harbour on a clear day',
    place: 'Sydney Opera House, Sydney, Australia',
    photographer: 'Jo Barnes',
    handle: 'yourlifestylebusiness',
    id: '5IHB76yDsQM',
    pageSlug: 'the-sydney-opera-house-in-the-middle-of-a-body-of-water',
  }),
} satisfies Record<string, SitePhoto>;

export type SitePhotoSlug = keyof typeof SITE_PHOTOS;
