# Stage 1 — archival fetcher

Fetches carrier pages and archives the raw HTML. **It does not parse, extract,
or write anything into `content/airline-facts/`.** Extraction is stage 2, run
against this archive, so carrier sites are hit once and extraction is iterated
on offline.

## Running

```
npm run fetch                       # every carrier in carriers.json
npm run fetch -- --carrier qantas   # one carrier
npm run fetch -- --dry-run          # print the plan and robots verdicts, fetch nothing
```

Preflight can audit a separate carrier manifest without changing the approved
registry, and can preserve its report at a separate path:

```bash
npm run preflight -- --input /path/to/candidates.json --output data/captures/preflight-candidates.json
```

From the repo root. The root script delegates to `yarn --cwd ops/fetch fetch`,
which is why Playwright lives in `ops/fetch/package.json` and never enters the
site's dependency tree — `deploy-originfacts.sh` runs `yarn install
--frozen-lockfile`, and the live site should not be installing a browser.

First run in a clean checkout:

```
cd ops/fetch && yarn install && npx playwright install chromium
```

## Input

`carriers.json`. `locale` is **your assertion of the intended market**, not
something the fetcher validates — carriers express market in incompatible ways
(`/en-au/`, `/au/en/`, `?lang=en_AU`, subdomains), so there is no reliable
mapping from a locale string to a URL. The fetcher records what the page
actually said (`html_lang`, `detected_currencies`) and whether a locale-shaped
URL segment *changed*, and leaves interpretation to stage 2.

A carrier with no locale fails the whole run. Different locales serve different
allowances and currencies, so an unlabelled capture cannot be trusted
downstream.

## Output

`data/captures/<YYYY-MM-DD>/<carrier_key>/<page_key>.html` and a sibling
`.meta.json`. The date is **UTC**, matching `fetched_at` — a run at 04:00 in
Perth lands in the previous day's folder, by design.

`content_hash` is sha256 over `document.body.innerText` with whitespace
collapsed, not over the raw HTML, so markup churn and ad tags do not produce
false diffs on the quarterly re-run. The raw HTML is archived, so a different
extraction can be re-derived later.

Gitignored — large, and reproducible by re-running.

### Re-running a day

Overwrites, with one exception: **a failed capture never replaces a body that
succeeded.** The failure meta is still written, and `body_retained_from` records
that the HTML beside it is older than the meta.

## Capture status

| Status | Meaning |
|---|---|
| `ok` | Fetched, and the text is long enough to be plausible content |
| `robots_denied` | robots.txt disallows the path. Not fetched |
| `robots_unavailable` | robots.txt unreadable (5xx/timeout). Failed closed, not fetched |
| `blocked` | 403, CAPTCHA, or bot-detection interstitial — see `block_signal` |
| `redirected_locale` | A locale-shaped URL segment changed between request and response |
| `too_short` | Under 2,000 characters — a consent shell or empty page |
| `error` | Network failure or non-200 after retries |

`block_signal` separates "this carrier walls off bots"
(`cloudflare_challenge`, `datadome`, `perimeterx`, `akamai`, `imperva`,
`captcha_present`, `interstitial_title`) from "this URL is forbidden"
(`http_403`). Different problems, different fixes.

Body content is inspected **before** the HTTP status, because a Cloudflare
challenge is routinely served as HTTP 200.

## Politeness

Not configurable.

- robots.txt fetched per host and obeyed. 4xx means allow (RFC 9309); 5xx and
  timeouts fail **closed** as `robots_unavailable` — "we could not ask
  permission" must not resolve to "go ahead".
- User-Agent identifies us and carries a contact URL.
- Strictly serial. One request in flight at a time, across all carriers. A floor
  of 3s between requests to the same host, raised if robots.txt asks for more.
- Two retries maximum, exponential backoff, transport failures only. A block, a
  short page, or a locale redirect are stable answers — asking again just costs
  the host.
- Images, fonts and media are aborted at the network layer.
- No proxies. No CAPTCHA or bot-detection bypass of any kind. A walled page is
  recorded and left for manual capture.

## Consent walls

Reject-non-essential, always. Where a CMP offers only "Accept all", the fetcher
clicks **nothing** and records `reject_unavailable`; the page then usually falls
under the threshold and is handed to a person. Consenting to tracking on a
carrier's site to harvest a page is not a trade this pipeline makes — a missing
capture is the cheaper mistake.

Dismissal is judged on three independent signals, because none is sufficient
alone: the banner is gone, a consent cookie was written, or the text grew. Some
banners overlay already-rendered content so length never moves; others remove
the banner and *then* load content asynchronously.
