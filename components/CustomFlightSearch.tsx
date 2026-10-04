'use client';

import { useEffect, useRef, useState } from 'react';
import FareCalendar, { DepartureIcon, ArrivalIcon } from '@/components/FareCalendar';
import TravelpayoutsCarSearch from '@/components/TravelpayoutsCarSearch';
import { setVisitorOrigin } from '@/lib/visitor-origin';

/**
 * Kayak-style flight-search bar (Option A). Fully custom UI — no Travelpayouts
 * widget. On submit it deep-links to /flight-search with origin/destination/
 * dates/pax + this page's airline code, which the existing pass-through turns
 * into the TP deep-link and filters results to that carrier. Same results +
 * commission as the widget, full control of the form.
 *
 * Airport/city lookup uses Travelpayouts' public places autocomplete
 * (no token, CORS-enabled — the same source the widget uses).
 */

type Place = { code: string; label: string; sub: string };

const AUTOCOMPLETE =
  'https://autocomplete.travelpayouts.com/places2?locale=en&types[]=city&types[]=airport&term=';

const KAYAK_ORANGE = '#ff690f';

function useAutocomplete(query: string, enabled: boolean) {
  const [results, setResults] = useState<Place[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(AUTOCOMPLETE + encodeURIComponent(q));
        const data: Array<Record<string, string>> = await res.json();
        setResults(
          (data || []).slice(0, 8).map((d) => ({
            code: d.code,
            label: d.city_name && d.city_name !== d.name ? `${d.name}, ${d.city_name}` : d.name,
            sub: d.country_name || '',
          })),
        );
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, enabled]);
  return results;
}

const KNOWN_PLACES: Record<string, Place> = {
  PER: { code: 'PER', label: 'Perth', sub: 'Australia' },
  BKK: { code: 'BKK', label: 'Bangkok', sub: 'Thailand' },
  DMK: { code: 'DMK', label: 'Bangkok Don Mueang', sub: 'Thailand' },
  DPS: { code: 'DPS', label: 'Bali Denpasar', sub: 'Indonesia' },
  SIN: { code: 'SIN', label: 'Singapore', sub: 'Singapore' },
  KUL: { code: 'KUL', label: 'Kuala Lumpur', sub: 'Malaysia' },
  SYD: { code: 'SYD', label: 'Sydney', sub: 'Australia' },
  MEL: { code: 'MEL', label: 'Melbourne', sub: 'Australia' },
  BNE: { code: 'BNE', label: 'Brisbane', sub: 'Australia' },
  ADL: { code: 'ADL', label: 'Adelaide', sub: 'Australia' },
  HND: { code: 'HND', label: 'Tokyo Haneda', sub: 'Japan' },
  NRT: { code: 'NRT', label: 'Tokyo Narita', sub: 'Japan' },
  ICN: { code: 'ICN', label: 'Seoul Incheon', sub: 'South Korea' },
  LHR: { code: 'LHR', label: 'London Heathrow', sub: 'United Kingdom' },
  CDG: { code: 'CDG', label: 'Paris Charles de Gaulle', sub: 'France' },
  DXB: { code: 'DXB', label: 'Dubai', sub: 'United Arab Emirates' },
  JFK: { code: 'JFK', label: 'New York JFK', sub: 'United States' },
  LAX: { code: 'LAX', label: 'Los Angeles', sub: 'United States' },
};

function UserIcon({ className = 'size-4 flex-none text-[#001e73]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MapPinIcon({ className = 'size-4 flex-none text-[#001e73]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/** One origin/destination segment: a chip when chosen, an autocomplete input otherwise. */
function PlaceSegment({
  placeholder,
  label,
  value,
  onSelect,
  hero = false,
}: {
  placeholder: string;
  label?: string;
  value: Place | null;
  onSelect: (p: Place | null) => void;
  hero?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const results = useAutocomplete(query, open && !value);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const choose = (p: Place) => {
    onSelect(p);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className={`relative min-w-[150px] flex-1 ${hero ? 'lg:min-w-[210px]' : ''}`} ref={boxRef}>
      {value ? (
        <div className="flex h-full items-center px-3 py-2">
          <MapPinIcon className="mr-2 size-4 flex-none text-[#001e73]" />
          <span className="min-w-0 truncate text-[15px] font-bold text-[#001e73]">
            {value.code} <span className="font-normal text-forest-900">- {value.label}</span>
            <button
              type="button"
              aria-label="Clear"
              onClick={() => {
                onSelect(null);
                setOpen(true);
              }}
              className="ml-1.5 inline-grid h-4 w-4 place-items-center rounded-full text-forest-900/50 hover:bg-forest-900/10 hover:text-forest-900"
            >
              ✕
            </button>
          </span>
        </div>
      ) : (
        <div className="flex h-full items-center px-3">
          <MapPinIcon className="mr-2 size-4 flex-none text-[#001e73]" />
          <input
            type="text"
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className={`h-full w-full bg-transparent py-2.5 text-sm text-forest-900 placeholder:text-forest-900/45 focus:outline-none ${hero ? 'rounded-none focus:bg-blue-50/40' : 'rounded-md focus:ring-2 focus:ring-forest-900/70'}`}
          />
        </div>
      )}
      {open && !value && results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-[260px] max-w-[80vw] overflow-auto rounded-lg border border-forest-900/15 bg-white py-1 shadow-xl">
          {results.map((p) => (
            <li key={`${p.code}-${p.label}`}>
              <button
                type="button"
                onClick={() => choose(p)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-forest-50"
              >
                <span className="min-w-0 truncate text-forest-900">
                  {p.label}
                  {p.sub && <span className="text-forest-900/50"> · {p.sub}</span>}
                </span>
                <span className="flex-none font-mono text-xs font-bold text-forest-900/55">{p.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const Divider = () => <span className="my-2 hidden w-px self-stretch bg-forest-900/10 sm:block" />;

function PlaneIcon({ className = 'size-5' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden><path d="m3 11 18-7-7 17-3-7-8-3Z" strokeLinejoin="round"/><path d="m11 14 4-4" strokeLinecap="round"/></svg>;
}

function ProductIcon({ kind }: { kind: 'flight' | 'hotel' | 'car' | 'package' }) {
  if (kind === 'flight') return <PlaneIcon className="size-5" />;
  if (kind === 'hotel') return <span aria-hidden className="text-lg">▤</span>;
  if (kind === 'car') return <span aria-hidden className="text-lg">▱</span>;
  return <span aria-hidden className="text-lg">☂</span>;
}

function parseFlightSearchParam(param: string) {
  // e.g. PER1709BKK24091 or PER1709BKK1
  const match = param.trim().match(/^([A-Za-z]{3})(\d{4})([A-Za-z]{3})(\d{4})?(\d+)?$/);
  if (!match) return null;
  const originCode = match[1].toUpperCase();
  const departDDMM = match[2];
  const destCode = match[3].toUpperCase();
  const returnDDMM = match[4];
  const paxNum = match[5] ? Number(match[5]) : 1;

  const parseDDMM = (ddmm: string) => {
    if (!ddmm || ddmm.length !== 4) return '';
    const day = Number(ddmm.slice(0, 2));
    const month = Number(ddmm.slice(2, 4)) - 1;
    const now = new Date();
    let year = now.getFullYear();
    const dt = new Date(year, month, day);
    if (dt < now) {
      year += 1;
    }
    const mmStr = String(month + 1).padStart(2, '0');
    const ddStr = String(day).padStart(2, '0');
    return `${year}-${mmStr}-${ddStr}`;
  };

  return {
    origin: originCode,
    destination: destCode,
    depart: parseDDMM(departDDMM),
    ret: returnDDMM ? parseDDMM(returnDDMM) : '',
    pax: paxNum,
    oneWay: !returnDDMM,
  };
}

export default function CustomFlightSearch({
  airlineIata,
  airlineName,
  variant = 'compact',
}: {
  airlineIata?: string | null;
  airlineName?: string;
  variant?: 'compact' | 'hero';
}) {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [depart, setDepart] = useState('');
  const [ret, setRet] = useState('');
  const [pax, setPax] = useState(1);
  const [oneWay, setOneWay] = useState(false);
  const [directOnly, setDirectOnly] = useState(false);
  const [addHotel, setAddHotel] = useState(false);
  const [addCar, setAddCar] = useState(false);
  const [cabin, setCabin] = useState('Economy');
  const [activeProduct, setActiveProduct] = useState<'flight' | 'car'>('flight');
  const [error, setError] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    if (origin?.code) {
      const cleanName = origin.label ? origin.label.split('-')[0].split(',')[0].trim() : origin.code;
      setVisitorOrigin({ iata: origin.code, name: cleanName || origin.code });
    }
  }, [origin]);
  const formRef = useRef<HTMLFormElement>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setShowOptions(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Parse URL search params (origin, destination, depart, return, pax, or flightSearch=PER1709BKK24091) on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    let origParam = params.get('origin') || params.get('from');
    let destParam = params.get('destination') || params.get('to');
    let depParam = params.get('depart') || params.get('depart_date');
    let retParam = params.get('return') || params.get('return_date');
    let paxParam = params.get('pax') || params.get('adults');

    const fsParam = params.get('flightSearch');
    if (fsParam) {
      const parsed = parseFlightSearchParam(fsParam);
      if (parsed) {
        origParam = parsed.origin;
        destParam = parsed.destination;
        if (parsed.depart) depParam = parsed.depart;
        if (parsed.ret) retParam = parsed.ret;
        if (parsed.pax) paxParam = String(parsed.pax);
        if (parsed.oneWay) setOneWay(true);
      }
    }

    if (depParam) setDepart(depParam);
    if (retParam) setRet(retParam);
    if (paxParam) setPax(Number(paxParam) || 1);
    if (params.has('direct')) setDirectOnly(true);

    const iso = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    if (!depParam) setDepart(iso(14));
    if (!retParam) setRet(iso(21));

    const fetchPlace = async (code: string): Promise<Place> => {
      const upper = code.toUpperCase();
      if (KNOWN_PLACES[upper]) return KNOWN_PLACES[upper];
      try {
        const res = await fetch(AUTOCOMPLETE + encodeURIComponent(code));
        const data: Array<Record<string, string>> = await res.json();
        const match = data?.find((d) => d.code?.toUpperCase() === upper) || data?.[0];
        if (match) {
          return {
            code: match.code,
            label: match.city_name || match.name,
            sub: match.country_name || '',
          };
        }
      } catch {
        /* fallback */
      }
      return { code: upper, label: upper, sub: '' };
    };

    if (origParam) {
      fetchPlace(origParam).then((p) => setOrigin(p));
    } else {
      fetch('/api/nearest-city')
        .then((r) => r.json())
        .then((j: { code?: string; name?: string; country?: string }) => {
          if (j?.code && j?.name) {
            setOrigin((prev) => prev ?? { code: j.code!, label: j.name!, sub: j.country || '' });
          }
        })
        .catch(() => {});
    }

    if (destParam) {
      fetchPlace(destParam).then((p) => setDestination(p));
    }
  }, []);

  // Listen for live urlchange events dispatched by Travelpayouts script
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const fsParam = params.get('flightSearch');
      if (fsParam) {
        const parsed = parseFlightSearchParam(fsParam);
        if (parsed) {
          const fetchPlace = async (code: string): Promise<Place> => {
            const upper = code.toUpperCase();
            if (KNOWN_PLACES[upper]) return KNOWN_PLACES[upper];
            try {
              const res = await fetch(AUTOCOMPLETE + encodeURIComponent(code));
              const data: Array<Record<string, string>> = await res.json();
              const match = data?.find((d) => d.code?.toUpperCase() === upper) || data?.[0];
              if (match) return { code: match.code, label: match.city_name || match.name, sub: match.country_name || '' };
            } catch {}
            return { code: upper, label: upper, sub: '' };
          };
          if (parsed.origin) fetchPlace(parsed.origin).then((p) => setOrigin(p));
          if (parsed.destination) fetchPlace(parsed.destination).then((p) => setDestination(p));
          if (parsed.depart) setDepart(parsed.depart);
          if (parsed.ret) setRet(parsed.ret);
        }
      }
    };

    window.addEventListener('urlchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('urlchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin?.code || !destination?.code) return setError('Choose a departure and destination.');
    if (!depart) return setError('Pick a departure date.');
    if (!oneWay && !ret) return setError('Pick a return date, or switch to One way.');
    setError('');
    const params = new URLSearchParams({
      origin: origin.code,
      destination: destination.code,
      depart,
      pax: String(pax),
    });
    if (!oneWay && ret) params.set('return', ret);
    if (directOnly) params.set('direct', 'true');
    if (airlineIata) params.set('airline', airlineIata);
    if (airlineName) params.set('an', airlineName);

    const targetUrl = `/flight-search?${params.toString()}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const seg = 'flex items-center px-3 text-sm text-forest-900';
  const hero = variant === 'hero';

  const productNav = null;

  if (hero && activeProduct === 'car') {
    return (
      <div data-testid="custom-travel-search" className="w-full">
        {productNav}
        <TravelpayoutsCarSearch />
      </div>
    );
  }

  return (
    <div data-testid="custom-travel-search" className="w-full">
      {productNav}
      <form
        ref={formRef}
        onSubmit={submit}
        onClick={() => setShowOptions(true)}
        data-testid="custom-flight-search"
        className="w-full"
      >
      <div
        data-testid="custom-flight-options-row"
        className={`mb-3 items-center gap-x-6 gap-y-2 text-sm font-bold text-[#001e73] ${
          showOptions ? 'is-expanded flex flex-wrap' : hero ? 'flex flex-wrap' : 'hidden'
        }`}
      >
        <select
          value={oneWay ? 'oneway' : 'return'}
          onChange={(e) => setOneWay(e.target.value === 'oneway')}
          className="cursor-pointer bg-transparent py-1 font-bold text-[#001e73] focus:outline-none"
        >
          <option value="return">Round-trip</option>
          <option value="oneway">One-way</option>
        </select>

        <label className="inline-flex cursor-pointer items-center gap-1.5 font-bold text-[#001e73]">
          <UserIcon className="size-4 text-[#001e73]" />
          <select
            value={pax}
            onChange={(e) => setPax(Number(e.target.value))}
            className="cursor-pointer bg-transparent py-1 font-bold text-[#001e73] focus:outline-none"
            aria-label="Travelers"
          >
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} Traveler{n === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>

        <select
          value={cabin}
          onChange={(e) => setCabin(e.target.value)}
          className="cursor-pointer bg-transparent py-1 font-bold text-[#001e73] focus:outline-none"
          aria-label="Cabin class"
        >
          <option value="Economy">Coach</option>
          <option value="Premium economy">Premium economy</option>
          <option value="Business">Business</option>
          <option value="First">First</option>
        </select>
      </div>

      {/* Main bar */}
      <div className={`flex flex-wrap items-stretch bg-white ${hero ? 'gap-0 rounded-[8px] border border-[#b8c9e2] p-2 shadow-[0_12px_28px_rgba(11,42,91,0.12)]' : 'gap-1 rounded-[8px] border border-forest-900/15 p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]'}`}>
        <PlaceSegment placeholder="Where from?" value={origin} onSelect={setOrigin} hero={hero} />

        <button
          type="button"
          onClick={swap}
          aria-label="Swap origin and destination"
          className={`${hero ? 'my-0 h-11 w-11 rounded-[8px] border border-[#c8d5e7] bg-white shadow-sm' : 'my-1 w-9 rounded-[8px]'} grid flex-none place-items-center text-forest-900/60 hover:bg-forest-50 hover:text-forest-900`}
        >
          ⇄
        </button>

        <PlaceSegment placeholder="Country, city or airport" value={destination} onSelect={setDestination} hero={hero} />

        <Divider />

        {/* Dates — custom two-month fare calendar (dd/mm/yyyy, colour-coded) */}
        <FareCalendar
          depart={depart}
          ret={ret}
          oneWay={oneWay}
          minDate={today}
          origin={origin?.code}
          destination={destination?.code}
          onChange={(d, r) => {
            setDepart(d);
            setRet(r);
          }}
        />

        <Divider />

        {/* Passengers */}
        <div className={`${seg} min-w-[110px] flex-none ${hero ? 'hidden' : ''}`}>
          <select
            value={pax}
            onChange={(e) => setPax(Number(e.target.value))}
            aria-label="Passengers"
            className="bg-transparent py-2 text-sm text-forest-900 focus:outline-none"
          >
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} adult{n === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <button
          type="submit"
          className={`${hero ? 'm-0 min-h-12 rounded-[8px] px-12 text-base' : 'my-0.5 rounded-[8px] px-6 text-sm'} flex-none font-bold text-white transition hover:brightness-95`}
          style={{ backgroundColor: hero ? '#ff4b0a' : KAYAK_ORANGE }}
        >
          Search
        </button>
      </div>

      {/* Direct flights only */}
      <div
        data-testid="direct-flights-only-row"
        className={`mt-3 items-center gap-x-6 gap-y-3 text-sm text-forest-900/70 justify-end ${
          showOptions ? 'is-expanded flex flex-wrap' : hero ? 'flex flex-wrap' : 'hidden'
        }`}
      >
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={directOnly}
            onChange={(e) => setDirectOnly(e.target.checked)}
            className="h-4 w-4 accent-primary-emphasis"
          />
          Direct flights only
        </label>
      </div>

      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
      </form>
    </div>
  );
}
