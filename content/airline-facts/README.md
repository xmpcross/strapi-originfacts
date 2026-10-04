# Airline fact store

For the page-by-page content plan, rationale, full fetch workflow, and release
process, see [`docs/AIRLINE_PAGE_CONTENT_IMPLEMENTATION.md`](../../docs/AIRLINE_PAGE_CONTENT_IMPLEMENTATION.md).

One file per airline: `content/airline-facts/<slug>.json`, where `<slug>` matches
the airline slug in Strapi (the same one `/airlines/<slug>` uses).

This is the store the Tier 1 template reads. Loader: `lib/airline-facts.ts`.

## The rule this store exists to enforce

**A module with no sources does not render.** There is no fallback prose. If a
figure has not been verified against a citable source, the module shows as
*Unpublished* on the page instead — a visible gap, not a plausible-looking
paragraph with nothing behind it.

The loader drops any module missing `id`, `title`, `verifiedAt`, or a non-empty
`sources` array, so a half-filled spreadsheet row cannot reach the page by
accident.

## Shape

Provenance is per **field**, not per module. A module-level source list lets a
table publish a cell nobody sourced as long as the module cites something —
which is rule 3 violated by construction.

```jsonc
{
  "slug": "qantas",
  "official_website": "https://www.qantas.com",   // required; validation uses it
  "modules": [
    {
      "id": "contact",
      "title": "Contact and the small print",
      "required": ["phone_home_market"],          // all must be `official` to publish
      "fields": {
        "phone_home_market": {
          "value": "13 13 13",
          "status": "official",
          "source_url": "https://www.qantas.com/en-au/help/contact-us",
          "verified_at": "2026-08-24"
        },
        "phone_us": { "value": null, "status": "pending" }
      },
      "table": {
        "caption": "Contact by market",
        "columns": ["Market", "Number"],
        "rows": [{ "label": "Australia", "cells": ["phone_home_market"] }]
      }
    }
  ]
}
```

Table cells name **field keys**, never strings, so no cell can reach the page
without provenance attached.

## Status

| Status | Meaning | Renders? |
|---|---|---|
| `official` | The carrier's own page, or a named regulator | Yes |
| `third_party` | Aggregator, encyclopedia, blog. Plausible, unconfirmed | No |
| `disputed` | Credible sources disagree | No — the conflict renders |
| `pending` | Not yet researched, or the lookup failed | No |
| `n/a` | Does not apply to this carrier | No |

A module publishes only when every field in `required` is `official`. Otherwise
it renders the unpublished state, naming which fields are missing.

## Validation

```
npm run validate:facts            # the store — runs automatically as prebuild
npm run validate:facts:fixtures   # the fixture suite
```

`prebuild` means a file that breaks the contract **fails the build** rather than
reaching production. That is structural on purpose: a design mock has already
been served publicly under green "Verified" stamps.

Enforced:

- Any file carrying `_warning`, or named `_*`, fails. Mock data cannot sit in
  the store.
- `official` requires `source_url`, `verified_at` and a non-empty `value`.
- `disputed` requires both readings in `conflicting_values`.
- `verified_at` must be `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. **Precision is never
  widened** — a year stays a year.
- Every key in `required` must exist in `fields`.
- **A `contact` field whose value looks like a phone number or postal address
  must be sourced from the carrier's own registrable domain.** Anything else
  fails.

That last rule exists because contact numbers are the most poisoned field type
in search: scam operations publish fake airline "customer service" numbers as
PDFs on university and government domains, harvesting card details from callers.
Domain authority is not a signal. Comparison uses the public suffix list
(`tldts`), not label counting — under `.com.au` the last two labels *are* the
suffix, so counting would treat every `*.com.au` host as one site — and not
`endsWith`, which passes `qantas.com.attacker.example`.

Fixtures live in `ops/fixtures/airline-facts/`, named `pass-*` or `fail-*`. A
validator with no negative tests only proves it can say yes.

## Conventions

- **`verified_at` is per field.** No inheriting a stamp from a sibling field, a
  previous run, or another carrier.
- **Cite the carrier, not an aggregator.** Duffel's `conditions_of_carriage_url`
  gives that link for 57 of the 71 Tier 1 carriers.
- **Where sources disagree, set `disputed` and publish neither.** A module that
  silently picks one of two figures has guessed, and the reader cannot tell.
- **Record the fetched URL per field.** Markets genuinely differ; an `en-au`
  number and an `en-us` number are different facts, not one fact to normalise.
- **Units live in the value** (`"1 × 23 kg"`, `"140 cm"`). The template does not
  add units or convert between them.
- **`correspondence_address`, never `registered_address`.** We publish where a
  complaint can be sent. A registered office is public record and useless to a
  traveller.

## No samples in the store

There is deliberately no sample file here. One existed, was renamed off its
underscore, and was served on production as verified fact. The validator now
rejects `_*` filenames and any `_warning` key, so that cannot recur. Fixtures
live in `ops/fixtures/airline-facts/` instead, outside the store entirely.
