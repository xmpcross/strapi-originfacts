# Duplicate URL patterns — options for a decision

Written 2026-07-30 as part of the canonical-links task. **No decision has been
made or implemented** — this documents the current state and the options with
tradeoffs. Redirect/segment changes are explicitly out of scope of that task.

## Current state (verified live, 2026-07-30)

| Pattern | Behaviour today |
|---|---|
| `/hotels` | Page stub calling `redirect('/category/hotels')` → **307 (temporary)** |
| `/hotels/<slug>` | Page stub redirecting to `/destinations/<slug>` → 307 |
| `/countries/<code>` | `permanentRedirect()` → **308** to `/destinations/<slug>` whenever a CMS destination exists for the code — which today is **every code except KX**. KX (and any future code without a destination) renders a full country page with a self-canonical. |

Note: the task brief described `/countries/<code>` as serving byte-identical
content on both patterns. That is not what production does — it 308s. The
"duplicate pattern" question is therefore about the *route segments and stub
pages*, not about duplicate indexable content.

## Options

### A. Keep as-is (redirect stubs stay)

- **For:** zero risk; inbound links to old URLs keep working; `/countries/<code>`
  remains a working entry point for the long tail (typed URLs, old bookmarks,
  external links using ISO codes); KX-style codes without a destination still
  get a page.
- **Against:** crawl budget spent on hops; internal-link hygiene must be
  maintained by the crawler report forever; `/hotels` uses a **307**, which
  tells Google the move is temporary and keeps the old URL in the index longer.

### B. Minimal hardening: make the stub redirects permanent (301/308), keep all segments

- Change `redirect()` → `permanentRedirect()` in `/hotels` and `/hotels/[slug]`.
- **For:** one-line changes; signals permanence to crawlers so equity
  consolidates; nothing breaks — URLs still resolve.
- **Against:** permanent redirects are cached aggressively by browsers/CDNs —
  effectively irreversible if you later want `/hotels` to be a real page again.

### C. Full consolidation: move redirects to next.config, delete the stub segments

- Express `/hotels`, `/hotels/:slug`, `/countries/:code` as `next.config.mjs`
  `redirects()` rules (308 by default), delete the three route segments.
- **For:** redirects happen before rendering (cheaper — no React render per
  hit); one declarative place to see all URL moves; removes dead template code.
- **Against:** `/countries/:code` cannot be expressed statically — the
  code→slug mapping lives in Strapi, so this option requires either middleware
  with a data lookup or generating the rules at build time (staleness risk when
  destinations are added). Losing the KX fallback page also means codes without
  destinations 404 unless handled.

### D. Re-purpose `/countries/<code>` as a distinct page (no redirect)

- Serve country-specific *aviation directory* content (airports, airlines,
  routes) at `/countries/<code>`, distinct from the editorial destination guide.
- **For:** the ISO-code URL is a natural entry point for data-ish queries and
  deep links; the template already exists and renders (KX proves it); more
  indexable surface without duplication **if** the content is genuinely
  distinct from the destination page.
- **Against:** the most work; near-duplicate risk if the two pages aren't
  clearly differentiated (that's the exact AdSense "scaled content" trap the
  quality gates exist to avoid); splits link equity for country queries across
  two URLs.

## Recommendation withheld

Per the task brief, this is your call. Inputs that would settle it:
- Search Console: how much external traffic actually lands on
  `/countries/<code>` and `/hotels` URLs today (if ~zero, Option C's breakage
  cost is ~zero).
- Whether a distinct country-level aviation page (Option D) fits the content
  roadmap, or whether destination pages are intended to be the single
  country surface.

The internal-link fixes shipped alongside this doc make the site link straight
to canonicals regardless of which option is chosen, and the CI crawler report
keeps it that way.
