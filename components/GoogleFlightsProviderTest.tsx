'use client';

import { useMemo, useState } from 'react';

type FlightLeg = {
  airline?: string;
  flight_number?: string;
  departure_airport?: { id?: string; time?: string };
  arrival_airport?: { id?: string; time?: string };
};

type FlightResult = {
  flights?: FlightLeg[];
  price?: number;
  total_duration?: number;
  type?: string;
  booking_token?: string;
};

type BookingPart = {
  book_with?: string;
  price?: number;
  airline?: boolean;
  booking_request?: { url?: string; post_data?: string };
};

type BookingOption = {
  together?: BookingPart;
  departing?: BookingPart;
  returning?: BookingPart;
  separate_tickets?: boolean;
};

type ApiData = {
  best_flights?: FlightResult[];
  other_flights?: FlightResult[];
  booking_options?: BookingOption[];
  search_metadata?: Record<string, unknown>;
  error?: string;
};

const PROVIDERS = ['All providers', 'Agoda', 'Booking.com', 'Trip.com', 'Kiwi'];

function futureIso(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function seller(option: BookingOption) {
  return option.together?.book_with || option.departing?.book_with || 'Unknown provider';
}

export default function GoogleFlightsProviderTest() {
  const [origin, setOrigin] = useState('JFK');
  const [destination, setDestination] = useState('LHR');
  const [outboundDate, setOutboundDate] = useState(() => futureIso(30));
  const [returnDate, setReturnDate] = useState(() => futureIso(37));
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [results, setResults] = useState<FlightResult[]>([]);
  const [bookingOptions, setBookingOptions] = useState<BookingOption[]>([]);
  const [raw, setRaw] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookingIndex, setBookingIndex] = useState<number | null>(null);
  const [error, setError] = useState('');

  const filteredOptions = useMemo(() => {
    if (provider === 'All providers') return bookingOptions;
    const needle = provider.toLowerCase().replace('.com', '');
    return bookingOptions.filter((option) => seller(option).toLowerCase().includes(needle));
  }, [bookingOptions, provider]);

  async function readApi(url: string) {
    const response = await fetch(url, { cache: 'no-store' });
    const data = (await response.json()) as ApiData;
    if (!response.ok || data.error) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setBookingOptions([]);
    try {
      const query = new URLSearchParams({
        origin,
        destination,
        outbound_date: outboundDate,
        return_date: returnDate,
        adults: '1',
        currency: 'USD',
      });
      const data = await readApi(`/api/google-flights?${query}`);
      setRaw(data);
      setResults([...(data.best_flights || []), ...(data.other_flights || [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchProviders(flight: FlightResult, index: number) {
    if (!flight.booking_token) return;
    setBookingIndex(index);
    setError('');
    try {
      const query = new URLSearchParams({ booking_token: flight.booking_token, currency: 'USD' });
      const data = await readApi(`/api/google-flights?${query}`);
      setRaw(data);
      setBookingOptions(data.booking_options || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch booking providers.');
    } finally {
      setBookingIndex(null);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={search} className="grid gap-4 rounded-lg border border-forest-900/15 bg-white p-5 shadow-sm md:grid-cols-5">
        <label className="text-sm font-semibold text-forest-900">
          From
          <input value={origin} maxLength={3} onChange={(e) => setOrigin(e.target.value.toUpperCase())} className="mt-1 w-full rounded border border-forest-900/20 px-3 py-2 uppercase" />
        </label>
        <label className="text-sm font-semibold text-forest-900">
          To
          <input value={destination} maxLength={3} onChange={(e) => setDestination(e.target.value.toUpperCase())} className="mt-1 w-full rounded border border-forest-900/20 px-3 py-2 uppercase" />
        </label>
        <label className="text-sm font-semibold text-forest-900">
          Depart
          <input type="date" value={outboundDate} onChange={(e) => setOutboundDate(e.target.value)} className="mt-1 w-full rounded border border-forest-900/20 px-3 py-2" />
        </label>
        <label className="text-sm font-semibold text-forest-900">
          Return
          <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="mt-1 w-full rounded border border-forest-900/20 px-3 py-2" />
        </label>
        <button disabled={loading} className="self-end rounded bg-primary-emphasis px-5 py-2.5 font-bold text-white disabled:opacity-50">
          {loading ? 'Searching…' : 'Search Google Flights'}
        </button>
      </form>

      {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {results.length > 0 && (
        <section>
          <h2 className="editorial-h text-2xl font-bold text-forest-900">Flight results ({results.length})</h2>
          <p className="mt-1 text-sm text-ink/65">Fetching providers costs one additional SerpApi search per itinerary.</p>
          <div className="mt-4 grid gap-3">
            {results.slice(0, 12).map((result, index) => {
              const first = result.flights?.[0];
              const last = result.flights?.[result.flights.length - 1];
              return (
                <article key={`${first?.flight_number}-${index}`} className="flex flex-wrap items-center justify-between gap-4 rounded border border-forest-900/10 bg-white p-4">
                  <div>
                    <p className="font-bold text-forest-900">{result.flights?.map((leg) => leg.airline).filter(Boolean).join(' + ') || 'Unknown airline'}</p>
                    <p className="text-sm text-ink/70">{first?.departure_airport?.id} {first?.departure_airport?.time} → {last?.arrival_airport?.id} {last?.arrival_airport?.time}</p>
                    <p className="text-sm text-ink/70">{result.total_duration || '—'} min · {result.flights?.length || 0} segment(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-forest-900">${result.price ?? '—'}</p>
                    <button type="button" disabled={!result.booking_token || bookingIndex !== null} onClick={() => fetchProviders(result, index)} className="mt-2 rounded border border-forest-900/20 px-3 py-1.5 text-sm font-semibold text-forest-900 disabled:opacity-40">
                      {bookingIndex === index ? 'Fetching…' : 'Fetch booking providers'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {bookingOptions.length > 0 && (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="editorial-h text-2xl font-bold text-forest-900">Booking providers</h2>
              <p className="text-sm text-ink/65">Filter is applied locally after Google returns its available sellers.</p>
            </div>
            <label className="text-sm font-semibold text-forest-900">Provider
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className="ml-2 rounded border border-forest-900/20 px-3 py-2">
                {PROVIDERS.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 overflow-x-auto rounded border border-forest-900/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-forest-900/[0.04]"><tr><th className="p-3">Seller</th><th className="p-3">Price</th><th className="p-3">Airline direct?</th><th className="p-3">Booking action</th></tr></thead>
              <tbody>{filteredOptions.map((option, index) => {
                const part = option.together || option.departing;
                return <tr key={`${seller(option)}-${index}`} className="border-t border-forest-900/10"><td className="p-3 font-semibold">{seller(option)}</td><td className="p-3">${part?.price ?? '—'}</td><td className="p-3">{part?.airline ? 'Yes' : 'No'}</td><td className="p-3">{part?.booking_request?.url ? 'URL returned' : 'No URL'}</td></tr>;
              })}</tbody>
            </table>
          </div>
          {filteredOptions.length === 0 && <p className="mt-3 text-sm text-ink/65">Google did not offer that provider for this itinerary.</p>}
        </section>
      )}

      {raw && (
        <details className="rounded border border-forest-900/10 bg-slate-950 text-slate-100">
          <summary className="cursor-pointer p-4 font-semibold">Inspect latest raw SerpApi response</summary>
          <pre className="max-h-[650px] overflow-auto border-t border-white/10 p-4 text-xs">{JSON.stringify(raw, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
