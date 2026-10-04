# JSON-LD schema — inventory & validation

Compiled 2026-07-30, branch `seo/schema-coverage`.

## Pre-change inventory (what was already emitted)

The schema layer was substantially built before this task:

| Template | Emitted before this change |
|---|---|
| `/` (home) | Organization (with the four sameAs profiles), WebSite |
| `/about`, `/contact` | Organization (+ ContactPoint on contact), AboutPage / ContactPage |
| Article detail | Article (headline, description, image, datePublished, dateModified, author, publisher, section, keywords) — or HowTo *instead* for step articles; BreadcrumbList; FAQPage for editor Q&As |
| Airline detail | Airline, FAQPage, BreadcrumbList |
| Airport detail | Airport (codes, address, geo), FAQPage — **no BreadcrumbList despite a visible trail** |
| Country detail | Country, FAQPage — **no BreadcrumbList despite a visible trail** |
| Destination detail | FAQPage only — **no entity schema at all** on what are the canonical country pages |
| All index/hub pages | BreadcrumbList + CollectionPage |
| Flight-search | BreadcrumbList + FAQPage |
| Route detail | none (not in this task's five types; noted for later) |

Defect found during inventory: all 57 articles carry the house byline
"FXN Studio Editorial", and the Article builder marked any named byline as
`Person` — i.e. every article asserted a person named "FXN Studio Editorial".

## Changes made

1. **Article author**: bylines matching house patterns (editorial/studio/team/
   staff/desk/newsroom) are now `Organization`; only real names become
   `Person`. No named-Person markup ships while the byline is generic (P9).
2. **BreadcrumbList** added to airport and country detail pages — mirrors of
   the visible trails. Destination pages render **no** breadcrumb trail, so
   deliberately get no BreadcrumbList (markup must match visible furniture).
3. **Place-typed schema on destinations** (`destinationJsonLd`): Country /
   City (+ containedInPlace) / Continent / Place by record type.
4. **Airport schema enriched** with `telephone` and official-site `sameAs` —
   only when the page renders those values (airport-info panel).
5. Not added, per brief: Review/AggregateRating (no first-party reviews), and
   nothing sourced outside the page's own data.

## Validation results — Schema.org validator (validator.schema.org API), 2026-07-30

Every JSON-LD block from a local production build was posted to the
validator; numbers are the validator's own error/warning counts.

| Page | Blocks | Result |
|---|---|---|
| `/` | Organization, WebSite | 0 errors, 0 warnings each |
| `/airlines/qantas` | Airline, FAQPage, BreadcrumbList | 0 / 0 each |
| `/airports/syd` | Airport, BreadcrumbList, FAQPage | 0 / 0 each |
| `/destinations/japan` | Country | 0 / 0 |
| `/countries/kx` | Country, FAQPage, BreadcrumbList | 0 / 0 each |
| `/articles/seaside-uk-hotels-coastal-views-2026` | Article, BreadcrumbList | 0 / 0 each |
| `/flight-search` | BreadcrumbList, FAQPage | 0 / 0 each |
| `/airlines` (index) | BreadcrumbList, CollectionPage | 0 / 0 each |

**Google Rich Results Test**: has no public API, so it cannot be scripted
from this environment — run the pages above through
https://search.google.com/test/rich-results after deploy (the Schema.org
validator covers syntax/vocabulary; Rich Results additionally checks
Google-feature eligibility). Results here are only claimed for the
Schema.org validator.

## Continuous check

- `ops/check-jsonld.mjs <baseUrl>` — fails (exit 1) when any page's JSON-LD
  doesn't parse, required fields for its @type are empty, a FAQPage question
  isn't visible in the page HTML, or a breadcrumb item is incomplete. Run
  against a local `next start` after building. Current run: 16 blocks across
  7 pages, 0 failures.
- `tests/jsonld.test.ts` — unit tests on every builder: required fields,
  four sameAs profiles, FAQPage ⇄ visible list identity, empty-field
  omission, JSON round-trip. Suite: 25/25.
