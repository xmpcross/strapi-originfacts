import { memo } from 'react';
import { formatDuration, formatKm, type DirectoryCarrier, type DirectoryRoute } from '@/lib/route-directory';
import styles from './RouteDirectory.module.css';

/** Airlines named on a card before the rest collapse to "+N more". */
const CARRIERS_SHOWN = 2;

/**
 * One route in the /flight-routes directory. Text only: codes, cities,
 * countries, distance and estimated time from the route record, and the
 * airlines on it. The title links to the route page and covers the card; the
 * airport codes and airline names link to their own pages.
 */
const RouteCard = memo(function RouteCard({
  route: r,
  carriers,
}: {
  route: DirectoryRoute;
  carriers: DirectoryCarrier[];
}) {
  const o = r.origin;
  const d = r.destination;
  const named = r.carriers.slice(0, CARRIERS_SHOWN).map((i) => carriers[i]).filter(Boolean);
  const more = r.carriers.length - named.length;
  const countries = o.country && d.country ? (o.country === d.country ? `${o.country} · domestic` : `${o.country} → ${d.country}`) : o.country || d.country;

  return (
    <article className={styles.card} data-testid={`route-card-${r.slug}`}>
      <div className={styles.codes}>
        <a href={`/airports/${o.slug}`} className={styles.code}>
          {o.iata}
        </a>
        <span aria-hidden>→</span>
        <a href={`/airports/${d.slug}`} className={styles.code}>
          {d.iata}
        </a>
        {r.distanceKm ? <span className={styles.km}>{formatKm(r.distanceKm)}</span> : null}
      </div>
      <h3 className={styles.title}>
        <a href={`/flight-routes/${r.slug}`}>
          {o.city} <span aria-hidden>→</span>
          <span className="sr-only"> to </span> {d.city}
        </a>
      </h3>
      {countries && <p className={styles.sub}>{countries}</p>}
      <p className={styles.meta}>
        {r.durationMinutes ? (
          <span>≈ {formatDuration(r.durationMinutes)} est.</span>
        ) : null}
        {r.durationMinutes ? ' · ' : null}
        {named.map((c, i) => (
          <span key={c.slug}>
            {i > 0 && ', '}
            <a href={`/airlines/${c.slug}`} className={styles.carrier}>
              {c.name}
            </a>
          </span>
        ))}
        {more > 0 && ` +${more} more`}
        {named.length === 0 && 'No airlines in our record yet'}
      </p>
    </article>
  );
});

export default RouteCard;
