import type { Metadata } from 'next';
import Link from 'next/link';
import { clampDescription } from '@/lib/seo';
import { JsonLd } from '@/components/SeoBlocks';
import { ORG_ID, organizationJsonLd, absoluteUrl, breadcrumbJsonLd } from '@/lib/jsonld';
import { contactHref } from '@/lib/contact';
import ChapterNav, { type Chapter } from '@/components/methodology/ChapterNav';
import { loadMethodologyData, type MethodologyData } from '@/components/methodology/data';

/*
  This page is where Originfacts makes promises about its process, so it
  describes the process as it is — not as it is meant to become.

  History: an earlier version claimed every article was cross-referenced
  "directly against official civil aviation authorities and carrier
  documentation" and had undergone "rigorous multi-tier verification by named
  travel domain experts". At the time, 96% of airline fact fields carried
  `verified_by: automated_provenance`, and a sample of their citations was 54%
  dead links. A reviewer who checked that claim would have found it false,
  which discredits the accurate parts of the site along with it.

  Rules for editing this page:
  - Every number is counted from the data the site renders
    (components/methodology/data.ts). Never type one in.
  - The verification explainer quotes real fields from content/airline-facts
    and mirrors the labels the airline pages use (components/airline-v2).
  - If the verification bar rises, raise the claim to match — not before.
  - Section ids from the old Markdown version (content/pages/methodology.md,
    removed) still resolve: see LegacyAnchor.
*/

// Article and airline counts come from Strapi; re-render hourly rather than
// freezing whatever the CMS returned at build.
export const revalidate = 3600;

const DESCRIPTION = clampDescription(
  'How Originfacts researches and writes: where our travel data comes from, how AI drafts are reviewed by editors, how airline facts are verified, and how to report a correction.',
);

export const metadata: Metadata = {
  title: 'Editorial Methodology & Standards',
  description: DESCRIPTION,
  alternates: { canonical: '/methodology' },
  robots: { index: true, follow: true },
};

const methodologyPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Editorial Methodology & Standards | Originfacts',
  headline: 'How we research and write',
  url: absoluteUrl('/methodology'),
  description: DESCRIPTION,
  inLanguage: 'en',
  publisher: { '@id': ORG_ID },
  about: { '@id': ORG_ID },
  mainEntity: { '@id': ORG_ID },
};

const CONTACT_EMAIL = 'contact@originfacts.com';
const SUPPORT_EMAIL = 'support@fxnholdings.com';

const CHAPTERS: Chapter[] = [
  { id: 'principles', n: '01', label: 'Principles' },
  { id: 'sources', n: '02', label: 'Where information comes from' },
  { id: 'how-articles-are-made', n: '03', label: 'How an article is made' },
  { id: 'airline-verification', n: '04', label: 'Airline fact verification' },
  { id: 'rankings', n: '05', label: '“Best of” lists and rankings' },
  { id: 'corrections', n: '06', label: 'Corrections' },
  { id: 'affiliate-independence', n: '07', label: 'Affiliate links' },
  { id: 'updates', n: '08', label: 'Keeping pages current' },
  { id: 'who-runs-originfacts', n: '09', label: 'Who runs Originfacts' },
];

const PRINCIPLES = [
  {
    title: 'Origin-first context',
    text: 'Every destination has a history, culture and geographic context. Before recommending where to stay or how to fly, our articles look at the place itself — its history, culture and local reality — so travel decisions rest on an understanding of where you are going.',
    anchor: 'why-focus-on-origin-first-travel-insights',
  },
  {
    title: 'Fact-grounded',
    text: 'Travel details change quickly. We focus on facts that can be checked — flight routes, airport facilities, visa requirements, hotel locations and fare patterns — and do not publish travel rumours or misleading clickbait.',
    anchor: 'how-do-we-ensure-fact-grounded-travel-information',
  },
  {
    title: 'Open about money',
    text: 'Originfacts is an independent publication supported by affiliate partnerships. Commercial links are disclosed, and chapter 07 sets out what they can and cannot change.',
    anchor: null,
  },
];

type SourceRow = { what: string; from: string; how: string };

const SOURCE_ROWS: SourceRow[] = [
  {
    what: 'Airline baggage, carry-on, fares, check-in and contact details',
    from: "The airline's own conditions of carriage and help pages",
    how: 'Checked by hand, figure by figure. Each published figure shows its source link and the date it was checked.',
  },
  {
    what: 'Passenger rights after delays and cancellations',
    from: 'Named regulators — for example the US Department of Transportation, the EU (EUR-Lex), the UK Civil Aviation Authority and the Australian Government',
    how: 'The airline page names the framework that may apply and links to the regulator. We do not assess individual claims.',
  },
  {
    what: 'Where an airline flies: routes, destinations, distances, aircraft types seen',
    from: 'The Originfacts route dataset, built from Travelpayouts route data',
    how: 'Labelled with its source and not verified by hand. It accumulates over time, so it is not a schedule or a current fleet list.',
  },
  {
    what: 'Airline identity and links to conditions of carriage',
    from: "Duffel's airline reference data",
    how: 'Used to identify the carrier and point you to its own terms.',
  },
  {
    what: 'Airlines that have stopped flying',
    from: 'Cessation dates recorded in Wikidata',
    how: 'Shown as a notice with a link to the Wikidata record. Very recent dates are held back until a person confirms them.',
  },
  {
    what: 'Flight prices and hotel results',
    from: 'Flight and hotel search partners, at the time of search',
    how: 'May be live, cached, estimated or currency-converted. Confirm the final price on the provider’s site.',
  },
  {
    what: 'Destinations, entry rules, health and safety in articles',
    from: 'Official sources such as national tourism authorities and government travel advisories',
    how: 'Consulted during research and editor review. Rules change; check the official source before you travel.',
  },
];

const OFFICIAL_REFERENCES = [
  { label: 'US DOT Air Consumer Protection', href: 'https://www.transportation.gov/airconsumer' },
  { label: 'EU air passenger rights', href: 'https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_en.htm' },
  { label: 'FAA PackSafe', href: 'https://www.faa.gov/hazmat/packsafe' },
  { label: 'CASA: Can I pack that?', href: 'https://www.casa.gov.au/passengers-and-can-i-pack-that' },
  { label: 'US State Department travel advisories', href: 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html' },
  { label: 'Smartraveller (Australia)', href: 'https://www.smartraveller.gov.au/' },
  { label: 'CDC Travelers’ Health', href: 'https://wwwnc.cdc.gov/travel' },
  { label: 'WHO international travel and health', href: 'https://www.who.int/ith' },
];

const PROCESS = [
  {
    title: 'Topic selection',
    text: 'Editors choose topics from a planned list, based on reader interest, route changes, seasonal travel and destination queries.',
  },
  {
    title: 'AI-assisted research and drafting',
    text: 'A large language model, given a brief, our editorial guidelines and structured prompts, helps compile research and writes a first draft. AI also helps organise large datasets, such as airport facilities or historical timelines.',
  },
  {
    title: 'Saved as a draft',
    text: 'Drafts are checked against our writing rules — for example, no claims of hands-on testing or first-hand stays — and are saved unpublished.',
  },
  {
    title: 'Editor review',
    text: 'A human editor reviews the draft, checks the details most likely to be wrong, such as prices and policies, refines the language and publishes it under a named byline. No automated output is published without that review.',
  },
  {
    title: 'Images',
    text: 'Cover images are often made with generative image models; real photographs are used where licensing permits. AI-generated images illustrate a concept and are never meant to show a specific hotel, aircraft, price or person.',
  },
];

const FACT_STATUSES = [
  { status: 'official', meaning: "From the airline's own published page or a named regulator", shown: 'Published, with source link and date' },
  { status: 'third_party', meaning: 'From an aggregator, encyclopedia or blog — plausible, unconfirmed', shown: 'Not published' },
  { status: 'disputed', meaning: 'Credible sources disagree', shown: 'Not published — both readings shown' },
  { status: 'pending', meaning: 'Not yet researched, or the lookup failed', shown: 'Not published' },
  { status: 'n/a', meaning: 'Does not apply to this carrier', shown: 'Not published' },
];

const WE_DO_NOT = ['Hands-on product testing', 'Mystery shopping', 'Paid stays'];

const RELATED = [
  { href: '/about', label: 'About Originfacts', note: 'What we cover and how the site earns money' },
  { href: '/faq', label: 'FAQ', note: 'Prices, airline data, corrections and privacy' },
  { href: '/authors', label: 'Our editors', note: 'Who reviews and signs our articles' },
  { href: '/contact', label: 'Contact', note: 'Every way to reach us' },
  { href: '/legal/affiliate-disclosure', label: 'Affiliate disclosure', note: 'Partners and what they can affect' },
];

const fmt = (n: number) => n.toLocaleString('en-GB');
const plural = (n: number, one: string, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;

/* ------------------------------------------------------------------ */

export default async function MethodologyPage() {
  const data = await loadMethodologyData();
  const { facts } = data;

  // Counted, never typed: see components/methodology/data.ts.
  const stats = [
    data.articles > 0 ? { value: fmt(data.articles), label: 'published articles' } : null,
    data.directoryAirlines > 0 ? { value: fmt(data.directoryAirlines), label: 'airlines in the directory' } : null,
    data.verifiedGuides > 0 ? { value: fmt(data.verifiedGuides), label: 'verified airline policy guides' } : null,
    facts.carriersWithVerified > 0 ? { value: fmt(facts.carriersWithVerified), label: 'airlines with hand-checked figures' } : null,
  ].filter((s): s is { value: string; label: string } => s !== null);

  return (
    <article className="overflow-x-clip" data-testid="methodology-page">
      <JsonLd data={organizationJsonLd({ withContactPoint: true })} />
      <JsonLd data={methodologyPageJsonLd} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Methodology', url: '/methodology' }])} />

      {/* ---------------- Hero ---------------- */}
      <header className="mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16" data-testid="methodology-hero">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
          <div className="min-w-0">
            <p className="eyebrow-tag">Methodology</p>
            <h1 className="mt-5 text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">
              How we research and write
            </h1>
            <p className="mt-6 text-xl font-semibold leading-snug text-forest-900 sm:text-2xl">
              Originfacts separates what we have checked from what we have not, and says which is which on the page.
            </p>
            <p className="mt-5 text-base leading-relaxed text-forest-900/75">
              Airline baggage and policy figures are published only where a person has checked them by hand against the
              carrier&apos;s own documentation; those carry a source link and the date they were checked. Figures our
              pipeline has collected but nobody has verified are held back rather than shown, because a plausible number
              presented as a fact is worse than no number.
            </p>
            <p className="mt-4 text-base leading-relaxed text-forest-900/75">
              Many articles are drafted with AI assistance; every one is reviewed by an editor before it is published under
              a named byline. Commercial links are disclosed, and they never decide what an airline page states as fact.
              When we get something wrong, tell us and it will be corrected or removed.
            </p>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold" data-testid="methodology-trust-links">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-emphasis underline-offset-2 hover:underline">
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <Link href="/about" className="text-forest-950 underline-offset-2 hover:underline">
                  About Originfacts →
                </Link>
              </li>
              <li>
                <Link href="/authors" className="text-forest-950 underline-offset-2 hover:underline">
                  Our editors →
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-forest-950 underline-offset-2 hover:underline">
                  Contact →
                </Link>
              </li>
            </ul>
          </div>

          <HeroLedger data={data} />
        </div>
      </header>

      {/* ---------------- Numbers ---------------- */}
      {stats.length > 0 && (
        <section aria-label="The methodology in numbers" className="border-y border-forest-900/15 bg-paper" data-testid="methodology-stats">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex min-w-0 flex-col-reverse border-l-2 border-primary-emphasis pl-4">
                <dt className="mt-2 text-xs font-bold uppercase tracking-widest text-forest-900/60">{s.label}</dt>
                <dd className="text-4xl font-bold leading-none text-forest-950 sm:text-5xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 pt-12 sm:px-6 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:gap-14 lg:pt-16">
        <aside className="min-w-0">
          <ChapterNav chapters={CHAPTERS} />
        </aside>

        <div className="min-w-0">
          {/* ---------------- 01 Principles ---------------- */}
          <Chapter id="principles" n="01" label="Principles" title="What do we hold ourselves to?" legacy={['1-what-are-our-core-editorial-principles']} first>
            <p className="max-w-3xl text-base leading-relaxed text-forest-900/80 sm:text-lg">
              Originfacts is a travel research and information site. We help readers understand both the origin stories
              behind places and the practical realities of planning a trip to them today.
            </p>
            <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
              {PRINCIPLES.map((p, i) => (
                <div key={p.title} className="min-w-0 border-t-2 border-forest-950 pt-4">
                  {p.anchor && <LegacyAnchor id={p.anchor} />}
                  <p className="font-mono text-xs font-bold text-forest-900/50">0{i + 1}</p>
                  <h3 className="mt-2 text-lg font-bold leading-snug text-forest-950">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-forest-900/75">{p.text}</p>
                </div>
              ))}
            </div>
          </Chapter>

          {/* ---------------- 02 Sources ---------------- */}
          <Chapter id="sources" n="02" label="Sources" title="Where does our information come from?" legacy={['2-how-do-we-research-and-verify-travel-data']}>
            <p className="max-w-3xl text-base leading-relaxed text-forest-900/80 sm:text-lg">
              Different kinds of information come from different places, and they are not all checked the same way. This
              is what each one rests on.
            </p>
            <dl className="mt-8 divide-y divide-forest-900/10 border-y border-forest-900/15" data-testid="methodology-sources">
              {SOURCE_ROWS.map((row) => (
                <div key={row.what} className="grid grid-cols-1 gap-2 py-5 md:grid-cols-[minmax(0,4fr)_minmax(0,5fr)] md:gap-8">
                  <dt className="min-w-0 text-base font-bold leading-snug text-forest-950">{row.what}</dt>
                  <dd className="min-w-0 text-sm leading-relaxed text-forest-900/80">
                    <span className="block font-semibold text-forest-950">{row.from}</span>
                    <span className="mt-1 block">{row.how}</span>
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="min-w-0 rounded-[0.3rem] border-l-4 border-secondary-emphasis bg-secondary p-6" data-testid="methodology-articles-vs-airlines">
                <h3 className="text-lg font-bold leading-snug text-forest-950">Articles and airline pages are checked differently</h3>
                <p className="mt-3 text-sm leading-relaxed text-forest-900/80">
                  Airline pages carry provenance for each figure: the page it came from and the day it was checked. Articles
                  do not. In an article, an editor checks the key details — transport options, baggage rules, visa
                  prerequisites, peak travel windows — against official sources where one exists, but individual sentences
                  do not carry their own source stamp.
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-forest-900/60">Official references we consult</p>
                <p className="mt-2 text-sm leading-relaxed text-forest-900/75">
                  For passenger rights, safety rules, entry requirements and health. We do not import their data — check the
                  latest version at the source.
                </p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {OFFICIAL_REFERENCES.map((r) => (
                    <li key={r.href} className="min-w-0">
                      <a
                        href={r.href}
                        rel="noopener"
                        className="inline-block rounded-full border border-forest-900/15 bg-white px-3 py-1.5 text-sm text-forest-900/80 hover:border-primary-emphasis/40 hover:text-primary-emphasis"
                      >
                        {r.label} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Chapter>

          {/* ---------------- 03 Production ---------------- */}
          <Chapter
            id="how-articles-are-made"
            n="03"
            label="AI and editors"
            title="How is an article made?"
            legacy={['3-how-do-we-use-responsible-ai-and-human-governance']}
          >
            <p className="max-w-3xl text-base leading-relaxed text-forest-900/80 sm:text-lg">
              Originfacts uses AI tools to help with research, data organisation and first drafts. Every article is reviewed
              and approved by a human editor before it is published.
            </p>
            <ol className="mt-10 grid grid-cols-1" data-testid="methodology-process">
              {PROCESS.map((step, i) => (
                <li key={step.title} className="relative min-w-0 pb-8 pl-16 last:pb-0">
                  {i < PROCESS.length - 1 && <span aria-hidden className="absolute left-5 top-10 h-[calc(100%-2.5rem)] w-px bg-forest-900/15" />}
                  <span className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary-emphasis text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="pt-2 text-lg font-bold leading-snug text-forest-950">{step.title}</h3>
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-forest-900/75">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-12">
              <PullQuote>We use AI to research and structure content faster — not as a way to publish without human judgement.</PullQuote>
              <p className="text-base leading-relaxed text-forest-900/80">
                Every article carries a named byline. Our editors and their areas of focus are listed on the{' '}
                <Link href="/authors" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                  authors page
                </Link>
                .
              </p>
            </div>
          </Chapter>

          {/* ---------------- 04 Airline verification ---------------- */}
          <Chapter
            id="airline-verification"
            n="04"
            label="Airline facts"
            title="How are airline facts verified?"
            legacy={['how-airline-reference-pages-are-verified']}
          >
            <p className="max-w-3xl text-base leading-relaxed text-forest-900/80 sm:text-lg">
              Airline pages are built from a fact store in which every figure carries its own status, and only one status
              publishes. A section of an airline page appears only when every figure it needs is verified; until then it
              says so, rather than showing an estimate or a number copied from another website.
            </p>

            <VerificationStates data={data} />

            {facts.official > 0 && (
              <p className="mt-6 max-w-3xl text-sm leading-relaxed text-forest-900/70" data-testid="methodology-fact-counts">
                Right now {plural(facts.official, 'figure')} across {plural(facts.carriersWithVerified, 'airline')}{' '}
                {facts.official === 1 ? 'is' : 'are'} published this way. {fmt(facts.pending)} more{' '}
                {facts.pending === 1 ? 'is' : 'are'} held back as not yet verified
                {facts.disputed > 0 ? `, and ${fmt(facts.disputed)} ${facts.disputed === 1 ? 'is' : 'are'} shown as a conflict between sources` : ''}.
              </p>
            )}

            <div className="mt-10 overflow-hidden rounded-[0.3rem] border border-forest-900/15" data-testid="methodology-status-table">
              <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,5fr)_minmax(0,4fr)] gap-4 bg-forest-950 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white/80 md:grid">
                <span>Status</span>
                <span>Meaning</span>
                <span>On the page</span>
              </div>
              <dl className="divide-y divide-forest-900/10">
                {FACT_STATUSES.map((s) => (
                  <div key={s.status} className="grid grid-cols-1 gap-1 px-5 py-4 md:grid-cols-[minmax(0,2fr)_minmax(0,5fr)_minmax(0,4fr)] md:gap-4">
                    <dt className="font-mono text-sm font-bold text-forest-950">{s.status}</dt>
                    <dd className="text-sm leading-relaxed text-forest-900/80">{s.meaning}</dd>
                    <dd
                      className={`text-sm font-semibold ${
                        s.status === 'official' ? 'text-emerald-800' : s.status === 'disputed' ? 'text-amber-900' : 'text-forest-900/70'
                      }`}
                    >
                      {s.shown}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
              <SubBlock id="how-we-label-airlines-that-no-longer-fly" title="Airlines that no longer fly">
                The directory includes carriers that have ceased operations. Each of those pages carries a notice with the
                cessation date recorded in Wikidata and a link to that record, and the flight-booking tools are removed.
                Carriers whose status we cannot source are shown without a label rather than guessed at.
              </SubBlock>
              <SubBlock id="what-our-directory-does-not-include" title="Who is not in the directory">
                Organisations that hold an IATA designator but do not operate flights — railways, ferry operators,
                reservation-system vendors, trade bodies and military units — are excluded. Cargo-only carriers are not
                listed either.
              </SubBlock>
              <SubBlock title="Route data is not a fleet list">
                “Where they fly” figures come from our route dataset, which accumulates over time. It can name aircraft
                types an airline has retired and miss recent additions, so check the airline&apos;s own site for current
                schedules and aircraft.
              </SubBlock>
            </div>
          </Chapter>

          {/* ---------------- 05 Rankings ---------------- */}
          <Chapter
            id="rankings"
            n="05"
            label="Rankings"
            title="What does a “best” or “top” list mean here?"
            legacy={['6-how-do-we-rank-review-and-label-what-we-publish', 'what-a-quotbestquot-quottopquot-or-quotpicksquot-list-means-on-originfacts']}
          >
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-12">
              <div className="min-w-0 space-y-4 text-base leading-relaxed text-forest-900/80">
                <p>
                  Ranked and “best of” articles are editorial selections. They are compiled from published fare and route
                  data, official airline and hotel policies and the sources described in{' '}
                  <a href="#sources" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                    chapter 02
                  </a>
                  , then reviewed by an editor.
                </p>
                <p>
                  We do not use words like “tested” in a title unless the article body describes exactly what was tested,
                  by whom and when. Words such as “cheapest” or “popular” depend on the data available at the time and on
                  editorial judgement, and we may not compare every provider in the market.
                </p>
                <p className="text-sm text-forest-900/70">
                  How commercial relationships can affect what appears on a page is covered in{' '}
                  <a href="#affiliate-independence" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                    chapter 07
                  </a>
                  .
                </p>
              </div>
              <div className="min-w-0 self-start rounded-[0.3rem] bg-forest-950 p-6 text-white sm:p-8" data-testid="methodology-we-do-not">
                <p className="text-xs font-bold uppercase tracking-widest text-sand-300">What we don&apos;t do</p>
                <ul className="mt-5 space-y-3">
                  {WE_DO_NOT.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-xl font-bold leading-snug !text-white">
                      <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/30 text-sm text-sand-300">
                        ✕
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm leading-relaxed text-white/75">
                  Our lists are not the result of any of these. They are research and editorial judgement, and we say so.
                </p>
              </div>
            </div>
          </Chapter>

          {/* ---------------- 06 Corrections ---------------- */}
          <Chapter
            id="corrections"
            n="06"
            label="Corrections"
            title="How do I report an error?"
            legacy={['5-how-can-readers-submit-feedback-amp-corrections']}
          >
            <p className="max-w-3xl text-base leading-relaxed text-forest-900/80 sm:text-lg">
              If you notice an outdated route, an incorrect airport code or a typo, tell us. Send the page URL, the exact
              text that looks wrong and a source we can verify. When something is wrong, it is corrected or removed.
            </p>
            <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="methodology-correction-routes">
              <RouteCard kicker="Editorial email" title={CONTACT_EMAIL} href={`mailto:${CONTACT_EMAIL}`} text="Corrections, feedback and editorial questions." />
              <RouteCard kicker="Online form" title="Report an error" href={contactHref('correction')} text="The contact form, with the subject set for a correction." />
              <RouteCard kicker="Company enquiries" title={SUPPORT_EMAIL} href={`mailto:${SUPPORT_EMAIL}`} text="Questions for FXN Holdings, the operator." />
            </ul>
            <p className="mt-6 max-w-3xl text-sm leading-relaxed text-forest-900/70">
              On airline pages, a corrected figure is re-checked against the airline&apos;s own page and gets a new source
              link and check date; a changed value never keeps the old stamp. More in the{' '}
              <Link href="/faq#report-an-error" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                FAQ
              </Link>
              .
            </p>
          </Chapter>

          {/* ---------------- 07 Affiliate ---------------- */}
          <Chapter
            id="affiliate-independence"
            n="07"
            label="Affiliate links"
            title="What can affiliate links change, and what can’t they?"
            legacy={['how-do-we-maintain-commercial-transparency']}
          >
            <p className="max-w-3xl text-base leading-relaxed text-forest-900/80 sm:text-lg">
              Originfacts is supported by affiliate partnerships. When you click a link for a flight search or a hotel
              booking, we may earn a commission, usually at no extra cost to you.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="min-w-0 rounded-[0.3rem] border-2 border-forest-950 p-6" data-testid="methodology-affiliate-cannot">
                <p className="text-xs font-bold uppercase tracking-widest text-forest-900/60">Commission does not decide</p>
                <ul className="mt-4 space-y-2.5 text-base font-semibold text-forest-950">
                  <Check>Which airline figures are published, or their status</Check>
                  <Check>Whether an error is corrected</Check>
                  <Check>What our articles state as fact</Check>
                </ul>
              </div>
              <div className="min-w-0 rounded-[0.3rem] bg-sand-100 p-6" data-testid="methodology-affiliate-can">
                <p className="text-xs font-bold uppercase tracking-widest text-forest-900/60">It can influence</p>
                <ul className="mt-4 list-disc space-y-2.5 pl-5 text-base text-forest-900/85">
                  <li>Which providers, links, widgets or offers appear on a page</li>
                  <li>Whether a link earns us a commission</li>
                  <li>How some results are displayed, where this is disclosed</li>
                </ul>
              </div>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-forest-900/70">
              The full details, including our partners, are in the{' '}
              <Link href="/legal/affiliate-disclosure" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                affiliate disclosure
              </Link>{' '}
              and on the{' '}
              <Link href="/about" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                About page
              </Link>
              .
            </p>
          </Chapter>

          {/* ---------------- 08 Updates ---------------- */}
          <Chapter id="updates" n="08" label="Updates" title="How are pages kept current?">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="min-w-0 border-t-2 border-forest-950 pt-4">
                <h3 className="text-lg font-bold leading-snug text-forest-950">Airline pages</h3>
                <p className="mt-2 text-sm leading-relaxed text-forest-900/75">
                  Every published figure shows the date it was checked, so you can see how old it is. When a figure is
                  re-checked it gets a new source link and date.
                </p>
              </div>
              <div className="min-w-0 border-t-2 border-forest-950 pt-4">
                <h3 className="text-lg font-bold leading-snug text-forest-950">Articles</h3>
                <p className="mt-2 text-sm leading-relaxed text-forest-900/75">
                  We revisit articles as routes, carrier policies, airport facilities and prices change, and when readers
                  report a problem. There is no fixed re-check schedule for every article.
                </p>
              </div>
            </div>
            <div className="mt-8 rounded-[0.3rem] border-l-4 border-secondary-emphasis bg-secondary p-6">
              <p className="text-base leading-relaxed text-forest-900/85">
                Facts that change often — prices, routes, visa rules and fees — are the most likely to go out of date.
                Confirm them with the provider or an official source before you book or travel. Originfacts is general
                information, not travel, visa or legal advice; see the{' '}
                <Link href="/legal/disclaimer" className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
                  disclaimer
                </Link>
                .
              </p>
            </div>
          </Chapter>

          {/* ---------------- 09 Operator ---------------- */}
          <Chapter
            id="who-runs-originfacts"
            n="09"
            label="Operator"
            title="Who runs Originfacts?"
            legacy={['4-who-owns-and-operates-originfacts']}
          >
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="min-w-0 rounded-[0.3rem] bg-forest-950 p-6 text-white sm:p-8" data-testid="methodology-operator">
                <p className="text-xs font-bold uppercase tracking-widest text-sand-300">Owned and operated by</p>
                <p className="mt-2 text-2xl font-bold !text-white">FXN Holdings</p>
                <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-y-3">
                  <OperatorRow label="ABN">53 274 423 748</OperatorRow>
                  <OperatorRow label="Mailing address">PO Box 500, WEST PERTH WA 6872, Australia</OperatorRow>
                  <OperatorRow label="Editorial">
                    <a href={`mailto:${CONTACT_EMAIL}`} className="underline-offset-2 hover:underline">
                      {CONTACT_EMAIL}
                    </a>
                  </OperatorRow>
                  <OperatorRow label="Company">
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="underline-offset-2 hover:underline">
                      {SUPPORT_EMAIL}
                    </a>
                  </OperatorRow>
                </dl>
                <p className="mt-6 border-t border-white/15 pt-5 text-sm leading-relaxed text-white/75">
                  How we handle personal data is set out in our{' '}
                  <Link href="/legal/privacy" className="font-semibold text-white underline underline-offset-2">
                    privacy policy
                  </Link>
                  .
                </p>
              </div>
              <nav aria-label="Related pages" className="min-w-0 self-start" data-testid="methodology-related">
                <p className="text-xs font-bold uppercase tracking-widest text-forest-900/60">Related</p>
                <ul className="mt-4 divide-y divide-forest-900/10 border-y border-forest-900/15">
                  {RELATED.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="group flex items-baseline justify-between gap-4 py-3.5">
                        <span className="min-w-0">
                          <span className="block font-bold text-forest-950 group-hover:text-primary-emphasis">{l.label}</span>
                          <span className="block text-sm text-forest-900/65">{l.note}</span>
                        </span>
                        <span aria-hidden className="text-primary-emphasis">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </Chapter>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */

function Chapter({
  id,
  n,
  label,
  title,
  legacy = [],
  first = false,
  children,
}: {
  id: string;
  n: string;
  label: string;
  title: string;
  legacy?: string[];
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-24 ${first ? 'pb-16 sm:pb-20' : 'border-t border-forest-900/15 py-16 sm:py-20'}`}
      data-testid={`methodology-${id}`}
    >
      {legacy.map((a) => (
        <LegacyAnchor key={a} id={a} />
      ))}
      <Kicker n={n} label={label} />
      <h2 id={`${id}-title`} className="mt-3 max-w-3xl text-3xl font-bold leading-tight text-forest-950 sm:text-4xl">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Ids from the old Markdown headings, kept so existing deep links still land. */
function LegacyAnchor({ id }: { id: string }) {
  return <span id={id} aria-hidden className="block scroll-mt-24" />;
}

function Kicker({ n, label }: { n: string; label: string }) {
  return (
    <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-primary-emphasis">
      <span className="font-mono text-forest-900/45">{n}</span>
      <span aria-hidden className="h-px w-8 bg-primary-emphasis/40" />
      {label}
    </p>
  );
}

function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="border-l-4 border-primary-emphasis pl-5">
      <p className="text-xl font-bold leading-snug text-forest-950 sm:text-2xl">“{children}”</p>
    </blockquote>
  );
}

function SubBlock({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-t-2 border-forest-950 pt-4">
      {id && <LegacyAnchor id={id} />}
      <h3 className="text-lg font-bold leading-snug text-forest-950">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-forest-900/75">{children}</p>
    </div>
  );
}

function RouteCard({ kicker, title, href, text }: { kicker: string; title: string; href: string; text: string }) {
  const cls =
    'group flex h-full flex-col rounded-[0.3rem] border border-forest-900/15 bg-white p-5 transition hover:border-primary-emphasis/40 hover:shadow-md';
  const body = (
    <>
      <span className="text-xs font-bold uppercase tracking-widest text-forest-900/60">{kicker}</span>
      <span className="mt-2 break-words text-lg font-bold leading-snug text-forest-950 group-hover:text-primary-emphasis">{title}</span>
      <span className="mt-2 text-sm leading-relaxed text-forest-900/75">{text}</span>
    </>
  );
  return (
    <li className="min-w-0">
      {href.startsWith('/') ? (
        <Link href={href} className={cls}>
          {body}
        </Link>
      ) : (
        <a href={href} className={cls}>
          {body}
        </a>
      )}
    </li>
  );
}

function OperatorRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="mt-3 text-xs font-bold uppercase tracking-wider text-white/55 sm:mt-0 sm:pt-0.5">{label}</dt>
      <dd className="break-words">{children}</dd>
    </>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-emphasis text-xs text-white">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* The three states a reader meets on an airline page. Badges, colours */
/* and wording mirror components/airline-v2/AirlineGuideV2.tsx.       */
/* ------------------------------------------------------------------ */

type BadgeTone = 'verified' | 'pending' | 'disputed';

function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  const cls: Record<BadgeTone, string> = {
    verified: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    pending: 'border-slate-300 bg-white text-slate-700',
    disputed: 'border-amber-300 bg-amber-50 text-amber-900',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${cls[tone]}`}>
      {tone === 'verified' && <CheckIcon className="h-3.5 w-3.5" />}
      {tone === 'disputed' && <WarnIcon />}
      {tone === 'pending' && <span aria-hidden className="h-2 w-2 rounded-full border border-slate-500" />}
      {children}
    </span>
  );
}

function VerificationStates({ data }: { data: MethodologyData }) {
  const { verified, pending, disputed } = data.examples;
  return (
    <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3" data-testid="methodology-states">
      {/* Verified */}
      <div className="flex min-w-0 flex-col rounded-[0.3rem] border border-forest-900/15 bg-white p-5" data-testid="methodology-state-verified">
        <div>
          <Badge tone="verified">{verified ? `Verified ${verified.date}` : 'Verified'}</Badge>
        </div>
        <h3 className="mt-4 text-lg font-bold leading-snug text-forest-950">Published, with its source</h3>
        <p className="mt-2 text-sm leading-relaxed text-forest-900/75">
          Read off the airline&apos;s own page or a named regulator, checked by hand, and shown with the source link and
          the date it was checked.
        </p>
        {verified && (
          <div className="mt-auto pt-5">
            <div className="rounded-[0.3rem] border border-forest-900/10 bg-paper p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-forest-900/60">{verified.label}</p>
              <p className="mt-1 break-words text-base font-semibold text-forest-950">{verified.value}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-forest-900/75">
                <CheckIcon className="h-3.5 w-3.5 text-emerald-700" />
                <span>Verified {verified.date}</span>
                <span aria-hidden>·</span>
                <a href={verified.sourceUrl} rel="noopener" className="underline underline-offset-2 hover:text-primary-emphasis">
                  {verified.host}
                </a>
              </p>
            </div>
            <ExampleLink slug={verified.slug} airline={verified.airline} />
          </div>
        )}
      </div>

      {/* Not yet verified */}
      <div className="flex min-w-0 flex-col rounded-[0.3rem] border border-dashed border-forest-900/25 bg-forest-50/40 p-5" data-testid="methodology-state-pending">
        <div>
          <Badge tone="pending">Not yet verified</Badge>
        </div>
        <h3 className="mt-4 text-lg font-bold leading-snug text-forest-950">Held back</h3>
        <p className="mt-2 text-sm leading-relaxed text-forest-900/75">
          Nobody has confirmed it against an official source yet, or the lookup failed. The section stays unpublished and
          lists what is still to check. A figure that cannot be traced to an official source is left blank rather than
          estimated.
        </p>
        {pending && (
          <div className="mt-auto pt-5">
            <div className="rounded-[0.3rem] border border-forest-900/10 bg-white/70 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-forest-900/60">{pending.section}</p>
              <p className="mt-1 text-sm text-forest-900/75">
                <span className="font-semibold text-forest-950">Still to check:</span> {pending.stillToCheck.join(', ')}.
              </p>
            </div>
            <ExampleLink slug={pending.slug} airline={pending.airline} />
          </div>
        )}
      </div>

      {/* Sources disagree */}
      <div className="flex min-w-0 flex-col rounded-[0.3rem] border border-amber-300 bg-white p-5" data-testid="methodology-state-disputed">
        <div>
          <Badge tone="disputed">Sources disagree</Badge>
        </div>
        <h3 className="mt-4 text-lg font-bold leading-snug text-forest-950">Both readings shown</h3>
        <p className="mt-2 text-sm leading-relaxed text-forest-900/75">
          Where credible sources give different answers, both values are shown and neither is presented as settled.
        </p>
        {disputed && (
          <div className="mt-auto pt-5">
            <div className="rounded-[0.3rem] border border-amber-300 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <WarnIcon />
                Sources disagree: {disputed.label.toLowerCase()}
              </p>
              <ul className="mt-2 space-y-1.5 text-sm leading-6 text-forest-950">
                {disputed.readings.map((v, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="text-amber-700">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="min-w-0 break-words">{v}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-900">
                Neither value is published until the airline’s own pages agree. Check with the airline before you fly.
              </p>
            </div>
            <ExampleLink slug={disputed.slug} airline={disputed.airline} />
          </div>
        )}
      </div>
    </div>
  );
}

function ExampleLink({ slug, airline }: { slug: string; airline: string }) {
  return (
    <Link href={`/airlines/${slug}`} className="mt-3 inline-block text-xs font-bold uppercase tracking-widest text-primary-emphasis hover:underline">
      Real example: {airline} →
    </Link>
  );
}

/** Hero companion: the three states with today's counts — typographic rather than photographic. */
function HeroLedger({ data }: { data: MethodologyData }) {
  const { facts } = data;
  const hasCounts = facts.official + facts.pending + facts.disputed > 0;
  const rows = [
    { tone: 'verified' as const, label: 'Verified', count: facts.official, note: 'published with a source link and check date' },
    { tone: 'pending' as const, label: 'Not yet verified', count: facts.pending, note: 'held back until someone checks them' },
    { tone: 'disputed' as const, label: 'Sources disagree', count: facts.disputed, note: 'shown as a conflict, not an answer' },
  ];
  return (
    <div className="min-w-0 rounded-[0.3rem] bg-forest-950 p-6 text-white sm:p-8" data-testid="methodology-ledger">
      <p className="text-xs font-bold uppercase tracking-widest text-sand-300">Airline figures, today</p>
      <p className="mt-2 text-sm leading-relaxed text-white/75">
        Every figure in our airline fact store carries one of these labels. Only one of them reaches the page as a fact.
      </p>
      <ul className="mt-6 space-y-4">
        {rows.map((r) => (
          <li key={r.label} className="flex min-w-0 items-center gap-4 border-t border-white/15 pt-4">
            {hasCounts && <span className="w-20 shrink-0 text-3xl font-bold leading-none !text-white sm:w-24 sm:text-4xl">{fmt(r.count)}</span>}
            <span className="min-w-0">
              <Badge tone={r.tone}>{r.label}</Badge>
              <span className="mt-1.5 block text-sm text-white/70">{r.note}</span>
            </span>
          </li>
        ))}
      </ul>
      <a href="#airline-verification" className="mt-6 inline-block text-xs font-bold uppercase tracking-widest text-white/80 hover:text-white">
        How verification works →
      </a>
    </div>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m3.5 8.2 2.8 2.7 6.2-6" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2.5 14.5 13.5h-13L8 2.5Z" />
      <path d="M8 6.5v3M8 11.6v.1" />
    </svg>
  );
}
