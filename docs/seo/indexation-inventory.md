# Indexation inventory — robots directives by template

Snapshot: 2026-07-30, branch `seo/airport-indexation` (after removing the airport
noindex gate). Source of truth for each row is the template's `metadata` /
`generateMetadata` export; there is **no middleware and no next.config header**
that sets robots anywhere. URL counts are from the live Strapi database on the
same date and will drift as content is added.

"Default" in the robots column means the template emits **no robots meta at
all** — Next.js/Google treat that as index,follow, which is the correct default
for indexable pages.

| Route pattern | ~URLs | Robots value | Canonical | Intentional |
|---|---|---|---|---|
| `/` (home) | 1 | default | n | y |
| `/about` | 1 | default | y | y |
| `/contact` | 1 | default | y | y |
| `/articles` | 1 | default | y | y |
| `/articles/[slug]` | 58 | default | y | y |
| `/category/[slug]` | 5 | default | y | y |
| `/airlines` | 1 | default | y | y |
| `/airlines/[slug]` | 1,097 | `index,follow` when substantive (about text, ≥8 editor FAQs, or tracked routes), else `noindex,follow` (~669 index / ~428 noindex) | y | y — quality gate |
| `/airports` | 1 | default *(was `noindex,follow` — removed in this PR)* | y | was AdSense gate, now lifted |
| `/airports/hubs` | 1 | default *(was `noindex,follow` — removed in this PR)* | n | was AdSense gate, now lifted |
| `/airports/[iata]` | ~3,604 | `index,follow` when substantive (about text or tracked routes), else `noindex,follow` — same gate as airlines *(was unconditionally noindex via `AIRPORTS_INDEXABLE=false` — flag flipped in this PR)* | y | was AdSense gate, now lifted |
| `/countries` | 1 | default | y | y |
| `/countries/[code]` | ~235 codes | default — but codes with a CMS destination `permanentRedirect` (308) to `/destinations/[slug]`; only residual codes render | y (self) | y |
| `/destinations` | 1 | default | y | y |
| `/destinations/[slug]` | 253 | default | y | y |
| `/flight-routes` | 1 | default | y | y |
| `/flight-routes/[slug]` | 501 | default | **n** | unknown — see flags |
| `/flight-search` | 1 | default | y | y |
| `/hotels` | 1 | default | n | y |
| `/hotels/[slug]` | 0 (pure redirect to `/destinations/[slug]`) | n/a | n/a | y |
| `/flights-from-perth` (+7 subpages) | 8 | default | y (self) | y |
| `/flights-from-perth-tp` (+7 subpages) | 8 | default | y (self) | unknown — see flags |
| `/hot-posts` | 1 | default | y | y |
| `/search` | 1 | `noindex,follow` | n | y — internal search results should not index |
| `/sitemap` (HTML page) | 1 | default | n | y |
| `/legal/[slug]` | 7 | default | n | y |
| 404 / unknown record (airport & airline not-found branches) | n/a | `noindex,nofollow` | n/a | y |

## Flags — possibly unintentional exclusions or risks

1. **[fixed in this PR]** The whole airport section (`/airports`, `/airports/hubs`,
   `/airports/[iata]`) was noindexed by the `AIRPORTS_INDEXABLE = false` flag added
   2026-07-30 for the AdSense review (commit `b56d9d8`). This PR lifts it; airport
   pages now use the identical substantive-content gate as airlines.
2. **Airport URLs are still absent from `sitemap.xml`** (`app/sitemap.ts` returns an
   empty `airportPaths` array, same AdSense rationale). Indexable-but-unlisted is
   coherent, but if the gate is being lifted deliberately, restoring substantive
   airports to the sitemap is the natural companion change. **Not changed here** —
   sitemap/robots.txt are scoped to a separate task.
3. **`/flight-routes/[slug]` has no canonical tag** — the only indexable detail
   template without one. Low risk (no known duplicate URLs for routes), but
   inconsistent with every other detail template.
4. **`/flights-from-perth` vs `/flights-from-perth-tp`** are twin template trees
   (8 pages each) with self-referencing canonicals. If the `-tp` (TravelPayouts
   white-label) tree renders substantially the same content, the two compete in
   search; consider canonicalising one tree to the other or noindexing the
   variant. Intent unknown — flagged for a decision, no change made.
5. **~428 thin airline pages** are noindexed by the substantive-content gate. This
   is working as designed (they flip to index automatically once enriched with
   about/FAQ content), listed here so the number isn't mistaken for a bug.
