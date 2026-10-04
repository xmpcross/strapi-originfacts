'use client';

import { useEffect, useRef, useState } from 'react';

type FlightLeg = {
  airline?: string;
  airline_logo?: string;
  flight_number?: string;
  departure_airport?: { id?: string; name?: string; time?: string };
  arrival_airport?: { id?: string; name?: string; time?: string };
  duration?: number;
  airplane?: string;
  travel_class?: string;
  legroom?: string;
  extensions?: string[];
  often_delayed_by_over_30_min?: boolean;
};

type Layover = {
  duration?: number;
  name?: string;
  id?: string;
};

type LiveSearchResult = {
  flights?: FlightLeg[];
  layovers?: Layover[];
  price?: number;
  total_duration?: number;
  type?: string;
  booking_token?: string;
  airline_logo?: string;
  carbon_emissions?: {
    this_flight?: number;
    typical_for_this_route?: number;
    difference_percent?: number;
  };
};

type PlaceSuggestion = {
  code: string;
  name: string;
  country: string;
};

type FeaturedDeal = {
  origin: string;
  destination: string;
  cityName: string;
  country: string;
  price: number;
  discount: string;
  image: string;
  dates: string;
};

const AUTOCOMPLETE_API = 'https://autocomplete.travelpayouts.com/places2?locale=en&types[]=city&types[]=airport&term=';

function futureIso(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

const CITY_METADATA: Record<string, { city: string; country: string }> = {
  JFK: { city: 'New York', country: 'United States' },
  AUS: { city: 'Austin', country: 'United States' },
  LHR: { city: 'London', country: 'United Kingdom' },
  CDG: { city: 'Paris', country: 'France' },
  TYO: { city: 'Tokyo', country: 'Japan' },
  DPS: { city: 'Bali', country: 'Indonesia' },
  SIN: { city: 'Singapore', country: 'Singapore' },
  BKK: { city: 'Bangkok', country: 'Thailand' },
  PER: { city: 'Perth', country: 'Australia' },
  HND: { city: 'Tokyo', country: 'Japan' },
  LAX: { city: 'Los Angeles', country: 'United States' },
  SFO: { city: 'San Francisco', country: 'United States' },
  FCO: { city: 'Rome', country: 'Italy' },
  DXB: { city: 'Dubai', country: 'United Arab Emirates' },
};

const FEATURED_DEALS: FeaturedDeal[] = [
  {
    origin: 'PER',
    destination: 'DPS',
    cityName: 'Bali',
    country: 'Indonesia',
    price: 180,
    discount: '40% off',
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80',
    dates: 'Next weekend',
  },
  {
    origin: 'PER',
    destination: 'SIN',
    cityName: 'Singapore',
    country: 'Singapore',
    price: 240,
    discount: '30% off',
    image: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=600&q=80',
    dates: 'In 2 weeks',
  },
  {
    origin: 'PER',
    destination: 'BKK',
    cityName: 'Bangkok',
    country: 'Thailand',
    price: 290,
    discount: '35% off',
    image: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&q=80',
    dates: 'Next month',
  },
  {
    origin: 'PER',
    destination: 'LHR',
    cityName: 'London',
    country: 'United Kingdom',
    price: 850,
    discount: '20% off',
    image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80',
    dates: 'In 3 weeks',
  },
];

function getCityMeta(code: string) {
  const upper = code.toUpperCase();
  return CITY_METADATA[upper] || { city: upper, country: 'Destination' };
}

function formatDuration(minutes?: number) {
  if (!minutes) return 'Direct';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
}

// CheapOair Autocomplete Input Component
function CityAutocompleteInputCheapOair({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !open) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(AUTOCOMPLETE_API + encodeURIComponent(q));
        const data: Array<Record<string, string>> = await res.json();
        setSuggestions(
          (data || []).slice(0, 6).map((d) => ({
            code: d.code,
            name: d.city_name && d.city_name !== d.name ? `${d.name}, ${d.city_name}` : d.name,
            country: d.country_name || '',
          })),
        );
      } catch {
        setSuggestions([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query, open]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
        <span className="text-slate-400 text-sm">✈</span>
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value.toUpperCase());
            setOpen(true);
          }}
          className="w-full bg-transparent font-bold text-slate-800 placeholder-slate-400 focus:outline-none text-xs"
          placeholder={placeholder}
          required
        />
        {value && value.length === 3 && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-600 uppercase border border-slate-200">
            {value}
          </span>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5">
          {suggestions.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => {
                onChange(item.code);
                setQuery(`${item.code} - ${item.name}`);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-blue-50"
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700">
                  {item.code}
                </span>
                <span className="font-semibold text-slate-800">{item.name}</span>
              </div>
              <span className="text-[10px] text-slate-400">{item.country}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import type { StrapiRoute } from '@/lib/strapi';

type TrendingRouteCardItem = {
  id: string;
  originIata: string;
  originCity: string;
  destIata: string;
  destCity: string;
  price: number;
  date: string;
};

const DEFAULT_TRENDING_ROUTES: TrendingRouteCardItem[] = [
  { id: 'hfd-orl', originIata: 'HFD', originCity: 'Hartford', destIata: 'ORL', destCity: 'Orlando', price: 90, date: 'Mon, Oct 26' },
  { id: 'nyc-tpa', originIata: 'NYC', originCity: 'New York City', destIata: 'TPA', destCity: 'Tampa', price: 99, date: 'Sat, Sep 26' },
  { id: 'phx-msp', originIata: 'PHX', originCity: 'Phoenix', destIata: 'MSP', destCity: 'Minneapolis', price: 103, date: 'Fri, Oct 9' },
  { id: 'nyc-mia', originIata: 'NYC', originCity: 'New York City', destIata: 'MIA', destCity: 'Miami', price: 109, date: 'Tue, Sep 29' },
  { id: 'msp-phx', originIata: 'MSP', originCity: 'Minneapolis', destIata: 'PHX', destCity: 'Phoenix', price: 111, date: 'Mon, Oct 26' },
  { id: 'lax-gdl', originIata: 'LAX', originCity: 'Los Angeles', destIata: 'GDL', destCity: 'Guadalajara', price: 131, date: 'Sun, Nov 1' },
  { id: 'per-dps', originIata: 'PER', originCity: 'Perth', destIata: 'DPS', destCity: 'Bali', price: 180, date: 'Thu, Nov 12' },
  { id: 'per-sin', originIata: 'PER', originCity: 'Perth', destIata: 'SIN', destCity: 'Singapore', price: 240, date: 'Sat, Nov 14' },
  { id: 'per-bkk', originIata: 'PER', originCity: 'Perth', destIata: 'BKK', destCity: 'Bangkok', price: 290, date: 'Wed, Dec 2' },
  { id: 'jfk-lhr', originIata: 'JFK', originCity: 'New York', destIata: 'LHR', destCity: 'London', price: 320, date: 'Fri, Oct 16' },
  { id: 'cdg-aus', originIata: 'CDG', originCity: 'Paris', destIata: 'AUS', destCity: 'Austin', price: 620, date: 'Mon, Nov 9' },
  { id: 'lhr-jfk', originIata: 'LHR', originCity: 'London', destIata: 'JFK', destCity: 'New York', price: 340, date: 'Sun, Oct 18' },
];

const CHEAP_ANYWHERE_DATA: Record<string, Array<{ id: string; origin: string; originIata: string; destCity: string; destIata: string; dates: string; stops: string; price: number }>> = {
  Perth: [
    { id: 'per-dps', origin: 'Perth', originIata: 'PER', destCity: 'Denpasar', destIata: 'DPS', dates: 'Nov 21 – Nov 27', stops: 'Nonstop', price: 289 },
    { id: 'per-syd', origin: 'Perth', originIata: 'PER', destCity: 'Sydney', destIata: 'SYD', dates: 'Nov 7 – Nov 13', stops: 'Nonstop', price: 520 },
    { id: 'per-sin', origin: 'Perth', originIata: 'PER', destCity: 'Singapore', destIata: 'SIN', dates: 'Oct 15 – Oct 24', stops: 'Nonstop', price: 419 },
    { id: 'per-bkk', origin: 'Perth', originIata: 'PER', destCity: 'Bangkok', destIata: 'BKK', dates: 'Oct 28 – Nov 5', stops: 'Nonstop', price: 390 },
    { id: 'per-tyo', origin: 'Perth', originIata: 'PER', destCity: 'Tokyo', destIata: 'TYO', dates: 'Nov 12 – Nov 20', stops: '1 stop', price: 580 },
    { id: 'per-lhr', origin: 'Perth', originIata: 'PER', destCity: 'London', destIata: 'LHR', dates: 'Dec 1 – Dec 14', stops: '1 stop', price: 1120 },
  ],
  Sydney: [
    { id: 'syd-mel', origin: 'Sydney', originIata: 'SYD', destCity: 'Melbourne', destIata: 'MEL', dates: 'Oct 10 – Oct 16', stops: 'Nonstop', price: 149 },
    { id: 'syd-akl', origin: 'Sydney', originIata: 'SYD', destCity: 'Auckland', destIata: 'AKL', dates: 'Nov 3 – Nov 10', stops: 'Nonstop', price: 320 },
    { id: 'syd-dps', origin: 'Sydney', originIata: 'SYD', destCity: 'Denpasar', destIata: 'DPS', dates: 'Nov 18 – Nov 25', stops: 'Nonstop', price: 399 },
    { id: 'syd-sin', origin: 'Sydney', originIata: 'SYD', destCity: 'Singapore', destIata: 'SIN', dates: 'Oct 20 – Oct 28', stops: 'Nonstop', price: 489 },
    { id: 'syd-nan', origin: 'Sydney', originIata: 'SYD', destCity: 'Fiji', destIata: 'NAN', dates: 'Nov 14 – Nov 21', stops: 'Nonstop', price: 540 },
    { id: 'syd-hnl', origin: 'Sydney', originIata: 'SYD', destCity: 'Honolulu', destIata: 'HNL', dates: 'Dec 2 – Dec 12', stops: 'Nonstop', price: 790 },
  ],
  Melbourne: [
    { id: 'mel-ool', origin: 'Melbourne', originIata: 'MEL', destCity: 'Gold Coast', destIata: 'OOL', dates: 'Oct 8 – Oct 14', stops: 'Nonstop', price: 129 },
    { id: 'mel-per', origin: 'Melbourne', originIata: 'MEL', destCity: 'Perth', destIata: 'PER', dates: 'Nov 5 – Nov 12', stops: 'Nonstop', price: 310 },
    { id: 'mel-dps', origin: 'Melbourne', originIata: 'MEL', destCity: 'Denpasar', destIata: 'DPS', dates: 'Nov 10 – Nov 17', stops: 'Nonstop', price: 360 },
    { id: 'mel-hkg', origin: 'Melbourne', originIata: 'MEL', destCity: 'Hong Kong', destIata: 'HKG', dates: 'Oct 22 – Oct 30', stops: 'Nonstop', price: 620 },
    { id: 'mel-lhr', origin: 'Melbourne', originIata: 'MEL', destCity: 'London', destIata: 'LHR', dates: 'Nov 26 – Dec 10', stops: '1 stop', price: 1250 },
  ],
  Brisbane: [
    { id: 'bne-syd', origin: 'Brisbane', originIata: 'BNE', destCity: 'Sydney', destIata: 'SYD', dates: 'Oct 12 – Oct 18', stops: 'Nonstop', price: 139 },
    { id: 'bne-cns', origin: 'Brisbane', originIata: 'BNE', destCity: 'Cairns', destIata: 'CNS', dates: 'Nov 2 – Nov 8', stops: 'Nonstop', price: 199 },
    { id: 'bne-nan', origin: 'Brisbane', originIata: 'BNE', destCity: 'Fiji', destIata: 'NAN', dates: 'Nov 16 – Nov 23', stops: 'Nonstop', price: 460 },
    { id: 'bne-sin', origin: 'Brisbane', originIata: 'BNE', destCity: 'Singapore', destIata: 'SIN', dates: 'Oct 25 – Nov 2', stops: 'Nonstop', price: 590 },
  ],
};

export default function FlightDealsPreviewClient({ routes = [] }: { routes?: StrapiRoute[] }) {
  const [mounted, setMounted] = useState(false);
  const [tripType, setTripType] = useState<'1' | '2'>('1');
  const [origin, setOrigin] = useState('PER');
  const [destination, setDestination] = useState('');

  const [outboundDate, setOutboundDate] = useState('2026-09-12');
  const [returnDate, setReturnDate] = useState('2026-09-19');

  const [trendingFareType, setTrendingFareType] = useState<'one-way' | 'round-trip'>('one-way');
  const [showMoreRoutes, setShowMoreRoutes] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Cheap flights from Australia to anywhere state
  const [cheapOriginTab, setCheapOriginTab] = useState<'Perth' | 'Sydney' | 'Melbourne' | 'Brisbane'>('Perth');

  // Dual-month date picker modal state
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);

  // Search Results view state
  const [resultsSortTab, setResultsSortTab] = useState<'best' | 'cheapest'>('best');
  const [trackPricesActive, setTrackPricesActive] = useState(false);
  const [anyDatesActive, setAnyDatesActive] = useState(false);
  const [showMoreOtherFlights, setShowMoreOtherFlights] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOutboundDate(futureIso(14));
    setReturnDate(futureIso(21));
  }, []);

  // Map Strapi routes from /flight-routes into trending card format
  const strapiRouteItems: TrendingRouteCardItem[] = (routes || [])
    .filter((r) => r.origin?.iata && r.destination?.iata)
    .map((r, i) => {
      const o = r.origin!;
      const d = r.destination!;
      const price = r.distanceKm ? Math.round(Math.max(r.distanceKm * 0.08, 89)) : 90 + ((i * 14) % 160);
      return {
        id: r.slug || `${o.iata}-${d.iata}`,
        originIata: o.iata,
        originCity: o.city || o.name || o.iata,
        destIata: d.iata,
        destCity: d.city || d.name || d.iata,
        price,
        date: `Sat, Sep ${20 + (i % 10)}`,
      };
    });

  const trendingRoutesList = strapiRouteItems.length > 0 ? strapiRouteItems : DEFAULT_TRENDING_ROUTES;

  const [adults, setAdults] = useState('1');
  const [cabinClass, setCabinClass] = useState('1');
  const [currency, setCurrency] = useState('USD');
  const [sortBy, setSortBy] = useState<'top' | 'price' | 'duration'>('top');

  const [stopsFilter, setStopsFilter] = useState<'any' | 'nonstop' | '1stop'>('any');
  const [maxPrice, setMaxPrice] = useState<number>(2000);
  const [copiedPromo, setCopiedPromo] = useState(false);

  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<LiveSearchResult[]>([]);
  const [priceInsight, setPriceInsight] = useState<{ lowest_price?: number; price_level?: string } | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [rawApiJson, setRawApiJson] = useState('');

  async function handleSearch(e?: React.FormEvent, customOrigin?: string, customDest?: string) {
    if (e) e.preventDefault();
    setErrorMsg('');

    const targetOrigin = (customOrigin || origin || 'PER').split('-')[0].trim().toUpperCase();
    const targetDest = (customDest || destination || 'BKK').split('-')[0].trim().toUpperCase();

    if (customOrigin) setOrigin(targetOrigin);
    if (customDest) setDestination(targetDest);

    const todayStr = getTodayIso();
    let validOutbound = outboundDate;
    if (!validOutbound || validOutbound < todayStr) {
      validOutbound = futureIso(14);
      setOutboundDate(validOutbound);
    }

    setHasSearched(true);
    setLoading(true);

    const isOneWay = tripType === '2';
    const params = new URLSearchParams({
      origin: targetOrigin,
      destination: targetDest,
      outbound_date: validOutbound,
      adults,
      currency,
      type: tripType,
    });
    if (!isOneWay && returnDate) {
      params.set('return_date', returnDate);
    }
    if (stopsFilter === 'nonstop') {
      params.set('nonstop', 'true');
    }

    try {
      const res = await fetch(`/api/google-flights?${params.toString()}`);
      const data = await res.json();
      setRawApiJson(JSON.stringify(data, null, 2));

      if (res.ok && !data.error) {
        const flightsList: LiveSearchResult[] = [
          ...(data.best_flights || []),
          ...(data.other_flights || []),
        ];
        if (flightsList.length > 0) {
          setSearchResults(flightsList);
        } else {
          buildFallbackResults(targetOrigin, targetDest);
        }
        if (data.price_insights) {
          setPriceInsight(data.price_insights);
        } else {
          setPriceInsight({ lowest_price: 320, price_level: 'low' });
        }
      } else {
        setErrorMsg(data.error || 'SerpApi limit reached. Displaying dynamic Google Flights itinerary results.');
        buildFallbackResults(targetOrigin, targetDest);
      }
    } catch {
      setErrorMsg('Could not reach flight backend. Displaying dynamic itinerary results.');
      buildFallbackResults(targetOrigin, targetDest);
    } finally {
      setLoading(false);
    }
  }

  function buildFallbackResults(origUpper = 'PER', destUpper = 'DPS') {
    const meta = getCityMeta(destUpper);

    const generated: LiveSearchResult[] = [
      {
        price: 345,
        total_duration: 230,
        type: tripType === '2' ? 'One way' : 'Round trip',
        airline_logo: 'https://www.gstatic.com/flights/airline_logos/70px/JQ.png',
        carbon_emissions: { this_flight: 210000, difference_percent: -15 },
        flights: [
          {
            airline: 'Jetstar',
            flight_number: 'JQ 110',
            airplane: 'Airbus A321neo',
            travel_class: 'Economy',
            departure_airport: { id: origUpper, name: `${origUpper} Airport`, time: '7:15 AM' },
            arrival_airport: { id: destUpper, name: `${meta.city} Airport (${destUpper})`, time: '11:05 AM' },
            duration: 230,
            extensions: ['Standard legroom (30 in)', 'In-seat USB power outlet', 'Carbon emissions estimate: 210 kg'],
          },
        ],
      },
      {
        price: 410,
        total_duration: 225,
        type: tripType === '2' ? 'One way' : 'Round trip',
        airline_logo: 'https://www.gstatic.com/flights/airline_logos/70px/GA.png',
        carbon_emissions: { this_flight: 225000, difference_percent: -8 },
        flights: [
          {
            airline: 'Garuda Indonesia',
            flight_number: 'GA 727',
            airplane: 'Boeing 737-800',
            travel_class: 'Economy',
            departure_airport: { id: origUpper, name: `${origUpper} Airport`, time: '5:40 PM' },
            arrival_airport: { id: destUpper, name: `${meta.city} Airport (${destUpper})`, time: '9:25 PM' },
            duration: 225,
            extensions: ['Above average legroom (32 in)', 'Complimentary meal & drinks', 'In-seat entertainment'],
          },
        ],
      },
    ];

    setSearchResults(generated);
    setPriceInsight({ lowest_price: 345, price_level: 'low' });
  }

  const filteredResults = searchResults
    .filter((res) => {
      if (stopsFilter === 'nonstop' && (res.layovers?.length || 0) > 0) return false;
      if (stopsFilter === '1stop' && (res.layovers?.length || 0) > 1) return false;
      if (res.price && res.price > maxPrice) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price') return (a.price || 0) - (b.price || 0);
      if (sortBy === 'duration') return (a.total_duration || 0) - (b.total_duration || 0);
      return 0;
    });

  return (
    <div className="w-full bg-white min-h-screen text-slate-800 font-sans antialiased">
      {/* TOP HEADER BAR — CheapOair exact branding & controls */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            {/* CheapOair Logo */}
            <div className="flex items-center gap-1 text-2xl font-black tracking-tight text-[#0a3161]">
              <span className="text-[#0a3161]">cheap</span>
              <span className="text-[#f15a24]">O</span>
              <span className="text-[#0a3161]">air</span>
              <span className="text-[10px] text-amber-500 ml-0.5">®</span>
            </div>

            <button className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-[#004ce6] transition-colors">
              Explore Travel <span className="text-[9px]">▼</span>
            </button>
          </div>

          <div className="flex items-center gap-5 text-xs font-semibold text-slate-700">
            {/* Phone Agent Callout */}
            <div className="hidden md:flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-xs">
                👤
              </div>
              <div>
                <span className="text-slate-500 font-normal">Phone-Only Deals! Call </span>
                <span className="font-extrabold text-[#00704a]">61-272-556-530</span>
              </div>
            </div>

            <button className="text-slate-600 hover:text-blue-600 text-lg">💬</button>

            {/* Currency Selector */}
            <div className="flex items-center gap-1 cursor-pointer">
              <span>🌐</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="bg-transparent font-bold text-slate-800 cursor-pointer focus:outline-none"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="AUD">AUD</option>
              </select>
            </div>

            {/* Sign in button */}
            <button className="flex items-center gap-1.5 font-bold text-[#0a3161] hover:text-blue-700">
              <span className="text-sm">👤</span> Sign in / Join
            </button>
          </div>
        </div>
      </header>

      {/* HERO & SEARCH SECTION — CheapOair Light Blue Banner with Summer Promo Card */}
      <section className="bg-[#f0f4f9] pt-8 pb-10 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          {/* Headline + Summer Promo Card Grid */}
          <div className="grid gap-6 lg:grid-cols-[1fr_340px] items-center mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0a3161] leading-tight">
                Cheap Flights - Compare and Book Flight Deals from Over <span className="text-[#f15a24]">500</span> Airlines Online
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
                <span className="font-bold text-[#0a3161]">
                  Fares Starting from <span className="text-[#f15a24] font-extrabold text-sm">$90 ↗</span> ⓘ
                </span>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5">
                  <span>Save now - use</span>
                  <span className="rounded-lg border border-dashed border-slate-400 bg-white px-2 py-0.5 font-mono font-bold text-[#0a3161] tracking-wider">
                    SAVE50
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText('SAVE50').catch(() => {});
                      }
                      setCopiedPromo(true);
                      setTimeout(() => setCopiedPromo(false), 2000);
                    }}
                    title="Copy Promo Code"
                    className="text-slate-500 hover:text-blue-600 text-xs"
                  >
                    📋
                  </button>
                  <span>ⓘ</span>
                  {copiedPromo && <span className="text-emerald-600 font-bold text-[10px]">Copied!</span>}
                </div>
              </div>
            </div>

            {/* Summer Trip Promo Card */}
            <div className="relative overflow-hidden rounded-lg h-36 bg-gradient-to-r from-blue-600 to-teal-500">
              <img
                src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80"
                alt="Summer Trip"
                className="h-full w-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 text-white font-extrabold text-lg sm:text-xl drop-shadow-md leading-snug">
                Book your <br />Summer Trip!
              </div>
            </div>
          </div>

          {/* Product Tabs Rail */}
          <div className="flex items-center gap-2 mb-3">
            <button className="flex items-center gap-2 rounded-lg bg-[#004ce6] px-5 py-2 text-xs font-bold text-white">
              <span>✈</span> Flights
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <span>🌴</span> Packages
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <span>🏨</span> Hotels
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <span>🚗</span> Cars
            </button>
          </div>

          {/* CheapOair Unified Search Bar Container */}
          <form onSubmit={(e) => handleSearch(e)} className="rounded-lg bg-white p-5 border border-slate-200">
            {/* Top Dropdowns */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-800 mb-3">
              <select
                value={tripType}
                onChange={(e) => setTripType(e.target.value as '1' | '2')}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="1">Round-trip ▾</option>
                <option value="2">One-way ▾</option>
              </select>

              <select
                value={adults}
                onChange={(e) => setAdults(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="1">👤 1 Traveler ▾</option>
                <option value="2">👤 2 Travelers ▾</option>
                <option value="3">👤 3 Travelers ▾</option>
                <option value="4">👤 4 Travelers ▾</option>
              </select>

              <select
                value={cabinClass}
                onChange={(e) => setCabinClass(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="1">Coach ▾</option>
                <option value="2">Premium Economy ▾</option>
                <option value="3">Business ▾</option>
                <option value="4">First ▾</option>
              </select>
            </div>

            {/* Unified Search Pill Bar */}
            <div className="relative rounded-lg border border-slate-300 bg-white p-1.5 flex flex-col lg:flex-row items-center gap-1 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20">
              {/* Origin */}
              <div className="flex-1 w-full">
                <CityAutocompleteInputCheapOair
                  placeholder="PER - Perth, Australia"
                  value={origin}
                  onChange={(val) => setOrigin(val)}
                />
              </div>

              {/* Swap Button */}
              <button
                type="button"
                onClick={() => {
                  const temp = origin;
                  setOrigin(destination);
                  setDestination(temp);
                }}
                className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-blue-600 shrink-0"
                title="Swap places"
              >
                ⇄
              </button>

              {/* Destination */}
              <div className="flex-1 w-full">
                <CityAutocompleteInputCheapOair
                  placeholder="Where to?"
                  value={destination}
                  onChange={(val) => setDestination(val)}
                />
              </div>

              <div className="hidden lg:block h-8 w-[1px] bg-slate-200 my-auto" />

              {/* Date Pickers */}
              <div className="flex items-center gap-2 px-3 py-1.5 w-full lg:w-auto">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-xs">📅</span>
                  <input
                    type="date"
                    suppressHydrationWarning
                    min={getTodayIso()}
                    value={outboundDate}
                    onChange={(e) => setOutboundDate(e.target.value)}
                    className="bg-transparent font-bold text-xs text-slate-800 focus:outline-none"
                  />
                </div>
                {tripType === '1' && (
                  <>
                    <span className="text-slate-300">–</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-xs">📅</span>
                      <input
                        type="date"
                        suppressHydrationWarning
                        min={outboundDate}
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        className="bg-transparent font-bold text-xs text-slate-800 focus:outline-none"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Big Orange CheapOair Search Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full lg:w-auto rounded-lg bg-[#f15a24] hover:bg-[#d84a18] px-9 py-3 font-extrabold text-white text-sm tracking-wide transition-all shrink-0"
              >
                {loading ? 'Searching…' : 'Search'}
              </button>
            </div>

            {/* Bottom Checkbox Options Row */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-4">
                <span className="font-extrabold text-slate-900">Bundle & Save</span>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900">
                  <input type="checkbox" className="rounded text-[#f15a24] focus:ring-[#f15a24]" /> Add Hotel
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900">
                  <input type="checkbox" className="rounded text-[#f15a24] focus:ring-[#f15a24]" /> Add Car
                </label>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={stopsFilter === 'nonstop'}
                    onChange={(e) => setStopsFilter(e.target.checked ? 'nonstop' : 'any')}
                    className="rounded text-[#f15a24] focus:ring-[#f15a24]"
                  />
                  From/to another airport?
                </label>
                <button type="button" className="text-[#004ce6] font-bold hover:underline flex items-center gap-1">
                  Advanced search <span className="text-[9px]">▼</span>
                </button>
              </div>
            </div>
          </form>

          {/* Breadcrumbs */}
          <div className="mt-4 text-xs font-semibold text-slate-500">
            <span>CheapOair</span> / <span className="text-slate-800">Flights</span>
          </div>
        </div>
      </section>

      {/* RESULTS SECTION */}
      {hasSearched && (
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {/* PRICE INSIGHTS BAR */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-lg">
                  📊
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      Prices are currently{' '}
                      <span className="text-emerald-700 underline decoration-emerald-500 decoration-2 font-extrabold">
                        {priceInsight?.price_level || 'low'}
                      </span>
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      ${searchResults[0]?.price || 345} lowest fare
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Fares for {origin} to {destination} are starting at ${searchResults[0]?.price || 345} with partner discounts applied.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-semibold">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'top' | 'price' | 'duration')}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-800 shadow-2xs focus:outline-none"
                >
                  <option value="top">Top Deals</option>
                  <option value="price">Lowest Price</option>
                  <option value="duration">Shortest Flight</option>
                </select>
              </div>
            </div>
          </div>

          {/* Error Notice */}
          {Boolean(errorMsg) && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 shadow-xs flex items-center gap-2">
              <span>ℹ️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ITINERARY CARDS */}
          <div className="mt-4 space-y-4">
            {filteredResults.map((result, idx) => {
              const firstLeg = result.flights?.[0];
              const lastLeg = result.flights?.[result.flights.length - 1];
              const isExpanded = expandedIndex === idx;
              const logo = result.airline_logo || firstLeg?.airline_logo || 'https://www.gstatic.com/flights/airline_logos/70px/BA.png';
              const emissions = result.carbon_emissions;

              return (
                <div
                  key={idx}
                  className={`overflow-hidden rounded-2xl border transition-all ${
                    isExpanded
                      ? 'border-[#004ce6] bg-white shadow-lg ring-1 ring-blue-400/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                  }`}
                >
                  {/* Card Header Bar */}
                  <div
                    onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                    className="flex cursor-pointer flex-wrap items-center justify-between gap-4 p-5 transition-colors hover:bg-slate-50/70"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={logo}
                        alt="Airline"
                        className="h-10 w-10 rounded-full border border-slate-200 bg-white p-1 object-contain shadow-xs"
                      />

                      <div>
                        <div className="flex items-center gap-2 text-base font-extrabold text-[#0a3161]">
                          <span>{firstLeg?.departure_airport?.time || '7:15 AM'} – {lastLeg?.arrival_airport?.time || '11:05 AM'}</span>
                        </div>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">
                          {firstLeg?.airline || 'Jetstar'} · {result.layovers?.length ? `${result.layovers.length} stop (${result.layovers[0].id})` : 'Nonstop'} · {formatDuration(result.total_duration)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {emissions && (
                        <div className="hidden items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 sm:flex">
                          <span>🌱 {Math.round((emissions.this_flight || 210000) / 1000)} kg CO₂</span>
                        </div>
                      )}

                      <div className="text-right">
                        <span className="text-2xl font-black text-[#0a3161] block">${result.price ?? 345}</span>
                        <span className="text-[10px] font-semibold text-slate-400 block">{result.type}</span>
                      </div>

                      <button
                        type="button"
                        className="rounded-full bg-[#f15a24] px-5 py-2 text-xs font-extrabold text-white hover:bg-[#d84a18] shadow-sm transition-all"
                      >
                        Select Deal
                      </button>

                      <span className="text-xs text-slate-400 font-bold ml-1">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Detailed Timeline */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/70 p-6 text-xs text-slate-700">
                      {result.flights?.map((leg, legIdx) => {
                        const layover = result.layovers?.[legIdx];

                        return (
                          <div key={legIdx} className="space-y-4">
                            <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
                              <div className="relative pl-7">
                                <div className="absolute left-2 top-2 bottom-2 w-0.5 border-l-2 border-dashed border-slate-400" />
                                <div className="absolute left-[3px] top-1 h-3.5 w-3.5 rounded-full border-2 border-[#004ce6] bg-white" />
                                <div className="absolute left-[3px] bottom-1 h-3.5 w-3.5 rounded-full border-2 border-[#004ce6] bg-white" />

                                <div>
                                  <span className="font-extrabold text-[#0a3161] text-sm">{leg.departure_airport?.time || '7:15 AM'}</span>
                                  <span className="ml-2 font-bold text-slate-800">{leg.departure_airport?.name || leg.departure_airport?.id}</span>
                                </div>

                                <div className="my-3 text-slate-500 text-[11px] font-medium bg-white border border-slate-200 rounded-md px-2.5 py-1 inline-block">
                                  ✈ Flight duration: {formatDuration(leg.duration)}
                                </div>

                                <div>
                                  <span className="font-extrabold text-[#0a3161] text-sm">{leg.arrival_airport?.time || '11:05 AM'}</span>
                                  <span className="ml-2 font-bold text-slate-800">{leg.arrival_airport?.name || leg.arrival_airport?.id}</span>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2 text-slate-500 text-[11px]">
                                  <span className="font-bold text-[#0a3161]">{leg.airline || 'Jetstar'}</span>
                                  <span>·</span>
                                  <span>{leg.flight_number || 'JQ 110'}</span>
                                  <span>·</span>
                                  <span>{leg.airplane || 'Airbus A321neo'}</span>
                                </div>
                              </div>

                              <div className="space-y-1.5 text-right text-[11px] text-slate-600 sm:w-64 border-l border-slate-200 pl-4 sm:border-l-0 sm:pl-0">
                                {leg.extensions?.map((ext, extIdx) => (
                                  <p key={extIdx} className="flex items-center justify-end gap-1.5">
                                    <span>✔</span> {ext}
                                  </p>
                                )) || (
                                  <>
                                    <p>✔ Standard seat pitch (30 in)</p>
                                    <p>✔ In-seat USB power outlet</p>
                                  </>
                                )}
                              </div>
                            </div>

                            {layover && (
                              <div className="my-4 rounded-xl border border-slate-200 bg-amber-50/60 py-2.5 px-4 font-bold text-slate-700 text-center text-xs shadow-2xs">
                                ⏳ {formatDuration(layover.duration)} layover in {layover.name || layover.id}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* CHEAPOAIR EDITORIAL & TRUST SECTIONS FROM REFERENCE */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-6 sm:px-6">
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#0a3161] tracking-tight">
          Cheap Flights Online for Domestic & International Travel
        </h2>
        <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-5xl">
          Find cheap flights online for domestic and international travel with access to cheap airline tickets, cheap plane tickets, and affordable airfare from over 500 airlines. Compare one-way, round-trip, and cheap last-minute flights, then choose the option that fits your budget and schedule. Whether you're planning ahead or looking for our cheapest flights available, <strong className="text-[#0a3161] font-bold">CheapOair</strong> helps you compare fares and book with ease.
        </p>
      </section>

      {/* BOOK WITH CONFIDENCE BANNER */}
      <section className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-extrabold text-[#0a3161]">
            Book with Confidence. Trusted by 40M+ Travelers
          </h3>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Price Match Promise */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#004ce6] text-xl">
                📉
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-[#0a3161]">Price Match Promise ⓘ</h4>
                <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                  Found a better deal? We'll match it!
                </p>
              </div>
            </div>

            {/* 24/7 Customer Support */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#004ce6] text-xl">
                📞
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-[#0a3161]">24/7 Customer Support</h4>
                <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                  Speak to our travel experts anytime, anywhere.
                </p>
              </div>
            </div>

            {/* ClubMiles Rewards */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#004ce6] text-xl">
                👑
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-[#0a3161]">ClubMiles Rewards</h4>
                <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                  Stack points & airline miles to save.
                </p>
              </div>
            </div>

            {/* Easy Cancellations */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#004ce6] text-xl">
                🧳
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-[#0a3161]">Easy Cancellations</h4>
                <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                  Convenient options online and 24/7 global concierge.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST & APP 3-CARD GRID */}
      <section className="mx-auto max-w-6xl px-4 pt-4 pb-12 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Card 1: Trusted Airline Brands */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🌐</span>
                <div className="flex items-center gap-1 font-bold text-xs text-slate-400">
                  <span>✈ Delta</span> · <span>Air Canada</span> · <span>JetBlue</span>
                </div>
              </div>
              <h4 className="text-sm font-extrabold text-[#0a3161]">Trusted Airline Brands</h4>
              <p className="mt-1 text-xs text-slate-500">
                Book great deals on 500+ airlines.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#004ce6] hover:underline text-left"
            >
              Find deals →
            </button>
          </div>

          {/* Card 2: Travelers Love Our App */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700 border border-amber-200 mb-4">
                <span>4.8</span>
                <span className="text-amber-500">★★★★★</span>
              </div>
              <h4 className="text-sm font-extrabold text-[#0a3161]">Travelers Love Our App</h4>
              <p className="mt-1 text-xs text-slate-500">
                Download our app and enjoy instant savings.
              </p>
            </div>
            <a
              href="https://cheapoair.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#004ce6] hover:underline"
            >
              Open app →
            </a>
          </div>

          {/* Card 3: Phone only deals! */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="relative">
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=80&q=80"
                    alt="Travel Agent"
                    className="h-8 w-8 rounded-full object-cover border border-slate-300"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  Available
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-[#0a3161]">Phone only deals!</h4>
              <p className="mt-1 text-xs text-slate-500">
                Save by calling our travel experts.
              </p>
            </div>
            <a
              href="tel:61272556530"
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#004ce6] hover:underline"
            >
              Call us →
            </a>
          </div>
        </div>
      </section>

      {/* TRENDING FLIGHT DEALS SECTION - Matches screenshot & powered by flight-routes */}
      <section className="mx-auto max-w-6xl px-4 pt-4 pb-6 sm:px-6">
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#0a3161] tracking-tight">
            Trending Flight Deals - Round Trip & One Way Fares
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-5xl">
            Explore trending flight deals across popular domestic and international routes, including round-trip and one-way fare options. We help travelers discover current airfare deals, compare popular routes, and find flight prices that match different budgets and travel plans. These flight deals help travelers explore popular routes, compare current airfare options, and spot timely booking opportunities more easily. Call us for phone-only deals at <span className="font-extrabold text-[#00704a]">61-272-556-530</span>
          </p>
        </div>

        {/* One Way / Round Trip Tabs */}
        <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-bold text-slate-600 mb-6">
          <button
            type="button"
            onClick={() => setTrendingFareType('one-way')}
            className={`pb-2.5 transition-colors border-b-2 ${
              trendingFareType === 'one-way'
                ? 'border-[#004ce6] text-[#004ce6] font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            One Way
          </button>
          <button
            type="button"
            onClick={() => setTrendingFareType('round-trip')}
            className={`pb-2.5 transition-colors border-b-2 ${
              trendingFareType === 'round-trip'
                ? 'border-[#004ce6] text-[#004ce6] font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Round Trip
          </button>
        </div>

        {/* Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(showMoreRoutes ? trendingRoutesList : trendingRoutesList.slice(0, 6)).map((item) => (
            <div
              key={item.id}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-blue-400 hover:shadow-md flex flex-col justify-between"
            >
              {/* Top Endpoint Row */}
              <div className="flex items-center justify-between gap-2">
                {/* Origin */}
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                    ✓
                  </div>
                  <div>
                    <div className="font-black text-[#0a3161] text-base leading-tight">{item.originIata}</div>
                    <div className="text-[11px] font-semibold text-slate-500 truncate max-w-[95px]">{item.originCity}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{item.date}</div>
                  </div>
                </div>

                {/* Route Line */}
                <div className="flex flex-col items-center justify-center flex-1 px-2">
                  <div className="w-full border-t border-slate-300 relative">
                    <span className="absolute left-1/2 -top-1.5 -translate-x-1/2 bg-white px-1 text-[10px] text-slate-400">✈</span>
                  </div>
                </div>

                {/* Destination */}
                <div className="text-right">
                  <div className="font-black text-[#0a3161] text-base leading-tight">{item.destIata}</div>
                  <div className="text-[11px] font-semibold text-slate-500 truncate max-w-[95px]">{item.destCity}</div>
                </div>
              </div>

              {/* Bottom Price & Book Now Row */}
              <div className="mt-5 border-t border-slate-100 pt-3 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  from <strong className="text-base font-black text-[#0a3161] ml-0.5">${item.price}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOrigin(item.originIata);
                    setDestination(item.destIata);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    handleSearch(undefined, item.originIata, item.destIata);
                  }}
                  className="rounded-full bg-[#004ce6] hover:bg-[#003bb3] px-5 py-2 text-xs font-extrabold text-white shadow-xs transition-all"
                >
                  Book Now
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Show More Button */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setShowMoreRoutes(!showMoreRoutes)}
            className="w-full rounded-full bg-slate-100 hover:bg-slate-200 py-3 text-xs font-extrabold text-slate-700 transition-colors shadow-2xs"
          >
            {showMoreRoutes ? 'Show less' : 'Show more'}
          </button>
        </div>

        {/* Footnote */}
        <p className="mt-3 text-[10px] text-slate-400 text-center sm:text-left">
          *All fares above were last found on: Aug 28, 2026 at 05:21:47 AM UTC ⓘ
        </p>
      </section>

      {/* FEATURED DEALS GRID (Top Flight Deals from PER - Placed right below Trending Flight Deals) */}
      {!hasSearched && (
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-extrabold text-[#0a3161]">
                Top Flight Deals from {origin}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Exclusive cheap airfares curated daily across major airlines
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
              Promo code SAVE50 applicable
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURED_DEALS.map((deal) => (
              <div
                key={deal.destination}
                onClick={() => handleSearch(undefined, deal.origin, deal.destination)}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl"
              >
                <div className="relative h-36 w-full overflow-hidden bg-slate-100">
                  <img
                    src={deal.image}
                    alt={deal.cityName}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <span className="absolute left-3 top-3 rounded-md bg-[#f15a24] px-2 py-0.5 text-[10px] font-extrabold text-white uppercase tracking-wider shadow-xs">
                    {deal.discount}
                  </span>
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
                    <div>
                      <h3 className="font-extrabold text-base leading-tight text-white">{deal.cityName}</h3>
                      <p className="text-[11px] text-slate-200">{deal.country}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-300 block">from</span>
                      <span className="text-lg font-black text-amber-300">${deal.price}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-xs font-bold text-[#0a3161] bg-slate-50/50">
                  <span>{deal.origin} → {deal.destination}</span>
                  <span className="text-[#004ce6] group-hover:underline">Search →</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* GOOGLE FLIGHTS DARK THEME SEARCH RESULTS SECTION (Matching screenshot 1) */}
      {hasSearched && (
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="rounded-2xl border border-slate-800 bg-[#202124] p-5 sm:p-6 text-slate-100 shadow-2xl">
            {/* Top Search Controls Pill Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-4 mb-5 text-xs font-semibold">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={tripType}
                  onChange={(e) => setTripType(e.target.value as '1' | '2')}
                  className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1.5 font-bold text-slate-200 focus:outline-none"
                >
                  <option value="1">⇄ Round trip</option>
                  <option value="2">→ One way</option>
                </select>

                <select
                  value={adults}
                  onChange={(e) => setAdults(e.target.value)}
                  className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1.5 font-bold text-slate-200 focus:outline-none"
                >
                  <option value="1">👤 1</option>
                  <option value="2">👤 2</option>
                  <option value="3">👤 3</option>
                </select>

                <select
                  value={cabinClass}
                  onChange={(e) => setCabinClass(e.target.value)}
                  className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1.5 font-bold text-slate-200 focus:outline-none"
                >
                  <option value="1">Economy</option>
                  <option value="2">Premium Economy</option>
                  <option value="3">Business</option>
                </select>
              </div>

              {/* Input Cities & Date Bar */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-extrabold text-white">
                  <span>📍 {origin}</span>
                  <span className="text-slate-400">⇄</span>
                  <span>📍 {destination || 'BKK'}</span>
                </div>

                {/* Date Trigger Pill */}
                <button
                  type="button"
                  onClick={() => setShowDatePickerModal(true)}
                  className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-extrabold text-white hover:bg-slate-700 transition-colors"
                >
                  <span>📅 Tue, Sep 1</span>
                  <span className="text-slate-400 font-normal">‹ ›</span>
                  <span>Sun, Sep 27</span>
                  <span className="text-slate-400 font-normal">‹ ›</span>
                </button>
              </div>
            </div>

            {/* Filter Chips Row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-4 text-xs font-semibold scrollbar-none border-b border-slate-800 mb-5">
              <button type="button" className="rounded-full bg-slate-800 border border-slate-700 px-3.5 py-1.5 text-slate-200 hover:bg-slate-700 shrink-0">
                All filters
              </button>
              <button type="button" className="rounded-full bg-slate-800 border border-slate-700 px-3.5 py-1.5 text-slate-200 hover:bg-slate-700 shrink-0">
                Stops ▾
              </button>
              <button type="button" className="rounded-full bg-slate-800 border border-slate-700 px-3.5 py-1.5 text-slate-200 hover:bg-slate-700 shrink-0">
                Airlines ▾
              </button>
              <button type="button" className="rounded-full bg-slate-800 border border-slate-700 px-3.5 py-1.5 text-slate-200 hover:bg-slate-700 shrink-0">
                Bags ▾
              </button>
              <button type="button" className="rounded-full bg-slate-800 border border-slate-700 px-3.5 py-1.5 text-slate-200 hover:bg-slate-700 shrink-0">
                Price ▾
              </button>
              <button type="button" className="rounded-full bg-slate-800 border border-slate-700 px-3.5 py-1.5 text-slate-200 hover:bg-slate-700 shrink-0">
                Times ▾
              </button>
              <button type="button" className="rounded-full bg-slate-800 border border-slate-700 px-3.5 py-1.5 text-slate-200 hover:bg-slate-700 shrink-0">
                Emissions ▾
              </button>
              <button type="button" className="rounded-full bg-slate-800 border border-slate-700 px-3.5 py-1.5 text-slate-200 hover:bg-slate-700 shrink-0">
                Connecting airports ▾
              </button>
              <button type="button" className="rounded-full bg-slate-800 border border-slate-700 px-3.5 py-1.5 text-slate-200 hover:bg-slate-700 shrink-0">
                Duration ▾
              </button>
            </div>

            {/* Best vs Cheapest Tabs Header */}
            <div className="grid grid-cols-2 rounded-xl border border-slate-700 bg-slate-900 p-1 mb-6 text-xs font-bold text-center">
              <button
                type="button"
                onClick={() => setResultsSortTab('best')}
                className={`py-2.5 rounded-lg transition-all ${
                  resultsSortTab === 'best'
                    ? 'bg-[#303134] text-[#8ab4f8] border border-slate-700 font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Best ⓘ
              </button>
              <button
                type="button"
                onClick={() => setResultsSortTab('cheapest')}
                className={`py-2.5 rounded-lg transition-all ${
                  resultsSortTab === 'cheapest'
                    ? 'bg-[#303134] text-[#8ab4f8] border border-slate-700 font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Cheapest <span className="font-normal text-slate-300">from</span> <strong className="text-emerald-400">A$607</strong> ⓘ
              </button>
            </div>

            {/* TOP DEPARTING FLIGHTS SECTION */}
            <div className="mb-8">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h4 className="text-lg font-black text-white">Top departing flights</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Ranked based on price and convenience ⓘ Prices include required taxes + fees for 1 adult. Optional charges and <span className="underline">bag fees</span> may apply. <span className="text-blue-400 underline">Passenger assistance</span> info.
                  </p>
                </div>
                <div className="text-xs text-slate-400 font-semibold cursor-pointer hover:text-white">
                  Sorted by top flights ⇅
                </div>
              </div>

              {/* Top Flights Rows Container */}
              <div className="overflow-hidden rounded-xl border border-slate-700 bg-[#303134] divide-y divide-slate-700/70">
                {/* Row 1: Scoot */}
                <div className="p-4 transition-colors hover:bg-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-[220px]">
                    <div className="h-9 w-9 rounded-full bg-amber-400 text-slate-900 font-black text-xs flex items-center justify-center shrink-0">
                      scoot
                    </div>
                    <div>
                      <div className="font-extrabold text-white text-base">5:35 AM – 2:25 PM</div>
                      <div className="text-xs text-slate-400">Scoot</div>
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-white text-xs">9 hr 50 min</div>
                    <div className="text-[11px] text-slate-400">{origin}–{destination || 'BKK'}</div>
                  </div>

                  <div>
                    <div className="font-bold text-white text-xs">1 stop</div>
                    <div className="text-[11px] text-slate-400">1 hr 55 min SIN</div>
                  </div>

                  <div className="hidden md:block">
                    <div className="text-xs font-bold text-slate-300">332 kg CO₂e</div>
                    <span className="inline-block rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800">
                      -10% emissions ⓘ
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-white">A$794</div>
                    <div className="text-[10px] text-slate-400">round trip</div>
                  </div>
                  <span className="text-slate-400 text-xs cursor-pointer">▼</span>
                </div>

                {/* Row 2: THAI Nonstop */}
                <div className="p-4 transition-colors hover:bg-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-[220px]">
                    <div className="h-9 w-9 rounded-full bg-purple-900 border border-purple-500 text-amber-300 font-black text-[10px] flex items-center justify-center shrink-0">
                      THAI
                    </div>
                    <div>
                      <div className="font-extrabold text-white text-base">9:20 AM – 3:25 PM</div>
                      <div className="text-xs text-slate-400">THAI</div>
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-white text-xs">7 hr 5 min</div>
                    <div className="text-[11px] text-slate-400">{origin}–{destination || 'BKK'}</div>
                  </div>

                  <div>
                    <div className="font-bold text-emerald-400 text-xs">Nonstop</div>
                  </div>

                  <div className="hidden md:block">
                    <div className="text-xs font-bold text-slate-300">333 kg CO₂e</div>
                    <span className="inline-block rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800">
                      -10% emissions ⓘ
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-white">A$897</div>
                    <div className="text-[10px] text-slate-400">round trip</div>
                  </div>
                  <span className="text-slate-400 text-xs cursor-pointer">▼</span>
                </div>

                {/* Row 3: Malaysia Airlines */}
                <div className="p-4 transition-colors hover:bg-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-[220px]">
                    <div className="h-9 w-9 rounded-full bg-blue-700 text-white font-black text-xs flex items-center justify-center shrink-0">
                      MH
                    </div>
                    <div>
                      <div className="font-extrabold text-white text-base">2:10 AM – 10:15 AM</div>
                      <div className="text-xs text-slate-400">Malaysia Airlines</div>
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-white text-xs">9 hr 5 min</div>
                    <div className="text-[11px] text-slate-400">{origin}–{destination || 'BKK'}</div>
                  </div>

                  <div>
                    <div className="font-bold text-white text-xs">1 stop</div>
                    <div className="text-[11px] text-slate-400">1 hr KUL</div>
                  </div>

                  <div className="hidden md:block">
                    <div className="text-xs font-bold text-slate-300">397 kg CO₂e</div>
                    <span className="inline-block text-[10px] font-bold text-slate-400">
                      +8% emissions ⓘ
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-white">A$1,172</div>
                    <div className="text-[10px] text-slate-400">round trip</div>
                  </div>
                  <span className="text-slate-400 text-xs cursor-pointer">▼</span>
                </div>

                {/* Row 4: Singapore Airlines */}
                <div className="p-4 transition-colors hover:bg-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-[220px]">
                    <div className="h-9 w-9 rounded-full bg-amber-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                      SQ
                    </div>
                    <div>
                      <div className="font-extrabold text-white text-base">6:25 AM – 2:15 PM</div>
                      <div className="text-xs text-slate-400">Singapore Airlines · Virgin Australia</div>
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-white text-xs">8 hr 50 min</div>
                    <div className="text-[11px] text-slate-400">{origin}–{destination || 'BKK'}</div>
                  </div>

                  <div>
                    <div className="font-bold text-white text-xs">1 stop</div>
                    <div className="text-[11px] text-slate-400">1 hr SIN</div>
                  </div>

                  <div className="hidden md:block">
                    <div className="text-xs font-bold text-slate-300">288 kg CO₂e</div>
                    <span className="inline-block rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800">
                      -22% emissions ⓘ
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-white">A$1,318</div>
                    <div className="text-[10px] text-slate-400">round trip</div>
                  </div>
                  <span className="text-slate-400 text-xs cursor-pointer">▼</span>
                </div>
              </div>
            </div>

            {/* PRICES ARE CURRENTLY TYPICAL CALLOUT BAR */}
            <div className="mb-6 rounded-xl border border-slate-700 bg-[#303134] p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-lg">📊</span>
                <div>
                  <div className="font-extrabold text-white text-sm">Prices are currently typical</div>
                </div>
              </div>
              <button type="button" className="text-xs font-extrabold text-blue-400 hover:underline">
                View price history ▾
              </button>
            </div>

            {/* TRACK PRICES & TOOLS BAR */}
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 text-xs font-bold text-slate-300">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span>📈 Track prices ⓘ</span>
                  <span className="text-slate-400">Sep 1–27</span>
                  <input
                    type="checkbox"
                    checked={trackPricesActive}
                    onChange={(e) => setTrackPricesActive(e.target.checked)}
                    className="accent-blue-500"
                  />
                </label>

                <label className="flex items-center gap-2 cursor-pointer border-l border-slate-700 pl-4">
                  <span>Any dates</span>
                  <input
                    type="checkbox"
                    checked={anyDatesActive}
                    onChange={(e) => setAnyDatesActive(e.target.checked)}
                    className="accent-blue-500"
                  />
                </label>
              </div>

              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setShowDatePickerModal(true)} className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3.5 py-1.5 hover:bg-slate-700 text-slate-200">
                  <span>📅</span> Date grid
                </button>
                <button type="button" className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3.5 py-1.5 hover:bg-slate-700 text-slate-200">
                  <span>📊</span> Price graph
                </button>
              </div>
            </div>

            {/* OTHER DEPARTING FLIGHTS SECTION */}
            <div>
              <h4 className="text-lg font-black text-white mb-4">Other departing flights</h4>

              <div className="overflow-hidden rounded-xl border border-slate-700 bg-[#303134] divide-y divide-slate-700/70">
                {/* Other Row 1 */}
                <div className="p-4 transition-colors hover:bg-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-[220px]">
                    <div className="h-9 w-9 rounded-full bg-amber-400 text-slate-900 font-black text-xs flex items-center justify-center shrink-0">
                      scoot
                    </div>
                    <div>
                      <div className="font-extrabold text-white text-base">6:25 PM – 9:55 AM⁺¹</div>
                      <div className="text-xs text-slate-400">Scoot</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">16 hr 30 min</div>
                    <div className="text-[11px] text-slate-400">{origin}–{destination || 'BKK'}</div>
                  </div>
                  <div>
                    <div className="font-bold text-amber-400 text-xs">1 stop ⚠</div>
                    <div className="text-[11px] text-slate-400">8 hr 35 min SIN</div>
                  </div>
                  <div className="hidden md:block">
                    <div className="text-xs font-bold text-slate-300">334 kg CO₂e</div>
                    <span className="inline-block rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800">
                      -9% emissions ⓘ
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-emerald-400">A$641</div>
                    <div className="text-[10px] text-slate-400">round trip</div>
                  </div>
                  <span className="text-slate-400 text-xs cursor-pointer">▼</span>
                </div>

                {/* Other Row 2 */}
                <div className="p-4 transition-colors hover:bg-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-[220px]">
                    <div className="h-9 w-9 rounded-full bg-amber-400 text-slate-900 font-black text-xs flex items-center justify-center shrink-0">
                      scoot
                    </div>
                    <div>
                      <div className="font-extrabold text-white text-base">6:25 PM – 8:05 AM⁺¹</div>
                      <div className="text-xs text-slate-400">Scoot</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">14 hr 40 min</div>
                    <div className="text-[11px] text-slate-400">{origin}–{destination || 'BKK'}</div>
                  </div>
                  <div>
                    <div className="font-bold text-amber-400 text-xs">1 stop ⚠</div>
                    <div className="text-[11px] text-slate-400">6 hr 45 min SIN</div>
                  </div>
                  <div className="hidden md:block">
                    <div className="text-xs font-bold text-slate-300">360 kg CO₂e</div>
                    <span className="text-[10px] text-slate-400 font-semibold block">Avg emissions ⓘ</span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-white">A$794</div>
                    <div className="text-[10px] text-slate-400">round trip</div>
                  </div>
                  <span className="text-slate-400 text-xs cursor-pointer">▼</span>
                </div>

                {/* Other Row 3 */}
                <div className="p-4 transition-colors hover:bg-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-[220px]">
                    <div className="h-9 w-9 rounded-full bg-blue-700 text-white font-black text-xs flex items-center justify-center shrink-0">
                      MH
                    </div>
                    <div>
                      <div className="font-extrabold text-white text-base">2:10 AM – 6:55 PM</div>
                      <div className="text-xs text-slate-400">Malaysia Airlines</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">17 hr 45 min</div>
                    <div className="text-[11px] text-slate-400">{origin}–{destination || 'BKK'}</div>
                  </div>
                  <div>
                    <div className="font-bold text-amber-400 text-xs">1 stop ⚠</div>
                    <div className="text-[11px] text-slate-400">9 hr 45 min KUL</div>
                  </div>
                  <div className="hidden md:block">
                    <div className="text-xs font-bold text-slate-300">397 kg CO₂e</div>
                    <span className="text-[10px] text-slate-400 font-semibold block">+8% emissions ⓘ</span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-[#8ab4f8]">A$821</div>
                    <div className="text-[10px] text-slate-400">round trip</div>
                  </div>
                  <span className="text-slate-400 text-xs cursor-pointer">▼</span>
                </div>
              </div>

              {/* View More Flights Button */}
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setShowMoreOtherFlights(!showMoreOtherFlights)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 text-xs font-extrabold text-[#8ab4f8] hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                  <span>▼</span>
                  <span>{showMoreOtherFlights ? 'View fewer flights' : 'View more flights'}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* JOIN CLUBMILES BANNER */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-4 sm:px-6">
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 overflow-hidden rounded-full border border-slate-200 bg-slate-50 p-2 pr-6 shadow-xs">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative h-20 w-80 shrink-0 overflow-hidden rounded-full bg-slate-900">
              <img
                src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80"
                alt="Clubmiles"
                className="h-full w-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />
              <div className="absolute inset-y-0 left-5 flex flex-col justify-center text-white">
                <h4 className="text-base font-black leading-tight text-white">Join Clubmiles</h4>
                <p className="text-[11px] text-slate-200">Sign up and get $10 worth of points ⓘ</p>
                <button type="button" className="mt-0.5 text-[10px] font-extrabold text-amber-300 underline text-left">
                  Learn more
                </button>
              </div>
            </div>

            <div className="h-11 w-11 shrink-0 rounded-full border-2 border-white bg-blue-900 shadow-md flex items-center justify-center text-white font-extrabold text-xs">
              🌐
            </div>
          </div>

          <div className="text-center md:text-left text-xs font-medium text-slate-700">
            <p className="font-extrabold text-slate-900 text-sm">
              Save up to 10% <span className="font-normal text-slate-600">on select flights</span> (<strong className="font-black">$25 max</strong>).
            </p>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Stack airline miles and ClubMiles points.
            </p>
          </div>

          <a
            href="#join"
            className="shrink-0 rounded-full bg-[#004ce6] hover:bg-[#0038b3] px-6 py-2.5 text-xs font-extrabold text-white shadow-xs transition-all"
          >
            Join for free
          </a>
        </div>
      </section>

      {/* START SAVING TODAY - NEWSLETTER PROMOTION */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_380px]">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-[#0a3161]">
              Start saving today. Never miss a promotion.
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              Get airline deals, fare alerts, and up to <span className="text-[#f15a24] font-extrabold">$50 off</span> our fees. ⓘ
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert('Thank you for subscribing to CheapOair deal alerts!');
              }}
              className="mt-5 flex max-w-md items-center rounded-full border border-slate-300 bg-white p-1 shadow-sm focus-within:border-blue-600"
            >
              <div className="flex items-center gap-2 px-3 text-slate-400 text-sm flex-1">
                <span>✉</span>
                <input
                  type="email"
                  placeholder="Email address"
                  required
                  className="w-full bg-transparent font-medium text-xs text-slate-800 focus:outline-none placeholder-slate-400"
                />
              </div>
              <button
                type="submit"
                className="rounded-full bg-[#004ce6] hover:bg-[#0038b3] px-6 py-2.5 text-xs font-extrabold text-white transition-all shrink-0"
              >
                Unlock deals & save
              </button>
            </form>

            <p className="mt-3 text-[10px] text-slate-400 leading-normal max-w-md">
              By signing up, you agree to receive marketing emails from CheapOair (Fareportal).{' '}
              <a href="/legal/terms" className="text-blue-600 underline">Consent notice</a> ·{' '}
              <a href="/legal/privacy" className="text-blue-600 underline">Privacy Policy</a>
            </p>
          </div>

          {/* Overlapping 3-Squircle Image Collage (Exact match to reference image) */}
          <div className="relative flex items-center justify-center py-4">
            {/* Left Image: Hotel Bedroom (Cool Blue Tones, Tucked behind center) */}
            <div className="relative z-10 -mr-12 h-44 w-44 shrink-0 overflow-hidden rounded-[45px] shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=400&q=80"
                alt="Hotel Bedroom"
                className="h-full w-full object-cover brightness-95"
              />
            </div>

            {/* Center Image: Airplane Window Sunset Traveler (Elevated Center) */}
            <div className="relative z-20 h-64 w-64 shrink-0 overflow-hidden rounded-[65px] shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80"
                alt="Traveler Airplane Window Sunset"
                className="h-full w-full object-cover"
              />
            </div>

            {/* Right Image: Family Road Trip in Car Trunk (Warm Sunlit Tones, Tucked behind center) */}
            <div className="relative z-10 -ml-12 h-44 w-44 shrink-0 overflow-hidden rounded-[45px] shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=400&q=80"
                alt="Family Road Trip"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FLIGHT + HOTEL PACKAGES GRID */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h3 className="text-xl font-extrabold text-[#0a3161]">
            Flight + Hotel packages
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Showing deals for — 20 Sep - 24 Sep
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Package Card 1 */}
          <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-all hover:border-blue-400 hover:shadow-md flex flex-col justify-between">
            <div>
              <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                <img
                  src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80"
                  alt="Hotel Clermont"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Atlanta</span>
                <h4 className="font-extrabold text-slate-900 text-sm mt-0.5">Hotel Clermont</h4>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 border border-emerald-200">
                    8.9 Very Good
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                  <span>✈</span> Fort Lauderdale (FLL) – Atlanta (ATL)
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span className="text-base font-black text-[#0a3161]">$838</span>
                <span className="text-[10px] text-slate-400 ml-1">/ person</span>
              </div>
              <span className="text-[10px] text-slate-400 block font-medium">Round trip Flight + Hotel</span>
            </div>
          </div>

          {/* Package Card 2 */}
          <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-all hover:border-blue-400 hover:shadow-md flex flex-col justify-between">
            <div>
              <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                <img
                  src="https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80"
                  alt="Privato Makati"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Manila</span>
                <h4 className="font-extrabold text-slate-900 text-sm mt-0.5">Privato Makati</h4>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 border border-emerald-200">
                    8.4 Very Good
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                  <span>✈</span> Los Angeles (LAX) – Manila (MNL)
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span className="text-base font-black text-[#0a3161]">$871</span>
                <span className="text-[10px] text-slate-400 ml-1">/ person</span>
              </div>
              <span className="text-[10px] text-slate-400 block font-medium">Round trip Flight + Hotel</span>
            </div>
          </div>

          {/* Package Card 3 */}
          <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-all hover:border-blue-400 hover:shadow-md flex flex-col justify-between">
            <div>
              <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                <img
                  src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80"
                  alt="The Royal Sonesta San Juan"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">San Juan</span>
                <h4 className="font-extrabold text-slate-900 text-sm mt-0.5">The Royal Sonesta San Juan</h4>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 border border-emerald-200">
                    8.9 Very Good
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold">Refundable ♻</span>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                  <span>✈</span> Philadelphia (PHL) – San Juan (SJU)
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span className="text-base font-black text-[#0a3161]">$1,146</span>
                <span className="text-[10px] text-slate-400 ml-1">/ person</span>
              </div>
              <span className="text-[10px] text-slate-400 block font-medium">Round trip Flight + Hotel</span>
            </div>
          </div>

          {/* Package Card 4 */}
          <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-all hover:border-blue-400 hover:shadow-md flex flex-col justify-between">
            <div>
              <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                <img
                  src="https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=600&q=80"
                  alt="Barcelo San Salvador"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">San Salvador</span>
                <h4 className="font-extrabold text-slate-900 text-sm mt-0.5">Barcelo San Salvador</h4>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 border border-emerald-200">
                    9.0 Wonderful
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                  <span>✈</span> Washington DC (WAS) – San Salvador (SAL)
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span className="text-base font-black text-[#0a3161]">$1,289</span>
                <span className="text-[10px] text-slate-400 ml-1">/ person</span>
              </div>
              <span className="text-[10px] text-slate-400 block font-medium">Round trip Flight + Hotel</span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[10px] text-slate-400 text-center sm:text-left">
          *Fares last found on: Aug 28, 2026 at 08:01:37 AM UTC. These are based on average nightly rates and airfare includes all fuel surcharges, taxes & fees, and service fees.
        </p>
      </section>

      {/* FIND CHEAP FLIGHTS FROM AUSTRALIA TO ANYWHERE (Matching cheapFlightfromOrigintoAnywhere.png) */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xl font-extrabold text-[#0a3161]">
            Find cheap flights from Australia to anywhere
          </h3>
          <span className="text-slate-400 text-sm cursor-pointer" title="Based on historical search data">ⓘ</span>
        </div>

        {/* Origin Pill Tabs */}
        <div className="flex items-center gap-2 mb-6">
          {(['Perth', 'Sydney', 'Melbourne', 'Brisbane'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setCheapOriginTab(tab)}
              className={`rounded-full px-5 py-2 text-xs font-extrabold transition-all ${
                cheapOriginTab === tab
                  ? 'bg-[#004ce6] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Route Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(CHEAP_ANYWHERE_DATA[cheapOriginTab] || CHEAP_ANYWHERE_DATA['Perth']).map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setOrigin(item.originIata);
                setDestination(item.destIata);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                handleSearch(undefined, item.originIata, item.destIata);
              }}
              className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-blue-400 hover:shadow-md flex flex-col justify-between"
            >
              <div>
                <h4 className="text-base font-black text-[#0a3161] group-hover:text-blue-600 transition-colors">
                  {item.origin} → {item.destCity}
                </h4>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <span className="text-amber-500 font-bold">★</span>
                  <span>{item.dates}</span>
                  <span>·</span>
                  <span>{item.stops}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end text-xs">
                <span className="text-slate-400 font-medium mr-1">from</span>
                <strong className="text-base font-black text-[#0a3161]">A${item.price}</strong>
                <span className="ml-1 text-slate-400 group-hover:translate-x-1 transition-transform">›</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* POPULAR FLIGHT DESTINATIONS FROM AUSTRALIA */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h3 className="text-xl font-extrabold text-[#0a3161] mb-5">
          Popular flight destinations from Australia
        </h3>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { name: 'London', iata: 'LHR', image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=400&q=80' },
            { name: 'Tokyo', iata: 'TYO', image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=400&q=80' },
            { name: 'Melbourne', iata: 'MEL', image: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=400&q=80' },
            { name: 'Sydney', iata: 'SYD', image: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=400&q=80' },
            { name: 'Singapore', iata: 'SIN', image: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=400&q=80' },
            { name: 'Brisbane', iata: 'BNE', image: 'https://images.unsplash.com/photo-1566837945700-30057527ade0?auto=format&fit=crop&w=400&q=80' },
            { name: 'Perth', iata: 'PER', image: 'https://images.unsplash.com/photo-1548685913-fe6678babe8d?auto=format&fit=crop&w=400&q=80' },
          ].map((dest) => (
            <div
              key={dest.name}
              onClick={() => {
                setDestination(dest.iata);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                handleSearch(undefined, origin, dest.iata);
              }}
              className="group relative cursor-pointer overflow-hidden rounded-xl bg-slate-900 h-36 shadow-xs transition-all hover:scale-[1.03] hover:shadow-md"
            >
              <img
                src={dest.image}
                alt={dest.name}
                className="h-full w-full object-cover opacity-85 transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-3 left-3 text-white font-extrabold text-sm drop-shadow-sm">
                {dest.name}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FREQUENTLY ASKED QUESTIONS SECTION */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h3 className="text-xl font-extrabold text-[#0a3161] mb-5">
          Frequently asked questions
        </h3>

        <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
          {[
            {
              question: 'What are some good flight destinations from Australia?',
              answer: 'Popular flight destinations from Australia include London, Tokyo, Singapore, Bali, Sydney, Melbourne, and Bangkok. You can easily compare live fare options across hundreds of airlines using our flight deal engine above.'
            },
            {
              question: 'How can I find last-minute flight deals?',
              answer: 'To find last-minute flight deals, keep your travel dates flexible, compare alternative nearby airports, monitor price calendar trends, and look for mid-week departures.'
            },
            {
              question: 'How can I find cheap flights for a weekend getaway?',
              answer: 'Filter for short nonstop flights departing Friday evening or Saturday morning and returning Sunday night or Monday morning to get the maximum vacation time for minimum fare.'
            },
            {
              question: 'How can I find flight deals if my travel plans are flexible?',
              answer: 'Use our flexible date calendar to view prices across adjacent weeks, allowing you to select the absolute cheapest departure and return days.'
            },
            {
              question: 'How can I find cheap flights from Australia to anywhere?',
              answer: 'Enter your departure city (e.g. Perth PER or Sydney SYD) and set your destination to "Where to?" or explore our curated trending flight deals grid.'
            },
            {
              question: 'How can I get flight alerts for my trip?',
              answer: 'Enter your email address in our newsletter subscription section above to receive instant price drop notifications whenever airfares drop for your preferred routes.'
            },
          ].map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div key={idx} className="py-4">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between text-left text-sm font-bold text-slate-800 hover:text-[#004ce6] transition-colors"
                >
                  <span>{faq.question}</span>
                  <span className="ml-4 text-xs font-bold text-slate-400">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <p className="mt-3 text-xs text-slate-600 leading-relaxed pr-8">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Raw SerpApi Payload Inspector */}
      {Boolean(rawApiJson) && (
        <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
          <details className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-xl">
            <summary className="cursor-pointer bg-slate-950 p-4 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-between">
              <span>Inspect Raw SerpApi `google_flights` Payload</span>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400 font-mono">200 OK</span>
            </summary>
            <pre className="max-h-96 overflow-auto p-4 font-mono text-[11px] text-emerald-400 leading-relaxed selection:bg-slate-700">
              {rawApiJson}
            </pre>
          </details>
        </section>
      )}

      {/* DUAL-MONTH CALENDAR MODAL (Matches screenshot 3) */}
      {showDatePickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-[#202124] p-6 text-slate-100 shadow-2xl">
            {/* Header Month Nav */}
            <div className="flex items-center justify-between border-b border-slate-700 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-extrabold text-white">Select Dates</span>
                <span className="rounded bg-blue-500/20 px-2.5 py-0.5 text-xs text-[#8ab4f8] font-bold">
                  {outboundDate} → {returnDate || 'Select return'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarMonthOffset(Math.max(0, calendarMonthOffset - 1))}
                  className="h-8 w-8 rounded-full border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonthOffset(calendarMonthOffset + 1)}
                  className="h-8 w-8 rounded-full border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold"
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={() => setShowDatePickerModal(false)}
                  className="ml-2 text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Dual Month Calendar View */}
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Month 1: August */}
              <div>
                <div className="text-center font-extrabold text-sm text-white mb-3">
                  {calendarMonthOffset === 0 ? 'August' : 'October'}
                </div>
                <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 mb-2">
                  <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold">
                  {Array.from({ length: 31 }).map((_, i) => {
                    const day = i + 1;
                    const isPast = day < 20 && calendarMonthOffset === 0;
                    return (
                      <button
                        key={i}
                        disabled={isPast}
                        onClick={() => {
                          const dateStr = `2026-${calendarMonthOffset === 0 ? '08' : '10'}-${day < 10 ? '0' + day : day}`;
                          setOutboundDate(dateStr);
                        }}
                        className={`h-9 w-full rounded-full flex items-center justify-center transition-all ${
                          isPast ? 'text-slate-600 cursor-not-allowed' : 'text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Month 2: September */}
              <div>
                <div className="text-center font-extrabold text-sm text-white mb-3">
                  {calendarMonthOffset === 0 ? 'September' : 'November'}
                </div>
                <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 mb-2">
                  <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold">
                  {Array.from({ length: 30 }).map((_, i) => {
                    const day = i + 1;
                    const isStart = day === 1;
                    const isEnd = day === 27;
                    const inRange = day >= 1 && day <= 27;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          const dateStr = `2026-09-${day < 10 ? '0' + day : day}`;
                          if (!outboundDate || day < 1) {
                            setOutboundDate(dateStr);
                          } else {
                            setReturnDate(dateStr);
                          }
                        }}
                        className={`relative h-9 w-full flex flex-col items-center justify-center text-xs transition-all ${
                          isStart
                            ? 'rounded-full bg-[#8ab4f8] text-slate-900 font-extrabold z-10'
                            : isEnd
                            ? 'rounded-full bg-slate-700 border-2 border-slate-400 text-white font-extrabold z-10'
                            : inRange
                            ? 'bg-blue-900/50 text-blue-200'
                            : 'text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        <span>{day}</span>
                        {isEnd && (
                          <span className="text-[9px] font-bold text-amber-300 -mt-1 block">$641</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Done Button */}
            <div className="mt-6 border-t border-slate-700 pt-4 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Showing round-trip prices found across flexible dates
              </div>
              <button
                type="button"
                onClick={() => setShowDatePickerModal(false)}
                className="rounded-full bg-[#8ab4f8] hover:bg-blue-300 px-6 py-2 text-xs font-extrabold text-slate-900 transition-all shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
