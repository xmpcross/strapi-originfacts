# Aviation-data error root causes — 2026-07-30 investigation

Traced before any fix, per the data-integrity task. Three reported error
classes; investigation found they reduce to **two code bugs and one upstream
data problem**, all compounding through the same weak join key: the IATA code.

## Error class 1 — wrong airline record fields (Qantas ICAO "EAQ", legal name "Eastern Australia Airlines"; Air Albania as Air Bourbon/France)

**Root cause: our transformation bug** in `backend/ai-writer-cli/enrich-airlines.js`
(and its `enrich-airlines-openclaw.js` sibling), `lookupWikidata()`.

- The TravelPayouts airlines dump provides only `{ code (IATA), name }` — no
  ICAO, no country, no legal name. Those fields are back-filled by the enrich
  scripts from Wikidata, queried **by IATA code alone** with `LIMIT 1` and no
  ordering, and **no check that the returned entity is the same airline**.
- IATA codes are shared (subsidiaries flying under a parent designator) and
  recycled (reassigned after an airline dies). Wikidata returns every entity
  carrying the code; `LIMIT 1` picks arbitrarily:
  - `QF` → matched **Eastern Australia Airlines** (QantasLink subsidiary,
    ICAO EAQ) instead of Qantas → wrong ICAO + legal name on `airline:qantas`.
  - `ZB` → matched **Air Bourbon** (defunct, Réunion/France) instead of
    Air Albania → wrong legal name, country, ICAO (BUB).
  - `TA` → **Tasair** (Tasmania) instead of Avianca El Salvador → country
    "Australia".
  - `FO` → **Airlines of Tasmania** instead of Flybondi → country "Australia".
  - `US` → **US Airways** (defunct) instead of Silk Avia → country "United
    States", ICAO "AAL".
- Scale: the harness found **427 airlines** whose stored legal name is a
  *different* airline sharing the code — roughly 4 in 10 enriched records.

**Fix applied (code only):** `lookupWikidata()` now fetches up to 10
candidates and `pickWikidataCandidate()` requires the candidate's English
label/short name to match the record's name (exact match wins; token-overlap
≥ 0.6 otherwise). No confident match → the record stays unenriched
(unverified) instead of silently wrong. Applied to both enrich scripts.

## Error class 2 — "Airlines based in Australia" listing Avianca El Salvador and Flybondi

**Root cause: downstream of class 1 — not a separate mapping bug.**
`listAirlinesByCountry('Australia')` filters `country == "Australia"`
correctly; the *country field on those records* is wrong (written by the
class-1 collision: Tasair and Airlines of Tasmania are Australian). No code
change needed in the country/destination templates; the records need
correction (listed in the integrity report; awaiting approval).

## Error class 3 — Silk Avia, Lufthansa, Air Djibouti, Philippine Airlines on SYD→MEL

**Root cause: both an upstream data problem and our transformation bug**, in
`backend/ai-writer-cli/ingest-travelpayouts.js` `ingestRoutes()`:

1. **Our bug — codeshare flag ignored.** The TP `routes.json` rows carry an
   explicit `codeshare: true/false` field. The ingest aggregated
   `airline_iata` from ALL rows, so marketing carriers became "carriers on
   this route": the SYD→MEL dump rows include `AA`, `LH`, `US`, and a QF
   codeshare row, all flagged `codeshare: true`. That is how Lufthansa
   (and American, US Airways) got onto an Australian domestic route.
   **Fix applied:** codeshare rows are now skipped during aggregation.
2. **Upstream staleness + recycled-code join.** TP's `routes.json` is a
   legacy snapshot (OpenFlights lineage, ~2014): `DJ` on SYD→MEL is **Virgin
   Blue** (its code then; `codeshare: false`, so the codeshare fix alone
   doesn't remove it), and `US` is **US Airways**. Our join maps those codes
   to the airlines that hold them *today* — Air Djibouti and Silk Avia —
   attaching present-day foreign carriers to a 2014 route row. `PR`
   (Philippine Airlines) is likewise a stale operating row. This is a source
   error we cannot patch in code without a current authoritative route feed;
   the harness flags every such case (foreign carrier on a domestic route =
   HIGH, 1,113 findings) for data correction, and the ingest gate blocks new
   ones.

## Why the errors compound

All three classes share one design flaw: **treating the 2-letter IATA code as
a stable unique identifier across datasets and across time.** It is neither.
Every fix and every harness check introduced by this task disambiguates
through the airline *name* against a reference registry, or refuses to guess.
