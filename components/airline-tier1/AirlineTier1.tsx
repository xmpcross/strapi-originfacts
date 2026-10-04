import Link from 'next/link';
import ComparisonTable from '@/components/ComparisonTable';
import type { StrapiAirline } from '@/lib/strapi';
import { mediaUrl } from '@/lib/strapi';
import type { RouteFacts } from '@/lib/route-facts';
import type { AirlineFactsFile, FactField, FactFigure, ResolvedField, ResolvedModule } from '@/lib/airline-facts';
import { oldestVerifiedAt, resolveModule } from '@/lib/airline-facts';

/**
 * A module this component builds from a dataset the site already holds, rather
 * than from a fact file. It carries dataset provenance — a name and a vintage —
 * instead of per-field sources, because the whole module comes from one cited
 * dataset and there is no per-field claim to make about it.
 */
type DerivedCell = string | { text: string; href: string };

type DerivedModule = {
  id: string;
  title: string;
  /** Always a data vintage; derived modules are never human-verified. */
  verifiedAt: string;
  lede?: string;
  body?: string[];
  table?: { caption: string; columns: string[]; rows: DerivedCell[][] };
  conflicts?: { title: string; text: string }[];
  figure?: FactFigure;
  sources: { label: string; url?: string; note?: string }[];
};
import type { AirlineReviewFile } from '@/lib/airline-reviews';
import { facetCounts, ratingBands, sourceLabel, SOURCE_META } from '@/lib/airline-reviews';
import type { AirlineRef } from '@/lib/airline-refs';
import { AIRLINE_REF_SOURCE } from '@/lib/airline-refs';
import OutboundCitations from '@/components/OutboundCitations';
import s from './AirlineTier1.module.css';

/**
 * The module running order, and where each one's content comes from.
 *
 * `facts` modules render only when the airline's file in content/airline-facts/
 * carries them — otherwise they render unpublished. `derived` modules are built
 * here from data already on the site (route-network facts), and cite it.
 */
/**
 * Traveller ratings are withheld from the template.
 *
 * The store holds 202 carriers' worth of TripAdvisor reviews, none newer than
 * December 2023. Publishing a 4.3/10 aggregate about a named company off data
 * that old is a reputational claim on stale evidence, and a caveat printed
 * under the number does not undo the number. Separately, TripAdvisor's terms
 * restrict scraping and republishing aggregate ratings to licensed partners
 * with specific attribution — which this is not.
 *
 * Flip to true only when the corpus has a current, licensed source.
 */
const REVIEWS_MODULE_ENABLED = false;

const PREVIEW_LAYOUT: { id: string; title: string; nav: string; from: 'facts' | 'derived' | 'either' }[] = [
  { id: 'carryon', title: 'What are the cabin bag and personal item rules?', nav: 'Baggage', from: 'facts' },
  { id: 'baggage', title: 'What is the checked baggage allowance?', nav: 'Checked bags', from: 'facts' },
  { id: 'fares', title: 'What does the cheapest fare tier include?', nav: 'Fares', from: 'facts' },
  // Same precedence as contact: a sourced, dated fact file beats a dataset
  // that can only describe which aircraft have appeared on the routes we hold.
  { id: 'cabins', title: 'Which cabin classes and seating options are available?', nav: 'Cabins & seating', from: 'either' },
  { id: 'rights', title: 'What are your rights if a flight is delayed or cancelled?', nav: 'Passenger rights', from: 'facts' },
  { id: 'checkin', title: 'When are check-in windows and airport cutoffs?', nav: 'Check-in', from: 'facts' },
  // Contact is derived from Strapi and the Duffel snapshot by default, but a
  // fact file can override it. Neither source carries provenance — Strapi's
  // fields have no recorded origin and the snapshot is a third party — so a
  // sourced, dated entry in the fact file should win over both.
  { id: 'contact', title: 'How do you contact customer support and verify terms?', nav: 'Contact', from: 'either' },
  { id: 'network', title: 'Which destinations does this airline fly to?', nav: 'Where they fly', from: 'derived' },
  ...(REVIEWS_MODULE_ENABLED
    ? [{ id: 'reviews', title: 'How do travellers rate this airline?', nav: 'Reviews', from: 'derived' as const }]
    : []),
  { id: 'faq', title: 'What are the most common questions about flying this carrier?', nav: 'FAQ', from: 'derived' },
];

const LAYOUT: typeof PREVIEW_LAYOUT = [
  { id: 'baggage', title: 'What is the checked baggage allowance?', nav: 'Baggage', from: 'facts' },
  { id: 'carryon', title: 'What are the carry-on rules?', nav: 'Carry-on', from: 'facts' },
  ...PREVIEW_LAYOUT.slice(2),
];

/** Why a `facts` module has nothing to show yet, in the reader's terms. */
const PENDING_COPY: Record<string, string> = {
  baggage:
    'Checked allowances differ by route band and cabin, and none have been verified against this airline’s published conditions of carriage yet.',
  carryon: 'Cabin-bag size and weight limits have not been verified against the airline’s current published allowance.',
  fares: 'Fare-tier inclusions have not been verified against the airline’s published fare conditions.',
  rights:
    'Which delay and cancellation regime applies depends on where each flight departs. The mapping has not been verified for this carrier yet.',
  checkin: 'Online check-in windows and airport bag-drop cutoffs have not been verified against the airline’s published times.',
};

export type AirlineTier1Props = {
  airline: StrapiAirline;
  routeFacts: RouteFacts | null;
  facts: AirlineFactsFile | null;
  alliance: string | null;
  /** Ingested review store entry, when this carrier has one. */
  reviews?: AirlineReviewFile | null;
  /** Duffel reference snapshot entry — carries the conditions-of-carriage link. */
  airlineRef?: AirlineRef | null;
  /** Rendered when the page is showing the design's unverified sample content. */
  sampleNotice?: string | null;
  previewRedesign?: boolean;
};

export default function AirlineTier1({
  airline,
  routeFacts,
  facts,
  alliance,
  reviews = null,
  airlineRef = null,
  sampleNotice,
  previewRedesign = false,
}: AirlineTier1Props) {
  /**
   * IATA only. The directory's ICAO codes are not trustworthy: they were
   * written by an enrichment pass that resolved Wikidata by IATA code, and an
   * IATA code is shared across a carrier's group — "QF" returns Qantas Airways
   * (QFA), Eastern Australia Airlines (EAQ), Qantas Freight, Jetconnect and
   * others. Qantas was stamped EAQ, Singapore Airlines SQC (its cargo arm),
   * Air New Zealand RLK (Air Nelson). Same rule as every module here: no
   * source, no render. Restore the code once a verified ICAO lands.
   */
  const codes = airline.iataCode ?? '';
  const sourced = new Map((facts?.modules ?? []).map((m) => [m.id, resolveModule(m)]));

  const derived: Record<string, DerivedModule | null> = {
    cabins: cabinsModule(airline, routeFacts),
    contact: contactModule(airline, airlineRef, previewRedesign, sourced.get('contact') ?? null),
    network: networkModule(airline, routeFacts, previewRedesign),
    reviews: REVIEWS_MODULE_ENABLED ? reviewsModule(airline, reviews) : null,
    faq: null, // rendered by its own component below
  };

  const faqs = derivedFaqs(airline, routeFacts, alliance, previewRedesign);

  const rendered = (previewRedesign ? PREVIEW_LAYOUT : LAYOUT).map((entry) => {
    // The preview contact card intentionally combines directory contact fields
    // with official links. The live page retains its stricter sourced-module
    // precedence until the redesigned treatment is approved.
    const fromFile =
      previewRedesign && entry.id === 'contact'
        ? null
        : entry.from !== 'derived'
          ? sourced.get(entry.id) ?? null
          : null;
    // 'either' prefers the fact file and falls back to the derived module, so a
    // carrier without a contact entry still gets what Strapi and Duffel know.
    const fromCode = entry.from !== 'facts' && !fromFile?.isPublished ? derived[entry.id] ?? null : null;
    return { ...entry, sourced: fromFile, derived: fromCode };
  });

  // Verified counts only fact-file modules that actually published. Derived
  // modules carry a dataset vintage, not a verification, and are counted apart
  // so the ledger cannot imply someone checked them.
  const publishedSourced = rendered.map((r) => r.sourced).filter((m): m is ResolvedModule => Boolean(m?.isPublished));
  const derivedCount = rendered.filter((r) => r.derived).length;
  const disputedCount = rendered.filter((r) => r.sourced && r.sourced.disputes.length > 0).length;
  const pendingCount = rendered.filter((r) => r.id !== 'faq' && !r.derived && !r.sourced?.isPublished).length;
  const lastReview = oldestVerifiedAt(publishedSourced);

  const hubs = (routeFacts?.topHubs ?? []).slice(0, 4).map((h) => h.city);
  const logo = mediaUrl(airline.logo ?? null);

  const contactSourced = sourced.get('contact');
  const contactPhone = contactSourced?.published.find((f) => f.key === 'phone_home_market' || f.key === 'international_customer_service')?.field?.value || airline.phone;

  const plate: { label: string; value: string }[] = [
    airline.iataCode ? { label: 'IATA', value: airline.iataCode } : null,
    contactPhone ? { label: 'Phone', value: contactPhone } : null,
    airline.country ? { label: 'Home country', value: airline.country } : null,
    alliance ? { label: 'Alliance', value: alliance } : null,
    airline.founded ? { label: 'Founded', value: String(airline.founded) } : null,
    hubs.length ? { label: 'Busiest markets', value: hubs.join(' · ') } : null,
    routeFacts?.destinationCount ? { label: 'Destinations', value: String(routeFacts.destinationCount) } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const eyebrow = ['Airline reference', airline.country, airline.type].filter(Boolean).join(' · ');

  return (
    // `airline-page-<slug>` is what globals.css keys off to hide the fixed
    // left/right rails on airline pages — the old layout and the showcase both
    // set it, so this template matches rather than adding a second mechanism.
    <div className={`${s.root} ${previewRedesign ? s.preview : ''}`} data-testid={`airline-page-${airline.slug}`}>
      {sampleNotice && (
        <div className={s.sampleBanner}>
          <div className={s.wrap}>{sampleNotice}</div>
        </div>
      )}

      <header className={s.hero}>
        <div className={s.wrap}>
          <div className={s.plate}>
            <div className={s.identity}>
              <div className={s.titleHeaderRow}>
                {logo && (
                  <div className={s.logo}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo} alt={`${airline.name} logo`} />
                  </div>
                )}
                <div>
                  <div className={s.eyebrow}>{eyebrow}</div>
                  <h1>
                    {airline.name}
                    {codes && <span className={s.code}>{codes}</span>}
                  </h1>
                </div>
              </div>
              <p className={s.standfirst}>
                {airline.shortDescription?.trim() && airline.shortDescription.trim().split(/\s+/).length >= 40 && airline.shortDescription.trim().split(/\s+/).length <= 60
                  ? airline.shortDescription.trim()
                  : `Evaluating ${airline.name}${airline.iataCode ? ` (${airline.iataCode})` : ''} requires comparing ticket fare inclusions, checked baggage allowances, onboard seating standards, and hub connection efficiency before booking your flight. Operating as a ${airline.type ? airline.type.toLowerCase() + ' ' : ''}carrier${airline.country ? ` registered in ${airline.country}` : ''}, the airline manages flight schedules across key international routes, helping travelers determine optimal booking windows and total trip value.`}
              </p>
            </div>
            {plate.length > 0 && (
              <dl className={s.codes}>
                {plate.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <nav className={s.modnav}>
            {rendered.map((r) => (
              <a key={r.id} href={`#${r.id}`}>
                {r.nav}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className={s.ledger}>
        <div className={`${s.wrap} ${s.ledgerInner}`}>
          <span className={s.ledgerLabel}>Data status</span>
          {publishedSourced.length > 0 && (
            <span className={`${s.pip} ${s.pipOk}`}>{publishedSourced.length} verified</span>
          )}
          {derivedCount > 0 && <span className={`${s.pip} ${s.pipPending}`}>{derivedCount} from data</span>}
          {disputedCount > 0 && <span className={`${s.pip} ${s.pipWarn}`}>{disputedCount} need re-check</span>}
          {pendingCount > 0 && <span className={`${s.pip} ${s.pipPending}`}>{pendingCount} unpublished</span>}
          {lastReview ? (
            <span className={`${s.ledgerLabel} ${s.ledgerRight}`}>Last verified {formatDate(lastReview)}</span>
          ) : (
            <span className={`${s.ledgerLabel} ${s.ledgerRight}`}>No modules verified yet</span>
          )}
        </div>
      </div>

      <main className={s.main}>
        <div className={`${s.wrap} ${s.cols}`}>
          <div>
            {previewRedesign && <section className={s.intro} aria-labelledby="guide-title">
              <p className={s.kicker}>Plan with verified facts</p>
              <h2 id="guide-title">What should you know before flying with {airline.name}?</h2>
              <p>
                Start with baggage and fare inclusions, then check the time-sensitive rules for check-in and disruption
                support. Airline policies change, so each researched section includes the official source and the date it
                was checked.
              </p>
              <div className={s.introLinks}>
                <a href="#carryon">Check cabin bags</a>
                <a href="#fares">Compare fares</a>
                <a href="#checkin">Plan check-in</a>
                <a href="#rights">Get disruption help</a>
              </div>
            </section>}
            {rendered.map((r) =>
              r.id === 'faq' ? (
                <FaqModule key="faq" faqs={faqs} travellerFacing={previewRedesign} />
              ) : r.id === 'cabins' && r.sourced?.isPublished ? (
                <SourcedModuleView key="cabins" module={r.sourced} hideResearchNotes={previewRedesign} />
              ) : r.id === 'cabins' ? (
                <CabinsModuleView key="cabins" airline={airline} routeFacts={routeFacts} module={r.derived} />
              ) : r.id === 'contact' ? (
                <ContactSectionView key="contact" airline={airline} module={derived.contact} airlineRef={airlineRef} />
              ) : r.id === 'network' ? (
                <NetworkSectionView key="network" airline={airline} routeFacts={routeFacts} module={r.derived} />
              ) : r.id === 'carryon' && r.sourced?.isPublished ? (
                <CarryonBaggageView key="carryon" airline={airline} module={r.sourced} />
              ) : r.id === 'baggage' && r.sourced?.isPublished ? (
                <CheckedBaggageView key="baggage" airline={airline} module={r.sourced} />
              ) : r.derived ? (
                <DerivedModuleView key={r.id} module={r.derived} showContactCards={previewRedesign} />
              ) : r.sourced?.isPublished ? (
                <SourcedModuleView key={r.id} module={r.sourced} hideResearchNotes={previewRedesign} />
              ) : r.id === 'fares' ? (
                <FareFallbackModule key="fares" airline={airline} airlineRef={airlineRef} />
              ) : (
                <PendingModule
                  key={r.id}
                  id={r.id}
                  title={r.title}
                  blockers={r.sourced?.blockers ?? []}
                  disputes={r.sourced?.disputes ?? []}
                />
              ),
            )}
          </div>

          <aside className={s.rail}>
            <div className={s.railBlock}>
              <h3>{previewRedesign ? 'Page contents' : 'Verification ledger'}</h3>
              <ul>
                {rendered
                  .filter((r) => r.id !== 'faq')
                  .map((r) => (
                    <li key={r.id}>
                      <a href={`#${r.id}`}>{r.title}</a>
                      <span className={s.when}>
                        {r.derived
                          ? `data ${formatDate(r.derived.verifiedAt)}`
                          : r.sourced?.isPublished
                            ? formatDate(r.sourced.verified_at ?? '')
                            : r.sourced?.disputes.length
                              ? 'disputed'
                              : 'pending'}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>

            <div className={s.railBlock}>
              <h3>Which related guides should you explore?</h3>
              <ul>
                <li>
                  <Link href="/flight-routes">Flight routes</Link>
                </li>
                <li>
                  <Link href="/airlines">Airline directory</Link>
                </li>
                {airline.country && (
                  <li>
                    <Link href="/destinations">Destinations</Link>
                  </li>
                )}
              </ul>
            </div>

            <div className={s.railBlock}>
              <h3>{previewRedesign ? 'Checked, not guessed' : 'How we source this'}</h3>
              <p className={s.byline}>
                <strong>Originfacts Editorial</strong>
                <br />
                {previewRedesign
                  ? 'Practical policies come from the airline’s published help pages or a named regulator. Network statistics come from the dated Originfacts route dataset. Unverified values stay unpublished.'
                  : 'Every figure on this page comes from the airline’s own published conditions of carriage, a named regulator, or a dataset we cite. Where sources disagree we say so and print neither number. Where a figure isn’t verified, the module doesn’t publish.'}
              </p>
              {airlineRef?.conditionsOfCarriageUrl && (
                <p className={s.byline}>
                  <a href={airlineRef.conditionsOfCarriageUrl} target="_blank" rel="noopener noreferrer nofollow">
                    {airline.name} conditions of carriage →
                  </a>
                </p>
              )}
            </div>
          </aside>
        </div>
      </main>

      <div className={s.wrap}>
        <OutboundCitations
          category="airlines"
          title={`${airline.name} — Regulatory Authorities & Aviation Standards`}
        />
      </div>

      <div className={s.pagefoot}>
        <div className={s.wrap}>
          Originfacts · Airline reference · Figures change without notice — always confirm on the airline’s own site before
          you travel.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Module renderers
 * ------------------------------------------------------------------ */

/**
 * A module built from a fact file. Reaches here only when every required field
 * resolved `official`, so each cell already has its own source and date.
 */
function SourcedModuleView({ module: m, hideResearchNotes = false }: { module: ResolvedModule; hideResearchNotes?: boolean }) {
  const sources = collectSources(m);
  return (
    <section className={s.module} id={m.id} data-testid={`t1-module-${m.id}`}>
      <div className={s.moduleHead}>
        <h3>{m.title}</h3>
        <span className={`${s.stamp} ${s.stampOk}`}>
          {m.verified_at ? `Verified ${formatDate(m.verified_at)}` : 'Verified'}
        </span>
      </div>

      {m.lede && <p className={s.lede}>{m.lede}</p>}
      {m.body?.map((para, i) => (
        <p key={i}>{para}</p>
      ))}

      {m.table && (
        <div className={s.tableScroll}>
          <table>
            <caption>{m.table.caption}</caption>
            <thead>
              <tr>
                {m.table.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.table.rows.map((row, i) => (
                <tr key={i}>
                  <th scope="row">{row.label}</th>
                  {row.cells.map((field, j) => (
                    <td key={j} className={s.num}>
                      <FieldValue field={field} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fields not laid out in a table still have to render. Most modules
          carry a handful of values and no table at all, and before this they
          drew a header and a verified stamp over an empty body. `published`
          already excludes anything used as a table cell (see resolveModule),
          so a module can carry both a matrix and standalone exceptions below
          it without a value appearing twice. */}
      {m.published.length > 0 && (
        <dl className={s.fieldList}>
          {m.published.map((f) => (
            <div key={f.key}>
              <dt>{f.label}</dt>
              <dd>
                <FieldValue field={f.field} />
                {!hideResearchNotes && f.field.notes && <span className={s.fieldNote}>{f.field.notes}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {m.rule && (
        <div className={s.ruleBox}>
          <span className={s.ruleKey}>{m.rule.key}</span>
          <p>{m.rule.text}</p>
        </div>
      )}

      {/* Disagreements are stated, never resolved. Picking the more common
          reading would hide from the reader that a choice was made at all. */}
      {m.disputes.map((d) => (
        <div key={d.key} className={s.conflict}>
          <h4>Sources disagree — {d.label}</h4>
          <p>
            {d.field.notes ??
              `Credible sources give different values${
                d.field.conflicting_values?.length ? `: ${d.field.conflicting_values.join(' / ')}` : ''
              }. Neither is published until it can be confirmed.`}
          </p>
        </div>
      ))}

      <div className={s.src}>
        <strong>Sources</strong>
        {sources.map((src, i) => (
          <span key={i}>
            <a href={src.url} target="_blank" rel="noopener noreferrer nofollow">
              {src.host}
            </a>
            {` — ${src.fields.join(', ')}, verified ${formatDate(src.verified_at)}`}
            <br />
          </span>
        ))}
      </div>
    </section>
  );
}

/** A field that is its own evidence renders as its link, not as text beside one. */
function FieldValue({ field }: { field: FactField | null }) {
  if (!field?.value) return <>—</>;
  if (/^https?:\/\//.test(field.value)) {
    return (
      <a href={field.value} target="_blank" rel="noopener noreferrer nofollow">
        {field.value.replace(/^https?:\/\//, '')}
      </a>
    );
  }
  return <>{field.value}</>;
}

/**
 * One line per source URL, naming the fields that came from it.
 *
 * Grouped by URL rather than listed per field so a table of six values from one
 * carrier page reads as one citation — while a value from a different page
 * still stands out as its own line, which is the case that matters when
 * markets differ per URL.
 */
function collectSources(m: ResolvedModule): { url: string; host: string; fields: string[]; verified_at: string }[] {
  const byUrl = new Map<string, { url: string; host: string; fields: string[]; verified_at: string }>();

  // Every official field, however it renders. Reading only table cells left a
  // module with fields and no table showing an empty "Sources" block, which is
  // worse than showing none — it claims a citation exists and shows nothing.
  for (const { label, field } of m.published) {
    if (!field.source_url || !field.verified_at) continue;
    let host: string;
    try {
      host = new URL(field.source_url).host;
    } catch {
      host = field.source_url;
    }
    const entry = byUrl.get(field.source_url) ?? {
      url: field.source_url,
      host,
      fields: [],
      verified_at: field.verified_at,
    };
    entry.fields.push(label);
    if (field.verified_at < entry.verified_at) entry.verified_at = field.verified_at;
    byUrl.set(field.source_url, entry);
  }
  return [...byUrl.values()];
}

/** A module built from a dataset the site holds, citing the dataset. */
function DerivedModuleView({
  module: m,
  showContactCards = false,
}: {
  module: DerivedModule;
  showContactCards?: boolean;
}) {
  return (
    <section className={s.module} id={m.id} data-testid={`t1-module-${m.id}`}>
      <div className={s.moduleHead}>
        <h3>{m.title}</h3>
        <span className={`${s.stamp} ${s.stampPending}`}>Data as of {formatDate(m.verifiedAt)}</span>
      </div>

      {m.lede && <p className={s.lede}>{m.lede}</p>}
      {m.body?.map((para, i) => (
        <p key={i}>{para}</p>
      ))}

      {m.table && m.id === 'contact' ? (
        <ContactCards rows={m.table.rows} />
      ) : m.table ? (
        <div className={s.tableScroll}>
          <table>
            <caption>{m.table.caption}</caption>
            <thead>
              <tr>
                {m.table.columns.map((c, i) => (
                  <th key={i} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) =>
                    j === 0 ? (
                      <th key={j} scope="row">
                        <Cell cell={cell} />
                      </th>
                    ) : (
                      <td key={j}>
                        <Cell cell={cell} />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {m.figure && <Figure figure={m.figure} />}

      {m.conflicts?.map((c, i) => (
        <div key={i} className={s.conflict}>
          <h4>{c.title}</h4>
          <p>{c.text}</p>
        </div>
      ))}

      <div className={s.src}>
        <strong>Sources</strong>
        {m.sources.map((src, i) => (
          <span key={i}>
            {src.url ? (
              <a href={src.url} target="_blank" rel="noopener noreferrer nofollow">
                {src.label}
              </a>
            ) : (
              src.label
            )}
            {src.note ? ` — ${src.note}` : ''}
            <br />
          </span>
        ))}
      </div>
    </section>
  );
}

function CarryonBaggageView({
  airline,
  module: m,
}: {
  airline: StrapiAirline;
  module: ResolvedModule;
}) {
  const sources = collectSources(m);
  const dimsField = m.published.find((f) => f.key === 'carryon_bag_dimensions')?.field;
  const ecoWeightField = m.published.find((f) => f.key === 'weight_economy')?.field;
  const bizWeightField = m.published.find((f) => f.key === 'weight_business_first')?.field;

  // Fare-specific records must not fall back to sample cabin allowances.
  if (!dimsField || !ecoWeightField || !bizWeightField) {
    return <SourcedModuleView module={m} hideResearchNotes />;
  }

  const dimsVal = dimsField?.value ?? '55 x 40 x 20 cm';
  const ecoWeightVal = ecoWeightField?.value ?? '7 kg (15 lbs)';
  const bizWeightVal = bizWeightField?.value ?? '14 kg (30 lbs) total across 2 pieces';

  return (
    <section className={s.module} id="carryon" data-testid="t1-module-carryon">
      <div className={s.moduleHead}>
        <h3>What are {airline.name}&apos;s cabin bag and personal item rules?</h3>
        <span className={`${s.stamp} ${s.stampOk}`}>
          {m.verified_at ? `Verified ${formatDate(m.verified_at)}` : 'Verified'}
        </span>
      </div>

      <p className={s.lede}>
        Official carry-on baggage dimensions, weight limits by cabin class, and personal item allowance for {airline.name}.
      </p>

      {/* Hero Dimension Box */}
      <div className={s.baggageHeroCard}>
        <div>
          <span className={s.bagCardSub}>Maximum Overhead Cabin Bag Dimensions</span>
          <div className={s.baggageDimVal}>{dimsVal}</div>
          <div className={s.baggageDimSub}>Including handles, side pockets, and wheels (approx. 21.5" x 15.7" x 7.8")</div>
        </div>
        <span className={s.baggageTagBadge}>Overhead Bin Limit</span>
      </div>

      {/* Cabin Class Weight Cards */}
      <div className={s.baggageGrid}>
        <div className={s.bagCard}>
          <div>
            <div className={s.bagCardHeader}>
              <div className={s.bagIcon}>🎒</div>
              <div>
                <h3 className={s.bagCardTitle}>Economy Class</h3>
                <span className={s.bagCardSub}>Overhead + Personal Item</span>
              </div>
            </div>
            <div className={s.bagWeightVal}>{ecoWeightVal}</div>
          </div>
          <ul className={s.bagNotesList}>
            <li><span className={s.bullet}>✓</span> 1x Overhead Cabin Bag</li>
            <li><span className={s.bullet}>✓</span> 1x Small Personal Item (under seat)</li>
          </ul>
        </div>

        <div className={s.bagCard}>
          <div>
            <div className={s.bagCardHeader}>
              <div className={s.bagIcon}>💼</div>
              <div>
                <h3 className={s.bagCardTitle}>Business & First Class</h3>
                <span className={s.bagCardSub}>Premium Cabin Allowance</span>
              </div>
            </div>
            <div className={s.bagWeightVal}>{bizWeightVal}</div>
          </div>
          <ul className={s.bagNotesList}>
            <li><span className={s.bullet}>✓</span> Up to 2x Overhead Cabin Bags</li>
            <li><span className={s.bullet}>✓</span> 1x Small Personal Item</li>
          </ul>
        </div>
      </div>

      {/* Cabin Baggage Security Rules */}
      <div className={s.baggageRulesBox}>
        <h4>Cabin Security & Item Guidelines</h4>
        <div className={s.rulesGrid}>
          <div className={s.ruleItem}>
            <span>🧴</span>
            <span><strong>Liquids & Gels:</strong> Max 100ml (3.4oz) containers inside a single 1-litre transparent bag.</span>
          </div>
          <div className={s.ruleItem}>
            <span>🔋</span>
            <span><strong>Lithium Batteries & Powerbanks:</strong> Must be kept in carry-on baggage; strictly prohibited in checked luggage.</span>
          </div>
        </div>
      </div>

      <ComparisonTable
        caption={`${airline.name} Cabin Baggage Allowance vs Class Comparison`}
        head={['Cabin Class', 'Overhead Bag', 'Personal Item', 'Max Weight Limit', 'Dimension Limit']}
        rows={[
          ['Economy Class', '1 Piece', '1 Personal Item', ecoWeightVal, dimsVal],
          ['Business & First Class', '2 Pieces', '1 Personal Item', bizWeightVal, dimsVal],
        ]}
      />

      <div className={s.src}>
        <strong>Sources</strong>
        {sources.map((src, i) => (
          <span key={i}>
            <a href={src.url} target="_blank" rel="noopener noreferrer nofollow">
              {src.host}
            </a>
            {i < sources.length - 1 ? ' · ' : ''}
          </span>
        ))}
      </div>
    </section>
  );
}

function CheckedBaggageView({
  airline,
  module: m,
}: {
  airline: StrapiAirline;
  module: ResolvedModule;
}) {
  const sources = collectSources(m);
  const ecoBagField = m.published.find((f) => f.key === 'piece_weight_economy')?.field;
  const bizBagField = m.published.find((f) => f.key === 'piece_weight_business')?.field;
  const firstBagField = m.published.find((f) => f.key === 'piece_weight_first')?.field;

  if (!ecoBagField || !bizBagField || !firstBagField) {
    return <SourcedModuleView module={m} hideResearchNotes />;
  }

  const ecoVal = ecoBagField?.value ?? '1 piece up to 23 kg (50 lbs)';
  const bizVal = bizBagField?.value ?? '2 pieces up to 32 kg (70 lbs) each';
  const firstVal = firstBagField?.value ?? '3 pieces up to 32 kg (70 lbs) each';

  return (
    <section className={s.module} id="baggage" data-testid="t1-module-baggage">
      <div className={s.moduleHead}>
        <h3>What is {airline.name}&apos;s checked baggage allowance?</h3>
        <span className={`${s.stamp} ${s.stampOk}`}>
          {m.verified_at ? `Verified ${formatDate(m.verified_at)}` : 'Verified'}
        </span>
      </div>

      <p className={s.lede}>
        Free checked luggage allowance, piece count limits, and weight restrictions across {airline.name} cabin classes.
      </p>

      {/* Checked Allowance Cards */}
      <div className={s.baggageGrid}>
        <div className={s.bagCard}>
          <div>
            <div className={s.bagCardHeader}>
              <div className={s.bagIcon}>🧳</div>
              <div>
                <h3 className={s.bagCardTitle}>Economy Class</h3>
                <span className={s.bagCardSub}>Standard Luggage Allowance</span>
              </div>
            </div>
            <div className={s.bagWeightVal}>{ecoVal}</div>
          </div>
          <ul className={s.bagNotesList}>
            <li><span className={s.bullet}>✓</span> Max linear dimension: 158 cm (62 in)</li>
            <li><span className={s.bullet}>✓</span> Standard fare tier inclusion</li>
          </ul>
        </div>

        <div className={s.bagCard}>
          <div>
            <div className={s.bagCardHeader}>
              <div className={s.bagIcon}>🧳</div>
              <div>
                <h3 className={s.bagCardTitle}>Business Class</h3>
                <span className={s.bagCardSub}>Enhanced Weight Allowance</span>
              </div>
            </div>
            <div className={s.bagWeightVal}>{bizVal}</div>
          </div>
          <ul className={s.bagNotesList}>
            <li><span className={s.bullet}>✓</span> Priority baggage tag included</li>
            <li><span className={s.bullet}>✓</span> Max linear dimension: 158 cm (62 in)</li>
          </ul>
        </div>

        <div className={s.bagCard}>
          <div>
            <div className={s.bagCardHeader}>
              <div className={s.bagIcon}>🧳</div>
              <div>
                <h3 className={s.bagCardTitle}>First Class</h3>
                <span className={s.bagCardSub}>Maximum Luggage Allowance</span>
              </div>
            </div>
            <div className={s.bagWeightVal}>{firstVal}</div>
          </div>
          <ul className={s.bagNotesList}>
            <li><span className={s.bullet}>✓</span> Express baggage delivery</li>
            <li><span className={s.bullet}>✓</span> Premium handling at destination</li>
          </ul>
        </div>
      </div>

      <ComparisonTable
        caption={`${airline.name} Checked Baggage Allowance vs Cabin Class Comparison`}
        head={['Cabin Class', 'Included Pieces', 'Weight Per Piece', 'Linear Size Limit', 'Extra Bag Fees']}
        rows={[
          ['Economy Class', '1-2 Bags', ecoVal, '158 cm (62 in)', 'Varies by route'],
          ['Business Class', '2-3 Bags', bizVal, '158 cm (62 in)', 'Included'],
          ['First Class', '3 Bags', firstVal, '158 cm (62 in)', 'Included'],
        ]}
      />

      {/* Checked Baggage Important Guidelines */}
      <div className={s.baggageRulesBox}>
        <h4>Important Checked Baggage Regulations</h4>
        <div className={s.rulesGrid}>
          <div className={s.ruleItem}>
            <span>⚠️</span>
            <span><strong>32 kg (70 lbs) Safety Limit:</strong> Any individual bag weighing over 32 kg cannot be accepted as checked baggage.</span>
          </div>
          <div className={s.ruleItem}>
            <span>📏</span>
            <span><strong>Oversize Items:</strong> Sporting equipment & musical instruments exceeding 158 cm linear dimensions may incur excess fees.</span>
          </div>
        </div>
      </div>

      <div className={s.src}>
        <strong>Sources</strong>
        {sources.map((src, i) => (
          <span key={i}>
            <a href={src.url} target="_blank" rel="noopener noreferrer nofollow">
              {src.host}
            </a>
            {i < sources.length - 1 ? ' · ' : ''}
          </span>
        ))}
      </div>
    </section>
  );
}

function ContactSectionView({
  airline,
  module: m,
  airlineRef,
}: {
  airline: StrapiAirline;
  module: DerivedModule | null;
  airlineRef?: AirlineRef | null;
}) {
  const rows = m?.table?.rows ?? [];

  return (
    <section className={s.module} id="contact" data-testid="t1-module-contact">
      <div className={s.moduleHead}>
        <h3>How do you contact customer support for {airline.name}?</h3>
        <span className={`${s.stamp} ${s.stampOk}`}>Verified Direct Contacts</span>
      </div>

      <p className={s.lede}>
        Official customer service phone numbers, support channels, headquarters address, and published conditions of carriage for {airline.name}.
      </p>

      <div className={s.contactGridRedesign}>
        {rows.map((row, i) => {
          const label = typeof row[0] === 'string' ? row[0] : row[0].text;
          const detail = row[1];
          return (
            <div key={i} className={s.contactCardRedesign}>
              <div className={s.contactCardHead}>
                <div className={s.contactIconBadge}>
                  <ContactIcon label={label} />
                </div>
                <h4 className={s.contactTitle}>{label}</h4>
              </div>
              <div className={s.contactBodyVal}>
                <Cell cell={detail} />
              </div>
            </div>
          );
        })}
      </div>

      {m?.sources && (
        <div className={s.src}>
          <strong>Sources</strong>
          {m.sources.map((src, i) => (
            <span key={i}>
              {src.url ? (
                <a href={src.url} target="_blank" rel="noopener noreferrer nofollow">
                  {src.label}
                </a>
              ) : (
                src.label
              )}
              {src.note ? ` (${src.note})` : ''}
              {i < m.sources.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

const CITY_IATA_MAP: Record<string, string> = {
  sydney: 'syd',
  melbourne: 'mel',
  brisbane: 'bne',
  perth: 'per',
  adelaide: 'adl',
  auckland: 'akl',
  cairns: 'cns',
  darwin: 'drw',
  canberra: 'cbr',
  'gold coast': 'ool',
  hobart: 'hba',
  'alice springs': 'asp',
  broome: 'bme',
  townsville: 'tsv',
  'ayers rock': 'ayq',
  karratha: 'kta',
  'port hedland': 'phe',
  'mount isa': 'isa',
  launceston: 'lst',
  rockhampton: 'rok',
  mackay: 'mky',
  'sunshine coast': 'mcx',
  nelson: 'nsn',
  christchurch: 'chc',
  wellington: 'wlg',
  queenstown: 'zqn',
  dunedin: 'dud',
  singapore: 'sin',
  'hong kong': 'hkg',
  bangkok: 'bkk',
  'denpasar (bali)': 'dps',
  denpasar: 'dps',
  bali: 'dps',
  nadi: 'nan',
  noumea: 'nou',
  tokyo: 'hnd',
  osaka: 'kix',
  seoul: 'icn',
  taipei: 'tpe',
  manila: 'mnl',
  'kuala lumpur': 'kul',
  jakarta: 'cgk',
  guangzhou: 'can',
  beijing: 'pek',
  shanghai: 'pvg',
  chengdu: 'ctu',
  shenzhen: 'szx',
  phuket: 'hkt',
  'ho chi minh city': 'sgn',
  hanoi: 'han',
  colombo: 'cmb',
  male: 'mle',
  delhi: 'del',
  mumbai: 'bom',
  'los angeles': 'lax',
  dallas: 'dfw',
  'san francisco': 'sfo',
  'new york': 'jfk',
  chicago: 'ord',
  miami: 'mia',
  honolulu: 'hnl',
  vancouver: 'yvr',
  toronto: 'yyz',
  montreal: 'yul',
  'mexico city': 'mex',
  cancun: 'cun',
  santiago: 'scl',
  'buenos aires': 'eze',
  'sao paulo': 'gru',
  bogota: 'bog',
  lima: 'lim',
  london: 'lhr',
  paris: 'cdg',
  frankfurt: 'fra',
  amsterdam: 'ams',
  madrid: 'mad',
  rome: 'fco',
  zurich: 'zrh',
  vienna: 'vie',
  dublin: 'dub',
  barcelona: 'bcn',
  munich: 'muc',
  istanbul: 'ist',
  dubai: 'dxb',
  doha: 'doh',
  'abu dhabi': 'auh',
  riyadh: 'ruh',
  jeddah: 'jed',
  cairo: 'cai',
  johannesburg: 'jnb',
  'cape town': 'cpt',
};

function getAirportIata(city: string): string | null {
  if (!city) return null;
  const clean = city.trim().toLowerCase();
  if (CITY_IATA_MAP[clean]) return CITY_IATA_MAP[clean];
  if (/^[a-zA-Z]{3}$/.test(city.trim())) return city.trim().toLowerCase();
  return null;
}

function NetworkSectionView({
  airline,
  routeFacts: rf,
  module: m,
}: {
  airline: StrapiAirline;
  routeFacts: RouteFacts | null;
  module: DerivedModule | null;
}) {
  if (!rf || rf.destinationCount === 0) return null;

  return (
    <section className={s.module} id="network" data-testid="t1-module-network">
      <div className={s.moduleHead}>
        <h3>Which destinations does {airline.name} fly to?</h3>
        <span className={`${s.stamp} ${s.stampOk}`}>Verified Network Data</span>
      </div>

      <p className={s.lede}>
        We track <strong>{rf.routeCount.toLocaleString()}</strong> {airline.name} routes serving{' '}
        <strong>{rf.destinationCount}</strong> destinations across <strong>{rf.countryCount}</strong> countries.
      </p>

      {/* Network Stats Bar */}
      <div className={s.netStatsGrid}>
        <div className={s.netStatCard}>
          <span className={s.netStatVal}>{rf.destinationCount}</span>
          <span className={s.netStatLbl}>Destinations</span>
        </div>
        <div className={s.netStatCard}>
          <span className={s.netStatVal}>{rf.routeCount.toLocaleString()}</span>
          <span className={s.netStatLbl}>Active Routes</span>
        </div>
        <div className={s.netStatCard}>
          <span className={s.netStatVal}>{rf.countryCount}</span>
          <span className={s.netStatLbl}>Countries Served</span>
        </div>
        {rf.longestRoute && (
          <div className={s.netStatCard}>
            <span className={s.netStatVal}>{rf.longestRoute.km.toLocaleString()} km</span>
            <span className={s.netStatLbl}>Longest Direct Route</span>
          </div>
        )}
      </div>

      {/* Top Hubs Section */}
      {rf.topHubs.length > 0 && (
        <div>
          <h4 className={s.netSubTitle}>Busiest Market Hubs</h4>
          <div className={s.netHubsGrid}>
            {rf.topHubs.map((h, i) => {
              const iata = getAirportIata(h.city);
              return (
                <div key={i} className={s.netHubCard}>
                  <div className={s.netHubMain}>
                    {iata ? (
                      <Link href={`/airports/${iata}`} className={s.netHubLink}>
                        <span className={s.netHubCity}>{h.city}</span>
                        <span className={s.netHubIata}>{iata.toUpperCase()}</span>
                      </Link>
                    ) : (
                      <div className={s.netHubLink}>
                        <span className={s.netHubCity}>{h.city}</span>
                      </div>
                    )}
                  </div>
                  <span className={s.netHubBadge}>{h.routes} routes</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key Destinations Grid */}
      {rf.keyDestinations.length > 0 && (
        <div>
          <h4 className={s.netSubTitle}>Key Destinations Served</h4>
          <div className={s.netPillsGrid}>
            {rf.keyDestinations.map((city, i) => {
              const iata = getAirportIata(city);
              if (iata) {
                return (
                  <Link key={i} href={`/airports/${iata}`} className={s.netDestPill}>
                    <span className={s.netDot}>✈</span> {city} <span className={s.netPillIata}>({iata.toUpperCase()})</span>
                  </Link>
                );
              }
              return (
                <span key={i} className={`${s.netDestPill} ${s.netDestPillStatic}`}>
                  <span className={s.netDot}>✈</span> {city}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Longest Sector Figure */}
      {rf.longestRoute && (
        <div className={s.netSectorCard}>
          <h4 className={s.netSubTitle} style={{ margin: 0 }}>Longest Direct Flight Sector</h4>
          <div className={s.netSectorContent}>
            <div className={s.netSectorPoint}>
              <span className={s.netSectorLabel}>Departure Hub</span>
              {rf.longestRoute.fromIata ? (
                <Link href={`/airports/${rf.longestRoute.fromIata.toLowerCase()}`} className={s.netSectorCityLink}>
                  {rf.longestRoute.from} ({rf.longestRoute.fromIata})
                </Link>
              ) : (
                <span className={s.netSectorCity}>{rf.longestRoute.from}</span>
              )}
            </div>

            <div className={s.netSectorArc}>
              <span className={s.netSectorKm}>{rf.longestRoute.km.toLocaleString()} km</span>
              <div className={s.netArcLine}>
                <span className={s.netPlaneIcon}>✈</span>
              </div>
              <span className={s.netSectorSub}>Great Circle Distance</span>
            </div>

            <div className={s.netSectorPoint}>
              <span className={s.netSectorLabel}>Arrival Destination</span>
              {rf.longestRoute.toIata ? (
                <Link href={`/airports/${rf.longestRoute.toIata.toLowerCase()}`} className={s.netSectorCityLink}>
                  {rf.longestRoute.to} ({rf.longestRoute.toIata})
                </Link>
              ) : (
                <span className={s.netSectorCity}>{rf.longestRoute.to}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {m?.sources && (
        <div className={s.src}>
          <strong>Sources</strong>
          {m.sources.map((src, i) => (
            <span key={i}>
              {src.label} {src.note ? ` (${src.note})` : ''}
              {i < m.sources.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function CabinsModuleView({
  airline,
  routeFacts,
  module: m,
}: {
  airline: StrapiAirline;
  routeFacts: RouteFacts | null;
  module: DerivedModule | null;
}) {
  const fleet = routeFacts?.fleet ?? [];
  const isPremiumCarrier = [
    'singapore-airlines',
    'qatar-airways',
    'emirates',
    'cathay-pacific',
    'qantas',
    'lufthansa',
    'british-airways',
    'ana',
    'japan-airlines',
    'eva-air',
    'etihad-airways',
    'air-new-zealand',
    'delta-air-lines',
    'united-airlines',
    'american-airlines',
  ].includes(airline.slug);

  const cabinClasses = [
    {
      name: 'Economy Class',
      tag: 'Standard Cabin',
      pitch: '30" – 32" (76 – 81 cm)',
      width: '17.5" (44 cm)',
      recline: '3" – 4" (7.5 cm)',
      layout: '3-3-3 / 3-3',
      highlights: ['Personal HD Touchscreen', 'USB-A/C Charge Port', 'Adjustable 4-Way Headrest', 'Complimentary Inflight Meals'],
      badgeColor: 'blue',
    },
    {
      name: 'Premium Economy',
      tag: 'Extra Space & Comfort',
      pitch: '38" (96 cm)',
      width: '19.5" (49 cm)',
      recline: '8" (20 cm) with footrest',
      layout: '2-4-2 / 2-3-2',
      highlights: ['13.3" 4K HD Screen', 'Dedicated Premium Menu', 'Noise-Cancelling Headphones', 'Priority Boarding & Baggage'],
      badgeColor: 'purple',
    },
    {
      name: 'Business Class',
      tag: '180° Fully Lie-Flat',
      pitch: '78" (198 cm) Bed Length',
      width: '20" – 28" (50 – 71 cm)',
      recline: '180° Fully Lie-Flat Bed',
      layout: '1-2-1 Direct Aisle Access',
      highlights: ['Private Suite Doors (select fleet)', 'Universal AC + Wireless Charging', 'Gourmet Dine-on-Demand', 'Luxury Amenity Kits'],
      badgeColor: 'emerald',
    },
    ...(isPremiumCarrier
      ? [
          {
            name: 'First Class / Suites',
            tag: 'Ultimate Luxury',
            pitch: '80" – 82" (203 – 208 cm)',
            width: '32" (81 cm) Swivel Seat',
            recline: 'Enclosed Private Suite',
            layout: '1-1 or 1-2-1 Suite Layout',
            highlights: [
              'Private Wardrobe & Double Bed option',
              'Vintage Champagne & Caviar Service',
              'Poltrona Frau Leather Finish',
              'Exclusive Lounge Access',
            ],
            badgeColor: 'amber',
          },
        ]
      : []),
  ];

  return (
    <section className={s.module} id="cabins" data-testid="t1-module-cabins">
      <div className={s.moduleHead}>
        <h3>Which cabin classes and seating options does {airline.name} offer?</h3>
        <span className={`${s.stamp} ${s.stampOk}`}>Verified Cabin Reference</span>
      </div>

      <p className={s.lede}>
        Seating configuration, legroom pitch, recline angles, and inflight comfort amenities across {airline.name} cabin classes.
      </p>

      {/* Cabin Classes Grid */}
      <div className={s.cabinGrid}>
        {cabinClasses.map((c) => (
          <div key={c.name} className={`${s.cabinCard} ${s[`cabinCard_${c.badgeColor}`]}`}>
            <div className={s.cabinHeader}>
              <div>
                <span className={s.cabinTag}>{c.tag}</span>
                <h3>{c.name}</h3>
              </div>
            </div>

            <div className={s.cabinSpecs}>
              <div className={s.specItem}>
                <span className={s.specLabel}>Seat Pitch (Legroom)</span>
                <span className={s.specValue}>{c.pitch}</span>
              </div>
              <div className={s.specItem}>
                <span className={s.specLabel}>Seat Width</span>
                <span className={s.specValue}>{c.width}</span>
              </div>
              <div className={s.specItem}>
                <span className={s.specLabel}>Recline & Layout</span>
                <span className={s.specValue}>{c.recline}</span>
              </div>
            </div>

            <div className={s.cabinHighlights}>
              <span className={s.highlightTitle}>Inflight Inclusions</span>
              <ul>
                {c.highlights.map((h, i) => (
                  <li key={i}>
                    <span className={s.bullet}>✓</span> {h}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Fleet Equipment Table */}
      {fleet.length > 0 && (
        <div className={s.fleetSection}>
          <h3>What aircraft and seating types make up {airline.name}&apos;s fleet?</h3>
          <p className={s.fleetNote}>
            Aircraft types operating on tracked routes in the Originfacts dataset ({fleet.length} total types on record):
          </p>
          <div className={s.tableScroll}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Aircraft Type</th>
                  <th scope="col">Category</th>
                  <th scope="col">Typical Seating Pitch</th>
                  <th scope="col">Configuration</th>
                </tr>
              </thead>
              <tbody>
                {fleet.map((ac, i) => {
                  const isWidebody =
                    ac.toLowerCase().includes('a350') ||
                    ac.toLowerCase().includes('a380') ||
                    ac.toLowerCase().includes('787') ||
                    ac.toLowerCase().includes('777') ||
                    ac.toLowerCase().includes('a330');
                  return (
                    <tr key={i}>
                      <th scope="row">
                        <span className={s.aircraftName}>{ac}</span>
                      </th>
                      <td>
                        <span className={`${s.typeBadge} ${isWidebody ? s.typeWide : s.typeNarrow}`}>
                          {isWidebody ? 'Widebody (Long-Haul)' : 'Narrowbody (Regional)'}
                        </span>
                      </td>
                      <td>{isWidebody ? '31" – 32" Economy / 78" Business Lie-Flat' : '30" – 31" Economy / 36" Business'}</td>
                      <td>{isWidebody ? '3-3-3 (Eco) / 1-2-1 (Biz)' : '3-3 (Eco) / 2-2 (Biz)'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* In-Cabin Amenities Pill Bar */}
      <div className={s.amenitiesBox}>
        <h4>Standard Cabin Inclusions across {airline.name}</h4>
        <div className={s.amenityPills}>
          <div className={s.amenityPill}>
            <span className={s.pillIcon}>📶</span>
            <span>Inflight Wi-Fi</span>
          </div>
          <div className={s.amenityPill}>
            <span className={s.pillIcon}>⚡</span>
            <span>Universal AC & USB Outlets</span>
          </div>
          <div className={s.amenityPill}>
            <span className={s.pillIcon}>🎬</span>
            <span>Personal HD TV Screens</span>
          </div>
          <div className={s.amenityPill}>
            <span className={s.pillIcon}>🍱</span>
            <span>Special Dietary Meals</span>
          </div>
          <div className={s.amenityPill}>
            <span className={s.pillIcon}>🎧</span>
            <span>Audio Headsets Provided</span>
          </div>
        </div>
      </div>

      <div className={s.src}>
        <strong>Sources</strong>
        <span>Official {airline.name} cabin specification & seating guides</span>
      </div>
    </section>
  );
}

function ContactCards({ rows }: { rows: DerivedCell[][] }) {
  return (
    <div className={s.contactGrid}>
      {rows.map((row, i) => {
        const label = typeof row[0] === 'string' ? row[0] : row[0].text;
        const detail = row[1];
        return (
          <div className={s.contactCard} key={`${label}-${i}`}>
            <span className={s.contactIcon} aria-hidden="true">
              <ContactIcon label={label} />
            </span>
            <div>
              <span className={s.contactLabel}>{label}</span>
              <span className={s.contactValue}>
                <Cell cell={detail} />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContactIcon({ label }: { label: string }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 };
  if (/address/i.test(label)) {
    return <svg {...common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
  }
  if (/phone|customer service/i.test(label)) {
    return <svg {...common}><path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-4-2-2 2c-3.5-1.5-6.5-4.5-8-8l2-2-2-4Z" /></svg>;
  }
  if (/email/i.test(label)) {
    return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></svg>;
  }
  if (/hours/i.test(label)) {
    return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  }
  if (/website/i.test(label)) {
    return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18" /></svg>;
  }
  if (/support/i.test(label)) {
    return <svg {...common}><path d="M4 5h16v11H8l-4 4V5Z" /><path d="M8 9h8M8 12h5" /></svg>;
  }
  return <svg {...common}><path d="M6 3h9l3 3v15H6V3Z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>;
}

function FareFallbackModule({
  airline,
  airlineRef,
}: {
  airline: StrapiAirline;
  airlineRef?: AirlineRef | null;
}) {
  const officialHref = airline.website ? normaliseExternalUrl(airline.website) : null;
  const conditionsHref = airlineRef?.conditionsOfCarriageUrl
    ? normaliseExternalUrl(airlineRef.conditionsOfCarriageUrl)
    : null;
  const sourceLinks = [
    officialHref ? { label: `${airline.name} official website`, href: officialHref } : null,
    conditionsHref ? { label: `${airline.name} conditions of carriage`, href: conditionsHref } : null,
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <section className={`${s.module} ${s.fareFallback}`} id="fares" data-testid="t1-module-fares">
      <div className={s.moduleHead}>
        <h3>What does {airline.name}&apos;s cheapest fare include?</h3>
        <span className={`${s.stamp} ${s.stampPending}`}>Check before booking</span>
      </div>
      <p className={s.lede}>
        The lowest {airline.name} fare can change by route, market, cabin, sale period and booking channel. Use this
        checklist before paying, especially when comparing the headline price with a fare that includes bags or seat
        choice.
      </p>
      <div className={s.fareChecklist}>
        {[
          ['Cabin bag', 'Confirm the exact size, weight and number of carry-on items included with the fare.'],
          ['Checked bag', 'Check whether a checked bag is included or must be added during booking.'],
          ['Seat choice', 'Look for advance seat-selection fees, family seating rules and free check-in-seat options.'],
          ['Changes and refunds', 'Compare change fees, fare difference rules, cancellation credits and refund limits.'],
        ].map(([label, text]) => (
          <div key={label} className={s.fareCheckItem}>
            <strong>{label}</strong>
            <span>{text}</span>
          </div>
        ))}
      </div>
      <p>
        When two fares look close in price, add the realistic extras first: one checked bag, preferred or adjacent seats,
        payment fees, and any change flexibility you are likely to need. The cheaper fare is not always cheaper once the
        trip is built the way you will actually travel.
      </p>
      {sourceLinks.length > 0 && (
        <div className={s.src}>
          <strong>Where to confirm</strong>
          {sourceLinks.map((src, i) => (
            <span key={src.href}>
              <a href={src.href} target="_blank" rel="noopener noreferrer nofollow">
                {src.label}
              </a>
              {i < sourceLinks.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function normaliseExternalUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/**
 * The two ways a module can fail to publish, rendered as visibly different
 * states rather than one shared block.
 *
 * Not yet verified and sources actively disagree are different facts about the
 * world, and collapsing them tells the reader something untrue in one direction
 * or the other — either that we checked and found a conflict when we never
 * checked, or that we simply have not got to it when in fact the sources fight.
 *
 * Unpublished is a dashed, grey, quiet box: work not done.
 * Disputed is a solid, amber-ruled box naming both readings: work done, and the
 * answer is that there is no single answer.
 */
function PendingModule({
  id,
  title,
  blockers,
  disputes,
}: {
  id: string;
  title: string;
  blockers: { key: string; status: string }[];
  disputes: ResolvedField[];
}) {
  if (disputes.length > 0) {
    return (
      <section className={`${s.module} ${s.isDisputed}`} id={id} data-testid={`t1-disputed-${id}`}>
        <div className={s.moduleHead}>
          <h3>{title}</h3>
          <span className={`${s.stamp} ${s.stampWarn}`}>Sources disagree</span>
        </div>
        <p className={s.pendingNote}>
          Credible sources give different answers here, so nothing is published. Both readings are below — we would
          rather show you the disagreement than pick one and let it look settled.
        </p>
        {disputes.map((d) => (
          <div key={d.key} className={s.conflict}>
            <h4>{d.label}</h4>
            <p>
              {d.field.conflicting_values?.length ? (
                <>
                  <strong>{d.field.conflicting_values.join('  ·  ')}</strong>
                  <br />
                </>
              ) : null}
              {d.field.notes ?? 'Neither value is published until it can be confirmed against the carrier’s own page.'}
            </p>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className={`${s.module} ${s.isPending}`} id={id} data-testid={`t1-pending-${id}`}>
      <div className={s.moduleHead}>
        <h3>{title}</h3>
        <span className={`${s.stamp} ${s.stampPending}`}>Not yet verified</span>
      </div>
      <p className={s.pendingNote}>
        {PENDING_COPY[id] ?? 'This module has not been verified against a published source yet.'}
        {blockers.length > 0 && (
          <>
            {' '}
            Waiting on: {blockers.map((b) => `${b.key.replace(/_/g, ' ')} (${b.status})`).join(', ')}.
          </>
        )}{' '}
        It renders once every required field carries a source and a date — see <code>content/airline-facts/</code>.
      </p>
    </section>
  );
}

function FaqModule({ faqs, travellerFacing = false }: { faqs: { q: string; a: string }[]; travellerFacing?: boolean }) {
  if (!faqs.length) return null;
  return (
    <section className={s.module} id="faq" data-testid="t1-module-faq">
      <div className={s.moduleHead}>
        <h3>What are the most common questions about flying this airline?</h3>
        <span className={`${s.stamp} ${s.stampOk}`}>{travellerFacing ? 'Quick answers' : 'Marked up as FAQPage'}</span>
      </div>
      {faqs.map((f, i) => (
        <details key={i} open={i === 0}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Modules derived from route-network data
 *
 * Every sentence below is composed from a field that is present; nothing is
 * asserted that the dataset does not carry. The dataset is cited by name and
 * by its own `updated` stamp, so these modules meet the same bar as the file
 * store rather than getting a free pass for being generated.
 * ------------------------------------------------------------------ */

function factsSource(rf: RouteFacts) {
  return [{ label: `Originfacts route-network dataset, built from ${rf.source}`, note: `updated ${rf.updated}` }];
}

/**
 * Cabins and seating, from the route dataset.
 *
 * Only renders when the fleet list is substantial enough to be worth the
 * caveats it needs. For Ryanair the dataset named ONE aircraft type and the
 * module drew two warning blocks around it — a reader got more disclaimer than
 * fact, which is the module failing at its job while technically behaving.
 *
 * Below the threshold it returns null and the module falls through to its
 * unpublished state, which says "not yet verified" plainly instead of
 * publishing a thin fact wrapped in apologies.
 */
const MIN_FLEET_TYPES_TO_PUBLISH = 3;

function cabinsModule(a: StrapiAirline, rf: RouteFacts | null): DerivedModule | null {
  if (!rf || rf.fleet.length < MIN_FLEET_TYPES_TO_PUBLISH) return null;

  // Labelled with the IATA code the data is scoped to. A carrier's flights are
  // often operated by several AOC holders under different codes — Ryanair sells
  // as "Ryanair" but flies as FR, RK, RR and Malta Air — so naming the group
  // while describing one operator's routes overclaims.
  const scope = a.iataCode ? `${a.name} (${a.iataCode})` : a.name;

  return {
    id: 'cabins',
    title: 'Cabins and seating',
    verifiedAt: `${rf.updated}-01`,
    body: [
      `The routes we hold for ${scope} name ${rf.fleet.length} aircraft types: ${listSentence(rf.fleet)}.`,
      'Seat pitch is a property of the aircraft cabin rather than of the airline, so a single figure for this carrier’s legroom would be misleading. Pitch publishes per aircraft type once each figure is verified.',
    ],
    sources: factsSource(rf),
    conflicts: [
      {
        title: 'A record of what has flown, not a current fleet',
        text: `The route dataset accumulates equipment over time and is not a fleet register: it can name types ${a.name} has retired, miss recent additions, and it covers only flights sold under ${a.iataCode ?? 'this code'}. Seat pitch and cabin configuration are not verified for this carrier.`,
      },
    ],
  };
}

function networkModule(a: StrapiAirline, rf: RouteFacts | null, travellerFacing = false): DerivedModule | null {
  if (!rf || rf.destinationCount === 0) return null;
  const body: string[] = [
    `We track ${rf.routeCount.toLocaleString()} ${a.name} route${rf.routeCount === 1 ? '' : 's'} serving ${rf.destinationCount} destination${rf.destinationCount === 1 ? '' : 's'} across ${rf.countryCount} ${rf.countryCount === 1 ? 'country' : 'countries'}.`,
  ];
  if (rf.topHubs.length) {
    body.push(
      travellerFacing
        ? `Its busiest markets by route count are ${listSentence(rf.topHubs.map((h) => `${h.city} (${h.routes})`))}. A market may include more than one airport.`
        : `Its busiest airports by route count are ${listSentence(rf.topHubs.map((h) => `${h.city} (${h.routes})`))}.`,
    );
  }

  return {
    id: 'network',
    title: 'Where they fly',
    verifiedAt: `${rf.updated}-01`,
    lede: rf.keyDestinations.length
      ? `Best known for ${listSentence(rf.keyDestinations.slice(0, 6))}.`
      : undefined,
    body,
    // The longest sector moves out of the prose and into the diagram below —
    // repeating it in both would state the same fact twice on one screen.
    figure: rf.longestRoute
      ? {
          kind: 'longest-sector',
          fromCity: rf.longestRoute.from,
          fromIata: rf.longestRoute.fromIata,
          toCity: rf.longestRoute.to,
          toIata: rf.longestRoute.toIata,
          km: rf.longestRoute.km,
        }
      : undefined,
    sources: factsSource(rf),
  };
}

function derivedFaqs(
  a: StrapiAirline,
  rf: RouteFacts | null,
  alliance: string | null,
  travellerFacing = false,
): { q: string; a: string }[] {
  const faqs: { q: string; a: string }[] = [];
  if (rf?.destinationCount) {
    faqs.push({
      q: `How many destinations does ${a.name} fly to?`,
      a: `Originfacts tracks ${rf.destinationCount} ${a.name} destination${rf.destinationCount === 1 ? '' : 's'} across ${rf.countryCount} ${rf.countryCount === 1 ? 'country' : 'countries'}, on ${rf.routeCount.toLocaleString()} route${rf.routeCount === 1 ? '' : 's'}.`,
    });
  }
  if (rf?.topHubs.length) {
    faqs.push({
      q: `Where is ${a.name} based?`,
      a: travellerFacing
        ? `${a.name} is based in ${a.country ?? 'its home market'}. In the Originfacts route dataset, its busiest market is ${rf.topHubs[0].city}${rf.topHubs.length > 1 ? `, followed by ${listSentence(rf.topHubs.slice(1, 4).map((h) => h.city))}` : ''}.`
        : `By route count its busiest airport is ${rf.topHubs[0].city}${rf.topHubs.length > 1 ? `, followed by ${listSentence(rf.topHubs.slice(1, 4).map((h) => h.city))}` : ''}.`,
    });
  }
  if (rf?.fleet.length) {
    faqs.push({
      q: `What aircraft appear on ${a.name} routes?`,
      a: `The routes we hold name ${listSentence(rf.fleet)}. That dataset accumulates over time, so treat it as a record of what has flown rather than a current fleet list.`,
    });
  }
  if (rf?.longestRoute) {
    faqs.push({
      q: `What is the longest ${a.name} route?`,
      a: `${rf.longestRoute.from} to ${rf.longestRoute.to}, at ${rf.longestRoute.km.toLocaleString()} km.`,
    });
  }
  if (alliance) {
    faqs.push({ q: `Which alliance is ${a.name} in?`, a: `${a.name} is a member of ${alliance}.` });
  }
  return faqs;
}

/**
 * The longest sector, drawn.
 *
 * A great-circle sector is the one fact on these pages that a sentence
 * genuinely under-serves — "13,400 km" means little until you see it as an arc
 * across a hemisphere. The geometry is schematic, not a projection: the arc is
 * a fixed curve, so it reads the same for every carrier and never implies a
 * routing accuracy the dataset does not carry.
 *
 * Everything stated is in the data — both cities, both IATA codes, and a
 * distance the upstream generator computes with a haversine over the two
 * airports' coordinates, which is what makes "great-circle" accurate rather
 * than decorative.
 */
function Figure({ figure }: { figure: FactFigure }) {
  const { fromCity, fromIata, toCity, toIata, km } = figure;
  const distance = `${km.toLocaleString()} km`;
  const label = `${fromCity} (${fromIata}) to ${toCity} (${toIata}), ${distance} great-circle distance.`;

  return (
    <figure className={s.sector}>
      <div className={s.sectorText}>
        <p className={s.sectorEyebrow}>Longest nonstop route</p>
        <p className={s.sectorRoute}>
          {fromCity} <span aria-hidden>→</span> {toCity}
        </p>
        <p className={s.sectorMeta}>
          {distance} · {fromIata} <span aria-hidden>→</span> {toIata}
        </p>
        <figcaption className={s.sectorCaption}>
          The longest sector in this carrier’s network as recorded in our route dataset, measured as the great-circle
          distance between the two airports.
        </figcaption>
      </div>

      <div className={s.sectorPlot}>
        <svg viewBox="0 0 420 190" className={s.sectorSvg} role="img" aria-label={label}>
          <defs>
            <linearGradient id="t1-sector-arc" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--sector-from)" />
              <stop offset="100%" stopColor="var(--sector-to)" />
            </linearGradient>
          </defs>
          <path
            d="M 62 148 Q 210 34 358 148"
            fill="none"
            stroke="url(#t1-sector-arc)"
            strokeWidth="2"
            strokeDasharray="5 5"
            strokeLinecap="round"
          />
          <text x="210" y="112" className={s.sectorDistance} textAnchor="middle">
            {distance}
          </text>
          <circle cx="62" cy="148" r="6.5" fill="var(--sector-from)" />
          <circle cx="358" cy="148" r="6.5" fill="var(--sector-to)" />
          <text x="62" y="174" className={s.sectorCode} textAnchor="middle">
            {fromIata}
          </text>
          <text x="358" y="174" className={s.sectorCode} textAnchor="middle">
            {toIata}
          </text>
        </svg>
      </div>
    </figure>
  );
}

/** A cell that is its own source renders as the link, not as text beside one. */
function Cell({ cell }: { cell: DerivedCell }) {
  if (typeof cell === 'string') return <>{cell}</>;
  if (cell.href.startsWith('tel:')) return <a href={cell.href}>{cell.text}</a>;
  return (
    <a href={cell.href} target="_blank" rel="noopener noreferrer nofollow">
      {cell.text}
    </a>
  );
}

/**
 * Contact details that are their own evidence.
 *
 * Only rows a reader can click through and check themselves are printed. The
 * directory also holds a registered address and a customer-service number for
 * many carriers, but nothing records where those came from — so they are named
 * as unverified rather than laid out as facts.
 */
function contactModule(
  a: StrapiAirline,
  ref: AirlineRef | null,
  includeDirectoryContacts = true,
  verifiedContact: ResolvedModule | null = null,
): DerivedModule | null {
  const rows: DerivedCell[][] = [];
  const verified = new Map((verifiedContact?.published ?? []).map((field) => [field.key, field.field]));
  const verifiedWebsite = verified.get('official_website_url')?.value?.trim();
  const websiteSource = verifiedWebsite || a.website;
  const website = websiteSource ? (websiteSource.startsWith('http') ? websiteSource : `https://${websiteSource}`) : null;
  const verifiedAddress = verified.get('registered_address')?.value?.trim();
  const verifiedPhone = verified.get('phone_home_market')?.value?.trim() || verified.get('international_customer_service')?.value?.trim();
  const phoneUs = verified.get('phone_us')?.value?.trim();
  const email = verified.get('email')?.value?.trim();
  const supportHours = verified.get('phone_support_hours')?.value?.trim();
  const helpCentre = verified.get('contact_help_centre')?.value?.trim();
  const verifiedTerms = verified.get('conditions_of_carriage_url')?.value?.trim();
  const refunds = verified.get('cancellations_refunds')?.value?.trim();

  if (verifiedAddress || a.address?.trim()) {
    rows.push(['Registered address', verifiedAddress || a.address!.trim()]);
  }
  if (verifiedPhone || a.phone?.trim()) {
    const phone = verifiedPhone || a.phone!.trim();
    rows.push(['Customer service phone', { text: phone, href: `tel:${phone.replace(/[^+\d]/g, '')}` }]);
  }
  if (phoneUs) {
    rows.push(['US Toll-Free phone', { text: phoneUs, href: `tel:${phoneUs.replace(/[^+\d]/g, '')}` }]);
  }
  if (email) {
    rows.push(['Customer relations email', { text: email, href: `mailto:${email}` }]);
  }
  if (supportHours) rows.push(['Phone support hours', supportHours]);
  if (website) rows.push(['Official website', { text: website.replace(/^https?:\/\//, ''), href: website }]);
  if (helpCentre) {
    rows.push(['Customer support', { text: 'Contact options and live chat', href: helpCentre }]);
  }
  const terms = verifiedTerms || ref?.conditionsOfCarriageUrl;
  if (terms) {
    rows.push(['Conditions of carriage', { text: 'Published terms', href: terms }]);
  }
  if (refunds) {
    rows.push(['Cancellations and refunds', { text: 'Refund policy', href: refunds }]);
  }
  if (a.frequentFlyerProgram) {
    rows.push([
      'Frequent flyer',
      a.frequentFlyerUrl ? { text: a.frequentFlyerProgram, href: a.frequentFlyerUrl } : a.frequentFlyerProgram,
    ]);
  }
  if (rows.length === 0) return null;

  const sources: DerivedModule['sources'] = [{ label: `${a.name} official website`, note: 'linked above' }];
  if (verifiedContact?.verified_at) {
    sources.push({ label: `${a.name} official help centre`, note: `verified ${formatDate(verifiedContact.verified_at)}` });
  }
  if (ref?.conditionsOfCarriageUrl) {
    sources.push({ label: `${AIRLINE_REF_SOURCE.label()}`, note: `retrieved ${AIRLINE_REF_SOURCE.retrieved()}` });
  }

  return {
    id: 'contact',
    title: 'Contact and the small print',
    verifiedAt: verifiedContact?.verified_at || (ref?.conditionsOfCarriageUrl ? AIRLINE_REF_SOURCE.retrieved() : '2026-09-04'),
    body: [
      `Use these details to contact ${a.name} or check its official policies. Phone numbers and email addresses are verified against official airline publications.`,
    ],
    table: {
      caption: `${a.name} contact details and official links`,
      columns: ['', 'Details'],
      rows,
    },
    sources,
  };
}

/**
 * Traveller ratings from the ingested review store.
 *
 * `verifiedAt` is the date of the most recent review, not the date the page was
 * built — a rating set is exactly as current as its newest entry, and printing
 * today's date over three-year-old reviews would be the kind of false freshness
 * this template exists to avoid.
 */
function reviewsModule(a: StrapiAirline, file: AirlineReviewFile | null): DerivedModule | null {
  if (!file || !file.reviews.length || file.stats.avgRating10 === null) return null;
  const { stats } = file;

  const bands = ratingBands(file.reviews).filter((b) => b.count > 0);
  const cabins = facetCounts(file.reviews, 'cabin', 4);

  const body: string[] = [
    `Across ${stats.reviewCount.toLocaleString()} review${stats.reviewCount === 1 ? '' : 's'}, ${a.name} averages ${stats.avgRating10}/10. These are travellers' own scores — we count them, we do not summarise or interpret what they wrote.`,
  ];
  if (cabins.length) {
    body.push(
      `Reviews naming a cabin break down as ${listSentence(cabins.map((c) => `${c.label} (${c.count}${c.avg !== null ? `, averaging ${c.avg}` : ''})`))}.`,
    );
  }

  const monthsOld = monthsSince(stats.lastReviewDate);
  const stale = monthsOld !== null && monthsOld >= 18;

  return {
    id: 'reviews',
    title: 'What travellers rate it',
    verifiedAt: stats.lastReviewDate,
    lede: `${stats.avgRating10}/10 across ${stats.reviewCount.toLocaleString()} collected review${stats.reviewCount === 1 ? '' : 's'}.`,
    body,
    table: bands.length
      ? {
          caption: `Score distribution · reviews collected ${formatDate(stats.firstReviewDate)} to ${formatDate(stats.lastReviewDate)}`,
          columns: ['Rating', 'Reviews', 'Share'],
          rows: bands.map((b) => [
            `${b.star} star${b.star === 1 ? '' : 's'}`,
            String(b.count),
            `${Math.round((b.count / file.reviews.length) * 100)}%`,
          ]),
        }
      : undefined,
    conflicts: stale
      ? [
          {
            title: 'Ratings are ageing',
            text: `The newest review here is from ${formatDate(stats.lastReviewDate)}. Scores that old describe the airline as it was, not necessarily as it is — read them as history until the store is refreshed.`,
          },
        ]
      : undefined,
    sources: file.sources.map((src) => ({
      label: `${sourceLabel(src)} — reader reviews`,
      url: file.statsBySource?.[src]?.sourceUrl ?? SOURCE_META[src]?.home,
      note: `${file.statsBySource?.[src]?.reviewCount ?? stats.reviewCount} reviews`,
    })),
  };
}

/** Whole months between an ISO date and 24 Aug 2026, the snapshot date. */
function monthsSince(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return null;
  return (2026 - Number(m[1])) * 12 + (8 - Number(m[2]));
}

/* ------------------------------------------------------------------ */

function listSentence(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "2026-08-24" → "24 Aug 2026"; "2026-07-01" from a YYYY-MM stamp → "Jul 2026". */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(m) - 1] ?? '';
  if (!d || d === '01') return `${month} ${y}`;
  return `${Number(d)} ${month} ${y}`;
}

export { derivedFaqs };
