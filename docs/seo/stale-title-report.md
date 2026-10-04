# Stale-year report — editorial titles vs publish/content year

Audit date: 2026-07-30. Checked all **57** published articles in Strapi.
Rule: flag any year appearing in the H1 `title` or `seoTitle` that differs
from the article's publish year; the body's year mentions are shown as
supporting evidence. **No titles have been edited** — each row is a proposal
awaiting approval. Apply in Strapi (article → title / seoTitle fields).

**6 articles flagged** (all published 2026-07-10):

## 1. `airport-vs-city-car-rentals-cheaper`

| Field | Current | Proposed |
|---|---|---|
| seoTitle | Airport vs City Car Rentals: Which Is Cheaper in 2024? | …Cheaper in **2026**? |

H1 carries no year. Body mentions no year.

## 2. `where-to-stay-in-bali-best-hotels-every-budget`

| Field | Current | Proposed |
|---|---|---|
| title (H1) | Where to Stay in Bali: Best Hotels for Every Budget in 2025 | …Budget in **2026** |
| seoTitle | Where to Stay in Bali: Best Hotels for Every Budget 2025 | …Budget **2026** |

Body mentions 2025 once — if the H1 is updated, that body reference should be
reviewed at the same time.

## 3. `budget-friendly-perth-trip-planning-guide`

| Field | Current | Proposed |
|---|---|---|
| seoTitle | Budget-Friendly Perth Trip: Real Costs & Hotel Picks (2024) | …Picks (**2026**) |

H1 carries no year. Body has one historical 2022 mention (fine to keep).

## 4. `best-apps-websites-cheap-hotels`

| Field | Current | Proposed |
|---|---|---|
| title (H1) | Best Apps and Websites for Cheap Hotels in 2025 (Tested) | …in **2026** (Tested) |
| seoTitle | Best Apps & Websites for Cheap Hotels in 2025 (Tested) | …in **2026** (Tested) |

Body mentions 2025 once — review alongside the title change.

## 5. `best-airport-hotels-near-perth-airport` *(the known case)*

| Field | Current | Proposed |
|---|---|---|
| seoTitle | Best Airport Hotels Near Perth Airport (PER) 2024 | …(PER) **2026** |

H1 ("Best Airport Hotels Near Perth Airport: Your Complete Guide") and body
carry no conflicting year.

## 6. `best-hotels-bangkok-thailand-every-budget`

| Field | Current | Proposed |
|---|---|---|
| title (H1) | Best Hotels in Bangkok Thailand for Every Budget in 2025 | …Budget in **2026** |
| seoTitle | Best Hotels in Bangkok for Every Budget (2025 Guide) | …(**2026** Guide) |

Body has one historical 2022 mention (price reference — verify it isn't a
stale rate while editing).

## Notes

- Changing an H1 `title` does **not** change the slug (slugs are stored
  separately), so no redirects are needed for any of these.
- The audit heuristic treats any `20xx` in a title that differs from the
  publish year as stale. Articles whose titles carry the publish year (2026)
  but reference older years in the body (e.g. "founded in 2020") are NOT
  flagged — historical mentions are legitimate.
- Re-run the audit any time with the same rule; it is deterministic against
  current Strapi content.
