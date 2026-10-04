'use client';

import { DESTINATION_CITIES, ORIGIN_CITIES } from '@/lib/flights-data';
import { tpwlSearchUrl } from '@/lib/tpwl-link';
import { useVisitorOrigin } from '@/lib/visitor-origin';

export default function SearchByDestinationBlock() {
  const origin = useVisitorOrigin();

  // Don't repeat the visitor's own city as a destination row.
  const destinations = DESTINATION_CITIES.filter((d) => d.iata !== origin.iata);

  return (
    <section className="mt-32" data-testid="cheap-flights-by-destination">
      <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">
        Where can you find cheap flights by destination?
      </h2>
      <p className="mt-2 max-w-4xl text-[1rem] text-ink/75">
        Use these destination rows when you know where you want to go but still want a faster route into the search form. Each link starts from{' '}
        <span className="text-primary-emphasis font-semibold">
          {origin.name} {origin.iata}
        </span>{' '}
        first, then shows alternative major origins so you can compare city pairs, positioning flights and nearby airport options.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map((dest) => {
          // Prefer the visitor's origin first, then up to 3 alternates from
          // the hub list (excluding both the destination and the visitor's
          // own city to avoid duplicates).
          const otherOrigins = ORIGIN_CITIES.filter(
            (o) => o.iata !== dest.iata && o.iata !== origin.iata,
          ).slice(0, 3);
          const origins = [origin, ...otherOrigins];
          return (
            <details key={dest.iata} className="group border-b border-forest-900/10">
              <summary className="flex cursor-pointer list-none items-center justify-between py-4">
                <a
                  href={tpwlSearchUrl(origin.iata, dest.iata)}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="flex-1 text-sm font-semibold text-[#1411ec] hover:text-primary-emphasis"
                >
                  Cheap flights to {dest.name} from {origin.name}
                </a>
                <span
                  className="rounded-full p-1.5 text-forest-900/40 transition group-hover:bg-forest-900/5 group-hover:text-primary-emphasis"
                  aria-label={`Show popular routes to ${dest.name}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4 transition-transform group-open:rotate-180"
                    aria-hidden
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </summary>
              <ul className="space-y-1 pb-4">
                {origins.map((o) => (
                  <li key={o.iata}>
                    <a
                      href={tpwlSearchUrl(o.iata, dest.iata)}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="block py-1 text-sm text-[#1411ec] hover:text-primary-emphasis"
                    >
                      From {o.name} → {dest.name}{' '}
                      <span className="font-mono text-xs text-forest-900/40">
                        {o.iata}–{dest.iata}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}
