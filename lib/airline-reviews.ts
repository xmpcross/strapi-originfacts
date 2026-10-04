import fs from 'node:fs';
import path from 'node:path';

/**
 * Loader for the unified airline-review store (content/airline-reviews/*.json).
 * Files are produced by ingestion adapters — currently the Kaggle Skytrax
 * archive (scripts/ingest-skytrax-kaggle.py) and TripAdvisor bulk exports
 * (scripts/ingest-tripadvisor-xml.py); later adapters (live Skytrax scrape,
 * Google, Trustpilot…) merge into the same files under their own `source` tag.
 *
 * Ratings are normalised to a 0–10 scale on the way in, so sources published on
 * different scales stay comparable. TripAdvisor's 1–5 stars are doubled.
 */

export type AirlineReview = {
  source: string;
  id: string;
  date: string;                     // YYYY-MM-DD
  rating10: number | null;          // normalised to 0–10 by the adapter
  title: string;
  text: string;
  author: string | null;
  authorCountry: string | null;
  authorLocation?: string | null;   // free-text place; not necessarily a country
  cabin: string | null;
  typeTraveller: string | null;
  route: string | null;
  aircraft: string | null;
  recommended: boolean | null;      // null where the source records no such signal
  subratings: Record<string, number> | null; // 1–5 per category
};

export type AirlineReviewStats = {
  source: string;                   // a source tag, or 'all' for the combined block
  reviewCount: number;
  avgRating10: number | null;
  recommendPct: number | null;      // null where no source in scope reports it
  subratings: Record<string, number> | null;
  firstReviewDate: string;
  lastReviewDate: string;
  sourceUrl?: string | null;        // where these reviews were originally published
};

export type AirlineReviewFile = {
  slug: string;
  sources: string[];
  stats: AirlineReviewStats;                       // combined across every source
  statsBySource?: Record<string, AirlineReviewStats>;
  reviews: AirlineReview[];
};

export const SUBRATING_LABELS: Record<string, string> = {
  seatComfort: 'Seat comfort',
  cabinStaff: 'Cabin staff',
  foodBeverages: 'Food & beverages',
  inflightEntertainment: 'In-flight entertainment',
  groundService: 'Ground service',
  wifiConnectivity: 'Wi-Fi',
  valueMoney: 'Value for money',
};

/**
 * Display metadata per source tag. Attribution is rendered from this, so a file
 * carrying reviews from two sources credits both rather than whichever adapter
 * happened to write it last.
 */
export const SOURCE_META: Record<string, { label: string; home: string }> = {
  'skytrax-kaggle': { label: 'Skytrax', home: 'https://www.airlinequality.com/' },
  tripadvisor: { label: 'TripAdvisor', home: 'https://www.tripadvisor.com/' },
};

export function sourceLabel(source: string): string {
  return SOURCE_META[source]?.label ?? source;
}

/**
 * Counts per star band, 5 down to 1, for the rating histogram. Ratings are
 * stored 0–10, so each band covers two points (10 → 5 stars, 2 → 1 star).
 * Empty bands are kept so the histogram always has five rows.
 */
export function ratingBands(reviews: AirlineReview[]): { star: number; count: number }[] {
  const counts = new Map<number, number>([[5, 0], [4, 0], [3, 0], [2, 0], [1, 0]]);

  for (const review of reviews) {
    if (review.rating10 === null) continue;
    const star = Math.min(5, Math.max(1, Math.ceil(review.rating10 / 2)));
    counts.set(star, (counts.get(star) ?? 0) + 1);
  }

  return [5, 4, 3, 2, 1].map((star) => ({ star, count: counts.get(star) ?? 0 }));
}

/**
 * Frequency of a free-text facet (cabin, route) across the stored reviews, with
 * the mean score of the reviews carrying it.
 *
 * These chips are counted from the reviews themselves — nothing here is
 * inferred, summarised or otherwise asserted on the reviewers' behalf. `avg` is
 * the arithmetic mean of the 0–10 ratings on those same reviews, so a chip
 * shown as well- or poorly-rated reports their scores rather than reading their
 * prose. It is null when no review in the group carried a rating.
 */
export function facetCounts(
  reviews: AirlineReview[],
  key: 'cabin' | 'route',
  limit: number
): { label: string; count: number; avg: number | null }[] {
  const groups = new Map<string, { count: number; rated: number[] }>();

  for (const review of reviews) {
    const value = review[key];
    if (!value) continue;
    const group = groups.get(value) ?? { count: 0, rated: [] };
    group.count += 1;
    if (review.rating10 !== null) group.rated.push(review.rating10);
    groups.set(value, group);
  }

  return [...groups.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, { count, rated }]) => ({
      label,
      count,
      avg: rated.length
        ? Math.round((rated.reduce((sum, n) => sum + n, 0) / rated.length) * 10) / 10
        : null,
    }));
}

/**
 * How a facet chip should read: well-rated, poorly-rated, or neither.
 *
 * The thresholds sit wide apart deliberately — a group whose mean lands in the
 * middle gets no verdict rather than a borderline one, and a group too small to
 * mean anything is left neutral instead of being labelled off one or two
 * scores.
 */
export function facetTone(facet: { count: number; avg: number | null }): 'positive' | 'negative' | 'neutral' {
  if (facet.avg === null || facet.count < 3) return 'neutral';
  if (facet.avg >= 7) return 'positive';
  if (facet.avg <= 4) return 'negative';
  return 'neutral';
}

/**
 * Choose which reviews to put on screen.
 *
 * Taking the newest N is not safe here: review sites cluster sentiment in time,
 * so a recent run of one-star reviews can fill every card while the headline
 * average describes a much wider spread. (Qantas: stored average 4.3/10, newest
 * six all 2/10.) Slots are instead allocated across rating bands in proportion
 * to the stored distribution — largest-remainder — and filled newest-first
 * within each band. The visible cards then match the number above them, and the
 * result is deterministic rather than cherry-picked.
 */
export function pickRepresentative(reviews: AirlineReview[], count: number): AirlineReview[] {
  if (reviews.length <= count) return reviews;

  const rated = reviews.filter((r) => r.rating10 !== null);
  if (rated.length === 0) return reviews.slice(0, count);

  const byRating = new Map<number, AirlineReview[]>();
  for (const review of rated) {
    const band = review.rating10 as number;
    if (!byRating.has(band)) byRating.set(band, []);
    byRating.get(band)!.push(review);
  }
  for (const list of byRating.values()) list.sort((a, b) => b.date.localeCompare(a.date));

  const bands = [...byRating.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([band, list]) => {
      const exact = (list.length / rated.length) * count;
      return { band, list, exact, take: Math.floor(exact) };
    });

  let left = count - bands.reduce((sum, b) => sum + b.take, 0);
  const byRemainder = [...bands].sort(
    (a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)) || b.band - a.band
  );
  for (const b of byRemainder) {
    if (left <= 0) break;
    if (b.take < b.list.length) {
      b.take += 1;
      left -= 1;
    }
  }

  const chosen = bands.flatMap((b) => b.list.slice(0, b.take));

  // Bands can run dry before the quota is met; top up by recency.
  if (chosen.length < count) {
    const taken = new Set(chosen.map((r) => r.id));
    for (const review of reviews) {
      if (chosen.length >= count) break;
      if (!taken.has(review.id)) {
        chosen.push(review);
        taken.add(review.id);
      }
    }
  }

  return chosen.sort((a, b) => b.date.localeCompare(a.date)).slice(0, count);
}

const DIR = path.join(process.cwd(), 'content', 'airline-reviews');

export function getAirlineReviews(slug: string): AirlineReviewFile | null {
  try {
    const raw = fs.readFileSync(path.join(DIR, `${slug}.json`), 'utf8');
    return JSON.parse(raw) as AirlineReviewFile;
  } catch {
    return null;
  }
}
