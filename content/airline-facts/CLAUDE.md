# Originfacts — airline reference pages

Next.js 15 (App Router) site at www.originfacts.com. This file governs the
airline reference pages under `/airlines/<slug>` and the fact files behind them.

## What these pages are

Reference pages for ~75 Tier 1 carriers: baggage, fares, cabins, check-in,
passenger rights, contact. Their entire value is that every printed figure is
traceable to a source a reader can open. The differentiator is not coverage or
prose — it is provenance.

Remaining carriers stay as thin directory entries, `noindex`, out of the sitemap.

## Non-negotiable data rules

These exist because each one has already been violated once. Do not relax them
without me saying so explicitly in the session.

1. **A failed lookup writes `null` and status `pending`.**
   Never a default that reads like an answer. `alliance: "none"` was written for
   all 75 carriers because a missing Wikidata property became a positive claim.
   Empty is honest; a plausible-looking wrong value is not.

2. **Never widen precision.**
   A year stays a year. Do not pad `1985` to `1985-01-01`. If the source gives a
   year, the field holds a year and the format says so.

3. **Every published value carries `source_url` and `verified_at`.**
   No exceptions. No inheriting a stamp from a sibling field, a previous run, or
   another carrier. If you cannot name the URL it came from, it is not verified.

4. **Where sources conflict, store both and publish neither.**
   Set status `disputed`, record both values in `notes`, render the conflict on
   the page. Do not pick the more common one.

5. **The entity must match.**
   `founded` means this airline, not a predecessor. British Airways was formed in
   1974, not 1919. Lufthansa dates to 1953, not 1926. When a source describes a
   predecessor company, that is a different entity — leave the field pending.

6. **Do not edit a field with status `official` without a new source URL and a
   new verification date.** Changing the value while keeping the old stamp is
   worse than leaving it stale.

## Done means on main

**A change is done when it is reachable from `main`.** Not when it is
committed, not when it is pushed, not when a PR is open, and not when a PR that
used to contain it has merged.

Verify before reporting anything complete:

    node ops/verify-shipped.mjs <sha> [<sha>...]
    git log --format=%H -5 feat/my-branch | xargs node ops/verify-shipped.mjs

It compares against `origin/main` rather than a local ref, because a local main
lagging behind origin is exactly how this looks fine and is not. Exit code 1 if
anything is stranded.

It matches by hash first, then by patch-id, so a rebased commit still reports as
shipped. A commit whose content changed during a rebase — a conflict resolution
alters the patch — will still read STRANDED. That is deliberate: a false
STRANDED costs a manual check, a false ON MAIN is the mistake this exists to
prevent.

This is written down because "pushed" was mistaken for "done" three times in one
week:

- Six CMS commits ran in production while `main` described a system that ran
  nowhere — including a divergent `docker-compose.yml`.
- Three commits were pushed to a branch *after* the PR containing it had
  merged, so they went nowhere while being reported as shipped. One was a
  contrast fix described as live.
- A mock data file survived five separate deletions because everyone believed
  it was already gone.

Each was recoverable, and none was noticed by whoever caused it. A push
succeeds loudly and lands nowhere quietly, which is the worst shape a mistake
can have.

## IATA codes are not entity identifiers

**Never join, dedupe or enrich on an IATA code alone.** Not in a script, not in
a query, not in a spreadsheet lookup.

A 2-letter IATA code is a route-marketing designator, not an identity. It is
recycled to a new carrier after the previous holder folds, and it is shared
across a group's subsidiaries, cargo arms and franchise partners. Wikidata
holds every one of those as a separate entity under the same `P229`.

This is not hypothetical — it is how the current airline table was corrupted:

- `QF` returns Qantas Airways **and** Eastern Australia Airlines, Qantas
  Freight, Sunstate, Jetconnect and National Jet Systems. Qantas was stamped
  ICAO `EAQ` — Eastern Australia's real code.
- `AB` was Air Berlin's before it was Bonza's; Bonza got `airberlin.com`.
  `US` was US Airways' before Silk Avia's. `UN` was Transaero's before United
  Nigeria's. `7H` was Era Aviation's before New Pacific's.
- **791 of 1,096 airlines share their IATA code with another Wikidata entity.**
  Country was overwritten with a different country on 151 of them — Scoot as
  United States, Vanilla Air as Australia, Porter as Canada.

Recycled codes produce obviously wrong values. **Group siblings produce
plausible ones**, and those do not announce themselves: `EAQ` is a real ICAO
for a real airline that really does operate QF services. Any carrier with a
cargo arm, a regional subsidiary or a franchise partner is exposed.

Join on something that identifies an entity — a **Wikidata QID** or an **ICAO
code**. Use IATA to display, and to key datasets we control end to end. Never
to resolve who a company is.

Fuzzy name matching is not a substitute. It fails closed on correct matches
("Qantas" against "Qantas Airways" scores 0.5) while still guessing on wrong
ones, and it is a string comparison standing in for an identity check.

## Status vocabulary

| Status | Meaning | Renders? |
|---|---|---|
| `official` | From the carrier's own published page or a named regulator | Yes |
| `third_party` | Aggregator, encyclopedia, blog. Plausible, unconfirmed | No |
| `disputed` | Credible sources disagree | No — render the conflict |
| `pending` | Not yet researched, or lookup failed | No |
| `n/a` | Does not apply to this carrier | No |

Only `official` publishes. A module renders only when every required field in it
is `official`; otherwise it renders the unpublished empty state.

## Layout

- `content/airline-facts/<slug>.json` — the fact files. Source of truth for the pages.
- <!-- fill in: page component path -->
- <!-- fill in: schema / validation path -->
- <!-- fill in: pipeline / scripts path -->

## Commands

<!-- fill these in — Claude should use these rather than guessing -->
- Build: `npm run build`
- Validate fact files: `<command>`
- Dev server: `npm run dev`
- Deploy: manual and deliberate. Do not run it.

## Existing verified data sources

Do not re-derive these; read what is already stored.

- **Duffel Airlines API** (`api.duffel.com/air/airlines`) — carrier identity.
- **Originfacts route-network dataset**, from TravelPayouts — routes,
  destinations, airports by route count, sector distances, aircraft types seen.
  This accumulates over time. It is **not** a fleet register: it names retired
  types and misses recent additions. Never present it as a current fleet.
- **Carrier conditions of carriage** — the only acceptable source for baggage,
  carry-on, fares and check-in.
- **Regulators** — infrastructure.gov.au, EUR-Lex, UK CAA — for passenger rights.

## Known issues

- **ICAO codes are wrong.** Qantas renders as `EAQ`; the correct code is `QFA`.
  Whatever join produced this affects all carriers. Fix the source, then backfill
  from OurAirports (public domain) or Wikidata (CC0). Do not hand-type 75 codes.
- **The ledger header shows "Last full review 6 Dec 2023"** — the newest review
  date is leaking into it. It should reflect the most recent field verification.
- **The reviews module** publishes an aggregate score from reviews no newer than
  Dec 2023. Treat as under review; do not extend it until sourcing is settled.

## Working style

- **Plan first for anything touching `content/airline-facts/`.** I want to read
  the diff before you write 75 files.
- Small commits, one concern each. A schema change and a data backfill are two
  commits.
- When a source page is ambiguous, stop and ask. Do not resolve ambiguity by
  choosing — that is how wrong values get stamped `official`.
- Prefer deterministic scripts over agentic loops for anything that runs
  quarterly. The refresh must produce a clean diff against the previous run.
- Do not bypass bot detection or CAPTCHAs on carrier sites. Where a page blocks
  automated access, flag the carrier for manual capture.

## What good looks like

A field nobody has verified renders as an honest empty state. A field that
conflicts renders as a stated conflict. A field that publishes carries a date and
a link. Fewer published fields, all correct, beats a full page of plausible
numbers — the page is worth reading precisely because we say what we do not know.