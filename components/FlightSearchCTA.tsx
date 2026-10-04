import { flightSearchUrl, type FlightSearchOpts } from '@/lib/affiliate';

type Props = {
  /** Sentence above the CTA button, e.g. "Find flights with Qantas". */
  title: string;
  /** Sub-line under the title. */
  subtitle?: string;
  /** Button label, defaults to "Search flights". */
  cta?: string;
  /** Sub-id for per-CTA conversion tracking (e.g. "airline_qantas"). */
  subId: string;
  /** Filter results to a specific airline IATA, if known. */
  airline?: string;
  /** Default origin IATA. Falls back to LON. */
  origin?: string;
  /** Default destination IATA. Falls back to BKK (the route the enricher uses for "deal of the month"). */
  destination?: string;
  /** Extra props passed through to flightSearchUrl. */
  search?: Omit<FlightSearchOpts, 'origin' | 'destination' | 'subId' | 'airline'>;
};

export default function FlightSearchCTA({
  title, subtitle, cta = 'Search flights',
  subId, airline,
  origin = 'LON', destination = 'BKK',
  search,
}: Props) {
  const href = flightSearchUrl({
    origin, destination, airline, subId, ...search,
  });

  return (
    <aside
      className="my-10 overflow-hidden rounded-[0.4rem] border border-primary-emphasis/15 bg-gradient-to-br from-primary-emphasis/5 to-primary-pressed/10 p-6 shadow-sm"
      data-testid={`flight-cta-${subId}`}
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary-emphasis">
            Sponsored search
          </p>
          <p className="mt-1.5 text-lg font-bold text-forest-950">
            {title}
          </p>
          {subtitle && (
            <p className="mt-1 text-sm text-forest-900/65">{subtitle}</p>
          )}
        </div>
        <a
          href={href}
          target="_blank"
          rel="sponsored noopener"
          className="shrink-0 inline-flex items-center gap-2 rounded-full bg-primary-emphasis px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-pressed"
        >
          {cta}
          <span aria-hidden>→</span>
        </a>
      </div>
    </aside>
  );
}
