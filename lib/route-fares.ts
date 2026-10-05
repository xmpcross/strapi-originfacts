/**
 * Live nonstop fare data for a route, from Travelpayouts' Data API (the same
 * account as app/api/flight-deals and app/api/price-calendar). These are fares
 * Aviasales users found in recent searches, cached by Travelpayouts — not a
 * schedule and not a quote — so every figure is rendered with that label and
 * the time it was fetched.
 *
 * The result (including fetchedAt) is cached for 6 hours with unstable_cache,
 * so the printed fetch time is the real age of the data.
 *
 * Caching: a successful answer is cached for 6 hours even when it holds no
 * fares, so quiet routes do not call the API on every regeneration. A failed
 * request (network, HTTP error, success:false) throws inside the cached
 * function, so it is NOT cached and the next regeneration retries; the page
 * itself regenerates at most once a minute (revalidate = 60), which bounds it.
 *
 * Currency: Travelpayouts converts on its side — `currency` is a documented
 * parameter of both endpoints, on the same free partner token — so each
 * display currency (lib/currency.ts) is fetched and cached on its own, never
 * converted here. The page builds its tables from the USD answer (flight
 * numbers, months, dates and times do not depend on currency) and prints the
 * prices in the visitor's header currency on the client, from
 * farePrices() — USD inline, the others via /api/route-fares.
 *
 * Server-only: uses TRAVELPAYOUTS_API_TOKEN. No token, no data or a failed
 * request all return null, and the sections that need fares do not render.
 */

import { unstable_cache } from 'next/cache';
import { DEFAULT_CURRENCY, type Currency } from '@/lib/currency';

const TP_BASE = 'https://api.travelpayouts.com/aviasales/v3';
const REVALIDATE_SECONDS = 6 * 60 * 60;

type TpFare = {
  price: number;
  airline: string;
  flight_number: string | number;
  departure_at: string; // ISO with the origin's UTC offset, e.g. 2026-10-14T11:00:00+03:00
  duration?: number;
  duration_to?: number;
  transfers?: number;
};

export type MonthFare = {
  month: string; // YYYY-MM
  price: number;
  airline: string;
  flightNumber: string;
  departureAt: string;
};

export type SeenFlight = {
  airline: string;
  flightNumber: string;
  /** Local departure time at the origin, HH:MM, as printed in the fare data. */
  departs: string;
  durationMinutes: number | null;
  /** Distinct departure dates this flight appeared on in the fetched fares. */
  datesSeen: number;
  lowestPrice: number;
};

export type RouteFares = {
  currency: Currency;
  fetchedAt: string;
  months: MonthFare[];
  flights: SeenFlight[];
  airlines: string[];
  duration: { min: number; max: number } | null;
  fareCount: number;
};

class FareFetchError extends Error {}

/** The API's data on success (possibly empty); throws FareFetchError on any failure. */
async function tpGet(token: string, path: string, params: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams(params).toString();
  let res: Response;
  try {
    res = await fetch(`${TP_BASE}/${path}?${qs}`, { headers: { 'X-Access-Token': token }, cache: 'no-store' });
  } catch (err) {
    throw new FareFetchError(`${path}: ${(err as Error).message}`);
  }
  if (!res.ok) throw new FareFetchError(`${path}: HTTP ${res.status}`);
  const json = (await res.json().catch(() => null)) as { success?: boolean; data?: unknown; error?: string } | null;
  if (!json?.success) throw new FareFetchError(`${path}: ${json?.error ?? 'unsuccessful response'}`);
  return json.data ?? null;
}

function isFare(x: unknown): x is TpFare {
  const f = x as TpFare;
  return !!f && typeof f.price === 'number' && typeof f.airline === 'string' && typeof f.departure_at === 'string';
}

/** "11:00" from "2026-10-14T11:00:00+03:00" — the local time as published, no TZ conversion. */
function localTime(iso: string): string {
  const m = /T(\d{2}:\d{2})/.exec(iso);
  return m ? m[1] : '';
}

async function fetchRouteFares(origin: string, destination: string, currency: Currency): Promise<RouteFares | null> {
  const token = process.env.TRAVELPAYOUTS_API_TOKEN;
  if (!token) return null;
  const base = { origin, destination, currency: currency.toLowerCase(), direct: 'true' };
  const [grouped, dated] = await Promise.all([
    tpGet(token, 'grouped_prices', { ...base, group_by: 'month' }),
    tpGet(token, 'prices_for_dates', { ...base, one_way: 'true', sorting: 'price', limit: '1000' }),
  ]);

  const months: MonthFare[] = [];
  if (grouped && typeof grouped === 'object') {
    for (const [month, f] of Object.entries(grouped as Record<string, unknown>)) {
      if (!isFare(f) || (f.transfers ?? 0) !== 0) continue;
      months.push({ month, price: f.price, airline: f.airline, flightNumber: String(f.flight_number), departureAt: f.departure_at });
    }
    months.sort((a, b) => a.month.localeCompare(b.month));
  }

  const fares = Array.isArray(dated) ? dated.filter(isFare).filter((f) => (f.transfers ?? 0) === 0) : [];
  const byFlight = new Map<string, { f: SeenFlight; dates: Set<string> }>();
  const durations: number[] = [];
  for (const f of fares) {
    const flightNumber = String(f.flight_number);
    const key = `${f.airline}${flightNumber}`;
    const minutes = f.duration_to ?? f.duration ?? null;
    if (minutes && minutes > 0) durations.push(minutes);
    const date = f.departure_at.slice(0, 10);
    const hit = byFlight.get(key);
    if (hit) {
      hit.dates.add(date);
      hit.f.lowestPrice = Math.min(hit.f.lowestPrice, f.price);
    } else {
      byFlight.set(key, {
        f: { airline: f.airline, flightNumber, departs: localTime(f.departure_at), durationMinutes: minutes && minutes > 0 ? minutes : null, datesSeen: 0, lowestPrice: f.price },
        dates: new Set([date]),
      });
    }
  }
  const flights = [...byFlight.values()]
    .map(({ f, dates }) => ({ ...f, datesSeen: dates.size }))
    .sort((a, b) => a.departs.localeCompare(b.departs));

  if (months.length === 0 && flights.length === 0) return null;

  const airlines = [...new Set([...flights.map((f) => f.airline), ...months.map((m) => m.airline)])].sort();
  return {
    currency,
    fetchedAt: new Date().toISOString(),
    months,
    flights,
    airlines,
    duration: durations.length ? { min: Math.min(...durations), max: Math.max(...durations) } : null,
    fareCount: fares.length,
  };
}

/** The flight key used by the tables and the price map: airline code + flight number. */
export const flightKey = (f: { airline: string; flightNumber: string }) => `${f.airline}${f.flightNumber}`;

/** Just the prices, keyed the way the tables key their rows — what the client needs to print them. */
export type RouteFarePrices = {
  currency: Currency;
  fetchedAt: string;
  months: Record<string, number>;
  flights: Record<string, number>;
};

export function farePrices(f: RouteFares): RouteFarePrices {
  return {
    currency: f.currency,
    fetchedAt: f.fetchedAt,
    months: Object.fromEntries(f.months.map((m) => [m.month, m.price])),
    flights: Object.fromEntries(f.flights.map((x) => [flightKey(x), x.lowestPrice])),
  };
}

export async function getRouteFares(origin: string, destination: string, currency: Currency = DEFAULT_CURRENCY): Promise<RouteFares | null> {
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  try {
    return await unstable_cache(() => fetchRouteFares(o, d, currency), ['route-fares-v3', o, d, currency], { revalidate: REVALIDATE_SECONDS })();
  } catch (err) {
    if (err instanceof FareFetchError) {
      console.warn(`[route-fares] ${o}-${d} ${currency} unavailable: ${err.message}`);
      return null;
    }
    throw err;
  }
}
