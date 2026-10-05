# Route research: Gemini + Google Search grounding → verified route guides

Writes `content/route-guides/<slug>.json` (the schema in `lib/route-guide.ts`,
same as `bah-to-doh.json`) for flight routes. **Status: built and tested
offline; not yet run against Gemini.** The first attempts on 5 Oct 2026
returned HTTP 429 `RESOURCE_EXHAUSTED` (billing not active on the key's
project), so no route content has been produced.

## One command

```bash
export PATH=/usr/local/lib/nodejs/current/bin:$PATH
node ops/route-research/run.mjs --routes syd-to-mel,kul-to-sin --dry-run   # plan only: routes, requests, budget, searches
node ops/route-research/run.mjs --routes syd-to-mel,kul-to-sin             # research → verify → build
node ops/route-research/run.mjs --all --limit 25                           # next 25 routes without a guide
node ops/route-research/usage.mjs --project-routes 491                     # token/search totals, cost, projection
```

Flags: `--model` (default `gemini-3.6-flash`), `--max-grounded` (default 40,
counted across runs from `data/usage.jsonl`), `--limit`, `--no-judge`,
`--min-claims` (default 3). Saved Gemini responses are reused, so a re-run
after a crash or a verifier change does not spend requests again.

**Stops:** any 401/403/429 or billing/quota/`RESOURCE_EXHAUSTED` reply ends
the run with exit code 2 and is never retried. The grounded-request cap
also stops it with exit 2.

The Gemini key is read from `GEMINI_API_KEY` (env or `.env.local`) and sent
only in the `x-goog-api-key` header, never in a URL, log or saved file.

## Steps

| Step | Script | Calls |
| --- | --- | --- |
| 1. Research | `gemini-research.mjs` | 3 grounded requests a route (operators today, dated history, airport access), `tools: [{ google_search: {} }]` |
| 2. Verify | `verify-sources.mjs` | fetches each source page; with `--judge`, makes 1 **non-grounded** call a route, only for claims whose quote was found on the page by the verifier rather than taken from the model |
| 3. Build | `build-guides.ts` (tsx) | none; writes the guide and the claims ledger |

**Sources come from grounding, not from the model's text.** Each claim is
mapped to the `groundingChunks` whose `groundingSupports` cover its text.
Their `vertexaisearch` redirect URLs are resolved to the real URL; that is
one request to Google, and the target page is not fetched at this point.
The URL the model wrote itself is tried last.

### The verification bar (`match.mjs`, unit-tested in `tests/route-research-match.test.ts`)

A claim is published only if all of these hold:

1. **Polite fetch.** The source page is fetched with the ops/fetch
   User-Agent (`Originfacts/1.0 (+https://www.originfacts.com/about)`).
   - robots.txt is obeyed on every host and every redirect hop. An
     unreadable robots.txt fails closed.
   - One request at a time, at least 4 s apart per host (longer if
     robots.txt sets a crawl-delay).
   - A 401/403/429 or a bot interstitial is recorded as `blocked`; the page
     is not retried or worked around.
2. **Exact quote.** The quote appears verbatim in the page text. Matching
   folds whitespace, quote marks, dashes, case and invisible characters
   only. Ellipses are not allowed.
3. **Every checkable token is in the quote.** That means every number
   (digits or words: "three" = 3), month, airline name and strong word
   (daily, weekly, seasonal, first, only, busiest…) in the claim.
4. **Route claims name both ends.** For operator, seasonal and history
   claims, the quote or the page title must name both ends of the route, by
   IATA code, city or a distinctive airport-name word. For airport and ground
   claims, the page must name that airport.
5. **History claims carry a year** in their text.
6. **No rejected hosts:** Wikipedia, forums and social media,
   flight-search/booking/route-map sites, and originfacts.com itself
   (`REJECTED_HOSTS`).
7. **Located quotes need the semantic check.** If the model's quote is not
   on the page, the verifier may find 1–2 consecutive sentences that pass
   rules 3 and 4 by themselves. Such a quote is marked `located` and needs
   the strict yes/no check (`--judge`); without it, the claim is not
   published.
8. **Airline identity by name, never by IATA code** (`build-guides.ts`).
   - The name must resolve to exactly one site airline. "Air India Express"
     never collapses into "Air India".
   - That airline must pass `carrierCodeMismatch()` from
     `lib/route-carriers.ts`, and `judgeRouteCarrier()` too if it is on the
     route record.
   - Only then does its IATA code go into `operating_airlines`. The page
     shows only operators that are also on the route record.

**Prose is assembled, not generated:**
- Each paragraph is one verified claim citing its source.
- The intro and the FAQ answers only join verified claims.

**When no guide file is written:**
- A route with no verified operator, or fewer than `--min-claims` verified
  claims, gets no guide file.
- An existing guide that this pipeline did not write is never overwritten
  (for example the hand-made `bah-to-doh.json`).

### Offline check (no Gemini)

```bash
node ops/route-research/verify-sources.mjs --routes bah-to-doh \
  --claims-file ops/route-research/fixtures/bah-to-doh.claims.json \
  --out ops/route-research/data/verified/bah-to-doh.fixture.json   # exit 1 on any FAIL
npx tsx ops/route-research/build-guides.ts --routes bah-to-doh \
  --verified ops/route-research/data/verified/bah-to-doh.fixture.json --min-claims 2   # dry run
npx tsx --test tests/route-research-match.test.ts
```

The fixture uses four sources already cited in `bah-to-doh.json`. It
re-fetches them politely and expects these results:
- **Verified:** two verbatim quotes, one of them with an invisible
  left-to-right mark on the page.
- **Dropped:**
  - an altered quote ("May 1" changed to "May 2");
  - a claim whose number disagrees with its real quote ("four" vs "three");
  - a claim whose year is not in its quote;
  - a history claim with no year;
  - a Wikipedia-only claim.
- **Needs the semantic check:** one claim, with a located two-sentence
  quote.

All 8 pass (5 Oct 2026).

## Files

- `claims/<slug>.json` (committed): every kept claim with its exact quote
  and URL, and every dropped claim with its reasons. This is the review
  trail for a guide.
- `data/` (gitignored), the audit trail:
  - `research/<slug>/<kind>.json`: the raw request and response, without
    the key.
  - `pages/*.json`: fetched page text and metadata.
  - `verified/<slug>.json`
  - `usage.jsonl`
  - cached read-only Strapi routes and airlines (`strapi-*.json`).
- Nothing is written to Strapi.

## Accounting

`data/usage.jsonl` gets one line per Gemini call, failed calls included:
- `grounded` and `web_search_queries` (how many searches Google ran);
- `prompt_tokens`, `tool_use_prompt_tokens`, `candidates_tokens` and
  `thoughts_tokens` (thinking is billed as output);
- `total_tokens`, the HTTP status, and the error, if any.

Rates used by `usage.mjs` (Google's pricing page, 5 Oct 2026):

| Model | Input / 1M | Output / 1M | Grounding |
| --- | --- | --- | --- |
| gemini-3.6-flash | $0.75 (until 31 Dec 2026, then $1.50) | $3.75 (then $7.50) | 5,000 free searches/month shared across Gemini 3.x, then $14 / 1,000 |
| gemini-3.5-flash | $1.50 | $9.00 | same |

| Run | Model | Grounded requests | Searches | Tokens (prompt / output / thinking) | Result |
| --- | --- | --- | --- | --- | --- |
| 5 Oct 2026 | gemini-3.5-flash | 1 | 0 | 0 / 0 / 0 | 429 `RESOURCE_EXHAUSTED`, stopped |
| 5 Oct 2026 | gemini-3.6-flash | 1 | 0 | 0 / 0 / 0 | 429 `RESOURCE_EXHAUSTED`, stopped |

**Pilot routes** (once billing is on):
- Busy international: lhr-to-jfk, syd-to-sin, lax-to-nrt.
- Domestic: syd-to-mel, jfk-to-lax, del-to-bom.
- Regional: kul-to-sin, akl-to-syd.
- Low popularity: lfw-to-oua, urc-to-htn.

## Known limits

- **Page text comes from the server-rendered HTML.** No JavaScript runs.
  Pages that load their content with JavaScript are dropped as "quote not
  on page"; they can be added by hand through `ops/fetch`.
- **Country-level wording fails the route-ends check.** A sentence that
  names only a country ("flights to Qatar") does not count as naming Doha.
  This is deliberately strict, so some true claims are dropped.
- **Grounding redirect URLs expire.** They are resolved during research and
  the real URL is saved.
