# Airline replacement URL preflight — 25 August 2026

## Scope

Non-destructive preflight of
`/opt/assets/blocked-airline-url-replacements.csv`. The approved
`ops/fetch/carriers.json` registry was not changed. Each replacement was first
checked with the identifying HTTP client and escalated to the existing
Playwright browser only when the lightweight request failed.

## Results

| Result | Count |
|---|---:|
| Replacement candidates tested | 124 |
| Airlines represented | 23 |
| Structurally usable URLs | 27 |
| Served directly to the HTTP client | 12 |
| Recovered by browser escalation | 21 |
| Not recovered by either instrument | 91 |

The counts overlap where a response was reachable but still carried a
structural warning such as several page purposes collapsing to one target.
`blocked_to_http` alone is not treated as a bad URL when the browser reaches
the same official page successfully.

## Clean replacements by airline

| Airline | Clean | Submitted | Notes |
|---|---:|---:|---|
| China Airlines | 6 | 6 | Strongest batch: all source purposes reached directly with no structural warning |
| Austrian Airlines | 4 | 5 | Fees, check-in, conditions and fares recovered; checked baggage still unresolved |
| Lufthansa | 4 | 5 | Carry-on, fees, check-in and conditions recovered; checked baggage still unresolved |
| SWISS | 4 | 5 | Carry-on, fees, check-in and conditions recovered; checked baggage still unresolved |
| Eurowings | 2 | 5 | Carry-on and excess-baggage sources recovered |
| Norse Atlantic | 2 | 5 | Fees and airport/check-in category pages recovered; article usefulness still needs capture review |
| Norwegian | 2 | 5 | Check-in and conditions recovered |
| ITA Airways | 1 | 5 | Conditions of carriage recovered |
| SAS | 1 | 5 | Checked baggage recovered |
| Transavia | 1 | 5 | Cabin baggage recovered |

## Still unrecovered

All submitted replacements remained unusable for Asiana, Bangkok Airways,
easyJet, EVA Air, Fiji Airways, Iberia, IndiGo, Japan Airlines, Jetstar, Qatar
Airways, Scoot and TUI Airways. These should remain in the manual/alternate
official-source queue rather than being imported.

## WestJet

WestJet was not covered by the replacement CSV. Current official baggage pages
were located separately:

- `https://www.westjet.com/en-ca/baggage/carry-on`
- `https://www.westjet.com/en-ca/baggage`

They provide carry-on and personal-item dimensions, fare-specific carry-on
allowances, the standard checked-bag weight and purchase-timing guidance. With
the already verified check-in module, WestJet now has the three modules needed
for release review.

## Recommended next batch

1. **China Airlines** — capture and extract all six clean replacements.
2. **Austrian Airlines** — capture four clean sources and locate one alternate
   official checked-baggage document.
3. **Lufthansa** — capture four clean sources and locate one alternate official
   checked-baggage document.

SWISS is the reserve candidate with the same four-of-five coverage as Austrian
and Lufthansa.

## Import rule

Only the 27 clean rows are eligible for a proposed registry patch. Preflight is
not publication: the full fetch must still obey robots and consent rules,
archive a substantive article body, pass selector review, extract candidates,
and complete field-level editorial verification.
