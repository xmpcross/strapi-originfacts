/**
 * City search for the sidebar weather widget, from data the site already has:
 * the OurAirports snapshot in data/airport-enrichment/ourairports.json (public
 * domain). One entry per city (OurAirports `municipality` + country) that has
 * an airport with scheduled service, located at that city's main airport
 * (largest OurAirports type, then most passengers per Wikidata).
 * No third-party geocoder is called.
 *
 * Server-only: reads the data file from disk once per process.
 */
import fs from 'node:fs';
import path from 'node:path';

export type WeatherPlace = {
  name: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  /** IATA code of the airport the coordinates come from. */
  iata: string;
  lat: number;
  lon: number;
};

type OaRow = {
  iata?: string;
  type?: string;
  lat?: number;
  lon?: number;
  country?: string;
  municipality?: string;
  scheduledService?: boolean;
};

const TYPE_RANK: Record<string, number> = { large_airport: 0, medium_airport: 1, small_airport: 2 };

export function normaliseQuery(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

type Indexed = WeatherPlace & { key: string; rank: number; pax: number };

/** Build the per-city index from OurAirports rows (exported for tests). */
export function buildPlaceIndex(rows: Record<string, OaRow>, patronage: Record<string, number> = {}): Indexed[] {
  const byCity = new Map<string, Indexed>();
  for (const [code, a] of Object.entries(rows)) {
    if (!a.scheduledService || !a.municipality || !a.country) continue;
    if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue;
    // Some municipalities read "Perth (Redcliffe)"; search on the city part.
    const name = a.municipality.replace(/\s*\(.*\)\s*$/, '').trim();
    if (!name) continue;
    const id = `${normaliseQuery(name)}|${a.country}`;
    const rank = TYPE_RANK[a.type ?? ''] ?? 3;
    // Busiest airport (Wikidata patronage) breaks ties between same-size ones.
    const pax = patronage[code] ?? 0;
    const prev = byCity.get(id);
    if (prev && (prev.rank < rank || (prev.rank === rank && prev.pax >= pax))) continue;
    byCity.set(id, {
      name,
      country: a.country,
      iata: a.iata ?? code,
      // Two decimals (about 1 km) is plenty for a city's weather and keeps
      // the upstream cache shared.
      lat: Math.round(a.lat * 100) / 100,
      lon: Math.round(a.lon * 100) / 100,
      key: normaliseQuery(name),
      rank,
      pax,
    });
  }
  return [...byCity.values()];
}

let index: Indexed[] | null = null;

function getIndex(): Indexed[] {
  if (index) return index;
  try {
    const read = (name: string) =>
      JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'airport-enrichment', name), 'utf8')) as {
        airports?: Record<string, { patronage?: { value?: number } | null } & OaRow>;
      };
    const patronage: Record<string, number> = {};
    try {
      for (const [code, w] of Object.entries(read('wikidata.json').airports ?? {})) {
        if (typeof w.patronage?.value === 'number') patronage[code] = w.patronage.value;
      }
    } catch {
      /* optional */
    }
    index = buildPlaceIndex(read('ourairports.json').airports ?? {}, patronage);
  } catch {
    index = [];
  }
  return index;
}

/**
 * Up to `limit` places matching `query`: an exact IATA code first, then city
 * names that start with the query, then names containing it as a word; larger
 * airports first within each group.
 */
export function searchPlaces(query: string, limit = 6, places: Indexed[] = getIndex()): WeatherPlace[] {
  const q = normaliseQuery(query);
  if (q.length < 2) return [];
  const upper = query.trim().toUpperCase();
  const scored: { p: Indexed; score: number }[] = [];
  for (const p of places) {
    let score = -1;
    if (upper.length === 3 && p.iata === upper) score = 0;
    else if (p.key === q) score = 1;
    else if (p.key.startsWith(q)) score = 2;
    else if (p.key.includes(` ${q}`)) score = 3;
    if (score >= 0) scored.push({ p, score });
  }
  scored.sort((a, b) => a.score - b.score || a.p.rank - b.p.rank || b.p.pax - a.p.pax || a.p.name.localeCompare(b.p.name));
  return scored.slice(0, limit).map(({ p }) => ({ name: p.name, country: p.country, iata: p.iata, lat: p.lat, lon: p.lon }));
}
