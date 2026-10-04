import {
  facetCounts,
  facetTone,
  getAirlineReviews,
  pickRepresentative,
  ratingBands,
  SOURCE_META,
  SUBRATING_LABELS,
  sourceLabel,
  type AirlineReview,
  type AirlineReviewStats,
} from '@/lib/airline-reviews';

/**
 * Traveller reviews from the unified review store, which may hold reviews from
 * several sources at once (Skytrax archive, TripAdvisor…). Everything shown —
 * the histogram, the chips, the attribution — is counted from the stored
 * reviews, so the section never asserts more than the data supports.
 *
 * Layout follows a retail review block: rating summary with a star histogram on
 * the left, what travellers actually flew on the right, cards below, then a
 * link out to the full listing.
 */

const STAR_PATH = 'M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z';

// Facet chips carry a verdict, so they never rely on colour alone — each tone
// ships its own glyph and the tooltip spells the score out.
const TONE_STYLES: Record<'positive' | 'negative' | 'neutral', { chip: string; glyph: string }> = {
  positive: { chip: 'border-success-emphasis/25 bg-success-emphasis/[0.08] text-success-emphasis', glyph: '✓' },
  negative: { chip: 'border-forest-900/15 bg-forest-900/[0.05] text-forest-900/70', glyph: '−' },
  neutral: { chip: 'border-forest-900/10 bg-forest-900/[0.03] text-forest-900/65', glyph: '' },
};

function Stars({ value, size = 14, id }: { value: number; size?: number; id: string }) {
  // `value` is 0–5 and may be fractional, so each star is filled by percentage
  // rather than rounded — 4.4 reads as four full stars plus a partial.
  return (
    <span className="inline-flex items-center gap-[2px]" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        const gradientId = `star-${id}-${i}`;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20" className="flex-none">
            <defs>
              <linearGradient id={gradientId}>
                <stop offset={`${fill * 100}%`} stopColor="#ffce00" />
                <stop offset={`${fill * 100}%`} stopColor="#e3e6ea" />
              </linearGradient>
            </defs>
            <path d={STAR_PATH} fill={`url(#${gradientId})`} />
          </svg>
        );
      })}
    </span>
  );
}

export default function AirlineReviews({ slug, name }: { slug: string; name: string }) {
  const data = getAirlineReviews(slug);
  if (!data || data.stats.reviewCount === 0) return null;

  const { stats } = data;
  const sources = data.sources ?? [];
  const bySource = data.statsBySource ?? {};
  const multiSource = sources.length > 1;

  const shown = pickRepresentative(data.reviews, 6);
  const bands = ratingBands(data.reviews);
  const maxBand = Math.max(...bands.map((b) => b.count), 1);
  const cabins = facetCounts(data.reviews, 'cabin', 5);
  const routes = facetCounts(data.reviews, 'route', 4);

  const years = `${stats.firstReviewDate.slice(0, 4)}–${stats.lastReviewDate.slice(0, 4)}`;
  const stars5 = stats.avgRating10 !== null ? stats.avgRating10 / 2 : null;
  const subs = stats.subratings
    ? Object.entries(stats.subratings).map(([k, v]) => ({ label: SUBRATING_LABELS[k] ?? k, avg: v }))
    : [];

  const linkFor = (source: string) =>
    (bySource[source] as AirlineReviewStats | undefined)?.sourceUrl ?? SOURCE_META[source]?.home ?? null;
  const primarySource = sources[0] ?? null;
  const primaryLink = primarySource ? linkFor(primarySource) : null;

  return (
    <section className="mx-auto max-w-6xl px-6 pb-20" data-testid="airline-reviews">
      <div className="rounded-[0.3rem] border border-forest-900/10 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="editorial-h text-2xl font-bold text-forest-900 lg:text-[1.7rem]">
            Reviews of {name}
          </h2>
          <span className="text-xs uppercase tracking-[0.2em] text-forest-900/45">
            {sources.map(sourceLabel).join(' + ')} · {years}
          </span>
        </div>

        {/* Summary: score + histogram on the left, what was flown on the right */}
        <div className="mt-6 grid gap-8 border-b border-forest-900/10 pb-7 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
          <div>
            <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
              {/* Headline score: one star beside the number, the way a rating
                  summary is normally read — not five stars competing with the
                  histogram directly next to it. */}
              <div className="min-w-[132px]">
                <div className="flex items-center gap-2">
                  <svg width="30" height="30" viewBox="0 0 20 20" aria-hidden="true" className="flex-none">
                    <path d={STAR_PATH} fill="#ffce00" />
                  </svg>
                  {stats.avgRating10 !== null && (
                    <span className="font-urbanist text-[2.7rem] font-bold leading-none text-forest-900">
                      {stats.avgRating10.toFixed(1)}
                      <span className="text-lg font-semibold text-forest-900/40">/10</span>
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs text-forest-900/55">
                  {stats.reviewCount.toLocaleString()} review{stats.reviewCount === 1 ? '' : 's'}
                </div>
              </div>

              <ul className="min-w-[210px] flex-1 space-y-[3px]">
                {bands.map((band) => (
                  <li key={band.star} className="flex items-center gap-2.5 text-xs text-forest-900/60">
                    <span className="flex flex-none items-center gap-1 tabular-nums">
                      {band.star}
                      <svg width="11" height="11" viewBox="0 0 20 20" aria-hidden="true">
                        <path d={STAR_PATH} fill="#ffce00" />
                      </svg>
                    </span>
                    <span className="h-[9px] flex-1 overflow-hidden rounded-[4px] bg-forest-900/[0.08]">
                      <span
                        className="block h-full rounded-[4px] bg-primary-emphasis"
                        style={{ width: `${(band.count / maxBand) * 100}%` }}
                      />
                    </span>
                    <span className="w-7 flex-none text-right tabular-nums text-forest-900/70">
                      {band.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Only sources that record a recommend signal produce this line. */}
            {stats.recommendPct !== null && (
              <p className="mt-5 flex items-center gap-2 text-xs text-forest-900/70">
                <span className="font-bold text-success-emphasis">✓</span>
                <span>
                  <span className="font-bold text-forest-900">{stats.recommendPct}%</span> would
                  recommend to a friend
                </span>
              </p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-forest-900">What travellers flew</h3>
            <p className="mt-1 text-xs leading-5 text-forest-900/55">
              Counted from the {stats.reviewCount.toLocaleString()} review
              {stats.reviewCount === 1 ? '' : 's'} below — a tally of the flights reviewed, with each
              chip carrying the average score those reviewers gave. Nothing here reads their prose
              or summarises what they said.
            </p>

            {(cabins.length > 0 || routes.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {[...cabins, ...routes].map((facet) => {
                  const tone = facetTone(facet);
                  const style = TONE_STYLES[tone];
                  return (
                    <span
                      key={`${facet.label}-${facet.count}`}
                      title={
                        facet.avg !== null
                          ? `${facet.count} review${facet.count === 1 ? '' : 's'}, averaging ${facet.avg.toFixed(1)}/10`
                          : `${facet.count} review${facet.count === 1 ? '' : 's'}`
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${style.chip}`}
                    >
                      {style.glyph && <span aria-hidden="true">{style.glyph}</span>}
                      {facet.label} ({facet.count})
                    </span>
                  );
                })}
              </div>
            )}

            <p className="mt-2.5 text-[11px] leading-5 text-forest-900/40">
              ✓ marks a group averaging 7/10 or better, − one averaging 4/10 or worse, across at
              least three reviews.
            </p>

            {subs.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-bold text-forest-900">Category averages</h3>
                <ul className="mt-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                  {subs.map((sub) => (
                    <li key={sub.label} className="flex items-center gap-3 text-xs text-forest-900/65">
                      <span className="w-32 flex-none">{sub.label}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-forest-900/[0.08]">
                        <span
                          className="block h-full rounded-full bg-forest-500"
                          style={{ width: `${(sub.avg / 5) * 100}%` }}
                        />
                      </span>
                      <span className="w-7 text-right font-mono font-bold text-forest-900">
                        {sub.avg.toFixed(1)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {multiSource && (
              <dl className="mt-6 flex flex-wrap gap-x-7 gap-y-2">
                {sources.map((source) => {
                  const sourceStats = bySource[source];
                  if (!sourceStats) return null;
                  return (
                    <div key={source} className="text-xs">
                      <dt className="text-forest-900/50">{sourceLabel(source)}</dt>
                      <dd className="font-bold text-forest-900">
                        {sourceStats.avgRating10 !== null
                          ? `${sourceStats.avgRating10.toFixed(1)}/10`
                          : '—'}
                        <span className="font-normal text-forest-900/45">
                          {' '}
                          · {sourceStats.reviewCount}
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </div>
        </div>

        {/* Review cards */}
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((review) => (
            <ReviewCard key={review.id} review={review} multiSource={multiSource} />
          ))}
        </div>

        {primaryLink && primarySource && (
          <div className="mt-7">
            <a
              href={primaryLink}
              rel="nofollow noopener noreferrer"
              target="_blank"
              className="inline-flex items-center justify-center rounded-[0.3rem] bg-primary-emphasis px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-emphasisHover"
            >
              Read all reviews on {sourceLabel(primarySource)}
            </a>
          </div>
        )}

        <p className="mt-5 text-xs leading-5 text-forest-900/45">
          Traveller reviews originally published on{' '}
          {sources.map((source, i) => {
            const href = linkFor(source);
            return (
              <span key={source}>
                {i > 0 && (i === sources.length - 1 ? ' and ' : ', ')}
                {href ? (
                  <a href={href} rel="nofollow noopener noreferrer" target="_blank" className="underline">
                    {sourceLabel(source)}
                  </a>
                ) : (
                  sourceLabel(source)
                )}
              </span>
            );
          })}
          , shown for reference — service standards may have changed since. Originfacts does not edit
          or verify individual reviews, and the sample reflects who chose to leave one.
        </p>
      </div>
    </section>
  );
}

function ReviewCard({ review, multiSource }: { review: AirlineReview; multiSource: boolean }) {
  // The store keeps the date the review was published, not the date of travel,
  // so it is reported as "Posted …" below rather than badged as a flight month.
  const tags = [review.cabin, review.route].filter(Boolean) as string[];

  const LIMIT = 260;
  const long = review.text.length > LIMIT;
  // Break on a word so the visible half never ends mid-word.
  const cut = long ? review.text.lastIndexOf(' ', LIMIT) : review.text.length;
  const head = long ? review.text.slice(0, cut > 0 ? cut : LIMIT).trimEnd() : review.text;
  const rest = long ? review.text.slice(cut > 0 ? cut : LIMIT).trim() : '';

  const place = review.authorCountry ?? review.authorLocation ?? null;
  const posted = formatPosted(review.date);

  return (
    <article className="flex flex-col rounded-[0.3rem] border border-forest-900/10 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        {review.rating10 !== null && <Stars value={review.rating10 / 2} id={review.id} />}
        {/* Absent is not the same as "not recommended" — only sources that
            record the signal render this. */}
        {review.recommended !== null && review.recommended !== undefined && (
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              review.recommended ? 'text-success-emphasis' : 'text-forest-900/35'
            }`}
          >
            {review.recommended ? 'Recommended' : 'Not recommended'}
          </span>
        )}
      </div>

      {review.title && (
        <h3 className="mt-2.5 font-urbanist text-[0.95rem] font-bold leading-snug text-forest-900">
          {review.title.replace(/ customer review$/i, '')}
        </h3>
      )}

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-[0.2rem] border border-forest-900/10 px-1.5 py-0.5 text-[10px] font-medium text-forest-900/55"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* <details> keeps the full text in the markup — and therefore indexable —
          while showing the same truncated card as the reference, with no client
          JavaScript. */}
      {long ? (
        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-sm font-light leading-6 text-forest-900/75 [&::-webkit-details-marker]:hidden">
            <span>{head}</span>
            <span className="group-open:hidden">
              …{' '}
              <span className="font-normal text-primary-emphasis hover:underline">See more</span>
            </span>
            <span className="hidden group-open:inline"> {rest}</span>
          </summary>
          <span className="mt-1 inline-block text-sm text-primary-emphasis hover:underline">
            See less
          </span>
        </details>
      ) : (
        <p className="mt-3 text-sm font-light leading-6 text-forest-900/75">{head}</p>
      )}

      <p className="mt-auto pt-4 text-xs text-forest-900/45">
        {posted ? `Posted ${posted} by ` : ''}
        {review.author ?? 'a traveller'}
        {place ? `, ${place}` : ''}
        {multiSource && <span className="text-forest-900/30"> · {sourceLabel(review.source)}</span>}
      </p>
    </article>
  );
}

/** "2024-02-11" → "February 2024". Month precision only: the day adds nothing
 *  to a review card, and a relative age would go stale in a cached render. */
function formatPosted(date: string): string | null {
  if (!/^\d{4}-\d{2}/.test(date)) return null;
  const [year, month] = date.split('-');
  const name = new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleString('en-GB', {
    month: 'long',
    timeZone: 'UTC',
  });
  return `${name} ${year}`;
}
