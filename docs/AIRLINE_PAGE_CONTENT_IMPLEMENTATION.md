# Airline page content implementation

This document explains what the redesigned airline pages publish, why each
section exists, and how the 75-airline content pipeline collects, verifies, and
releases the underlying facts.

## Goal

Each `/airlines/<slug>` page should answer the practical questions a traveller
asks before booking or flying. The page should be useful without becoming a
wall of text, indexable only when its most important claims are supported, and
clear about gaps rather than filling them with generic prose.

The page is assembled from three kinds of data:

1. **Official airline facts** in `content/airline-facts/<slug>.json`. These are
   field-level facts with source URLs and verification dates.
2. **Existing Origin Facts datasets**, such as route coverage and airline
   directory records. Derived sections identify the dataset and its vintage;
   they are not presented as manually verified facts.
3. **Structured page metadata**, including the airline name, country, logo,
   IATA code, canonical URL, and search indexing status.

Long tables and secondary details should use compact tables, cards, or
expandable disclosures where appropriate. Important booking constraints such
as baggage limits must remain visible and scannable rather than hidden merely
to shorten the page.

## Content added to each airline page

| Section | Content | Why it belongs on the page | Source and publication rule |
|---|---|---|---|
| Airline summary | Name, logo, home country, IATA code, alliance, founding year, major markets, and destination count where available | Establishes the entity quickly and supports airline-name and airline-facts search intent | Airline directory plus route dataset. Unknown or untrusted fields are omitted |
| Cabin bags and personal items | Number of items, size limits, weight limits, and fare or passenger exceptions | Baggage rules are among the highest-intent pre-flight questions and prevent avoidable airport charges | Official airline baggage page; the module publishes only when all required fields are official |
| Checked baggage | Included allowance, piece/weight limits, maximum dimensions, and relevant fare differences | Helps travellers compare fares and pack correctly | Official baggage or fare page; route- or cabin-dependent claims must be labelled rather than generalized |
| Cheapest fare | What the lowest fare includes: baggage, seat choice, changes, refunds, and boarding conditions | A headline price is not useful without its restrictions; this section supports fare-comparison intent | Official fare-family or fare-condition page; prose-only inclusions require manual review |
| Cabins and seating | Cabin names, seat or product information, and aircraft context when it can be supported | Helps users understand the onboard product without turning the page into marketing copy | Prefer verified airline facts; route/fleet data may provide a clearly labelled derived fallback |
| Delays and cancellations | Applicable passenger-rights framework, airline disruption links, and practical next steps | Gives travellers a useful path during disruption while avoiding unsupported legal promises | Official airline or regulator sources; jurisdiction-dependent statements must be explicit |
| Check-in and airport cutoffs | Online check-in opening/closing times, airport check-in, bag-drop, and gate deadlines | These are time-sensitive operational facts with a direct risk of a missed flight | Official check-in page; every displayed deadline needs a source and verification date |
| Contact and the small print | Official website, help centre, customer-service phone, support hours, correspondence/contact address, conditions of carriage, and loyalty programme | Gives readers safe, actionable contact routes and reduces exposure to fake airline phone numbers | Phone numbers and addresses require the carrier's own registrable domain. Unverified directory contacts are withheld |
| Where they fly | Destination count, major hubs/markets, route coverage, and related airport or route links | Supports discovery and internal linking while answering network-intent searches | Derived from the Origin Facts route dataset and labelled with its data vintage |
| Common questions | Short answers built only from facts already present on the page | Captures natural-language search intent and makes dense facts easier to scan | Answers must be derived from published modules; the FAQ must not introduce new unsupported claims |
| Sources and freshness | Source links, verification dates, dataset vintages, conflicts, and unpublished gaps | Makes the page auditable and prevents a stale page from appearing freshly verified | Generated from field provenance; missing and disputed facts stay visibly unpublished |

Traveller review scores are currently withheld. The available review corpus is
stale and its licensing does not support publishing a current aggregate score
as an Origin Facts rating.

## How the system fetches and verifies content

The system deliberately separates collection from publication. A successful
fetch does **not** make a fact live.

### 1. Define official sources

`ops/fetch/carriers.json` lists each carrier, its intended locale, and the
official pages to collect, such as baggage, fares, check-in, contact, and
conditions of carriage. Locale is required because allowances and currencies
can vary by market.

### 2. Preflight and fetch

The fetcher checks reachability and `robots.txt`, then opens permitted pages in
a real browser so client-rendered airline sites can be captured. It:

- identifies itself and obeys robots directives;
- fetches serially with a minimum delay per host;
- rejects non-essential consent where possible;
- does not use proxies or bypass CAPTCHAs/bot protection;
- records blocked, redirected, short, or failed pages instead of treating them
  as content.

Run all configured carriers or one carrier:

```bash
npm run fetch
npm run fetch -- --carrier ryanair
```

Raw HTML and metadata are archived under
`data/captures/<YYYY-MM-DD>/<carrier>/`. Captures are kept separate from the
live fact store, allowing extraction rules to improve without repeatedly
requesting the airline website.

### 3. Isolate the article and extract candidates

`ops/fetch/selectors.json` stores a reviewed article-body selector for each
carrier. Extraction never falls back silently when a selector stops matching;
that is treated as a failure because navigation and country pickers often
contain unrelated weights and dimensions.

```bash
npm run extract -- --carrier ryanair
```

Extraction writes `candidates.json`. Candidates retain the page, sentence,
value, URL, capture date, and proposed content kind. They are evidence for
review, not publishable facts.

### 4. Draft the airline fact file

```bash
npm run draft -- --carrier ryanair
```

The draft step groups candidates into page modules and writes every proposed
field as `pending`. A reviewer decides what a value means, whether it applies
to a particular fare/market/cabin, and which fields a module requires. This is
the semantic judgement that automation cannot safely infer from a number alone.

### 5. Prove citations and promote safe measurements

```bash
npm run promote -- --carrier ryanair --dry-run
npm run promote -- --carrier ryanair
```

Automatic promotion is intentionally narrow. A pending field can become
`official` only when it has a value and source URL, the URL is on the airline's
own registrable domain, and every measurement in the value appears in the
archived article for that exact URL. Prose claims and ambiguous inclusions stay
manual. Existing promotions can be audited again with `--recheck`.

### 6. Validate the fact store

```bash
npm run validate:facts
npm run validate:facts:fixtures
```

Validation rejects malformed provenance, placeholder sources, widened dates,
incomplete required fields, unsafe contact sources, and mock data. Validation
also runs automatically before every production build.

### 7. Review and publish through the allowlist

An airline is released only after its required traveller modules and rendered
page have been reviewed. Its slug is then added to
`PUBLISHED_AIRLINE_GUIDES` in `lib/airline-tier.ts`. The allowlist controls all
three release surfaces together:

- the redesigned component renders on `/airlines/<slug>`;
- metadata changes to `index, follow`;
- the canonical airline URL enters the sitemap.

Airlines outside the allowlist retain the legacy page and `noindex, follow`, so
having some fetched candidates cannot accidentally publish a thin or partially
verified guide.

### 8. Build, deploy, and monitor

Before release, run fact validation, TypeScript/build checks, and desktop/mobile
route QA. After deployment, confirm the public page, robots metadata, canonical
URL, and sitemap entry. Update the Notion airline tracker to record modules
found, fetched, verified, missing, published, and the next refresh action.

## Refresh cycle

Airline policies change. Scheduled refreshes should re-fetch configured source
pages, compare normalized content hashes, re-extract changed pages, and send
changed or conflicting fields back to review. Automation may flag and prove a
change, but it must not silently reinterpret a fare, jurisdiction, or exception.

The intended pipeline is:

```text
official source list
  -> polite archived fetch
  -> carrier-specific article selector
  -> candidate extraction
  -> pending fact draft
  -> citation proof + human semantic review
  -> validation
  -> reviewed publication allowlist
  -> build/deploy QA
  -> freshness monitoring
```

## Current publication policy

Publishing is incremental. A small reviewed group may go live while the
remaining airlines continue through extraction and verification. The Notion
tracker is the operational status record; Git is the authoritative history for
fact files, selectors, validation rules, and the publication allowlist.
