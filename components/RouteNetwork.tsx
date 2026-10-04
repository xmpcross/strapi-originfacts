import type { RouteFacts } from '@/lib/route-facts';
import ExpandableChips from '@/components/ExpandableChips';

/**
 * "Where {airline} flies" — the full route network, derived from TravelPayouts
 * route data. Distinct from the "Popular routes operated by" section below it,
 * which shows individually tracked route cards; this is the network-wide view
 * (destination/country counts, busiest hubs, fleet, longest sector).
 */
export default function RouteNetwork({ facts, airlineName }: { facts: RouteFacts; airlineName: string }) {
  const maxHub = facts.topHubs[0]?.routes || 1;

  return (
    <section className="mx-auto max-w-6xl px-6 pb-20" data-testid="airline-route-network">
      <p className="eyebrow-tag">
        <span className="inline-block h-px w-8 bg-forest-800/60" />
        Network overview
      </p>
      <h2 className="editorial-h mt-3 text-2xl font-bold text-2xl">
        Where {airlineName} flies
      </h2>
      <p className="mt-3 max-w-3xl text-sm font-light leading-7 text-forest-900/75">
        {airlineName} operates{' '}
        <strong className="font-semibold text-forest-900">{facts.routeCount.toLocaleString()} routes</strong> to{' '}
        <strong className="font-semibold text-forest-900">{facts.destinationCount} destinations</strong> across{' '}
        <strong className="font-semibold text-forest-900">{facts.countryCount} countries</strong>
        {facts.longestRoute
          ? `, its longest sector reaching ${facts.longestRoute.from} to ${facts.longestRoute.to} (${facts.longestRoute.km.toLocaleString()} km nonstop).`
          : '.'}
      </p>

      {/* Stat band */}
      <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="rn-stats">
        <StatTile value={facts.routeCount.toLocaleString()} label="Routes operated" />
        <StatTile value={String(facts.destinationCount)} label="Destinations" />
        <StatTile value={String(facts.countryCount)} label="Countries" />
        {facts.longestRoute && (
          <StatTile
            value={`${facts.longestRoute.km.toLocaleString()} km`}
            label="Longest route"
            hint={`${facts.longestRoute.fromIata} → ${facts.longestRoute.toIata}`}
            accent
          />
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        {/* Destinations */}
        <div>
          <h3 className="font-urbanist text-base font-bold text-forest-900">Destinations served</h3>
          <p className="mt-1 text-sm font-light text-forest-900/60">
            Cities {airlineName} flies to, most-served first.
          </p>
          <ExpandableChips items={facts.keyDestinations} initial={24} testId="rn-destinations" />
        </div>

        {/* Hubs + fleet */}
        <div>
          <h3 className="font-urbanist text-base font-bold text-forest-900">Main hubs</h3>
          <p className="mt-1 text-sm font-light text-forest-900/60">Busiest departure bases, by route count.</p>
          <div className="mt-4 flex flex-col gap-2.5">
            {facts.topHubs.map((h) => (
              <div key={h.city} className="grid grid-cols-[84px_1fr_auto] items-center gap-3">
                <span className="truncate text-[13px] font-bold text-forest-900">{h.city}</span>
                <span className="h-2 overflow-hidden rounded-full bg-forest-900/10">
                  <span
                    className="block h-full rounded-full bg-forest-800"
                    style={{ width: `${Math.max(8, Math.round((h.routes / maxHub) * 100))}%` }}
                  />
                </span>
                <span className="text-[12px] font-bold tabular-nums text-forest-900/55">{h.routes}</span>
              </div>
            ))}
          </div>

          {facts.fleet.length > 0 && (
            <>
              <h3 className="mt-6 font-urbanist text-base font-bold text-forest-900">Fleet</h3>
              <p className="mt-1 text-sm font-light text-forest-900/60">Aircraft types on record for these routes.</p>
              <ExpandableChips items={facts.fleet} initial={12} testId="rn-fleet" />
            </>
          )}
        </div>
      </div>

      {/* Longest nonstop route — feature block with a great-circle arc. */}
      {facts.longestRoute && (
        <div
          className="mt-10 grid overflow-hidden rounded-[0.4rem] border border-forest-900/12 bg-white/85 shadow-[0_1px_2px_rgba(0,0,0,0.03)] lg:grid-cols-[1.1fr_1fr]"
          data-testid="rn-longest-route"
        >
          <div className="p-6 lg:p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-emphasis">
              Longest nonstop route
            </p>
            <p className="editorial-h mt-2 text-xl font-bold text-forest-900 lg:text-2xl">
              {facts.longestRoute.from} → {facts.longestRoute.to}
            </p>
            <p className="mt-1.5 text-sm font-bold tabular-nums text-forest-900/80">
              {facts.longestRoute.km.toLocaleString()} km · {facts.longestRoute.fromIata} → {facts.longestRoute.toIata}
            </p>
            <p className="mt-3 max-w-md text-sm font-light leading-7 text-forest-900/65">
              The longest sector in the {airlineName} network, measured as the great-circle distance between the two
              airports.
            </p>
          </div>
          <div className="flex items-center justify-center bg-forest-50/70 p-5">
            <svg viewBox="0 0 360 190" role="img" aria-label={`${facts.longestRoute.from} to ${facts.longestRoute.to} route arc`} className="h-auto w-full max-w-[340px]">
              <defs>
                <linearGradient id="rn-arc" x1="0" x2="1">
                  <stop offset="0" stopColor="#0c5fe0" />
                  <stop offset="1" stopColor="#b96f18" />
                </linearGradient>
              </defs>
              <path d="M40 145 Q180 18 320 145" fill="none" stroke="url(#rn-arc)" strokeWidth="3" strokeDasharray="4 6" strokeLinecap="round" />
              <circle cx="40" cy="145" r="6" fill="#0c5fe0" />
              <circle cx="320" cy="145" r="6" fill="#b96f18" />
              <text x="40" y="169" textAnchor="middle" fontSize="13" fontWeight="700" fill="#12262f" className="font-urbanist">
                {facts.longestRoute.fromIata}
              </text>
              <text x="320" y="169" textAnchor="middle" fontSize="13" fontWeight="700" fill="#12262f" className="font-urbanist">
                {facts.longestRoute.toIata}
              </text>
              <text x="180" y="150" textAnchor="middle" fontSize="12" fill="#5a6b72">
                {facts.longestRoute.km.toLocaleString()} km
              </text>
            </svg>
          </div>
        </div>
      )}

      <p className="mt-7 text-[11px] font-light uppercase tracking-wider text-forest-900/40">
        Route data · {facts.source} · updated {facts.updated}
      </p>
    </section>
  );
}

function StatTile({
  value,
  label,
  hint,
  accent,
}: {
  value: string;
  label: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[0.3rem] border border-forest-900/10 bg-white/85 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div
        className={`font-urbanist text-2xl font-bold leading-none tabular-nums lg:text-[1.7rem] ${
          accent ? 'text-primary-emphasis' : 'text-forest-900'
        }`}
      >
        {value}
      </div>
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-forest-900/55">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] font-medium text-forest-900/45">{hint}</div>}
    </div>
  );
}
