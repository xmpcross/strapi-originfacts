# Count inventory — every place a number is rendered

Compiled 2026-07-30 as part of the consistent-counts task. "Source now" is the
state after this change; contradictions listed at the bottom are what shipped
before it. Canonical definitions live in `lib/counts.ts` (`getSiteCounts()`,
cached 1h) — the single query every display routes through.

**Canonical definitions:**
- **Airports** = records with an IATA code → **3,602** today (previously
  /countries showed 3,599 because it summed only codes present in the
  countries collection; /sitemap showed 3,602).
- **Regions** = distinct *valid* regions in the countries dataset → **6**.
  (The airline stat block said 7 because 9 airline records carry a legacy
  "Asia-Pacific" region value — a data error catalogued in
  docs/data/integrity-report.md; the counts module never counts invalid
  values. Do not fix by editing data here — P6 owns corrections.)
- **Countries** = countries collection rows (incl. territories) → 234; per
  region: Africa 58, Asia 49, Europe 48, N. America 40, Oceania 25,
  S. America 14. Region prose now says "countries and territories" and
  interpolates these values.

| # | Location | Displayed count | Source now |
|---|---|---|---|
| 1 | /countries stat card "Countries" | rows rendered | `countries.length` (dataset rows, self-describing) |
| 2 | /countries stat card "Airports" | 3,602 | `getSiteCounts().airports` via `stats` prop |
| 3 | /countries stat card "Regions" + blurb | 6 / "Six continental groupings…" | `getSiteCounts().regions`; blurb interpolates the same value |
| 4 | /countries region headers ("Africa — 58 countries") | per-region rows | rendered rows (equals `countriesByRegion` when unfiltered) |
| 5 | /countries region intro prose | interpolated | `REGION_INTROS[r](count)` — functions of the unfiltered per-region total |
| 6 | /airlines stat cards "Airlines" / "Countries" | rows rendered / distinct countries in index | self-describing derivations from the displayed list |
| 7 | /airlines stat card "Regions" + blurb | 6 | `getSiteCounts().regions` via `stats` prop; blurb interpolated |
| 8 | /airports/hubs stat strip (Hubs / Continents / Countries) | describes the hub list itself | rendered list (self-describing — intentionally not dataset totals) |
| 9 | /sitemap section counts "(N)" | length of each list on the page | self-describing (airports list = IATA-holders = canonical 3,602) |
| 10 | /destinations index "N destinations and counting" | rows rendered | dataset rows |
| 11 | Airport page intro "Originfacts tracks N destinations reachable from X" | dataset route total | `countRoutesFromAirport()` via `summary.routeTotal` (was: 15-capped sample) |
| 12 | Airport FAQ "Where can you fly from X?" | dataset route total + sample list | `routeTotal` for the count; `listProse` sample labelled "including" |
| 13 | Airport FAQ "Are there other airports in {country}?" | dataset country count − 1 | `getSiteCounts().airportsByCountryCode` (was: rendered 9-card sample — the featured-snippet bug) |
| 14 | Airline page intro/about network sentence | dataset route total | `countRoutesByCarrier()` via `summary.routeTotal` (was: 15-capped sample) |
| 15 | Airline generated FAQ "How many destinations…" | dataset route total | same; sample-derived "across M countries" dropped when sample incomplete |
| 16 | Route page "Carriers tracked" stat | carriers on the route record | the record itself (self-describing) |
| 17 | FAQ section header "N common questions" | rendered FAQ count | self-describing |
| 18 | Editor-managed airline FAQs (Strapi `faqs` json) | written by enrichment from TravelPayouts route facts | not templated here — covered by the P6 integrity harness |

## Contradictions this change resolves

1. **/airlines "Regions 7" vs "Six continental groupings" prose vs 6 filters** —
   stat now reads the canonical 6; blurb interpolates the same value.
2. **/countries "Airports 3,599" vs /sitemap "(3,602)"** — one definition
   (IATA-holders) everywhere.
3. **Region headers vs intro prose (58 vs "Fifty-four", 14 vs "Twelve",
   49 vs "48")** — prose interpolates the same per-region totals the headers
   use, phrased "countries and territories" to reflect what the dataset counts.
4. **Airport FAQ "9 other airports in Australia" vs the country page's 130** —
   answers now state the dataset count (129 others) and describe the on-page
   strip as "a selection".
5. **"Originfacts tracks 15 destinations" on hub airports** (the silent cap) —
   count claims use dataset totals; sample-derived tallies are dropped when
   the sample is incomplete.

## Guard rails

- `tests/counts.test.ts` asserts FAQ answers use dataset counts, capped
  samples never masquerade as totals, and stat values agree with the spelled
  prose derived from the same number.
- Adding a new displayed count? Read it from `lib/counts.ts` or
  `countRecords()` with an explicit filter; never from a capped list length
  or the rendered sample.
