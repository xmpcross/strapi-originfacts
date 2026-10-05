import Link from 'next/link';
import {
  airlinesHref,
  airportsHref,
  countryHref,
  flagEmoji,
  type DirectoryCountry,
} from '@/lib/country-directory';

/**
 * Featured countries above the /countries directory: the two per region with
 * the most airports listed (featuredCountries in lib/country-directory.ts).
 * Text and counts only — the CMS country and destination hero images are not
 * used on this page.
 */
export default function FeaturedCountryGrid({ countries }: { countries: DirectoryCountry[] }) {
  if (countries.length === 0) return null;
  return (
    <section className="mt-12" aria-labelledby="featured-countries-heading" data-testid="featured-countries">
      <div className="border-b border-forest-900/10 pb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-forest-900/55">Featured</p>
        <h2 id="featured-countries-heading" className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
          Most airports by region
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-forest-900/70 sm:text-base">
          Two per region: the countries with the most airports in our airport directory. Every country is listed
          below.
        </p>
      </div>

      {/* Phones: a swipeable row (as on /airports) so twelve cards do not push the directory far down. */}
      <ul className="no-scrollbar -mx-4 mt-5 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mt-6 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4">
        {countries.map((c) => (
          <li key={c.code} className="w-[78%] max-w-[300px] flex-none snap-start sm:w-auto sm:max-w-none">
            <FeaturedCard country={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeaturedCard({ country: c }: { country: DirectoryCountry }) {
  const stats: { label: string; value: number; href: string | undefined }[] = [
    { label: 'Airports', value: c.airports, href: airportsHref(c) },
    { label: 'Airlines', value: c.airlines, href: c.airlines > 0 ? (airlinesHref(c) ?? undefined) : undefined },
    { label: 'Route records', value: c.routes, href: undefined },
    { label: 'Articles', value: c.articles, href: undefined },
  ];
  return (
    <div
      className="relative flex h-full flex-col rounded-[0.3rem] border border-forest-900/10 bg-white p-4 transition hover:border-primary-emphasis/50 hover:shadow-[0_6px_16px_-6px_rgba(15,39,102,0.25)] sm:p-5"
      data-testid={`featured-country-${c.code}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-4xl leading-none" aria-hidden>
          {flagEmoji(c.code)}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-forest-900/50">{c.region}</span>
      </div>
      <h3 className="mt-4 flex min-w-0 items-center gap-2 text-lg font-bold leading-snug">
        <Link
          href={countryHref(c)}
          className="min-w-0 truncate after:absolute after:inset-0 after:rounded-[0.3rem] hover:text-primary-emphasis focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary-emphasis"
        >
          {c.name}
        </Link>
        <span className="flex-none rounded-[0.3rem] bg-forest-950 px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-white">
          {c.code}
        </span>
      </h3>

      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-forest-900/10 pt-3 text-sm">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-forest-900/50">{s.label}</dt>
            <dd className="mt-0.5 font-bold text-forest-950">
              {s.href ? (
                <a
                  href={s.href}
                  className="relative z-10 underline decoration-forest-900/25 underline-offset-2 hover:text-primary-emphasis hover:decoration-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
                >
                  {s.value.toLocaleString()}
                </a>
              ) : (
                s.value.toLocaleString()
              )}
            </dd>
          </div>
        ))}
      </dl>

      <span className="mt-auto pt-4 text-sm font-semibold text-primary-emphasis">
        {c.guide ? 'Read the guide' : 'Open the country page'}{' '}
        <span aria-hidden>→</span>
      </span>
    </div>
  );
}
