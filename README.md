# Originfacts.com — Next.js 15 frontend

OriginFacts.com is a travel and airport information site built with Next.js and
backed by a Strapi CMS. The production frontend is **self-hosted on the FXN VM**
and is **not** deployed on Vercel.

## Stack
- Next.js 15 (App Router, React Server Components)
- React 19
- Tailwind CSS + `@tailwindcss/typography` for article rendering
- Fraunces serif display + Geist sans body (distinctive editorial look)
- Fetches from Strapi 5 REST API, with ISR (60 s stale-while-revalidate)
- Resend for contact form email
- TravelPayouts, Stay22, SerpApi, DataForSEO and RapidAPI Airport Info integrations
- Google AdSense is wired but **currently disabled** — see [Advertising](#advertising)
- Fully responsive, SEO-ready (Open Graph, Twitter cards, canonical URLs)

## Production platform
- Public site: `https://www.originfacts.com`
- DNS / CDN: Cloudflare (proxied — the public A records are Cloudflare's)
- Origin server: `51.161.208.188`
- Canonical redirect: `originfacts.com` redirects to `www.originfacts.com`
- Web server / reverse proxy: nginx with Let's Encrypt certificates from Certbot
- Frontend runtime: native systemd service, `originfacts-com.service`
- Frontend port: `127.0.0.1:3000`, proxied by nginx
- **Project path: `/opt/projects/originfacts.com`**
- Node: system `/usr/bin/node` (the unit invokes `next start` directly)
- CMS: Strapi exposed at `https://cms.fxnstudio.com`
- CMS container: Docker container `fxn-strapi`, mapped to `127.0.0.1:8888 -> 1337`

The site moved off Vercel and onto this VM in August 2026. Anything describing a
Vercel project, `/var/www/html/originfacts.com`, or the old `146.0.42.20` host is
out of date.

## Docker status
The OriginFacts frontend is **not** running in Docker. It runs directly on the VM
using systemd:

```bash
systemctl status originfacts-com.service
```

Docker is running on the server for other services, including the Strapi CMS
container:

```bash
docker ps
```

## Pages
- `/` — Home: featured article + latest by category + destinations
- `/articles/[slug]` — Article detail with related by category (`/articles` redirects to `/all-articles`)
- `/all-articles` — All articles (paginated)
- `/category/[slug]` — Category landing (e.g. Flights, Hotels, Tips)
- `/destinations` and `/destinations/[slug]` — Destination grid and detail
- `/airports` and `/airports/[iata]` — Airport directory and detail
- `/airlines` and `/airlines/[slug]` — Airline directory and detail
- `/countries/[code]` — Redirects to the matching `/destinations/<slug>`
- `/flight-routes` and `/flight-routes/[slug]` — Route pages
- `/authors` and `/authors/[slug]` — Editor profiles
- `/methodology`, `/about`, `/faq`, `/contact`, `/legal/[slug]` — Editorial and policy pages
- `/sitemap` — HTML index for people (`noindex, follow`); `/sitemap.xml` is the real one

## Local development

```bash
cd /opt/projects/originfacts.com
yarn install
yarn dev
```

Local dev runs at `http://localhost:3000`.

## Deploying

**Use the deploy script.** It is the sanctioned path and is what the webhook
listener calls:

```bash
/usr/local/bin/deploy-originfacts.sh
tail -f /var/log/originfacts-deploy.log
```

It runs `yarn install --frozen-lockfile`, `rm -rf .next`, `yarn build`, then
restarts `originfacts-com.service`. Note that it builds **whatever is checked
out** — it does not pull. Check out `main` and pull first.

Because it removes `.next` before rebuilding, the site returns errors for the
duration of the build (roughly one minute). Deploy accordingly.

```bash
cd /opt/projects/originfacts.com
git checkout main && git pull --ff-only
/usr/local/bin/deploy-originfacts.sh
systemctl status originfacts-com.service
```

To check nginx after changing the vhost:

```bash
nginx -t
systemctl reload nginx
```

### Never build in place on a branch

`.next/` in this directory **is** the live production build — the systemd unit
serves straight out of it. Running `yarn build` here while on a feature branch
publishes that branch. To build a branch for verification, use a throwaway git
worktree with `node_modules` symlinked in, build there, and serve it on a spare
port.

### Automated deployment

`originfacts-webhook.service` can trigger deploys from GitHub, but it is
currently **disabled and inactive** — deploys are manual today.

```bash
systemctl status originfacts-webhook.service
```

## Editorial gates

Two mechanisms decide what is fit to publish. Both exist because generated
content had previously filled the site faster than anyone could check it, and
AdSense rejected the site for low value content in September 2026.

### Airline publication allowlist

`lib/airline-tier.ts` holds `PUBLISHED_AIRLINE_GUIDES`. Only carriers on that
list are indexable and enter the sitemap; every other airline page stays live
and linked but carries `noindex, follow`.

The bar is **at least one fact field verified by a person**
(`verified_by: manual_official_source` or `manual_review`). Ingested reviews do
not qualify a carrier, because `REVIEWS_MODULE_ENABLED` in
`components/airline-tier1/AirlineTier1.tsx` is false and that store renders
nothing.

This list previously drifted to all 436 carriers, which made the gate a no-op —
`AIRLINES_INDEXABLE=false` held nothing back. Add a slug only after someone has
actually read that carrier's policy.

### Fact provenance

Fields in `content/airline-facts/*.json` carry a `status`. Only `official`
renders; `lib/airline-facts.ts` gates on it and stamps published modules
"Verified &lt;date&gt;". Anything the ingest pipeline produced without human review
sits at `pending` and is withheld.

Do not promote a field to `official` without reading the value off the carrier's
own documentation and recording a `source_url` that resolves. `ops/downgrade-unverified-facts.mjs`
documents why: 3,016 fields once claimed `official` while asserting a single
default across the fleet, citing constructed URLs that were more than half dead.

`/methodology` describes this policy publicly. If the bar changes, change that
page to match — not the other way round.

## Advertising

`lib/adsense.ts` exports `ADSENSE_ENABLED = false`, which gates the loader
script, the `google-adsense-account` meta tag and `components/AdSlot.tsx`. No ad
units render while it is false.

Affiliate links must carry `rel="sponsored nofollow noopener"`.

## Environment variables
Runtime configuration lives in `.env.local` on the VM. Important keys include:

- `NEXT_PUBLIC_STRAPI_URL` — CMS, read at request time
- `NEXT_PUBLIC_SITE_URL` — canonicals, sitemap, RSS, OpenGraph
- `STRAPI_API_TOKEN` — optional; public reads work without it
- `NEXT_PUBLIC_TP_MARKER`, `NEXT_PUBLIC_TP_WL_HOST`, `TRAVELPAYOUTS_API_TOKEN`
- `NEXT_PUBLIC_STAY22_AID`
- `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`
- `SERPAPI_API_KEY`
- `NEXT_PUBLIC_ADSENSE_CLIENT`
- `RAPIDAPI_AIRPORT_INFO_KEY`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`

## Notes specific to this site

- Loaders read from disk while serving: `content/airline-facts`,
  `content/airline-reviews`, `content/legal`, `content/pages`,
  `data/airline-refs` and `data/route-facts`. The paths are built with
  `join(process.cwd(), …)`, which Next's tracer cannot follow, so
  `outputFileTracingIncludes` in `next.config.mjs` bundles them explicitly.
  Without it the build stays green and the pages render empty.
- API routes: `category-articles`, `contact`, `dataforseo-hotels`,
  `flight-deals`, `google-flights`, `nearest-airport`, `nearest-city`,
  `price-calendar`, `revalidate`.
- `yarn lint` does not run — `next lint` is unconfigured and prompts
  interactively. Use `npx tsc --noEmit` and a build as the check.

### The CMS is a runtime dependency

Content is fetched per request and per revalidation, so **the site has no
content if Strapi is unreachable**. The CMS runs on a separate host, and a DNS
failure there is enough to empty the site — which is exactly what happened in
August 2026.

## Customising the look
- Colours: `tailwind.config.ts` (`forest`, `sand`, `paper`, `ink`)
- Fonts: `app/layout.tsx` — swap Fraunces / Geist for any other pair you like
- Home hero copy: `app/page.tsx`

## Repository

`xmpcross/strapi-originfacts`, default branch `main`. Work on a feature branch
and open one PR per change; do not commit directly to `main`.
