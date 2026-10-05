/**
 * Home page: which stories go in which section, and the editorial copy around
 * them. Kept out of app/page.tsx so the selection rules can be tested.
 *
 * Nothing here is a typed-in number. Every count the page shows is computed
 * from the CMS or the guide data at render time; the copy only describes what
 * the site does (see /about and /methodology, which this must stay in line with).
 */
import type { StrapiArticle } from './strapi';
import { SECTIONS } from './sections';

/** Stories in the hero: one lead plus the mosaic beside it. */
export const HERO_SECONDARY = 4;
/** Stories in the "Latest stories" grid under the hero. */
export const LATEST_COUNT = 5;
/** Category bands, and stories in each (one feature + the rest as rows). */
export const CATEGORY_BANDS = 4;
export const CATEGORY_STORIES = 4;
/** Text-only "Recently published" list. */
export const RECENT_LIST_COUNT = 8;

/** Window used to rank categories by recent activity. */
const ACTIVITY_WINDOW_DAYS = 30;

/**
 * One- or two-sentence intros for the category bands. They paraphrase the
 * longer section descriptions in lib/sections.ts, which the category pages
 * show in full. A category without an entry here falls back to its tagline.
 */
export const CATEGORY_INTROS: Record<string, string> = {
  flights:
    'How fares, routes and baggage rules work, and the search habits that can bring the price of a seat down. Fares change constantly, so confirm the final price and conditions with the airline or booking site.',
  hotels:
    'Where-to-stay guides and hotel round-ups by destination, compiled from hotels’ own published information and booking listings. They are editorial selections, not paid or mystery stays.',
  'travel-tips':
    'Packing, airport routines, realistic itineraries and how many days a city needs: the small, practical decisions that make a trip run more smoothly.',
  'car-rentals':
    'How daily rates, insurance, fuel policies and airport surcharges work, drawing on rental companies’ published terms, so the price you book is closer to the price you pay.',
  destinations:
    'City and country guides: when to go, where to base yourself, and the history and culture that give a place its character.',
};

export type CategoryBand = {
  slug: string;
  name: string;
  intro: string;
  tagline: string | null;
  /** Articles in this category in the index (only meaningful when the index is complete). */
  total: number;
  /** Articles published in the activity window ending at the newest article. */
  recent: number;
  stories: StrapiArticle[];
};

export type HomeSelection = {
  lead: StrapiArticle | null;
  secondary: StrapiArticle[];
  latest: StrapiArticle[];
  bands: CategoryBand[];
  recentList: StrapiArticle[];
};

const time = (iso?: string) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Split the newest-first article index into the page's sections without
 * showing any story twice. Category bands are the categories with the most
 * articles published in the 30 days up to the newest article (ties: the most
 * recently updated category), and only categories with enough unseen stories
 * to fill a band qualify.
 */
export function selectHomeStories(index: StrapiArticle[]): HomeSelection {
  const articles = [...index].sort((a, b) => time(b.publishedAt) - time(a.publishedAt));
  const used = new Set<string>();
  const take = (rows: StrapiArticle[], n: number) => {
    const out: StrapiArticle[] = [];
    for (const a of rows) {
      if (out.length >= n) break;
      if (used.has(a.slug)) continue;
      used.add(a.slug);
      out.push(a);
    }
    return out;
  };

  const [lead = null] = take(articles, 1);
  const secondary = take(articles, HERO_SECONDARY);
  const latest = take(articles, LATEST_COUNT);

  const newest = time(articles[0]?.publishedAt);
  const windowStart = newest - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const byCategory = new Map<string, { name: string; rows: StrapiArticle[]; recent: number; last: number }>();
  for (const a of articles) {
    const cat = a.category;
    if (!cat?.slug) continue;
    const entry = byCategory.get(cat.slug) ?? { name: cat.name, rows: [], recent: 0, last: 0 };
    entry.rows.push(a);
    const t = time(a.publishedAt);
    if (t >= windowStart) entry.recent += 1;
    entry.last = Math.max(entry.last, t);
    byCategory.set(cat.slug, entry);
  }

  const ranked = [...byCategory.entries()].sort(
    ([, a], [, b]) => b.recent - a.recent || b.last - a.last || a.name.localeCompare(b.name),
  );

  const bands: CategoryBand[] = [];
  for (const [slug, entry] of ranked) {
    if (bands.length >= CATEGORY_BANDS) break;
    const unseen = entry.rows.filter((a) => !used.has(a.slug));
    if (unseen.length < CATEGORY_STORIES) continue;
    const section = SECTIONS.find((s) => s.slug === slug);
    bands.push({
      slug,
      name: entry.name,
      intro: CATEGORY_INTROS[slug] ?? section?.tagline ?? '',
      tagline: section?.tagline ?? null,
      total: entry.rows.length,
      recent: entry.recent,
      stories: take(unseen, CATEGORY_STORIES),
    });
  }

  const recentList = take(articles, RECENT_LIST_COUNT);

  return { lead, secondary, latest, bands, recentList };
}

/** Category name → article count from the index, newest-active first. */
export function categoryCounts(index: StrapiArticle[]): { slug: string; name: string; count: number }[] {
  const counts = new Map<string, { slug: string; name: string; count: number }>();
  for (const a of index) {
    if (!a.category?.slug) continue;
    const row = counts.get(a.category.slug) ?? { slug: a.category.slug, name: a.category.name, count: 0 };
    row.count += 1;
    counts.set(a.category.slug, row);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export type HomeFaq = { q: string; a: string };

/**
 * The visible FAQ, which the FAQPage JSON-LD mirrors word for word. Answers
 * restate what /about, /methodology and the affiliate disclosure say; the only
 * variable parts are lists and counts computed from data.
 */
export function homeFaqs(ctx: { topics: string[]; airlineGuides: number; airportGuides: number }): HomeFaq[] {
  const topicList = ctx.topics.length
    ? `${listJoin(ctx.topics)}`
    : 'destinations, flights, hotels, car rentals and travel tips';
  const guideBits = [
    ctx.airlineGuides > 0 ? `${ctx.airlineGuides} airline guide${ctx.airlineGuides === 1 ? '' : 's'}` : null,
    ctx.airportGuides > 0 ? `${ctx.airportGuides} airport guide${ctx.airportGuides === 1 ? '' : 's'}` : null,
  ].filter(Boolean) as string[];

  return [
    {
      q: 'What is Originfacts?',
      a: 'Originfacts is an independent travel website operated by FXN Holdings. It publishes travel articles alongside reference guides to airlines, airports and destination countries, so you can read about a place and plan the practical side of the trip in one place.',
    },
    {
      q: 'What topics does the travel blog cover?',
      a: `Articles are grouped into ${topicList}. ${
        guideBits.length
          ? `Separately from the articles, the site has ${listJoin(guideBits)} covering things like baggage allowances, check-in times and getting from the airport into town.`
          : 'Separately from the articles, the site has airline and airport guides covering things like baggage allowances, check-in times and getting from the airport into town.'
      }`,
    },
    {
      q: 'How are the airline and airport facts checked?',
      a: 'Airline figures are read from the airline’s own pages, and airport figures from the airport and its official transport operators. Each checked figure is shown with the page it came from and the date it was checked. If something has not been checked, the guide leaves it blank rather than guessing.',
    },
    {
      q: 'Is AI used to write the articles?',
      a: 'Yes. Many articles are researched and drafted with the help of a large language model (currently Anthropic’s Claude), working from an editorial brief and guidelines, and many cover images are made with generative image models. AI-generated images illustrate an article; they do not show a specific hotel, aircraft, price or person. The methodology page explains the process in full.',
    },
    {
      q: 'Does Originfacts sell flights or hotel rooms?',
      a: 'No. Originfacts does not sell travel, take payments or issue tickets. Some links go to booking sites and travel providers, and the site may earn a commission if you book through them, which usually does not change the price you pay. Always confirm the final price and conditions with the provider before booking.',
    },
    {
      q: 'How do I report a mistake?',
      a: 'Email contact@originfacts.com with the page and what looks wrong. Prices, routes, visa rules and fees change often, so these are the details most likely to go out of date; reported errors are corrected or removed.',
    },
  ];
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
