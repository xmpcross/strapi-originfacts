import type { AirlineRegion, StrapiAirline, StrapiAirport, StrapiCountry, StrapiDestination } from '@/lib/strapi';
import { DIRECTORY_REGIONS } from '@/lib/airline-directory';
import { foldText, letterOf } from '@/lib/airport-directory';

export { DIRECTORY_REGIONS, foldText, letterOf };

/**
 * One country on /countries. Every number is counted from records the site
 * already serves — nothing here is typed in by hand, and there is no prose:
 * the country collection's `about` field is empty, and the directory does not
 * show population, visa, safety or similar facts.
 */
export type DirectoryCountry = {
  /** ISO 3166-1 alpha-2, upper case. */
  code: string;
  /** As the country collection spells it. */
  name: string;
  /** From the country collection, as /airlines and /airports group it. */
  region?: AirlineRegion;
  /** Slug of the country's destination guide (/destinations/<slug>), when one exists. */
  guide?: string;
  /** Airports with an IATA code listed on /airports for this country. */
  airports: number;
  /** Airlines listed on /airlines whose home country is this one. */
  airlines: number;
  /** City destination guides filed under this country (what its guide lists under cities). */
  cityGuides: number;
  /** Published articles tagged with this country or one of its destinations. */
  articles: number;
  /** Route records departing an airport in this country. */
  routes: number;
  /**
   * What /airlines?country= should search for: the home-country spelling the
   * airline records use for this country (it can differ from `name`, e.g.
   * "Czech Republic"). /airlines treats it as substring search text, so it is
   * set only when that search returns exactly this country's airlines: every
   * record spells the country to include it, and no other country's spelling
   * does ("Niger" would also find Nigeria's airlines). Absent otherwise, and
   * the airline count is shown without a link.
   */
  airlineQuery?: string;
};

/** Where a country card's name links: the destination guide, else the country page. */
export function countryHref(c: Pick<DirectoryCountry, 'code' | 'guide'>): string {
  // /countries/<code> 301s to the destination guide whenever one exists, so
  // link the canonical URL rather than send every click through a redirect.
  return c.guide ? `/destinations/${c.guide}` : `/countries/${c.code.toLowerCase()}`;
}

export function airportsHref(c: Pick<DirectoryCountry, 'name'>): string {
  return `/airports?country=${encodeURIComponent(c.name)}`;
}

export function airlinesHref(c: Pick<DirectoryCountry, 'airlineQuery'>): string | null {
  return c.airlineQuery ? `/airlines?country=${encodeURIComponent(c.airlineQuery)}` : null;
}

/** Regional-indicator flag emoji for an ISO alpha-2 code ("" when the code is not two letters). */
export function flagEmoji(code: string): string {
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

// Airline records spell some countries differently from the country
// collection. Mirrors COUNTRY_ALIASES in lib/airline-directory.ts (not
// exported there); only names that exist in the country collection.
const AIRLINE_COUNTRY_ALIASES: Record<string, string> = {
  "People's Republic of China": 'China',
  'Hong Kong SAR of China': 'Hong Kong',
  'Republic of Korea': 'South Korea',
  'The Bahamas': 'Bahamas',
  'Democratic Republic of the Congo': 'DR Congo',
  Reunion: 'Réunion',
  'Czech Republic': 'Czechia',
  Macao: 'Macau',
  Burma: 'Myanmar',
  'Moldova (Republic of Moldova)': 'Moldova',
};

export type CountryDirectoryInput = {
  countries: Pick<StrapiCountry, 'code' | 'name' | 'region'>[];
  /** Every airport record; only those with an IATA code are counted, as /airports lists. */
  airports: Pick<StrapiAirport, 'iata' | 'countryCode'>[];
  destinations: Pick<StrapiDestination, 'slug' | 'type' | 'countryCode'>[];
  /** The airlines /airlines lists (already filtered by the caller). */
  airlines: Pick<StrapiAirline, 'country'>[];
  /** Route records per origin airport, lower-case IATA (fetchRouteCoverage). */
  originRouteCounts: Map<string, number>;
  /** Published articles per country code (fetchArticleCountsByCountry). */
  articleCounts: Map<string, number>;
};

/** Builds the directory rows, A–Z by name. Pure: no fetching. */
export function buildCountryDirectory(input: CountryDirectoryInput): DirectoryCountry[] {
  const up = (s?: string | null) => (s ?? '').trim().toUpperCase();

  const airportsByCode = new Map<string, number>();
  const routesByCode = new Map<string, number>();
  for (const a of input.airports) {
    const cc = up(a.countryCode);
    if (!cc || !a.iata) continue;
    airportsByCode.set(cc, (airportsByCode.get(cc) ?? 0) + 1);
    const routes = input.originRouteCounts.get(a.iata.toLowerCase()) ?? 0;
    if (routes) routesByCode.set(cc, (routesByCode.get(cc) ?? 0) + routes);
  }

  const guideByCode = new Map<string, string>();
  const cityGuidesByCode = new Map<string, number>();
  for (const d of input.destinations) {
    const cc = up(d.countryCode);
    if (!cc || !d.slug) continue;
    if (d.type === 'country') {
      if (!guideByCode.has(cc)) guideByCode.set(cc, d.slug);
    } else if (d.type === 'city') {
      cityGuidesByCode.set(cc, (cityGuidesByCode.get(cc) ?? 0) + 1);
    }
  }

  const codeByName = new Map<string, string>();
  for (const c of input.countries) if (c.code && c.name) codeByName.set(c.name.toLowerCase(), up(c.code));
  const airlinesByCode = new Map<string, number>();
  const spellingsByCode = new Map<string, Map<string, number>>();
  for (const a of input.airlines) {
    const raw = a.country?.trim();
    if (!raw) continue;
    const cc = codeByName.get((AIRLINE_COUNTRY_ALIASES[raw] ?? raw).toLowerCase());
    if (!cc) continue;
    airlinesByCode.set(cc, (airlinesByCode.get(cc) ?? 0) + 1);
    const spellings = spellingsByCode.get(cc) ?? new Map<string, number>();
    spellings.set(raw, (spellings.get(raw) ?? 0) + 1);
    spellingsByCode.set(cc, spellings);
  }

  const allSpellings = [...spellingsByCode.entries()].flatMap(([cc, m]) =>
    [...m.keys()].map((raw) => ({ cc, folded: foldText(raw) })),
  );
  const airlineQueryFor = (code: string): string | undefined => {
    const spellings = spellingsByCode.get(code);
    if (!spellings) return undefined;
    // Shortest spelling first: it is the one most likely to be contained in the others.
    for (const [raw] of [...spellings.entries()].sort((x, y) => x[0].length - y[0].length || y[1] - x[1])) {
      const q = foldText(raw);
      if (allSpellings.every((s) => (s.cc === code) === s.folded.includes(q))) return raw;
    }
    return undefined;
  };

  const seen = new Set<string>();
  const rows: DirectoryCountry[] = [];
  for (const c of input.countries) {
    const code = up(c.code);
    if (!code || !c.name || seen.has(code)) continue;
    seen.add(code);
    const region = c.region && DIRECTORY_REGIONS.includes(c.region) ? c.region : undefined;
    const airlineQuery = airlineQueryFor(code);
    rows.push({
      code,
      name: c.name,
      ...(region ? { region } : {}),
      ...(guideByCode.has(code) ? { guide: guideByCode.get(code) } : {}),
      airports: airportsByCode.get(code) ?? 0,
      airlines: airlinesByCode.get(code) ?? 0,
      cityGuides: cityGuidesByCode.get(code) ?? 0,
      articles: input.articleCounts.get(code) ?? 0,
      routes: routesByCode.get(code) ?? 0,
      ...(airlineQuery ? { airlineQuery } : {}),
    });
  }
  return rows.sort(compareCountries);
}

export function compareCountries(a: Pick<DirectoryCountry, 'name' | 'code'>, b: Pick<DirectoryCountry, 'name' | 'code'>): number {
  return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.code.localeCompare(b.code);
}

/**
 * Featured countries: in each region, the PER_REGION with the most airports
 * listed on /airports (ties A–Z). Every country in the collection has a
 * destination guide, so "has a guide" would not narrow anything down.
 */
export function featuredCountries(rows: DirectoryCountry[], perRegion = 2): DirectoryCountry[] {
  return DIRECTORY_REGIONS.flatMap((r) =>
    rows
      .filter((c) => c.region === r && c.airports > 0)
      .sort((x, y) => y.airports - x.airports || compareCountries(x, y))
      .slice(0, perRegion),
  );
}

/** Cards "Browse all countries" shows at first; each "Show more" adds as many again. */
export const COUNTRIES_BROWSE_LIMIT = 60;

/**
 * Compact tuple sent to the browser:
 * [code, name, region index (-1 none), guide slug, airports, airlines,
 *  city guides, articles, routes, airline query].
 */
export type CountryRow = [string, string, number, string, number, number, number, number, number, string];

export function toRow(c: DirectoryCountry): CountryRow {
  return [
    c.code,
    c.name,
    c.region ? DIRECTORY_REGIONS.indexOf(c.region) : -1,
    c.guide ?? '',
    c.airports,
    c.airlines,
    c.cityGuides,
    c.articles,
    c.routes,
    c.airlineQuery ?? '',
  ];
}

export function fromRow(r: CountryRow): DirectoryCountry {
  const [code, name, region, guide, airports, airlines, cityGuides, articles, routes, airlineQuery] = r;
  return {
    code,
    name,
    ...(region >= 0 ? { region: DIRECTORY_REGIONS[region] } : {}),
    ...(guide ? { guide } : {}),
    airports,
    airlines,
    cityGuides,
    articles,
    routes,
    ...(airlineQuery ? { airlineQuery } : {}),
  };
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}
