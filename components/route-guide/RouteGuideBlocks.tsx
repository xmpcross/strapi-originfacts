import { getAirlineRef } from '@/lib/airline-refs';
import type { GuideParagraph, GuideSection, GuideSource } from '@/lib/route-guide';
import { flightKey, type MonthFare, type RouteFares, type SeenFlight } from '@/lib/route-fares';
import { FareCurrencyNote, FarePrice } from '@/components/route-v2/FarePrices';

// Server components for the sourced route template (routes with a
// content/route-guides file). Live figures always say where they come from and
// when they were fetched; editorial text always carries numbered citations.

/** Site name first (the route's own carrier records), then Duffel's, then the code. */
export function airlineName(iata: string, names?: Record<string, string>): string {
  return names?.[iata] || getAirlineRef(iata)?.name || iata;
}

/** "55 min" for short hops; "11h 25m" from 90 minutes up, where minutes stop being readable. */
export function formatFlightMinutes(minutes: number): string {
  if (minutes < 90) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "55–60 min", "2h 40m–3h 10m", or a single value when min = max. */
export function formatFlightRange(min: number, max: number): string {
  if (min === max) return formatFlightMinutes(min);
  if (max < 90) return `${min}–${max} min`;
  return `${formatFlightMinutes(min)}–${formatFlightMinutes(max)}`;
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function formatDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function formatFetched(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' });
}

export function Cite({ ids, order }: { ids: string[]; order: Map<string, number> }) {
  const sorted = [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  return (
    <sup className="ml-0.5 whitespace-nowrap text-[0.7em] font-semibold">
      {sorted.map((id, i) => (
        <span key={id}>
          {i > 0 && ','}
          <a href={`#source-${id}`} className="text-primary-emphasis hover:underline" aria-label={`Source ${order.get(id)}`}>
            [{order.get(id)}]
          </a>
        </span>
      ))}
    </sup>
  );
}

export function CitedParagraph({ p, order, className = '' }: { p: GuideParagraph; order: Map<string, number>; className?: string }) {
  return (
    <p className={className}>
      {p.text}
      <Cite ids={p.sources} order={order} />
    </p>
  );
}

function FareNote({ fares }: { fares: RouteFares }) {
  return (
    <p className="mt-3 text-xs leading-relaxed text-forest-900/60">
      Lowest one-way nonstop fares per person found in recent searches on Aviasales, our flight-search partner. They are cached
      search results, not quotes: the fare on the day you book may differ. Months with no fare found are left out. Flights and
      dates fetched {formatFetched(fares.fetchedAt)}. <FareCurrencyNote />
    </p>
  );
}

export function SeenFlightsTable({ flights, fares, originIata, destinationIata, names }: { flights: SeenFlight[]; fares: RouteFares; originIata: string; destinationIata: string; names?: Record<string, string> }) {
  return (
    <div>
      <div className="overflow-x-auto rounded-[0.3rem] border border-forest-900/10">
        <table className="w-full min-w-[520px] text-left text-sm" data-testid="route-seen-flights">
          <thead className="bg-forest-900/[0.03] text-xs uppercase tracking-wider text-forest-900/60">
            <tr>
              <th className="px-4 py-3 font-semibold">Flight</th>
              <th className="px-4 py-3 font-semibold">Airline</th>
              <th className="px-4 py-3 font-semibold">Departs {originIata} (local)</th>
              <th className="px-4 py-3 font-semibold">Flight time</th>
              <th className="px-4 py-3 font-semibold">Lowest fare seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-900/10">
            {flights.map((f) => (
              <tr key={flightKey(f)}>
                <td className="px-4 py-3 font-mono font-semibold text-forest-900">
                  {f.airline} {f.flightNumber}
                </td>
                <td className="px-4 py-3 text-forest-900">{airlineName(f.airline, names)}</td>
                <td className="px-4 py-3 tabular-nums text-forest-900">{f.departs}</td>
                <td className="px-4 py-3 tabular-nums text-forest-900">{f.durationMinutes ? formatFlightMinutes(f.durationMinutes) : '—'}</td>
                <td className="px-4 py-3 tabular-nums text-forest-900"><FarePrice kind="flight" k={flightKey(f)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-forest-900/60">
        Nonstop {originIata}→{destinationIata} flights that appeared in {fares.fareCount} fares found in recent Aviasales searches. This shows
        which flights are being sold, not a full timetable: a flight can run on more days than it appears here, and schedules change.
        Check times with the airline before you travel. Data fetched {formatFetched(fares.fetchedAt)}. <FareCurrencyNote />
      </p>
    </div>
  );
}

export function MonthFaresTable({ months, fares, names }: { months: MonthFare[]; fares: RouteFares; names?: Record<string, string> }) {
  const cheapest = months.reduce((a, b) => (b.price < a.price ? b : a), months[0]);
  return (
    <div>
      <div className="overflow-x-auto rounded-[0.3rem] border border-forest-900/10">
        <table className="w-full min-w-[480px] text-left text-sm" data-testid="route-month-fares">
          <thead className="bg-forest-900/[0.03] text-xs uppercase tracking-wider text-forest-900/60">
            <tr>
              <th className="px-4 py-3 font-semibold">Month</th>
              <th className="px-4 py-3 font-semibold">Lowest fare</th>
              <th className="px-4 py-3 font-semibold">Airline &amp; flight</th>
              <th className="px-4 py-3 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-900/10">
            {months.map((m) => (
              <tr key={m.month} className={m === cheapest ? 'bg-sand-50' : undefined}>
                <td className="px-4 py-3 font-semibold text-forest-900">
                  {formatMonth(m.month)}
                  {m === cheapest && (
                    <span className="ml-2 rounded-[0.2rem] bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-forest-900">
                      Lowest
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums text-forest-900"><FarePrice kind="month" k={m.month} /></td>
                <td className="px-4 py-3 text-forest-900">
                  {airlineName(m.airline, names)} <span className="font-mono text-forest-900/70">{m.airline} {m.flightNumber}</span>
                </td>
                <td className="px-4 py-3 tabular-nums text-forest-900">{formatDay(m.departureAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FareNote fares={fares} />
    </div>
  );
}

export function GuideSectionBlock({ section, order }: { section: GuideSection; order: Map<string, number> }) {
  return (
    <section id={section.id} className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6" data-testid={`route-guide-${section.id}`}>
      <h2 className="editorial-h border-b border-forest-900/10 pb-3 text-[1.5rem] font-bold text-forest-900">{section.heading}</h2>
      <div className="mt-4 max-w-4xl space-y-4 text-base leading-relaxed text-forest-900/85">
        {section.paragraphs.map((p, i) => (
          <CitedParagraph key={i} p={p} order={order} />
        ))}
      </div>
    </section>
  );
}

export function SourcesList({ sources, order, verifiedAt }: { sources: GuideSource[]; order: Map<string, number>; verifiedAt: string }) {
  const sorted = [...sources].filter((s) => order.has(s.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return (
    <section id="sources" className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6 pb-20" data-testid="route-sources">
      <h2 className="editorial-h border-b border-forest-900/10 pb-3 text-[1.5rem] font-bold text-forest-900">Sources</h2>
      <p className="mt-3 text-sm text-forest-900/65">
        Route facts checked against these sources on {new Date(`${verifiedAt}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}.
        Fares, flights and flight times above come from live search data and are dated where they appear.
      </p>
      <ol className="mt-4 space-y-2 text-sm text-forest-900/85">
        {sorted.map((s) => (
          <li key={s.id} id={`source-${s.id}`} className="flex gap-2 scroll-mt-28">
            <span className="w-7 shrink-0 font-semibold text-forest-900/60">[{order.get(s.id)}]</span>
            <span>
              <a href={s.url} target="_blank" rel="noopener" className="font-semibold text-primary-emphasis hover:underline">
                {s.title}
              </a>
              {' — '}
              {s.publisher}
              {s.published && <>, {s.published}</>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
