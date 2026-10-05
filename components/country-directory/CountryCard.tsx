import {
  airlinesHref,
  airportsHref,
  countryHref,
  flagEmoji,
  plural,
  type DirectoryCountry,
} from '@/lib/country-directory';
import styles from './CountryDirectory.module.css';

/**
 * One country in "Browse all countries". The name links to the country's
 * guide and stretches over the card; the airport and airline counts link to
 * those directories filtered to the country. Counts only — no photos, no prose.
 */
export default function CountryCard({ country: c }: { country: DirectoryCountry }) {
  const guides = c.cityGuides;
  return (
    <div className={styles.card} data-testid={`country-card-${c.code}`}>
      <span className={styles.flag} aria-hidden>
        {flagEmoji(c.code)}
      </span>
      <a href={countryHref(c)} className={styles.name}>
        {c.name}
      </a>
      <span className={styles.code} title="ISO country code">
        {c.code}
      </span>
      <span className={styles.region}>{c.region ?? 'Region not set'}</span>
      <span className={styles.meta}>
        {c.airports > 0 ? (
          <a href={airportsHref(c)}>{plural(c.airports, 'airport')}</a>
        ) : (
          <span className={styles.none}>No airports listed</span>
        )}
        {c.airlines > 0 &&
          (airlinesHref(c) ? (
            <a href={airlinesHref(c)!}>{plural(c.airlines, 'airline')}</a>
          ) : (
            <span>{plural(c.airlines, 'airline')}</span>
          ))}
        {c.routes > 0 && <span>{plural(c.routes, 'route record')}</span>}
        {guides > 0 && <span>{plural(guides, 'city guide')}</span>}
        {c.articles > 0 && <span>{plural(c.articles, 'article')}</span>}
      </span>
    </div>
  );
}
