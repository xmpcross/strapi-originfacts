import Link from 'next/link';
import { isTrimmedLogo, mediaUrl, type StrapiAirline } from '@/lib/strapi';

export type FeaturedGuide = {
  airline: Pick<StrapiAirline, 'name' | 'slug' | 'iataCode' | 'type' | 'logo'>;
  /** Policy fields with status `official` in content/airline-facts. */
  verifiedFields: number;
  /** Destination airports in the route dataset (0 = no route data). */
  destinations: number;
  homeCountry: string;
};

/**
 * The published, verified airline guides — a static grid rather than an
 * auto-advancing carousel, so every guide is visible, crawlable and reachable
 * without waiting for a slide.
 */
export default function FeaturedAirlineGuides({ guides }: { guides: FeaturedGuide[] }) {
  if (guides.length === 0) return null;

  return (
    <section
      className="mt-12"
      aria-labelledby="featured-guides-heading"
      data-testid="tier1-airline-carousel"
    >
      <div className="flex flex-col gap-2 border-b border-forest-900/10 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-success-emphasis">
            <CheckIcon className="h-3.5 w-3.5" />
            Verified policy guides
          </p>
          <h2 id="featured-guides-heading" className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
            Start with a verified airline guide
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-forest-900/70 sm:text-base">
            Baggage, seat and onboard policies where each published fact is sourced to the airline&rsquo;s
            own pages or a named regulator.
          </p>
        </div>
        <p className="flex-none text-sm text-forest-900/60">
          {guides.length} guide{guides.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Phones: a swipeable row so the guides do not push the directory ~2,000px down. */}
      <ul className="no-scrollbar -mx-4 mt-5 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mt-6 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 lg:gap-4">
        {guides.map((g) => (
          <li key={g.airline.slug} className="w-[78%] max-w-[300px] flex-none snap-start sm:w-auto sm:max-w-none">
            <GuideCard guide={g} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function GuideCard({ guide }: { guide: FeaturedGuide }) {
  const { airline } = guide;
  const logo = mediaUrl(airline.logo ?? null);
  return (
    <Link
      href={`/airlines/${airline.slug}`}
      className="group relative flex h-full flex-col rounded-[0.3rem] border border-forest-900/10 bg-white p-4 transition hover:border-primary-emphasis/50 hover:shadow-[0_6px_16px_-6px_rgba(15,39,102,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis sm:p-5"
      data-testid={`featured-guide-${airline.slug}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="relative h-14 w-32 flex-none overflow-hidden">
          {logo ? (
            // Logo files are 400x200 canvases with the artwork centred at half the width.
            // Drawing the canvas at twice the box width and clipping the empty sides shows
            // the artwork at the full box width instead of half of it. Trimmed logos have no padding, so they are fitted into the box as-is.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt=""
              className={isTrimmedLogo(logo) ? 'h-full w-full object-contain' : 'absolute left-1/2 top-1/2 h-32 w-64 max-w-none -translate-x-1/2 -translate-y-1/2'}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="text-lg font-bold text-forest-900/50">{(airline.iataCode || airline.name).slice(0, 3)}</span>
          )}
        </div>
        {airline.iataCode && <IataBadge code={airline.iataCode} />}
      </div>

      <h3 className="mt-4 text-lg font-bold leading-snug group-hover:text-primary-emphasis">
        {airline.name}
      </h3>
      <p className="mt-0.5 text-sm text-forest-900/60">
        {[guide.homeCountry, airline.type].filter(Boolean).join(' · ')}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-forest-900/10 pt-3 text-sm">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-forest-900/50">Verified facts</dt>
          <dd className="mt-0.5 font-bold text-forest-950">{guide.verifiedFields}</dd>
        </div>
        {guide.destinations > 0 && (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-forest-900/50">Destinations</dt>
            <dd className="mt-0.5 font-bold text-forest-950">{guide.destinations}</dd>
          </div>
        )}
      </dl>

      <span className="mt-auto pt-4 text-sm font-semibold text-primary-emphasis">
        Read the guide <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  );
}

export function IataBadge({ code }: { code: string }) {
  return (
    <span className="relative flex-none rounded-[0.3rem] bg-forest-950 px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-white">
      <span className="sr-only">IATA code </span>
      {code}
    </span>
  );
}

export function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m3.5 8.2 2.8 2.7 6.2-6" />
    </svg>
  );
}
