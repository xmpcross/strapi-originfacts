/**
 * Canonical list of the 6 main site sections shown on the homepage AND used
 * as a fallback by /category/[slug] when a matching Strapi Category record
 * doesn't exist yet.
 *
 * Keep slugs in sync with the Strapi Category collection.
 */
export type SectionLayout = 'atlas' | 'departure' | 'wirecutter' | 'directory' | 'masonry' | 'grid';

export type Section = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  layout: SectionLayout;
};

export const SECTIONS: Section[] = [
  {
    slug: 'destinations',
    title: 'Destinations',
    tagline: 'Places that change you',
    description:
      'Guides to cities, regions, and out-of-the-way corners worth the flight. Each covers when to go, where to stay, what to eat, and which experiences are worth your time, alongside the practical logistics you need: airport transfers, neighborhood breakdowns, daily budgets, and the entry rules and local quirks that catch first-timers off guard. Guides are compiled from official tourism, transport and government sources and reviewed by a named editor — see how we research and write in our methodology.',
    layout: 'atlas',
  },
  {
    slug: 'flights',
    title: 'Flights',
    tagline: 'Pay less, fly more',
    description:
      'How to pay less for a seat in the air — from the search habits that surface cheaper fares to the routing options (mixed cabins, positioning flights, flexible dates) that can move the price. We explain how fares, baggage rules and loyalty programs work in plain English, drawing on published fare and route data and the airlines\' own policies, so you know which points are worth chasing and which are a distraction. Prices change constantly: always confirm the final fare and its conditions with the airline or booking site before you pay.',
    layout: 'departure',
  },
  {
    slug: 'hotels',
    title: 'Hotels',
    tagline: 'Beds worth booking twice',
    description:
      'Where-to-stay guides and hotel round-ups by destination — boutique finds, design-led independents, dependable city standbys and family-friendly picks — compiled from hotels\' own published information, booking-site listings and official sources, then reviewed by a named editor. They are editorial selections, not the result of paid or mystery stays. Beyond the lists we cover the booking craft: how OTA rebates and hotel loyalty status interact, when status matching is worth the email, and how to spot resort fees before they show up at check-out.',
    layout: 'wirecutter',
  },
  {
    slug: 'car-rentals',
    title: 'Car Rentals',
    tagline: 'Wheels without the markup',
    description:
      'Renting a car has more pitfalls than booking a flight: airport surcharges, fuel policies, "free upgrades" that aren\'t, and damage claims that can outlive the trip itself. This section explains how daily rates are built on popular road-trip routes — Mediterranean coastlines, US road trips, New Zealand loops — what each type of rental insurance covers, and when an off-airport pickup can cost less, drawing on rental companies\' published terms. Always check the final price, insurance and fuel policy on the rental company\'s own booking page before you pay.',
    layout: 'wirecutter',
  },
  {
    slug: 'travel-tips',
    title: 'Travel Tips',
    tagline: 'Shortcuts from the road',
    description:
      'The small moves that make travel easier — packing systems, what earns its carry-on space, airport routines that save time, and practical habits that head off trouble before it starts. Less Instagram-grid advice, more "here\'s what to do when your phone dies in a foreign taxi" — written for people who already travel and want to do it with less friction.',
    layout: 'masonry',
  },
];

export function findSection(slug: string): Section | undefined {
  return SECTIONS.find((s) => s.slug === slug);
}
