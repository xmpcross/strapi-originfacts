/**
 * "Explore from origin" data sources for the countries-page spike.
 *
 * Two providers behind the same return shape so the UI doesn't care where
 * data came from:
 *
 *   1. TravelPayouts  — uses TRAVELPAYOUTS_API_TOKEN already in .env.local.
 *      Free for affiliates; click-throughs route via our existing TP marker
 *      so any conversions still earn commission.
 *
 *   2. SerpAPI Google Travel Explore — needs SERPAPI_API_KEY. Paid tier
 *      (~$75/mo entry). Returns Google's curated destination grid with
 *      photos, but the booking link still points to Google Travel rather
 *      than an affiliate gateway.
 *
 * Both fetchers cache for 1 hour to avoid hammering the upstream APIs.
 */

export type ExploreFare = {
  destinationIata?: string;
  destinationName: string;       // city / airport / "Japan" depending on source
  countryCode?: string;
  priceMinor: number;            // smallest currency unit avoided — raw integer USD
  currency: string;
  airline?: string;
  departureDate?: string;        // ISO yyyy-mm-dd if available
  returnDate?: string;
  bookingUrl?: string;
  imageUrl?: string;
  source: 'travelpayouts' | 'serpapi';
};

export type ExploreResult = {
  source: 'travelpayouts' | 'serpapi';
  ok: boolean;
  fares: ExploreFare[];
  /** When ok=false, a short reason intended for the developer (e.g. missing key). */
  error?: string;
  /** Raw upstream response shape — only included for the spike comparison UI. */
  rawSample?: unknown;
};

const FETCH_REVALIDATE_SECS = 3600;

/**
 * Build a TravelPayouts deep-link search URL.
 *
 * We route through our own `/flights` page so visitors land on
 * originfacts first (branding + analytics + future ad slots), and that page
 * server-redirects to the TravelPayouts white-label host with the affiliate
 * marker attached. The query-string form keeps the ISO dates intact for both
 * sides of the redirect.
 */
function buildAviasalesSearchUrl(opts: {
  origin: string;
  destination: string;
  departureISO?: string;
  returnISO?: string;
  passengers?: number;
}): string {
  const params = new URLSearchParams({
    origin: opts.origin,
    destination: opts.destination,
  });
  if (opts.departureISO) params.set('depart', opts.departureISO);
  if (opts.returnISO) params.set('return', opts.returnISO);
  if (opts.passengers) params.set('pax', String(opts.passengers));
  return `/flights?${params.toString()}`;
}

/**
 * Build the actual TravelPayouts deep-link URL the /flights page
 * redirects to once it has resolved its query params. Exposed so the page
 * can call it server-side.
 *
 * Host resolution:
 *   - If NEXT_PUBLIC_TP_WL_HOST is set (e.g. "flights.originfacts.com"), the
 *     link routes through our own white-label domain. Brand stays ours and
 *     the affiliate marker is still honoured.
 *   - Otherwise we fall back to `www.aviasales.com`.
 *
 * Path format on both hosts:
 *   /search/{ORG}{DDMM}{DST}{DDMM}{PAX}?marker={MARKER}
 */
export function buildTravelpayoutsDeepLink(opts: {
  origin: string;
  destination: string;
  departureISO?: string;
  returnISO?: string;
  passengers?: number;
}): string {
  const marker = process.env.NEXT_PUBLIC_TP_MARKER ?? '';
  const host = process.env.NEXT_PUBLIC_TP_WL_HOST?.trim() || 'www.aviasales.com';
  const dep = opts.departureISO ? isoToDDMM(opts.departureISO) : '';
  const ret = opts.returnISO ? isoToDDMM(opts.returnISO) : '';
  const pax = opts.passengers ?? 1;
  return `https://${host}/search/${opts.origin}${dep}${opts.destination}${ret}${pax}${marker ? `?marker=${marker}` : ''}`;
}

function isoToDDMM(iso: string): string {
  // iso = "YYYY-MM-DD"; produce "DDMM"
  if (iso.length < 10) return '';
  const month = iso.slice(5, 7);
  const day = iso.slice(8, 10);
  return `${day}${month}`;
}

// --------------------------------------------------------------------------
// TravelPayouts — v1/city-directions returns a flat IATA → cheapest fare map
// from a given origin city. We filter to the requested country afterwards
// by joining with our Strapi airport list.
// --------------------------------------------------------------------------

export async function fetchTravelpayoutsExplore(opts: {
  originIata: string;
  countryDestinationIatas: string[];   // pass in to filter to the country
  countryCode?: string;
  limit?: number;
}): Promise<ExploreResult> {
  const token = process.env.TRAVELPAYOUTS_API_TOKEN;
  if (!token) {
    return { source: 'travelpayouts', ok: false, fares: [], error: 'TRAVELPAYOUTS_API_TOKEN not set' };
  }
  const url = `https://api.travelpayouts.com/v1/city-directions?origin=${encodeURIComponent(opts.originIata)}&currency=USD&token=${token}`;
  try {
    const res = await fetch(url, { next: { revalidate: FETCH_REVALIDATE_SECS } });
    if (!res.ok) {
      return { source: 'travelpayouts', ok: false, fares: [], error: `TP HTTP ${res.status}` };
    }
    const json = (await res.json()) as {
      success?: boolean;
      data?: Record<string, {
        price?: number;
        airline?: string;
        departure_at?: string;
        return_at?: string;
        flight_number?: string;
        transfers?: number;
        expires_at?: string;
      }>;
    };
    if (!json.success || !json.data) {
      return { source: 'travelpayouts', ok: false, fares: [], error: 'TP returned no data', rawSample: json };
    }

    const allow = new Set(opts.countryDestinationIatas.map((c) => c.toUpperCase()));
    const fares: ExploreFare[] = [];
    for (const [iata, row] of Object.entries(json.data)) {
      const code = iata.toUpperCase();
      if (allow.size > 0 && !allow.has(code)) continue;
      if (typeof row.price !== 'number') continue;
      const depISO = row.departure_at?.slice(0, 10);
      const retISO = row.return_at?.slice(0, 10);
      fares.push({
        destinationIata: code,
        destinationName: code,
        countryCode: opts.countryCode,
        priceMinor: Math.round(row.price),
        currency: 'USD',
        airline: row.airline,
        departureDate: depISO,
        returnDate: retISO,
        bookingUrl: buildAviasalesSearchUrl({
          origin: opts.originIata,
          destination: code,
          departureISO: depISO,
          returnISO: retISO,
        }),
        source: 'travelpayouts',
      });
    }
    fares.sort((a, b) => a.priceMinor - b.priceMinor);
    const limited = opts.limit ? fares.slice(0, opts.limit) : fares;
    return { source: 'travelpayouts', ok: true, fares: limited, rawSample: json.data };
  } catch (err) {
    return {
      source: 'travelpayouts',
      ok: false,
      fares: [],
      error: err instanceof Error ? err.message : 'TP fetch failed',
    };
  }
}

// --------------------------------------------------------------------------
// SerpAPI Google Travel Explore — needs SERPAPI_API_KEY. Returns Google's
// curated explore grid; we map the trip entries into our common shape.
// --------------------------------------------------------------------------

export async function fetchSerpapiExplore(opts: {
  originIata: string;
  countryName?: string;          // optional — omit to get global "where can I fly from" grid
  outboundDate?: string;         // ISO yyyy-mm-dd; defaults to ~30 days out
  returnDate?: string;
  /** Month index (1-12) — used when no explicit dates passed. Picks day-15 of that month next/this year. */
  monthIndex?: number;
  /** Trip duration in days. SerpAPI accepts `trip_length`. */
  tripLength?: number;
  /** Max price ceiling in USD. SerpAPI accepts `max_price`. */
  maxPrice?: number;
  /** Currency for the returned prices (SerpAPI converts). Defaults to USD. */
  currency?: string;
  /** 0 = non-stop, 1 = up to 1 stop, etc. */
  maxStops?: number;
  limit?: number;
}): Promise<ExploreResult> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) {
    return {
      source: 'serpapi',
      ok: false,
      fares: [],
      error: 'SERPAPI_API_KEY not set in .env.local — add a key from https://serpapi.com to enable this panel.',
    };
  }
  // If a month index is given, pick day-15 of that month (this year if still
  // ahead, otherwise next year). Default outbound = 30 days out.
  let outboundISO = opts.outboundDate;
  let returnISO = opts.returnDate;
  if (!outboundISO) {
    if (opts.monthIndex && opts.monthIndex >= 1 && opts.monthIndex <= 12) {
      const now = new Date();
      const targetYear = opts.monthIndex < now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear();
      outboundISO = new Date(Date.UTC(targetYear, opts.monthIndex - 1, 15)).toISOString().slice(0, 10);
    } else {
      outboundISO = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }
  }
  if (!returnISO) {
    const days = opts.tripLength ?? 7;
    returnISO = new Date(new Date(outboundISO).getTime() + days * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
  }

  // NOTE: `travel_mode` is rejected by google_travel_explore (that's a
  // google_flights-only param). Air-only is implicit on this engine.
  const params = new URLSearchParams({
    engine: 'google_travel_explore',
    departure_id: opts.originIata,
    outbound_date: outboundISO,
    return_date: returnISO,
    currency: (opts.currency || 'USD').toUpperCase(),
    api_key: key,
  });
  if (opts.countryName) params.set('q', opts.countryName);
  if (opts.tripLength) params.set('trip_length', String(opts.tripLength));
  if (opts.maxPrice) params.set('max_price', String(opts.maxPrice));
  if (opts.maxStops != null) params.set('stops', String(opts.maxStops));
  try {
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      next: { revalidate: FETCH_REVALIDATE_SECS },
    });
    if (!res.ok) {
      return { source: 'serpapi', ok: false, fares: [], error: `SerpAPI HTTP ${res.status}` };
    }
    // google_travel_explore returns a `destinations` array with this shape:
    //   { name, country, destination_airport: {code, location}, thumbnail,
    //     flight_price, start_date, end_date, airline, number_of_stops, link }
    type SerpapiDestination = {
      name?: string;
      country?: string;
      destination_airport?: { code?: string; location?: string };
      thumbnail?: string;
      flight_price?: number | string;
      airline?: string;
      start_date?: string;
      end_date?: string;
      number_of_stops?: number;
      link?: string;
    };
    const json = (await res.json()) as {
      destinations?: SerpapiDestination[];
      error?: string;
    };
    if (json.error) {
      return { source: 'serpapi', ok: false, fares: [], error: json.error, rawSample: json };
    }
    const destinations = json.destinations ?? [];
    const fares: ExploreFare[] = destinations
      .map<ExploreFare | null>((d) => {
        const priceNum = typeof d.flight_price === 'string'
          ? Number(d.flight_price.replace(/[^0-9.]/g, ''))
          : d.flight_price;
        if (!d.name || !priceNum || Number.isNaN(priceNum)) return null;
        return {
          destinationIata: d.destination_airport?.code,
          destinationName: d.country ? `${d.name}, ${d.country}` : d.name,
          priceMinor: Math.round(priceNum),
          currency: (opts.currency || 'USD').toUpperCase(),
          airline: d.airline,
          departureDate: d.start_date,
          returnDate: d.end_date,
          bookingUrl: d.link,
          imageUrl: d.thumbnail,
          source: 'serpapi',
        };
      })
      .filter((f): f is ExploreFare => f !== null);

    // Apply post-fetch filters that the API doesn't always honour reliably.
    let filtered = fares;
    if (opts.maxPrice) filtered = filtered.filter((f) => f.priceMinor <= opts.maxPrice!);
    if (opts.maxStops != null) {
      // SerpAPI doesn't always pass this through; if `number_of_stops` is on
      // the original payload, mirror it here. We already lost the field at
      // map time, so cross-reference via the original `destinations` array.
      const codesWithStops = new Map(
        destinations
          .filter((d) => d.destination_airport?.code && typeof d.number_of_stops === 'number')
          .map((d) => [d.destination_airport!.code!, d.number_of_stops!] as const),
      );
      filtered = filtered.filter((f) => {
        if (!f.destinationIata) return true;
        const s = codesWithStops.get(f.destinationIata);
        return s == null || s <= opts.maxStops!;
      });
    }

    filtered.sort((a, b) => a.priceMinor - b.priceMinor);
    const limited = opts.limit ? filtered.slice(0, opts.limit) : filtered;
    return { source: 'serpapi', ok: true, fares: limited, rawSample: destinations.slice(0, 1) };
  } catch (err) {
    return {
      source: 'serpapi',
      ok: false,
      fares: [],
      error: err instanceof Error ? err.message : 'SerpAPI fetch failed',
    };
  }
}
