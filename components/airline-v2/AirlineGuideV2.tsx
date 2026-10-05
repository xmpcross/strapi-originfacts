import Link from 'next/link';
import type { ReactNode } from 'react';
import type { StrapiAirline } from '@/lib/strapi';
import { mediaUrl } from '@/lib/strapi';
import type { RouteFacts } from '@/lib/route-facts';
import type { AirlineFactsFile, FactField, ResolvedField, ResolvedModule } from '@/lib/airline-facts';
import type { AirlineRef } from '@/lib/airline-refs';
import { AIRLINE_REF_SOURCE } from '@/lib/airline-refs';
import {
  cabinsModule,
  derivedFaqs,
  formatDate,
  getAirportIata,
  networkModule,
  PENDING_COPY,
  type DerivedModule,
} from '@/components/airline-tier1/AirlineTier1';
import SectionNav, { type NavItem, type NavStatus } from './SectionNav';
import {
  GLANCE_TILES,
  dateRange,
  factFaqs,
  fieldLabel,
  glanceGap,
  glanceHasValues,
  glanceValues,
  loadModules,
  publishedField,
  sharedSource,
  shownFields,
  sourceHost,
  sourcePath,
  splitCabinFields,
  telHref,
  type ModuleEntry,
} from './facts-view';
import s from './AirlineGuideV2.module.css';

/**
 * Airline reference page, v2 layout. Rendered only for slugs in
 * lib/airline-template-v2.ts; every other carrier keeps AirlineTier1.
 *
 * The data contract is unchanged from AirlineTier1 and is not re-implemented
 * here: fact-file modules go through resolveModule, derived modules come from
 * the same builders (cabinsModule, networkModule, derivedFaqs). What changed is
 * presentation:
 *
 *   - only `official` fields in published modules print as facts;
 *   - every printed fact carries its source and verification date, once per
 *     section when all of its facts share a page, otherwise per fact;
 *   - unpublished modules render a compact "not yet verified" state that names
 *     what is missing and never prints a pending value;
 *   - disputed fields render both readings and publish neither;
 *   - dataset-derived sections carry their vintage and a different badge, and
 *     are never counted or styled as verified.
 *
 * No copy here makes a claim about the airline. Every number comes from the
 * fact file or the route dataset; the surrounding sentences only describe
 * where a figure came from or what is still unchecked.
 */

export type AirlineGuideV2Props = {
  airline: StrapiAirline;
  routeFacts: RouteFacts | null;
  facts: AirlineFactsFile | null;
  alliance: string | null;
  airlineRef: AirlineRef | null;
  /** Same list the page marks up as FAQPage — built by guideFaqs(). */
  faqs: { q: string; a: string }[];
};

/** FAQ for the v2 page: verbatim answers from published facts, then the dataset FAQs. */
export function guideFaqs(
  airline: StrapiAirline,
  routeFacts: RouteFacts | null,
  alliance: string | null,
  facts: AirlineFactsFile | null,
): { q: string; a: string }[] {
  return [...factFaqs(airline.name, loadModules(facts)), ...derivedFaqs(airline, routeFacts, alliance, true)];
}

type SectionState =
  | { kind: 'sourced'; module: ResolvedModule }
  | { kind: 'derived'; module: DerivedModule }
  | { kind: 'pending'; module: ResolvedModule | null }
  | { kind: 'disputed'; module: ResolvedModule };

type SectionDef = { id: string; nav: string; title: string; from: 'facts' | 'derived' | 'either' };

/**
 * Page gutter. 16px on phones; from `lg` the side padding clears the site's
 * fixed "Scroll to top" (left) and "Follow" (right) widgets, which sit 50px in
 * from each edge and would otherwise overlap the nav and the section badges.
 */
const WRAP = 'mx-auto max-w-7xl px-4 sm:px-6';

/** Header facts fill the row whatever subset is present — no empty grey cell. */
const FACT_COLS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' };

/** Extra pending copy for sections AirlineTier1 has no wording for. */
const PENDING_EXTRA: Record<string, string> = {
  cabins: 'Cabin names, seat options and onboard details have not been verified against the airline’s published pages yet.',
  contact: 'Customer service numbers and contact routes have not been verified against the airline’s own contact pages yet.',
};

export default function AirlineGuideV2({ airline, routeFacts: rf, facts, alliance, airlineRef, faqs }: AirlineGuideV2Props) {
  const name = airline.name;
  const modules = loadModules(facts);
  const logo = mediaUrl(airline.logo ?? null);
  const officialSite = normaliseUrl(facts?.official_website || airline.website || null);
  const cabinsDerived = cabinsModule(airline, rf);
  const network = networkModule(airline, rf, true);

  const defs: SectionDef[] = [
    { id: 'carryon', nav: 'Carry-on', title: `${name} carry-on baggage allowance`, from: 'facts' },
    { id: 'baggage', nav: 'Checked bags', title: `${name} checked baggage allowance`, from: 'facts' },
    { id: 'fares', nav: 'Cheapest fare', title: `What ${name}’s cheapest fare includes`, from: 'facts' },
    { id: 'cabins', nav: 'Cabins & aircraft', title: `${name} cabins and aircraft`, from: 'either' },
    { id: 'rights', nav: 'Delays & cancellations', title: `If your ${name} flight is delayed or cancelled`, from: 'facts' },
    { id: 'checkin', nav: 'Check-in', title: `${name} check-in times and airport cut-offs`, from: 'facts' },
    { id: 'contact', nav: 'Contact', title: `How to contact ${name}`, from: 'facts' },
  ];

  const sections = defs.map((def) => {
    const m = modules.get(def.id)?.resolved ?? null;
    let state: SectionState;
    if (m?.isPublished) state = { kind: 'sourced', module: m };
    else if (def.id === 'cabins' && cabinsDerived) state = { kind: 'derived', module: cabinsDerived };
    else if (m && m.disputes.length > 0) state = { kind: 'disputed', module: m };
    else state = { kind: 'pending', module: m };
    return { ...def, state };
  });

  const statusOf = (st: SectionState): NavStatus =>
    st.kind === 'sourced' ? 'verified' : st.kind === 'derived' ? 'data' : st.kind;

  const navItems: NavItem[] = [
    ...sections.map((sec) => ({ id: sec.id, label: sec.nav, status: statusOf(sec.state) })),
    ...(network ? [{ id: 'network', label: 'Where they fly', status: 'data' as const }] : []),
    ...(faqs.length ? [{ id: 'faq', label: 'FAQ', status: 'none' as const }] : []),
    { id: 'sources', label: 'Sources', status: 'none' },
  ];

  const verifiedSections = sections.filter((x) => x.state.kind === 'sourced');
  const derivedCount = sections.filter((x) => x.state.kind === 'derived').length + (network ? 1 : 0);
  const pendingCount = sections.filter((x) => x.state.kind === 'pending').length;
  const disputedCount = sections.filter(
    (x) => x.state.kind === 'disputed' || (x.state.kind === 'sourced' && x.state.module.disputes.length > 0),
  ).length;
  const verifiedRange = dateRange(
    verifiedSections.flatMap((x) => (x.state.kind === 'sourced' ? shownFields(x.state.module).map((f) => f.verified_at) : [])),
  );

  const showGlance = glanceHasValues(modules);
  const hubs = (rf?.topHubs ?? []).slice(0, 3);
  const dataVintage = rf ? formatDate(`${rf.updated}-01`) : null;
  const headerFactCount = [airline.country, alliance, hubs.length, rf?.destinationCount].filter(Boolean).length;

  return (
    <div className={`${s.root} bg-[#fbfcff]`} data-testid={`airline-page-${airline.slug}`} data-template="v2">
      {/* ---------------------------------------------------------- header */}
      <header className="border-b border-forest-900/10 bg-white">
        <div className={`${WRAP} pb-8 pt-6 lg:pb-10`}>
          <nav aria-label="Breadcrumb" className="text-sm text-forest-900/75">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/airlines" className="hover:text-primary-emphasis hover:underline">
                  Airlines
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="font-medium text-forest-950">
                {name}
              </li>
            </ol>
          </nav>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4 sm:gap-6">
              <div className="flex h-16 w-24 flex-none items-center justify-center border-0 bg-transparent sm:h-32 sm:w-52">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt={`${name} logo`} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xl font-bold text-forest-900/70">{(airline.iataCode || name).slice(0, 3)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-emphasis">Airline guide</p>
                <h1 className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-3xl leading-tight sm:text-4xl">
                  {name}
                  {airline.iataCode && (
                    <span className="rounded-[0.3rem] bg-forest-950 px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-white">
                      <span className="sr-only">IATA code </span>
                      {airline.iataCode}
                    </span>
                  )}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-forest-900/80">
                  {verifiedSections.length > 0
                    ? `Baggage allowances, fare rules, check-in cut-offs and contact details for ${name}. Policy figures are read from ${name}’s own published pages and each one shows where it came from and when we checked it.`
                    : `Baggage, fare, check-in and contact rules for ${name} have not been verified yet. Each section below says what is still to check and links to ${name}’s own site.`}
                </p>
              </div>
            </div>

            {officialSite && (
              <a
                href={officialSite}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex flex-none items-center justify-center gap-2 self-start rounded-[0.3rem] border border-forest-900/15 bg-white px-4 py-2.5 text-sm font-semibold text-forest-950 transition hover:border-primary-emphasis hover:text-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-emphasis"
              >
                {sourceHost(officialSite)}
                <ExternalIcon />
                <span className="sr-only">(official website, opens in a new tab)</span>
              </a>
            )}
          </div>

          <dl className={`mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-[0.3rem] border border-forest-900/10 bg-forest-900/10 max-sm:[&>div:last-child:nth-child(odd)]:col-span-2 ${FACT_COLS[headerFactCount] ?? 'sm:grid-cols-4'}`}>
            <HeaderFact label="Home country" value={airline.country} />
            <HeaderFact label="Alliance" value={alliance} />
            <HeaderFact
              label="Busiest markets"
              hint={hubs.length ? `By route count · route data ${dataVintage}` : undefined}
              value={
                hubs.length ? (
                  <span>
                    {hubs.map((h, i) => (
                      <span key={h.city}>
                        {i > 0 && ', '}
                        <AirportLink city={h.city} />
                      </span>
                    ))}
                  </span>
                ) : null
              }
            />
            <HeaderFact
              label="Destinations"
              hint={rf?.destinationCount ? `Route data ${dataVintage}` : undefined}
              value={rf?.destinationCount ? `${rf.destinationCount} in ${rf.countryCount} ${rf.countryCount === 1 ? 'country' : 'countries'}` : null}
            />
          </dl>

          {/* Verification summary — the page's differentiator, stated once, up front. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" data-testid="v2-ledger">
            {verifiedSections.length > 0 && (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
                <CheckIcon className="h-4 w-4" />
                {verifiedSections.length} of {sections.length} sections verified
                {verifiedRange && <span className="font-normal text-forest-900/75">· checked {verifiedRange}</span>}
              </span>
            )}
            {derivedCount > 0 && <span className="text-forest-900/75">{derivedCount} from route data</span>}
            {disputedCount > 0 && <span className="text-amber-800">{disputedCount} with conflicting sources</span>}
            {pendingCount > 0 && <span className="text-forest-900/75">{pendingCount} not yet verified</span>}
            <a href="#sources" className="text-primary-emphasis underline-offset-2 hover:underline">
              How we check
            </a>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------- at a glance */}
      {/* Left out when no tile has an official value: six "not yet verified"
          tiles would only repeat what the section cards below already say. */}
      {showGlance && (
        <section aria-labelledby="glance-title" className={`${WRAP} pt-8`} data-testid="v2-glance">
          <h2 id="glance-title" className="text-xl sm:text-2xl">
            {name} at a glance
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GLANCE_TILES.map((tile) => (
              <GlanceTileView key={tile.id} tile={tile} modules={modules} />
            ))}
          </ul>
        </section>
      )}

      {/* ---------------------------------------------------------- body */}
      <div className={`${WRAP} pb-16 pt-8 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10`}>
        <aside className="hidden lg:block">
          <SectionNav items={navItems} />
        </aside>

        <div className="min-w-0">
          {/* Phones and tablets: a wrapping chip list, never a horizontal scroller. */}
          <nav aria-label="On this page" className="mb-6 lg:hidden">
            <ul className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-forest-900/15 bg-white px-3 py-1.5 text-sm text-forest-950 hover:border-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-6">
            {sections.map((sec) => (
              <SectionView
                key={sec.id}
                id={sec.id}
                title={sec.title}
                state={sec.state}
                airline={airline}
                officialSite={officialSite}
                modules={modules}
                airlineRef={airlineRef}
                rf={rf}
              />
            ))}

            {network && rf && <NetworkSection airline={airline} rf={rf} module={network} />}

            {faqs.length > 0 && (
              <Shell id="faq" title={`Common questions about flying ${name}`}>
                <div className="divide-y divide-forest-900/10 rounded-[0.3rem] border border-forest-900/10">
                  {faqs.map((f, i) => (
                    <details key={i} open={i === 0} className="group">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-3.5 font-semibold text-forest-950 hover:bg-forest-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-emphasis [&::-webkit-details-marker]:hidden">
                        <span>{f.q}</span>
                        <span aria-hidden className="mt-0.5 flex-none text-forest-900/60 transition group-open:rotate-45">
                          +
                        </span>
                      </summary>
                      <p className="px-4 pb-4 text-[15px] leading-7 text-forest-900/85">{f.a}</p>
                    </details>
                  ))}
                </div>
              </Shell>
            )}

            <SourcesSection airline={airline} sections={sections} network={network} />

            <aside aria-labelledby="related-title" className="rounded-[0.3rem] border border-forest-900/10 bg-white p-5">
              <h2 id="related-title" className="text-lg">
                Keep planning
              </h2>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <li>
                  <Link href="/airlines" className="font-medium text-primary-emphasis hover:underline">
                    Airline directory
                  </Link>
                </li>
                <li>
                  <Link href="/flight-routes" className="font-medium text-primary-emphasis hover:underline">
                    Flight routes
                  </Link>
                </li>
                <li>
                  <Link href="/destinations" className="font-medium text-primary-emphasis hover:underline">
                    Destinations
                  </Link>
                </li>
              </ul>
              <p className="mt-4 text-sm leading-6 text-forest-900/75">
                Airline rules change without notice. Confirm on {name}’s own site before you travel.
              </p>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * Header bits
 * ================================================================== */

function HeaderFact({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="bg-white px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-900/70">{label}</dt>
      <dd className="mt-1 text-[15px] font-semibold text-forest-950">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-forest-900/70">{hint}</dd>}
    </div>
  );
}

function AirportLink({ city }: { city: string }) {
  const iata = getAirportIata(city);
  return iata ? (
    <Link href={`/airports/${iata}`} className="underline decoration-forest-900/25 underline-offset-2 hover:text-primary-emphasis">
      {city}
    </Link>
  ) : (
    <>{city}</>
  );
}

/* ================================================================== *
 * At a glance
 * ================================================================== */

function GlanceTileView({ tile, modules }: { tile: (typeof GLANCE_TILES)[number]; modules: Map<string, ModuleEntry> }) {
  const values = glanceValues(modules, tile);
  const shared = sharedSource(values.map((v) => v.field));

  if (!values.length) {
    // No short official value for this tile. Say why, link to the section, and
    // never print a pending or disputed value here.
    const gap = glanceGap(modules, tile);
    const copy = {
      disputed: { text: 'Sources disagree, so no figure is published.', link: 'See both readings' },
      'in-section': { text: 'Covered in full in the section below.', link: 'Read it' },
      pending: { text: 'Not yet verified.', link: 'What’s missing' },
    }[gap];
    return (
      <li
        className={`flex flex-col rounded-[0.3rem] border border-dashed p-4 ${
          gap === 'disputed' ? 'border-amber-300 bg-amber-50/60' : 'border-forest-900/20 bg-white/60'
        }`}
      >
        <h3 className={`${s.h3} text-forest-950`}>{tile.title}</h3>
        <p className={`mt-2 text-sm ${gap === 'disputed' ? 'text-amber-900' : 'text-forest-900/75'}`}>
          {copy.text}{' '}
          <a href={`#${tile.section}`} className="font-medium text-primary-emphasis hover:underline">
            {copy.link}
            <span className="sr-only"> ({tile.title})</span>
          </a>
        </p>
      </li>
    );
  }

  return (
    <li className="flex flex-col rounded-[0.3rem] border border-forest-900/10 bg-white p-4 shadow-[0_1px_2px_rgba(15,39,102,0.04)]">
      <h3 className={`${s.h3} text-forest-950`}>{tile.title}</h3>
      <dl className="mt-2 space-y-2">
        {values.map((v) => (
          <div key={v.key}>
            {v.qualifier && (
              <dt className="text-xs font-semibold uppercase tracking-wider text-forest-900/70">{v.qualifier}</dt>
            )}
            {!v.qualifier && <dt className="sr-only">{fieldLabel(v.key)}</dt>}
            <dd className="text-[15px] font-semibold leading-6 text-forest-950">
              <FactValue value={v.field.value!} />
            </dd>
            {!shared && (
              <dd className="mt-0.5">
                <Provenance field={v.field} compact />
              </dd>
            )}
          </div>
        ))}
      </dl>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
        {shared ? <Provenance field={values[0].field} compact /> : <span />}
        <a href={`#${tile.section}`} className="text-xs font-medium text-primary-emphasis hover:underline">
          Full rules<span className="sr-only">: {tile.title}</span> <span aria-hidden>↓</span>
        </a>
      </div>
    </li>
  );
}

/* ================================================================== *
 * Sections
 * ================================================================== */

function Shell({
  id,
  title,
  badge,
  source,
  children,
  tone = 'default',
}: {
  id: string;
  title: string;
  badge?: ReactNode;
  source?: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'muted';
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-testid={`v2-section-${id}`}
      className={`${s.section} rounded-[0.3rem] border p-5 sm:p-7 ${
        tone === 'muted' ? 'border-dashed border-forest-900/20 bg-white/60' : 'border-forest-900/10 bg-white'
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <h2 id={`${id}-title`} className="text-xl leading-snug sm:text-2xl">
          {title}
        </h2>
        {badge && <div className="flex-none sm:pt-1">{badge}</div>}
      </div>
      {source && <div className="mt-2">{source}</div>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function SectionView({
  id,
  title,
  state,
  airline,
  officialSite,
  modules,
  airlineRef,
  rf,
}: {
  id: string;
  title: string;
  state: SectionState;
  airline: StrapiAirline;
  officialSite: string | null;
  modules: Map<string, ModuleEntry>;
  airlineRef: AirlineRef | null;
  rf: RouteFacts | null;
}) {
  if (state.kind === 'sourced') return <SourcedSection id={id} title={title} module={state.module} />;
  if (state.kind === 'derived') return <CabinsDerivedSection id={id} title={title} airlineName={airline.name} module={state.module} rf={rf} />;

  // Unpublished — pending or disputed. Contact still offers the links a reader
  // can check for themselves; neither prints an unverified value.
  const m = state.module;
  const pendingBlockers = (m?.blockers ?? []).filter((b) => b.status !== 'disputed');
  const copy = PENDING_COPY[id] ?? PENDING_EXTRA[id] ?? 'This section has not been verified against a published source yet.';
  const termsUrl =
    publishedField(modules, 'contact', 'conditions_of_carriage_url')?.value ?? airlineRef?.conditionsOfCarriageUrl ?? null;

  return (
    <Shell
      id={id}
      title={title}
      tone={state.kind === 'disputed' ? 'default' : 'muted'}
      badge={state.kind === 'disputed' ? <Badge tone="disputed">Sources disagree</Badge> : <Badge tone="pending">Not yet verified</Badge>}
    >
      <p className="text-[15px] leading-7 text-forest-900/80">
        {state.kind === 'disputed'
          ? 'Credible sources give different answers here, so neither is published. Both readings are below.'
          : copy}
      </p>
      {m?.disputes.map((d) => <DisputeCard key={d.key} dispute={d} />)}
      {pendingBlockers.length > 0 && (
        <p className="text-sm text-forest-900/75">
          <span className="font-semibold text-forest-950">Still to check:</span>{' '}
          {pendingBlockers.map((b) => fieldLabel(b.key)).join(', ')}.
        </p>
      )}
      <WhereToConfirm airline={airline} officialSite={officialSite} termsUrl={termsUrl} airlineRef={airlineRef} />
    </Shell>
  );
}

/** A published fact-file module: cabin tables, the fact's own table, fact cards, rule, disputes. */
function SourcedSection({ id, title, module: m }: { id: string; title: string; module: ResolvedModule }) {
  const all = shownFields(m);
  const shared = sharedSource(all);
  const range = dateRange(all.map((f) => f.verified_at));
  const { tables, rest } = splitCabinFields(m.published);

  return (
    <Shell
      id={id}
      title={title}
      badge={<Badge tone="verified">{range ? `Verified ${range}` : 'Verified'}</Badge>}
      source={shared ? <SectionSource url={shared.url} /> : undefined}
    >
      {m.lede && <p className="text-[15px] leading-7 text-forest-900/85">{m.lede}</p>}
      {m.body?.map((para, i) => (
        <p key={i} className="text-[15px] leading-7 text-forest-900/85">
          {para}
        </p>
      ))}

      {tables.map((t) => (
        <div key={t.caption} className="relative overflow-x-auto rounded-[0.3rem] border border-forest-900/10">
          <table className="w-full min-w-[18rem] border-collapse text-left text-[15px]">
            <caption className="border-b border-forest-900/10 bg-forest-50/60 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-forest-900/75">
              {t.caption}
            </caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Cabin</th>
                <th scope="col">{t.column}</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r) => (
                <tr key={r.key} className="border-t border-forest-900/10 first:border-t-0">
                  <th scope="row" className="w-[38%] px-4 py-3 align-top font-medium text-forest-900/80">
                    {r.cabin}
                  </th>
                  <td className="px-4 py-3 align-top font-semibold text-forest-950">
                    <FactValue value={r.field.value!} />
                    {!shared && (
                      <div className="mt-1 font-normal">
                        <Provenance field={r.field} compact />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {m.table && <FactFileTable table={m.table} perCell={!shared} />}

      {rest.length > 0 && (
        <dl className="grid gap-3 sm:grid-cols-2">
          {rest.map((f) => (
            <FactCard key={f.key} f={f} showSource={!shared} />
          ))}
        </dl>
      )}

      {m.rule && (
        <div className="rounded-[0.3rem] border-l-4 border-primary-emphasis bg-forest-50/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-900/75">{m.rule.key}</p>
          <p className="mt-1 text-[15px] leading-7 text-forest-950">{m.rule.text}</p>
        </div>
      )}

      {m.disputes.map((d) => (
        <DisputeCard key={d.key} dispute={d} />
      ))}
    </Shell>
  );
}

function FactFileTable({
  table,
  perCell,
}: {
  table: NonNullable<ResolvedModule['table']>;
  perCell: boolean;
}) {
  return (
    <div className="relative overflow-x-auto rounded-[0.3rem] border border-forest-900/10">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        <caption className="border-b border-forest-900/10 bg-forest-50/60 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-forest-900/75">
          {table.caption}
        </caption>
        <thead>
          <tr className="border-b border-forest-900/10">
            {table.columns.map((c, i) => (
              <th key={i} scope="col" className="px-4 py-2.5 font-semibold text-forest-900/80">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-t border-forest-900/10">
              <th scope="row" className="px-4 py-3 align-top font-medium text-forest-900/80">
                {row.label}
              </th>
              {row.cells.map((cell, j) => (
                <td key={j} className="px-4 py-3 align-top font-semibold text-forest-950">
                  {cell?.value ? (
                    <>
                      <FactValue value={cell.value} />
                      {perCell && (
                        <div className="mt-1 font-normal">
                          <Provenance field={cell} compact />
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="font-normal text-forest-900/70">Not verified</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FactCard({ f, showSource }: { f: ResolvedField; showSource: boolean }) {
  return (
    <div className="rounded-[0.3rem] border border-forest-900/10 bg-[#fbfcff] p-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-forest-900/75">{fieldLabel(f.key)}</dt>
      <dd className="mt-1.5 text-[15px] font-semibold leading-6 text-forest-950 [overflow-wrap:anywhere]">
        <FactValue value={f.field.value!} />
      </dd>
      {showSource && (
        <dd className="mt-2">
          <Provenance field={f.field} compact />
        </dd>
      )}
    </div>
  );
}

function DisputeCard({ dispute: d }: { dispute: ResolvedField }) {
  const values = d.field.conflicting_values ?? [];
  return (
    <div className="rounded-[0.3rem] border border-amber-300 bg-amber-50 p-4" data-testid={`v2-dispute-${d.key}`}>
      <h3 className={`${s.h3} flex items-center gap-2 text-amber-900`}>
        <WarnIcon />
        Sources disagree: {fieldLabel(d.key).toLowerCase()}
      </h3>
      {values.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-[15px] leading-6 text-forest-950">
          {values.map((v, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="text-amber-700">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      ) : (
        d.field.notes && <p className="mt-2 text-[15px] leading-6 text-forest-950">{d.field.notes}</p>
      )}
      <p className="mt-2 text-sm text-amber-900">
        Neither value is published until the airline’s own pages agree. Check with the airline before you fly.
      </p>
    </div>
  );
}

function WhereToConfirm({
  airline,
  officialSite,
  termsUrl,
  airlineRef,
}: {
  airline: StrapiAirline;
  officialSite: string | null;
  termsUrl: string | null;
  airlineRef: AirlineRef | null;
}) {
  if (!officialSite && !termsUrl) return null;
  const termsFromSnapshot = termsUrl && termsUrl === airlineRef?.conditionsOfCarriageUrl;
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="font-semibold text-forest-950">Check directly:</span>
      {officialSite && (
        <ExternalLink href={officialSite}>{airline.name} website</ExternalLink>
      )}
      {termsUrl && (
        <span>
          <ExternalLink href={termsUrl}>Conditions of carriage</ExternalLink>
          {termsFromSnapshot && AIRLINE_REF_SOURCE.retrieved() && (
            <span className="text-forest-900/70" title={AIRLINE_REF_SOURCE.label()}>
              {' '}
              (link from {AIRLINE_REF_SOURCE.label().split(' ')[0]} reference data, {formatDate(AIRLINE_REF_SOURCE.retrieved())})
            </span>
          )}
        </span>
      )}
    </p>
  );
}

/** Cabins from the route dataset: aircraft types seen, with the not-a-fleet caveat. */
function CabinsDerivedSection({
  id,
  title,
  airlineName,
  module: m,
  rf,
}: {
  id: string;
  title: string;
  airlineName: string;
  module: DerivedModule;
  rf: RouteFacts | null;
}) {
  const fleet = rf?.fleet ?? [];
  return (
    <Shell
      id={id}
      title={title}
      badge={<Badge tone="data">Route data · {formatDate(m.verifiedAt)}</Badge>}
      source={<DatasetSource module={m} />}
    >
      <p className="text-[15px] leading-7 text-forest-900/85">
        Cabin names and seat details are <strong className="font-semibold text-forest-950">not yet verified</strong> for{' '}
        {airlineName}. What the route dataset does record is which aircraft types have appeared on its
        routes:
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="Aircraft types recorded on tracked routes">
        {fleet.map((ac) => (
          <li key={ac} className="rounded-full border border-forest-900/15 bg-[#fbfcff] px-3 py-1 text-sm text-forest-950">
            {ac}
          </li>
        ))}
      </ul>
      {m.body?.[1] && <p className="text-sm leading-6 text-forest-900/80">{m.body[1]}</p>}
      {m.conflicts?.map((c) => (
        <div key={c.title} className="rounded-[0.3rem] border-l-4 border-forest-900/25 bg-forest-50/60 px-4 py-3">
          <h3 className={`${s.h3} text-forest-950`}>{c.title}</h3>
          <p className="mt-1 text-sm leading-6 text-forest-900/85">{c.text}</p>
        </div>
      ))}
    </Shell>
  );
}

function NetworkSection({ airline, rf, module: m }: { airline: StrapiAirline; rf: RouteFacts; module: DerivedModule }) {
  const shownDestinations = rf.keyDestinations.slice(0, 24);
  const more = rf.keyDestinations.length - shownDestinations.length;
  return (
    <Shell
      id="network"
      title={`Where ${airline.name} flies`}
      badge={<Badge tone="data">Route data · {formatDate(m.verifiedAt)}</Badge>}
      source={<DatasetSource module={m} />}
    >
      {m.body?.[0] && <p className="text-[15px] leading-7 text-forest-900/85">{m.body[0]}</p>}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Destinations" value={rf.destinationCount.toLocaleString()} />
        <Stat label={rf.countryCount === 1 ? 'Country' : 'Countries'} value={rf.countryCount.toLocaleString()} />
        <Stat label="Routes tracked" value={rf.routeCount.toLocaleString()} />
        {rf.longestRoute && <Stat label="Longest route" value={`${rf.longestRoute.km.toLocaleString()} km`} />}
      </dl>

      {rf.topHubs.length > 0 && (
        <div>
          <h3 className={`${s.h3} text-forest-950`}>Busiest markets by route count</h3>
          <ol className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rf.topHubs.map((h) => (
              <li
                key={h.city}
                className="flex items-center justify-between gap-3 rounded-[0.3rem] border border-forest-900/10 bg-[#fbfcff] px-3.5 py-2.5 text-[15px]"
              >
                <span className="font-medium text-forest-950">
                  <AirportLink city={h.city} />
                </span>
                <span className="text-sm text-forest-900/75">{h.routes} routes</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-forest-900/70">A market may include more than one airport.</p>
        </div>
      )}

      {rf.longestRoute && (
        <div className="rounded-[0.3rem] border border-forest-900/10 bg-[#fbfcff] p-4">
          <h3 className={`${s.h3} text-forest-950`}>Longest route in the dataset</h3>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] font-semibold text-forest-950">
            <AirportCode code={rf.longestRoute.fromIata} city={rf.longestRoute.from} />
            <span aria-hidden className="text-forest-900/50">
              ———✈———
            </span>
            <span className="sr-only">to</span>
            <AirportCode code={rf.longestRoute.toIata} city={rf.longestRoute.to} />
          </p>
          <p className="mt-1 text-sm text-forest-900/75">
            {rf.longestRoute.km.toLocaleString()} km great-circle distance between the two airports.
          </p>
        </div>
      )}

      {shownDestinations.length > 0 && (
        <div>
          <h3 className={`${s.h3} text-forest-950`}>Destinations in the route data</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {shownDestinations.map((city) => {
              const iata = getAirportIata(city);
              return (
                <li key={city}>
                  {iata ? (
                    <Link
                      href={`/airports/${iata}`}
                      className="inline-block rounded-full border border-forest-900/15 bg-white px-3 py-1 text-sm text-forest-950 hover:border-primary-emphasis hover:text-primary-emphasis"
                    >
                      {city}
                    </Link>
                  ) : (
                    <span className="inline-block rounded-full border border-forest-900/10 bg-[#fbfcff] px-3 py-1 text-sm text-forest-900/85">
                      {city}
                    </span>
                  )}
                </li>
              );
            })}
            {more > 0 && <li className="self-center px-1 text-sm text-forest-900/75">and {more} more</li>}
          </ul>
        </div>
      )}
    </Shell>
  );
}

function AirportCode({ code, city }: { code: string; city: string }) {
  return (
    <Link href={`/airports/${code.toLowerCase()}`} className="hover:text-primary-emphasis">
      {city} <span className="font-mono text-sm text-forest-900/75">{code}</span>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.3rem] border border-forest-900/10 bg-[#fbfcff] px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-900/70">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-forest-950">{value}</dd>
    </div>
  );
}

/* ================================================================== *
 * Sources and verification
 * ================================================================== */

function SourcesSection({
  airline,
  sections,
  network,
}: {
  airline: StrapiAirline;
  sections: { id: string; nav: string; state: SectionState }[];
  network: DerivedModule | null;
}) {
  const rows = [
    ...sections.map((sec) => ({ id: sec.id, nav: sec.nav, state: sec.state })),
    ...(network ? [{ id: 'network', nav: 'Where they fly', state: { kind: 'derived', module: network } as SectionState }] : []),
  ];

  return (
    <Shell id="sources" title="Sources and verification">
      <p className="text-[15px] leading-7 text-forest-900/85">
        Baggage, fare, check-in, disruption and contact figures are published only when they are read from{' '}
        {airline.name}’s own pages or a named regulator, and each one shows the page and the date it was checked. Where
        sources disagree we show both and publish neither. Route and destination figures come from the Originfacts
        route dataset and show its date instead; they are not verified by hand.
      </p>
      {/* A list rather than a table, so it reflows on a phone instead of scrolling sideways. */}
      <ul className="divide-y divide-forest-900/10 rounded-[0.3rem] border border-forest-900/10" aria-label="Where each section of this page comes from">
        <li aria-hidden className="hidden bg-forest-50/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-forest-900/75 sm:grid sm:grid-cols-[10rem_14rem_minmax(0,1fr)] sm:gap-4">
          <span>Section</span>
          <span>Status</span>
          <span>Source</span>
        </li>
        {rows.map((r) => (
          <li key={r.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[10rem_14rem_minmax(0,1fr)] sm:gap-4">
            <a href={`#${r.id}`} className="font-medium text-forest-950 hover:text-primary-emphasis hover:underline">
              {r.nav}
            </a>
            <span>
              <LedgerStatus state={r.state} />
            </span>
            <span className="min-w-0 text-forest-900/85">
              <LedgerSources state={r.state} />
            </span>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function LedgerStatus({ state }: { state: SectionState }) {
  if (state.kind === 'sourced') {
    const range = dateRange(shownFields(state.module).map((f) => f.verified_at));
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-800">
        <CheckIcon className="h-3.5 w-3.5" />
        Verified{range ? ` ${range}` : ''}
        {state.module.disputes.length > 0 && <span className="text-amber-800"> · 1+ conflict</span>}
      </span>
    );
  }
  if (state.kind === 'derived') return <span className="text-forest-900/85">Route data, {formatDate(state.module.verifiedAt)}</span>;
  if (state.kind === 'disputed') return <span className="text-amber-800">Sources disagree</span>;
  return <span className="text-forest-900/75">Not yet verified</span>;
}

function LedgerSources({ state }: { state: SectionState }) {
  if (state.kind === 'sourced') {
    const urls = [...new Set(shownFields(state.module).map((f) => f.source_url).filter((u): u is string => Boolean(u)))];
    return (
      <ul className="space-y-1">
        {urls.map((u) => (
          <li key={u} className="[overflow-wrap:anywhere]">
            <ExternalLink href={u}>{sourcePath(u)}</ExternalLink>
          </li>
        ))}
      </ul>
    );
  }
  if (state.kind === 'derived') return <>{state.module.sources.map((x) => x.label).join('; ')}</>;
  return <>—</>;
}

/* ================================================================== *
 * Small pieces
 * ================================================================== */

type BadgeTone = 'verified' | 'data' | 'pending' | 'disputed';

function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  const cls: Record<BadgeTone, string> = {
    verified: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    data: 'border-forest-200 bg-forest-50 text-forest-800',
    pending: 'border-slate-300 bg-white text-slate-700',
    disputed: 'border-amber-300 bg-amber-50 text-amber-900',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${cls[tone]}`}>
      {tone === 'verified' && <CheckIcon className="h-3.5 w-3.5" />}
      {tone === 'disputed' && <WarnIcon />}
      {tone === 'pending' && <span aria-hidden className="h-2 w-2 rounded-full border border-slate-500" />}
      {tone === 'data' && <span aria-hidden className="h-2 w-2 rounded-full bg-primary-emphasis" />}
      {children}
    </span>
  );
}

/** One line under a section heading when every fact in it came from the same page. */
function SectionSource({ url }: { url: string }) {
  return (
    <p className="text-sm text-forest-900/75 [overflow-wrap:anywhere]">
      Source: <ExternalLink href={url}>{sourcePath(url)}</ExternalLink>
    </p>
  );
}

function DatasetSource({ module: m }: { module: DerivedModule }) {
  return (
    <p className="text-sm text-forest-900/75">
      Source: {m.sources.map((x) => `${x.label}${x.note ? ` (${x.note})` : ''}`).join('; ')}. Not verified by hand.
    </p>
  );
}

/** Per-fact provenance: the date it was checked and the page it came from. */
function Provenance({ field, compact = false }: { field: FactField; compact?: boolean }) {
  if (!field.source_url || !field.verified_at) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 ${compact ? 'text-xs' : 'text-sm'} font-normal text-forest-900/75`}>
      <CheckIcon className="h-3.5 w-3.5 text-emerald-700" />
      <span>Verified {formatDate(field.verified_at)}</span>
      <span aria-hidden>·</span>
      <ExternalLink href={field.source_url} title={field.source_url}>
        {sourceHost(field.source_url)}
      </ExternalLink>
    </span>
  );
}

/** A value that is a URL renders as its link; an email as mailto; a single phone number as tel. */
function FactValue({ value }: { value: string }) {
  if (/^https?:\/\//.test(value)) {
    return (
      <ExternalLink href={value} className="[overflow-wrap:anywhere]">
        {sourcePath(value)}
      </ExternalLink>
    );
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return (
      <a href={`mailto:${value}`} className="text-primary-emphasis underline-offset-2 hover:underline [overflow-wrap:anywhere]">
        {value}
      </a>
    );
  }
  const tel = telHref(value);
  if (tel) {
    return (
      <a href={tel} className="text-primary-emphasis underline-offset-2 hover:underline">
        {value}
      </a>
    );
  }
  return <>{value}</>;
}

function ExternalLink({
  href,
  children,
  title,
  className = '',
}: {
  href: string;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      title={title}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`text-primary-emphasis underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-emphasis ${className}`}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
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

function ExternalIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 3h4v4M13 3 7.5 8.5M12 9.5V13H3V4h3.5" />
    </svg>
  );
}

function normaliseUrl(value: string | null): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
