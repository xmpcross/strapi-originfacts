import { Star } from 'lucide-react';
import { formatDuration, formatKm, type DirectoryCarrier, type DirectoryRoute } from '@/lib/route-directory';

/**
 * The routes with the highest popularity score in our route records, above
 * the /flight-routes directory. Text only — no destination photos. The score
 * is our records' own ranking, not passenger numbers, and the copy says so.
 */
export default function FeaturedRoutes({
  routes,
  carriers,
}: {
  routes: DirectoryRoute[];
  carriers: DirectoryCarrier[];
}) {
  if (routes.length === 0) return null;
  return (
    <section className="mt-10" aria-labelledby="featured-routes-heading" data-testid="featured-routes">
      <h2 id="featured-routes-heading" className="flex scroll-mt-24 items-center gap-2.5 text-xl sm:text-2xl">
        <Star aria-hidden className="h-6 w-6 text-primary-emphasis" />
        Most popular routes
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-forest-900/75">
        Highest popularity score in our records — a ranking within our dataset, not a count of passengers or flights.
      </p>

      {/* Phones: a swipeable row so the grid does not push the directory far down. */}
      <ul className="no-scrollbar -mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mt-4 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 lg:gap-4">
        {routes.map((r, i) => (
          <li key={r.slug} className="w-[78%] max-w-[300px] flex-none snap-start sm:w-auto sm:max-w-none">
            <FeaturedCard route={r} rank={i + 1} carriers={carriers} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeaturedCard({ route: r, rank, carriers }: { route: DirectoryRoute; rank: number; carriers: DirectoryCarrier[] }) {
  const o = r.origin;
  const d = r.destination;
  const names = r.carriers.map((i) => carriers[i]).filter(Boolean);
  return (
    <article
      className="group relative flex h-full flex-col rounded-[0.5rem] border border-forest-900/10 bg-white p-4 shadow-[0_1px_2px_rgba(15,39,102,0.04)] transition hover:-translate-y-0.5 hover:border-forest-900/25 hover:shadow-md"
      data-testid={`featured-route-${r.slug}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 font-mono text-2xl font-bold leading-none tracking-wider text-forest-950">
          <a href={`/airports/${o.slug}`} className="relative z-10 hover:text-primary-emphasis" title={o.name}>
            {o.iata}
          </a>
          <span aria-hidden className="text-lg text-forest-900/40">
            →
          </span>
          <a href={`/airports/${d.slug}`} className="relative z-10 hover:text-primary-emphasis" title={d.name}>
            {d.iata}
          </a>
        </p>
        <span className="font-mono text-xs font-semibold text-forest-900/45">#{rank}</span>
      </div>
      <h3 className="mt-4 truncate text-lg font-bold leading-snug group-hover:text-primary-emphasis">
        <a
          href={`/flight-routes/${r.slug}`}
          className="after:absolute after:inset-0 after:rounded-[0.5rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
        >
          {o.city} <span aria-hidden>→</span>
          <span className="sr-only"> to </span> {d.city}
        </a>
      </h3>
      <p className="mt-0.5 truncate text-sm text-forest-900/60">
        {o.country && d.country && o.country !== d.country ? `${o.country} → ${d.country}` : o.country || d.country}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-forest-900/10 pt-3 text-sm">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-forest-900/50">Distance</dt>
          <dd className="mt-0.5 font-bold tabular-nums text-forest-950">{r.distanceKm ? formatKm(r.distanceKm) : '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-forest-900/50">Est. flight time</dt>
          <dd className="mt-0.5 font-bold tabular-nums text-forest-950">
            {r.durationMinutes ? `≈ ${formatDuration(r.durationMinutes)}` : '—'}
          </dd>
        </div>
      </dl>
      {names.length > 0 && (
        <p className="mt-3 line-clamp-2 text-sm text-forest-900/70">
          <span className="font-semibold text-forest-950">
            {names.length} airline{names.length === 1 ? '' : 's'} on file:
          </span>{' '}
          {names.slice(0, 3).map((c, i) => (
            <span key={c.slug}>
              {i > 0 && ', '}
              <a href={`/airlines/${c.slug}`} className="relative z-10 underline decoration-forest-900/20 underline-offset-2 hover:text-primary-emphasis">
                {c.name}
              </a>
            </span>
          ))}
          {names.length > 3 && ` +${names.length - 3} more`}
        </p>
      )}
    </article>
  );
}
