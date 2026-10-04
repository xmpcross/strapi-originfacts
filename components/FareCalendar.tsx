'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Two-month fare calendar popover for the flight-search form. Matches the
 * reference design: DATES / WEEKEND / MONTH tabs, Departure/Return "exact"
 * labels, two side-by-side months with ‹ › navigation, day cells colour-coded
 * by price (green cheapest → amber → red), and a price legend.
 *
 * Dates are displayed dd/mm/yyyy; values are exchanged as ISO YYYY-MM-DD.
 * Prices come from /api/price-calendar (server-side Travelpayouts) when both an
 * origin and destination are known — otherwise it degrades to a plain range
 * picker with no colours or legend.
 */

type Props = {
  depart: string; // ISO YYYY-MM-DD ('' when unset)
  ret: string;
  oneWay: boolean;
  minDate: string; // ISO — earliest selectable (today)
  origin?: string; // IATA
  destination?: string; // IATA
  onChange: (depart: string, ret: string) => void;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const monthKey = (y: number, m: number) => `${y}-${pad(m + 1)}`;
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function DepartureIcon({ className = 'size-4 flex-none text-[#001e73]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="18" width="18" height="2" rx="0.5" />
      <path d="M20.8 7.2c.5-.8.2-1.9-.6-2.4-.8-.5-1.9-.2-2.4.6l-3.1 5.3-7.5-3.3 2.1-4.8-2.6.7-3.8 6-3.7-1.6 2.5 4 4.5 1.6 14.6-6.1z" />
    </svg>
  );
}

export function ArrivalIcon({ className = 'size-4 flex-none text-[#001e73]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="18" width="18" height="2" rx="0.5" />
      <path d="M3.2 7.5l2.2.8 1.8-1.5 2.5.8V2.5h2.5v7.1l6.5 2.5c.8.3 1.2 1.2.9 2s-1.2 1.2-2 .9l-4.5-1.8-4.5 2.2-5.4 1.8z" />
    </svg>
  );
}

export function DateIcon({ className = 'size-4 flex-none text-[#001e73]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function stepIsoDate(iso: string, days: number): string {
  if (!iso || iso.length !== 10) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function fmtNiceDate(iso: string): string {
  if (!iso || iso.length !== 10) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) return '';
  return `${DOW_SHORT[dt.getDay()]}, ${MONTH_SHORT[dt.getMonth()]} ${d}`;
}

/** ISO YYYY-MM-DD → dd/mm/yyyy for display. */
const fmtDDMM = (iso: string) =>
  iso && iso.length === 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';

/** Weeks (Sunday-first) for a month; each cell is a day number or null. */
function weeksOf(y: number, m: number): (number | null)[][] {
  const first = new Date(y, m, 1).getDay(); // 0=Sun
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Column 0 (Sun) or 6 (Sat) within a Sunday-first week row. */
const isWeekendCol = (flatIndex: number) => flatIndex % 7 === 0 || flatIndex % 7 === 6;

export default function FareCalendar({
  depart,
  ret,
  oneWay,
  minDate,
  origin,
  destination,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'dates' | 'weekend' | 'month'>('dates');
  const [prices, setPrices] = useState<Record<string, number>>({});
  const boxRef = useRef<HTMLDivElement>(null);

  // First visible month — anchored to the current selection or today.
  const anchor = depart || minDate;
  const [view, setView] = useState(() => ({
    y: Number(anchor.slice(0, 4)),
    m: Number(anchor.slice(5, 7)) - 1,
  }));

  const nextView = view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 };

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Fetch fares for the two visible months whenever they change (needs a route).
  useEffect(() => {
    if (!open || !origin || !destination) return;
    let cancelled = false;
    const months = [monthKey(view.y, view.m), monthKey(nextView.y, nextView.m)];
    (async () => {
      try {
        const parts = await Promise.all(
          months.map((mm) =>
            fetch(`/api/price-calendar?origin=${origin}&destination=${destination}&month=${mm}`)
              .then((r) => r.json())
              .then((j) => (j?.prices || {}) as Record<string, number>)
              .catch(() => ({})),
          ),
        );
        if (!cancelled) setPrices((prev) => ({ ...prev, ...parts[0], ...parts[1] }));
      } catch {
        /* no prices */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, origin, destination, view.y, view.m]);

  // Price tercile thresholds + per-bucket minimums (for cell colour + legend).
  const buckets = useMemo(() => {
    const vals = Object.values(prices).filter((n) => n > 0).sort((a, b) => a - b);
    if (vals.length < 3) return null;
    const t1 = vals[Math.floor(vals.length / 3)];
    const t2 = vals[Math.floor((vals.length * 2) / 3)];
    return {
      t1,
      t2,
      greenMin: vals[0],
      amberMin: vals.find((v) => v > t1) ?? t1,
      redMin: vals.find((v) => v > t2) ?? t2,
    };
  }, [prices]);

  const priceClass = (iso: string): string => {
    if (!buckets || prices[iso] == null) return '';
    const p = prices[iso];
    if (p <= buckets.t1) return 'bg-[#83e0aa] text-[#14532d]';
    if (p <= buckets.t2) return 'bg-[#ffd98a] text-[#7a4a00]';
    return 'bg-[#f3a3a3] text-[#7f1d1d]';
  };

  const inRange = (iso: string) => !oneWay && depart && ret && iso >= depart && iso <= ret;

  const pick = (iso: string) => {
    if (iso < minDate) return;
    if (oneWay) {
      onChange(iso, '');
      setOpen(false);
      return;
    }
    if (!depart || (depart && ret) || iso < depart) {
      onChange(iso, ''); // start / restart a range
    } else {
      onChange(depart, iso);
      setOpen(false);
    }
  };

  const Month = ({ y, m }: { y: number; m: number }) => (
    <div className="min-w-[230px] flex-1">
      <div className="mb-2 text-center text-sm font-semibold text-forest-900">
        {MONTHS[m]} {y}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-forest-900/40">
        {DOW.map((d, i) => (
          <div key={i} className="py-1">{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeksOf(y, m).flat().map((d, i) => {
          if (d == null) return <div key={i} />;
          const iso = toISO(y, m, d);
          const disabled = iso < minDate;
          const isEnd = iso === depart || (!oneWay && iso === ret);
          const range = inRange(iso);
          const base =
            'flex h-9 w-full items-center justify-center rounded-md text-sm font-medium transition';
          let cls: string;
          if (disabled) cls = 'text-forest-900/25';
          else if (isEnd || range) cls = 'bg-[#2f3a44] text-white';
          else cls = priceClass(iso) || 'text-forest-900 hover:bg-forest-100';
          const weekendRing =
            tab === 'weekend' && isWeekendCol(i) && !isEnd && !range && !disabled
              ? ' ring-1 ring-forest-900/25'
              : '';
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => pick(iso)}
              className={`${base} ${cls}${weekendRing}`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );

  const departFmt = depart ? fmtNiceDate(depart) : '';
  const retFmt = ret ? fmtNiceDate(ret) : '';

  return (
    <div className="relative min-w-[240px] flex-1" ref={boxRef}>
      {/* Trigger — cheapOair style with date steppers (< >) */}
      <div className="flex h-full w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm font-medium text-forest-900">
        <div className="flex items-center gap-2">
          <DateIcon className="size-4 flex-none text-[#001e73]" />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={departFmt ? 'font-medium text-[#001e73] hover:underline' : 'text-forest-900/50'}
          >
            {departFmt || 'Depart'}
          </button>
          {depart && (
            <span className="inline-flex items-center gap-1 text-xs text-forest-900/50">
              <button
                type="button"
                aria-label="Previous day"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(stepIsoDate(depart, -1), ret);
                }}
                className="px-0.5 font-bold hover:text-forest-900"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next day"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(stepIsoDate(depart, 1), ret);
                }}
                className="px-0.5 font-bold hover:text-forest-900"
              >
                ›
              </button>
            </span>
          )}
        </div>

        {!oneWay && (
          <>
            <span className="select-none font-light text-forest-900/40">—</span>

            <div className="flex items-center gap-2">
              <DateIcon className="size-4 flex-none text-[#001e73]" />
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={retFmt ? 'font-medium text-[#001e73] hover:underline' : 'text-forest-900/50'}
              >
                {retFmt || 'Return'}
              </button>
              {ret && (
                <span className="inline-flex items-center gap-1 text-xs text-forest-900/50">
                  <button
                    type="button"
                    aria-label="Previous day"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(depart, stepIsoDate(ret, -1));
                    }}
                    className="px-0.5 font-bold hover:text-forest-900"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Next day"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(depart, stepIsoDate(ret, 1));
                    }}
                    className="px-0.5 font-bold hover:text-forest-900"
                  >
                    ›
                  </button>
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[min(560px,92vw)] rounded-[8px] border border-forest-900/12 bg-white p-4 shadow-2xl">
          {/* Tabs + exact labels */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-forest-900/10 pb-3">
            <div className="flex items-center gap-5 text-[13px] font-semibold tracking-wide">
              {(['dates', 'weekend', 'month'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`uppercase ${tab === t ? 'text-forest-900 underline decoration-2 underline-offset-[6px]' : 'text-forest-900/40 hover:text-forest-900/70'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 text-[13px] text-forest-900/60">
              <span>Departure <span className="font-semibold text-[#3d6bc9]">exact ▾</span></span>
              <span>Return <span className="font-semibold text-[#3d6bc9]">exact ▾</span></span>
            </div>
          </div>

          {/* Two months with nav arrows */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))}
              className="mt-1 grid h-7 w-7 flex-none place-items-center rounded-full text-forest-900/60 hover:bg-forest-100"
            >
              ‹
            </button>
            <div className="flex flex-1 flex-col gap-6 sm:flex-row sm:gap-5">
              <Month y={view.y} m={view.m} />
              <Month y={nextView.y} m={nextView.m} />
            </div>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))}
              className="mt-1 grid h-7 w-7 flex-none place-items-center rounded-full text-forest-900/60 hover:bg-forest-100"
            >
              ›
            </button>
          </div>

          {/* Legend — only when we have real fares to bucket */}
          {buckets && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-forest-900/10 pt-3 text-xs text-forest-900/60">
              <span className="rounded-md bg-[#83e0aa] px-2 py-1 font-semibold text-[#14532d]">${buckets.greenMin}+</span>
              <span className="rounded-md bg-[#ffd98a] px-2 py-1 font-semibold text-[#7a4a00]">${buckets.amberMin}+</span>
              <span className="rounded-md bg-[#f3a3a3] px-2 py-1 font-semibold text-[#7f1d1d]">${buckets.redMin}+</span>
              <span>Estimated prices for {oneWay ? 'one-way' : 'return'} flights</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
