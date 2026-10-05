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
 * Server-only: uses TRAVELPAYOUTS_API_TOKEN. A missing token or a failed
 * request returns null, and the sections that need it do not render.
 */

import { unstable_cache } from 'next/cache';

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
  currency: 'USD';
  fetchedAt: string;
  months: MonthFare[];
  flights: SeenFlight[];
  airlines: string[];
  duration: { min: number; max: number } | null;
  fareCount: number;
};

async function tpGet(path: string, params: Record<string, string>): Promise<unknown> {
  const token = process.env.TRAVELPAYOUTS_API_TOKEN;
  if (!token) return null;
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${TP_BASE}/${path}?${qs}`, {
      headers: { 'X-Access-Token': token },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; data?: unknown };
    return json.success ? json.data ?? null : null;
  } catch {
    return null;
  }
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

async function fetchRouteFares(origin: string, destination: string): Promise<RouteFares | null> {
  const base = { origin, destination, currency: 'usd', direct: 'true' };
  const [grouped, dated] = await Promise.all([
    tpGet('grouped_prices', { ...base, group_by: 'month' }),
    tpGet('prices_for_dates', { ...base, one_way: 'true', sorting: 'price', limit: '1000' }),
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
    currency: 'USD',
    fetchedAt: new Date().toISOString(),
    months,
    flights,
    airlines,
    duration: durations.length ? { min: Math.min(...durations), max: Math.max(...durations) } : null,
    fareCount: fares.length,
  };
}

export function getRouteFares(origin: string, destination: string): Promise<RouteFares | null> {
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  return unstable_cache(() => fetchRouteFares(o, d), ['route-fares-v1', o, d], { revalidate: REVALIDATE_SECONDS })();
}
