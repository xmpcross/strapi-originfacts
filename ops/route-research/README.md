# Route research: Gemini + Google Search grounding → verified route guides

Writes `content/route-guides/<slug>.json` (the schema in `lib/route-guide.ts`,
same as `bah-to-doh.json`) for flight routes.

**Status (5 Oct 2026): research stopped after the pilot.** One guide shipped
(akl-to-syd, #174, from the first design). The improved design below found
plenty of sources but no route kept a verified operator, because most
citable pages either refuse this server (403) or can't be checked; see
**Pilot findings** before spending more. Earlier 429 `RESOURCE_EXHAUSTED`
replies were billing not yet linked to the key's project (and later a stale
copy of `.env.local` in a worktree).

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
| 1a. Research | `gemini-research.mjs` | 6 grounded **plain-prose** requests a route (operators, route history, origin airport, destination airport, transport at each end, one practical question), `tools: [{ google_search: {} }]`, `thinkingConfig.thinkingLevel: "low"`, no JSON asked for |
| 1b. Structure | `gemini-research.mjs` | 1 call **without search**: the six answers + numbered grounded sources + their `groundingSupports` → JSON claims that cite source numbers only |
| 2. Verify | `verify-sources.mjs` | fetches each source page; with `--judge`, 1 non-grounded call a route for claims whose quote the verifier located on the page |
| 3. Build | `build-guides.ts` (tsx) | none; writes the guide and the claims ledger |

**Sources come only from `groundingMetadata`.** Each `groundingChunks[].web.uri`
(a `vertexaisearch` redirect) is resolved to its final URL with one request
to Google (both are recorded; the target page is not fetched then). Hosts in
`REJECTED_HOSTS` (booking/fare aggregators, flight-route sites, UGC, social,
Wikipedia) are discarded before numbering. URLs the model writes in its
prose are never used. Why: on gemini-3.6-flash, asking a grounded call for
JSON-only output suppressed `groundingMetadata` and the model invented
plausible URLs (11 of 21 were 404 or lacked the quote); `thinkingLevel:
"minimal"` skipped the search entirely.

The structuring call cannot add URLs, and claims carry no model-written
quote: the verifier locates the supporting sentence on the fetched page
(1–2 consecutive sentences containing every key token), and every located
quote must pass the semantic check.

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
   (digits or words: "three" = 3), month, airline name (or its core name:
   "LATAM Airlines" ~ "LATAM"), strong word (daily, weekly, seasonal, first,
   only, busiest…) and proper name (AirportLink, Puhinui…) in the claim.
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
| 5 Oct 2026 | gemini-3.6-flash | 2 (lhr-to-jfk operators, one unparseable) | n/a | 3,703 / 819 / 8,724 | stopped for akl-to-syd first; not verified, not committed |
| 5 Oct 2026 | gemini-3.6-flash | 4 + 2 judge (akl-to-syd) | n/a | 16,852 / 3,843 / 36,247 | $0.163 at 3.6-flash rates; 16 claims → 6 verified → 5 published |

**Grounding metadata:** gemini-3.6-flash returned no `groundingMetadata`
(so `webSearchQueries` = 0 in the log) even though its JSON cited
`vertexaisearch` grounding redirect URLs, so it did search. The number of
searches billed is therefore only visible in Google's console, not here.
`verify-sources.mjs` resolves those redirect URLs itself. Thinking tokens
are ~90 % of the token cost.

| 5 Oct 2026 | gemini-3.6-flash, JSON-only, thinking low | 11 (akl-to-syd, syd-to-mel, kul-to-sin; 1 at minimal) | n/a | ~12,800 / 6,050 / 17,600 | $0.10; 29 claims → 5 verified, URLs largely invented |
| 5 Oct 2026 | gemini-3.6-flash, prose + structure (current design) | 18 | 64 | 70,027 / 55,645 / 14,884 | $0.32; 222 claims → 14 verified, 0 guides |

**Total Gemini spend for the pilot: about $0.62 in tokens** (103,375 prompt,
66,361 output, 77,488 thinking over 52 calls) plus 65 logged searches, all
inside the free 5,000/month.

## Pilot findings (5 Oct 2026)

Current design, one run each, no retries:

| Route | Grounded req. | Searches | Tokens (prompt / output / thinking) | Cost | Usable sources | Claims → verified | Guide |
| --- | --- | --- | --- | --- | --- | --- | --- |
| akl-to-syd | 6 | 22 | 20,863 / 20,522 / 2,784 | $0.103 | 56 (18 rejected) | 74 → 9 | no: only operator (China Eastern) is a possible fifth-freedom leg |
| syd-to-mel | 6 | 20 | 22,536 / 15,458 / 6,298 | $0.099 | 54 (15 rejected) | 66 → 1 | no operator |
| kul-to-sin | 6 | 22 | 26,628 / 19,665 / 5,802 | $0.116 | 63 (13 rejected) | 82 → 4 | no operator |

For comparison, the first design on akl-to-syd: 4 grounded + 2 checks,
$0.163, 16 claims → 6 verified → 5 published (#174).

**The wall is fetchability, not Gemini.** Drop reasons across the three routes:
- 56 claims cited only pages that answered **403** to our identified
  crawler. Among them: executivetraveller.com, routesonline.com, the Auckland
  and Melbourne airport sites, jetstar.com, transport.vic.gov.au,
  immi.homeaffairs.gov.au and nzhistory.govt.nz.
- 11 cited pages whose **robots.txt could not be read**, so they were
  skipped (fail closed, as in ops/fetch). Among them: qantas.com,
  virginaustralia.com, simpleflying.com and qantasnewsroom.com.au.
  qantas.com resets the HTTP/2 stream for robots.txt.
- 87 had **no sentence on the page carrying the claim's names and numbers**.
  The model merged facts from several sources, or added dates and details;
  the structuring prompt now forbids this, and it helped (5 → 14 verified),
  but not enough.
- 31 **failed the semantic check**.
- The airline sites that would confirm "X flies A–B" are exactly the ones
  that block or can't be checked, so operator claims are what fails most.

**Not used: browser capture of 403 pages.** Fetching those pages through a
headless browser (ops/fetch's Playwright) would get past bot protection
that the site deliberately put in front of non-browser clients. That is
circumventing a block, not polite crawling, so it is out of policy here even
with an honest User-Agent. Pages that refuse us stay unverified. A human can
still add a source by hand (`ops/fetch` manual ingest) after reading it.

**Projections** (current design: ~6 grounded requests, ~21 searches and
~$0.11 in tokens per route at 3.6-flash's 2026 rates; token prices double on
1 Jan 2027):

| Scope | Grounded requests | Searches | Search cost | Token cost | Expected yield |
| --- | --- | --- | --- | --- | --- |
| Top 100 by popularity | ~600 | ~2,100 | $0 (within 5,000/month free) | ~$11 | few guides with an operator list, at this verification rate |
| All 491 | ~2,950 | ~10,500 | ~$77 if run in one month; $0 if spread over 3 months | ~$52 | same |

Fewer, broader requests (3 a route) would cut searches by about a third (not
measured) but return fewer sources per topic. The verification yield, not
the request count, is the limiting factor.

**Before running again:**
- Decide where operator facts come from. Likely candidates are fetchable
  airline newsrooms, national news sites and government air-services pages.
  Or accept fare data as the operator list (the page's existing fallback)
  and use research only for history, airports and transport.
- Consider an allowlist of hosts known to answer our crawler, pre-checked
  with `ops/fetch` preflight, in the research prompt.

## Known limits

- **Partial operator lists are not published as the list.** `build-guides.ts`
  compares sourced operators with the airlines in live Travelpayouts nonstop
  fare data (the page's own fallback). If fare data has a carrier no source
  confirmed, `operating_airlines` is left empty (the page keeps the
  fare-data list) and the intro says "include".
- **Current-service claims** (operator, seasonal) need a source dated within
  18 months; ceased airlines (data/airline-status, held entries included),
  non-airlines, foreign carriers off the route record (possible
  fifth-freedom legs) and claims about another airport (e.g. WSI vs SYD)
  are dropped.
- **Editor drops** (`editor-drops.json`) remove a verified claim that
  conflicts with another sourced field on the page, with the reason kept in
  the ledger.

- **Page text comes from the server-rendered HTML.** No JavaScript runs.
  Pages that load their content with JavaScript are dropped as "quote not
  on page"; they can be added by hand through `ops/fetch`.
- **Country-level wording fails the route-ends check.** A sentence that
  names only a country ("flights to Qatar") does not count as naming Doha.
  This is deliberately strict, so some true claims are dropped.
- **Grounding redirect URLs expire.** They are resolved during research and
  the real URL is saved.
