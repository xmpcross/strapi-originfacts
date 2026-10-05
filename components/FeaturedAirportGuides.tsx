import Link from 'next/link';
import type { DirectoryAirport } from '@/lib/airport-directory';
import { CheckIcon } from '@/components/FeaturedAirlineGuides';

/**
 * A short grid of reviewed airport guides above the /airports directory.
 * Text-only by design: no airport photos (the CMS hero images are not used on
 * this page). The page picks which guides to show; this only lays them out.
 */
export default function FeaturedAirportGuides({
  airports,
  reviewedCount,
  guideIndex,
}: {
  airports: DirectoryAirport[];
  reviewedCount: number;
  /** Airports with a reviewed guide or route records, A–Z — plain links under the cards. */
  guideIndex: DirectoryAirport[];
}) {
  if (airports.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="featured-airports-heading" data-testid="featured-airport-guides">
      <div className="flex flex-col gap-2 border-b border-forest-900/10 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-success-emphasis">
            <CheckIcon className="h-3.5 w-3.5" />
            Reviewed airport guides
          </p>
          <h2 id="featured-airports-heading" className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
            Start with a reviewed guide
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-forest-900/70 sm:text-base">
            Two per region: the reviewed guides with the most routes in our route records. All {reviewedCount}, and
            every airport with route records, are listed below the cards.
          </p>
        </div>
        <Link
          href="/airports/top-100-airports"
          className="flex-none text-sm font-semibold text-primary-emphasis underline-offset-2 hover:underline"
        >
          All {reviewedCount} reviewed guides →
        </Link>
      </div>

      {/* Phones: a swipeable row so the grid does not push the directory far down. */}
      <ul className="no-scrollbar -mx-4 mt-5 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mt-6 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4 lg:gap-4">
        {airports.map((a) => (
          <li key={a.iata} className="w-[78%] max-w-[300px] flex-none snap-start sm:w-auto sm:max-w-none">
            <GuideCard airport={a} />
          </li>
        ))}
      </ul>

      <details className="group mt-6 rounded-[0.3rem] border border-forest-900/10 bg-white" data-testid="reviewed-airport-index">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-forest-950 hover:text-primary-emphasis [&::-webkit-details-marker]:hidden">
          All {guideIndex.length} airports with a reviewed guide (✓) or route records, A–Z
          <span aria-hidden className="text-forest-900/50 transition group-open:rotate-180">
            ▾
          </span>
        </summary>
        {/* Styled from the list down: 178 entries, so no per-item class strings. */}
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-forest-900/10 px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4 [&>li]:min-w-0 [&>li]:truncate [&_a]:text-forest-900/80 [&_a:hover]:text-primary-emphasis [&_a:hover]:underline [&_small]:font-mono [&_small]:text-xs [&_small]:text-forest-900/50">
          {guideIndex.map((a) => (
            <li key={a.iata}>
              <a href={`/airports/${a.slug}`}>{a.city || a.name}</a> <small>{a.iata}</small>
              {a.reviewed ? ' ✓' : ''}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function GuideCard({ airport: a }: { airport: DirectoryAirport }) {
  return (
    <Link
      href={`/airports/${a.slug}`}
      className="group flex h-full flex-col rounded-[0.3rem] border border-forest-900/10 bg-white p-4 transition hover:border-primary-emphasis/50 hover:shadow-[0_6px_16px_-6px_rgba(15,39,102,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis sm:p-5"
      data-testid={`featured-airport-${a.iata}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="relative font-mono text-3xl font-bold leading-none tracking-wider text-forest-950">
          <span className="sr-only">IATA code </span>
          {a.iata}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-forest-900/50">{a.region}</span>
      </div>
      <h3 className="mt-4 truncate text-lg font-bold leading-snug group-hover:text-primary-emphasis">{a.city || a.name}</h3>
      <p className="mt-0.5 line-clamp-2 text-sm text-forest-900/65">{a.name}</p>
      <p className="mt-0.5 truncate text-sm text-forest-900/60">{a.country}</p>

      <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-forest-900/10 pt-3 text-sm">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-forest-900/50">Route records</dt>
          <dd className="mt-0.5 font-bold text-forest-950">{a.routes ?? 0}</dd>
        </div>
        {a.icao && (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-forest-900/50">ICAO</dt>
            <dd className="mt-0.5 font-mono font-bold text-forest-950">{a.icao}</dd>
          </div>
        )}
      </dl>

      <span className="mt-auto pt-4 text-sm font-semibold text-primary-emphasis">
        Read the guide{' '}
        <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}
