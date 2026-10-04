# Article FAQ proposals — awaiting approval

Drafted 2026-07-30. **Nothing here has been written to Strapi.** Each file is a
reviewable proposal: 3–5 questions per article, answers 40–60 words, every
fact grounded in that article's existing body (no new prices, dates, routes,
or policies introduced). Approve a batch and the entries get written into the
article's `faqItems` component (which already renders through the shared
FaqSection + FAQPage schema).

**Coverage: 57/57 published articles · 284 proposed Q&As · 13 content gaps
flagged across 11 articles.**

## Content gaps worth knowing about

These articles cannot answer an obvious question for their topic from their
own body — a signal the body needs a content update (gap details are in each
file's "Content gaps" section):

| Article | Gaps |
|---|---|
| best-pet-friendly-hotels-europe-2026-travel-guide | 2 |
| skip-airport-security-lines-2026 | 2 |
| what-to-pack-for-thailand-travel | 1 |
| cheap-flights-to-tokyo-best-booking-strategies | 1 |
| cross-5-southeast-asian-borders-stress-free-2026 | 1 |
| cheap-2026-flights-southeast-asia-wild-frontier | 1 |
| cheap-bangkok-flights-2026-insider-tricks | 1 |
| cheap-car-rentals-avoid-hidden-fees | 1 |
| cheap-flights-sydney-2026-adventurers-guide | 1 |
| cheap-flights-to-australia-2026 | 1 |
| cheap-flights-to-bali-avoid-hidden-fees | 1 |

## Review workflow

1. Review a file; edit wording freely (keep answers within ~40–60 words).
2. Approve per-article or per-batch.
3. On approval the Q&As are written to Strapi `article.faqItems`
   (question/answer/order) — the frontend and FAQPage schema pick them up
   with no further changes.

Grounding spot-audit: six specific claims from a sampled proposal
(best-airport-hotels-near-perth-airport) were verified verbatim against the
article body before this batch was committed.
