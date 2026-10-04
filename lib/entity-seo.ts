/**
 * Shared SEO/enrichment helpers for the data-driven entity pages
 * (airports, airlines, countries, destinations).
 *
 * Two jobs:
 *  1. Quality gate — `*IsSubstantive()` decides whether a page carries enough
 *     real, page-specific information to deserve indexing. Pages that fail are
 *     served `robots: noindex, follow` and dropped from the sitemap, so Google
 *     only sees pages with genuine content (the fix for the "scaled/low-value
 *     content" AdSense rejection). They stay live for users, and re-enter the
 *     index automatically the moment they gain an `about`, routes, or full geo.
 *  2. Content builders — factual intro prose, FAQ Q&As, and schema.org JSON-LD
 *     derived ONLY from data that exists (no fabrication), to give the pages
 *     that DO pass the gate substantive, unique, structured content.
 *
 * `INDEX_MIN_ABOUT_CHARS` is the single tunable knob for gate strictness.
 */
import type { StrapiAirport, StrapiAirline, StrapiRoute, StrapiCountry } from '@/lib/strapi';
import { getCountryFacts } from '@/lib/country-facts';

export const SITE_URL = 'https://www.originfacts.com';

/**
 * Default social share image (1200×630), used sitewide via app/layout.tsx and
 * as the per-page fallback wherever an entity has no image of its own.
 * Regenerate with: node scripts/generate-og-default.mjs
 */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og/default.png`;

/** An `about` shorter than this is treated as effectively empty for gating. */
export const INDEX_MIN_ABOUT_CHARS = 120;

const hasText = (s?: string | null): s is string =>
  typeof s === 'string' && s.trim().length >= INDEX_MIN_ABOUT_CHARS;

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export type Faq = { q: string; a: string };

/** Strips tags + collapses whitespace so schema answers are plain text. */
const plainText = (s: string): string =>
  s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Normalises the free-form `faqs` json field editors fill in Strapi into a
 * clean Faq[]. Accepts `{q, a}` or `{question, answer}` entry shapes, drops
 * anything malformed or empty, and strips HTML. Returns [] unless at least
 * MIN_FAQS real Q&As survive — FAQPage markup with 0-1 entries is worthless
 * and placeholder rows must never reach the schema.
 */
export const MIN_FAQS = 2;

export function normalizeFaqs(raw: unknown): Faq[] {
  if (!Array.isArray(raw)) return [];
  const faqs: Faq[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const rec = entry as Record<string, unknown>;
    const q = rec.q ?? rec.question;
    const a = rec.a ?? rec.answer;
    if (typeof q !== 'string' || typeof a !== 'string') continue;
    const cleanQ = plainText(q);
    const cleanA = plainText(a);
    if (!cleanQ || !cleanA) continue;
    faqs.push({ q: cleanQ, a: cleanA });
  }
  return faqs.length >= MIN_FAQS ? faqs : [];
}

export type KeyFact = { label?: string; value: string };

/**
 * Normalises the `keyFacts` json field: accepts plain strings or
 * {label, value} entries, strips HTML, drops empties.
 */
export function normalizeKeyFacts(raw: unknown): KeyFact[] {
  if (!Array.isArray(raw)) return [];
  const facts: KeyFact[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const value = plainText(entry);
      if (value) facts.push({ value });
      continue;
    }
    if (typeof entry !== 'object' || entry === null) continue;
    const rec = entry as Record<string, unknown>;
    const value = typeof rec.value === 'string' ? plainText(rec.value) : '';
    if (!value) continue;
    const label = typeof rec.label === 'string' ? plainText(rec.label) : '';
    facts.push(label ? { label, value } : { value });
  }
  return facts;
}

export type HowToStep = { name: string; text: string; image?: string };

/**
 * Normalises the `steps` json field on how-to/itinerary articles. A filled
 * steps field is the explicit editorial flag that a post is a HowTo — no
 * heading-derived guessing. Entry shape: {name, text, image?} ({title, ...}
 * also accepted). Under MIN_STEPS valid entries → [] and the article keeps
 * plain Article schema.
 */
export const MIN_STEPS = 2;

export function normalizeSteps(raw: unknown): HowToStep[] {
  if (!Array.isArray(raw)) return [];
  const steps: HowToStep[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const rec = entry as Record<string, unknown>;
    const name = rec.name ?? rec.title;
    const text = rec.text ?? rec.description;
    if (typeof name !== 'string' || typeof text !== 'string') continue;
    const cleanName = plainText(name);
    const cleanText = plainText(text);
    if (!cleanName || !cleanText) continue;
    const image = typeof rec.image === 'string' && rec.image.trim() ? rec.image.trim() : undefined;
    steps.push({ name: cleanName, text: cleanText, ...(image ? { image } : {}) });
  }
  return steps.length >= MIN_STEPS ? steps : [];
}

/** HowTo JSON-LD for step-based articles — emitted INSTEAD of Article. */
export function howToJsonLd(opts: {
  name: string;
  description?: string;
  url: string;
  image?: string | null;
  totalTimeMinutes?: number;
  steps: HowToStep[];
}): Record<string, unknown> | null {
  if (opts.steps.length < MIN_STEPS) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.image ? { image: [opts.image] } : {}),
    ...(opts.totalTimeMinutes ? { totalTime: `PT${opts.totalTimeMinutes}M` } : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': opts.url },
    step: opts.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
      ...(s.image ? { image: s.image } : {}),
      url: `${opts.url}#step-${i + 1}`,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Quality gate
 * ------------------------------------------------------------------ */

/**
 * A page is substantive enough to index when it has REAL content — a written
 * `about` profile OR genuine network data (≥1 tracked route). Identity fields
 * alone (IATA/ICAO/country) are NOT enough: a code-only stub with no routes and
 * no profile is exactly the thin, templated page that triggers the AdSense
 * "scaled content" rejection, so it is noindex+follow until it earns content.
 *
 * `hasRoutes` is supplied by the caller — the page passes `routes.length > 0`;
 * the sitemap passes route-coverage set membership (see fetchRouteCoverage).
 */
export function airportIsSubstantive(a: StrapiAirport, hasRoutes: boolean): boolean {
  return hasText(a.about) || hasRoutes;
}

export function airlineIsSubstantive(a: StrapiAirline, hasRoutes: boolean): boolean {
  // A page is substantive (indexable + in the sitemap) once it carries real
  // generated content: a long-enough About, a full 8-question FAQ set, or
  // tracked routes. Thin, un-enriched airlines stay noindex until content
  // lands — then they flip automatically, no manual un-exclusion needed.
  const faqCount = Array.isArray(a.faqs)
    ? a.faqs.filter((f) => f && (f as { q?: string; a?: string }).q && (f as { q?: string; a?: string }).a).length
    : 0;
  return hasText(a.about) || hasRoutes || faqCount >= 8;
}

export function countryHasData(c: Pick<StrapiCountry, 'code' | 'about'>): boolean {
  return hasText(c.about) || Boolean(getCountryFacts(c.code));
}

/** Next.js metadata `robots` block for a gated page. */
/**
 * Airport pages are temporarily noindexed for the AdSense review — the 3.5k
 * templated pages read as "low value content" to reviewers. Flip back to true
 * after approval to restore indexing (sitemap entries in app/sitemap.ts too).
 */
export const AIRPORTS_INDEXABLE = false;

export const robotsFor = (indexable: boolean) =>
  indexable
    ? { index: true, follow: true }
    : { index: false, follow: true };

/* ------------------------------------------------------------------ *
 * Derived facts from a route list
 * ------------------------------------------------------------------ */

export type RouteSummary = {
  destinationCount: number;
  countryCount: number;
  carrierCount: number;
  destinationNames: string[];
  countryNames: string[];
  carriers: { name: string; slug: string; iataCode?: string }[];
  /** TOTAL tracked routes for this entity per the DATASET (from
   *  lib/counts.ts countRoutesFromAirport / countRoutesByCarrier). The other
   *  fields are derived from a CAPPED sample fetch (typically 15 routes) and
   *  must never be presented as dataset totals; when routeTotal is set, the
   *  copy builders use it for count claims and drop the sample-derived
   *  country/carrier tallies whenever the sample is incomplete. */
  routeTotal?: number;
};

/** The destination count that copy may assert: the dataset total when known,
 *  else the sample size (which is then, by definition, all we track). */
export const trackedCount = (s: RouteSummary): number => s.routeTotal ?? s.destinationCount;

/** True when the sample covers the whole dataset, making sample-derived
 *  tallies (countries spanned, carrier counts) safe to state as facts. */
export const sampleComplete = (s: RouteSummary): boolean =>
  s.routeTotal === undefined || s.routeTotal <= s.destinationCount;

export function summariseRoutes(routes: StrapiRoute[], side: 'origin' | 'destination' = 'destination'): RouteSummary {
  const dests = new Map<string, string>();
  const countries = new Set<string>();
  const carriers = new Map<string, { name: string; slug: string; iataCode?: string }>();
  for (const r of routes) {
    const end = side === 'destination' ? r.destination : r.origin;
    const name = end?.city || end?.name;
    if (end?.iata && name) dests.set(end.iata, name);
    if (end?.country) countries.add(end.country);
    for (const c of r.carriers ?? []) {
      if (c?.slug && c.name) carriers.set(c.slug, { name: c.name, slug: c.slug, iataCode: c.iataCode });
    }
  }
  return {
    destinationCount: dests.size,
    countryCount: countries.size,
    carrierCount: carriers.size,
    destinationNames: [...dests.values()],
    countryNames: [...countries],
    carriers: [...carriers.values()],
  };
}

/* ------------------------------------------------------------------ *
 * Intro prose — factual, built only from present fields
 * ------------------------------------------------------------------ */

const sentence = (parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join('');

export function airportIntro(a: StrapiAirport, s?: RouteSummary): string {
  const code = a.icao ? `${a.iata}/${a.icao}` : a.iata;
  const place = sentence([
    a.city ? ` serving ${a.city}` : '',
    a.country ? `${a.city ? ',' : ' in'} ${a.country}` : '',
    a.region ? ` (${a.region})` : '',
  ]);
  const lead = `${a.name} (${code}) is an airport${place}.`;
  const geo =
    num(a.latitude) && num(a.longitude)
      ? ` It sits at ${a.latitude!.toFixed(3)}°, ${a.longitude!.toFixed(3)}°${a.timezone ? ` and keeps ${a.timezone} local time` : ''}.`
      : a.timezone
        ? ` It observes ${a.timezone} local time.`
        : '';
  const net =
    s && s.destinationCount > 0
      ? sampleComplete(s)
        ? ` Originfacts tracks ${pluralise(trackedCount(s), 'destination')} reachable from ${a.iata}${s.countryCount > 1 ? ` across ${pluralise(s.countryCount, 'country', 'countries')}` : ''}${s.carrierCount > 0 ? `, served by ${pluralise(s.carrierCount, 'airline')}` : ''}.`
        : ` Originfacts tracks ${pluralise(trackedCount(s), 'destination')} reachable from ${a.iata}, served by airlines including ${listProse(s.carriers.map((c) => c.name), 4)}.`
      : '';
  return lead + geo + net;
}

export function airlineIntro(a: StrapiAirline, s?: RouteSummary): string {
  const code = a.iataCode ? (a.icaoCode ? `${a.iataCode}/${a.icaoCode}` : a.iataCode) : a.icaoCode;
  const kind = a.type ? `${a.type.toLowerCase()} airline` : 'airline';
  const based = sentence([
    a.city ? ` based in ${a.city}` : '',
    a.country ? `${a.city ? ', ' : ' based in '}${a.country}` : '',
  ]);
  const founded = num(a.founded) ? ` and founded in ${a.founded}` : '';
  const lead = `${a.name}${code ? ` (${code})` : ''} is a ${kind}${based}${founded}.`;
  const hub = a.airport ? ` Its operations are centred on ${a.airport}.` : '';
  const net =
    s && s.destinationCount > 0
      ? ` Originfacts tracks ${pluralise(trackedCount(s), 'destination')} on its network${sampleComplete(s) && s.countryCount > 1 ? ` across ${pluralise(s.countryCount, 'country', 'countries')}` : ''}.`
      : '';
  return lead + hub + net;
}

/**
 * "About {airline}" body — always at most 4 paragraphs:
 *   1. identity (generated from codes/type/base/founded/legal name)
 *   2-3. up to two paragraphs of CMS editorial (`about`), when present
 *   4. network + practical footer (generated from tracked routes/alliance/hub)
 * Every generated sentence is grounded in a present field.
 */
export function airlineAbout(
  a: StrapiAirline,
  s?: RouteSummary,
  opts?: { alliance?: string | null; longestRouteSentence?: string },
): string[] {
  const paras: string[] = [];
  const name = a.name;
  const code = a.iataCode ? (a.icaoCode ? `${a.iataCode}/${a.icaoCode}` : a.iataCode) : a.icaoCode;

  // 1 — identity
  const kind = a.type ? `${a.type.toLowerCase()} airline` : 'airline';
  const base = [a.city, a.country].filter(Boolean).join(', ');
  const identity =
    `${name}${code ? ` (${code})` : ''} is a ${kind}${base ? ` based in ${base}` : ''}` +
    `${num(a.founded) ? `, founded in ${a.founded}` : ''}.` +
    `${a.legalName && a.legalName !== name ? ` The company operates legally as ${a.legalName}.` : ''}` +
    `${a.region ? ` It is one of the ${a.region} carriers profiled on Originfacts.` : ''}`;
  paras.push(identity);

  // 2-3 — CMS editorial, capped at two paragraphs
  if (hasText(a.about)) {
    const cmsParas = a.about!.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    paras.push(...cmsParas.slice(0, 2));
  }

  // 4 — network + practical
  const closing: string[] = [];
  if (s && s.destinationCount > 0) {
    closing.push(
      `On the network side, Originfacts currently tracks ${pluralise(trackedCount(s), 'destination')}${sampleComplete(s) && s.countryCount > 1 ? ` across ${pluralise(s.countryCount, 'country', 'countries')}` : ''} served by ${name}.`,
    );
    if (opts?.longestRouteSentence) closing.push(opts.longestRouteSentence);
  }
  if (a.airport) closing.push(`Day-to-day operations are centred on ${a.airport}.`);
  if (opts?.alliance) closing.push(`${name} is a member of the ${opts.alliance} alliance.`);
  closing.push(
    `For bookings, schedule changes and service queries, use the official website and customer-service contacts listed in the details panel on this page.`,
  );
  paras.push(closing.join(' '));

  return paras.slice(0, 4);
}

/**
 * "Flying with X — what to expect" paragraphs. Every statement is derived
 * from a present field (type, alliance, founded, hub, country) so the copy
 * stays truthful and varies between airlines instead of repeating one
 * boilerplate block across all 137 pages.
 */
export function airlineExpectations(a: StrapiAirline, alliance?: string | null): string[] {
  const paras: string[] = [];
  const name = a.name;

  switch (a.type) {
    case 'Low-cost':
      paras.push(
        `${name} operates a low-cost model, which means headline fares are typically unbundled: seat selection, checked baggage and on-board food are usually sold as paid extras rather than included in the base ticket. When comparing ${name} against full-service alternatives, weigh the total price after extras — not just the headline fare — and check cabin-baggage size limits before you fly, as budget carriers tend to enforce them strictly at the gate.`,
      );
      break;
    case 'Charter':
      paras.push(
        `${name} is a charter operator, so most of its seats are sold through tour operators and package-holiday providers rather than as standalone tickets. Schedules follow seasonal demand, which means routes can appear and disappear with the holiday calendar — if you find a standalone seat-only fare, confirm the operating dates carefully.`,
      );
      break;
    case 'Cargo':
      paras.push(
        `${name} is a cargo carrier: it moves freight rather than fare-paying passengers. The details on this page are provided for aviation reference rather than trip planning.`,
      );
      break;
    case 'Regional':
      paras.push(
        `${name} is a regional carrier, typically flying shorter sectors on smaller aircraft — often as a feeder into larger hubs. Two practical notes: cabin-baggage allowances on regional aircraft can be tighter than on mainline jets (larger carry-ons may be gate-checked), and tight hub connections are usually protected when both flights sit on a single ticket.`,
      );
      break;
    case 'Scheduled':
      paras.push(
        `${name} operates scheduled services, selling tickets directly and through travel agencies on a published timetable. Fare classes usually range from restrictive economy tickets to flexible fares — the cheapest bucket generally books out first, so the earlier you commit to fixed dates, the better the price tends to be.`,
      );
      break;
  }

  if (alliance) {
    paras.push(
      `${name} is a member of ${alliance}. For frequent flyers that matters: miles earned on ${name} flights can normally be credited to partner programmes across the alliance, and elite-status benefits such as lounge access or priority boarding are typically recognised when flying with other ${alliance} members. Check the fare class before booking — deeply discounted tickets sometimes earn reduced or zero mileage.`,
    );
  }

  const founded = num(a.founded) ? (a.founded as number) : null;
  const age = founded ? new Date().getFullYear() - founded : null;
  if (founded && age && age > 0) {
    paras.push(
      `Founded in ${founded}, ${name} has been flying for ${age >= 20 ? `more than ${Math.floor(age / 10) * 10} years` : `${age} ${age === 1 ? 'year' : 'years'}`}${a.airport ? `, with operations centred on ${a.airport}` : ''}${a.country ? `${a.airport ? '' : ','} in ${a.country}` : ''}.`,
    );
  }

  return paras;
}

/* ------------------------------------------------------------------ *
 * FAQs — every answer is grounded in a present field
 * ------------------------------------------------------------------ */

/**
 * Extra grounded context the airport page can pass in — contact details from
 * the airport-info dataset and the count of other tracked airports in the
 * same country. Everything is optional; absent fields simply skip their Q&A.
 */
export type AirportFaqExtras = {
  icao?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  /** TOTAL airports in this airport's country per the DATASET
   *  (lib/counts.ts airportsByCountryCode), including this one. Never pass
   *  the rendered nearby-cards length — FAQ answers are extraction targets
   *  and must state dataset facts, not the visible sample. */
  countryAirportCount?: number;
};

/** Every airport page shows at least this many FAQ entries. */
export const MIN_AIRPORT_FAQS = 8;

export function airportFaqs(a: StrapiAirport, s?: RouteSummary, extra?: AirportFaqExtras): Faq[] {
  const faqs: Faq[] = [];
  const icao = a.icao || extra?.icao || undefined;
  const city = a.city || extra?.city || undefined;
  const country = a.country || extra?.country || undefined;

  // --- Grounded in identity / location fields -----------------------------
  if (city || country) {
    faqs.push({
      q: `Where is ${a.name}?`,
      a: `${a.name} is located in ${[city, country].filter(Boolean).join(', ')}${a.region ? ` (${a.region})` : ''}${num(a.latitude) && num(a.longitude) ? `, at coordinates ${a.latitude!.toFixed(3)}°, ${a.longitude!.toFixed(3)}°` : ''}.`,
    });
  }
  faqs.push({
    q: `What is the airport code for ${a.name}?`,
    a: `Its IATA code is ${a.iata}${icao ? ` and its ICAO code is ${icao}` : ''}.`,
  });
  if (city) {
    faqs.push({
      q: `Which city does ${a.iata} serve?`,
      a: `${a.name} serves ${city}${country ? `, ${country}` : ''}. When comparing fares, check whether other airports also serve the same area — prices and transfer times can differ between them.`,
    });
  }
  if (a.timezone) {
    faqs.push({ q: `What time zone is ${a.iata} in?`, a: `${a.name} operates on ${a.timezone} local time. Departure and arrival times on tickets are always shown in each airport's local time, so double-check the offset when planning connections or pick-ups.` });
  }
  if (num(a.latitude) && num(a.longitude)) {
    faqs.push({
      q: `How do I find ${a.name} on a map?`,
      a: `${a.name} sits at latitude ${a.latitude!.toFixed(3)}° and longitude ${a.longitude!.toFixed(3)}°. The map link in the details panel on this page opens the exact location for driving directions.`,
    });
  }

  // --- Grounded in tracked route data -------------------------------------
  if (s && s.carriers.length) {
    faqs.push({
      q: `Which airlines fly from ${a.iata}?`,
      a: `Carriers tracked on routes from ${a.iata} include ${listProse(s.carriers.map((c) => c.name), 6)}.`,
    });
  } else {
    faqs.push({
      q: `Which airlines fly from ${a.iata}?`,
      a: `Originfacts does not yet track scheduled routes from ${a.iata}. Use the flight search on this page to see live airline options for your travel dates.`,
    });
  }
  if (s && s.destinationNames.length) {
    faqs.push({
      q: `Where can you fly from ${a.iata}?`,
      a: `Originfacts tracks ${pluralise(trackedCount(s), 'destination')} from ${a.iata} — including ${listProse(s.destinationNames, 8)}${sampleComplete(s) && s.countryCount > 1 ? `, spread across ${pluralise(s.countryCount, 'country', 'countries')}` : ''}.`,
    });
  } else {
    faqs.push({
      q: `Where can you fly from ${a.iata}?`,
      a: `Route coverage for ${a.iata} is still being added to Originfacts. Run a search from ${a.iata} on the flight search page to see every destination airlines currently sell for your dates.`,
    });
  }

  // --- Grounded in airport-info contact fields ----------------------------
  if (extra?.phone || extra?.website || extra?.address) {
    const parts: string[] = [];
    if (extra.address) parts.push(`its address is ${extra.address}`);
    if (extra.phone) parts.push(`the phone number is ${extra.phone}`);
    if (extra.website) parts.push(`the official website is ${extra.website}`);
    faqs.push({
      q: `How do I contact ${a.name}?`,
      a: `${parts.join(', ').replace(/^./, (c) => c.toUpperCase())}. For flight-specific questions (delays, baggage, rebooking), contact the operating airline directly rather than the airport.`,
    });
  }
  // Dataset count, minus this airport itself. The rendered nearby-airports
  // strip is a small sample — never the number this answer states.
  const otherAirports = typeof extra?.countryAirportCount === 'number' ? extra.countryAirportCount - 1 : 0;
  if (country && otherAirports > 0) {
    faqs.push({
      q: `Are there other airports in ${country}?`,
      a: `Yes — Originfacts lists ${pluralise(otherAirports, 'other airport')} in ${country}. The nearby-airports section on this page links to a selection of them, which is useful when comparing fares or finding an alternative departure point.`,
    });
  }

  // --- Always-answerable top-ups so every page reaches MIN_AIRPORT_FAQS ---
  const fillers: Faq[] = [
    {
      q: `How can I find cheap flights from ${a.iata}?`,
      a: `Use the flight search on this page to compare live fares from ${a.name}. Prices vary by day of the week and how far ahead you book, so comparing a few nearby dates usually surfaces a cheaper option.`,
    },
    {
      q: `What is the difference between IATA and ICAO airport codes?`,
      a: `IATA codes like ${a.iata} are the three-letter codes shown on tickets, booking sites and baggage tags. ICAO codes${icao ? ` (${icao} for this airport)` : ''} are four-letter identifiers used in flight operations and air-traffic control. For booking travel, the IATA code is the one you need.`,
    },
    {
      q: `Do I need to confirm flight times with the airline?`,
      a: `Yes. Schedules change through the year, so always confirm departure times, terminals and check-in cut-offs with the operating airline before travelling from ${a.name}.`,
    },
    {
      q: `Is the information on this page up to date?`,
      a: `Airport, airline and route details for ${a.iata} come from the Originfacts database and are refreshed regularly. Live fares and availability always come from the flight search, which queries current prices at the time you search.`,
    },
    {
      q: `How early should I arrive at ${a.name}?`,
      a: `A common rule of thumb is two hours before a domestic departure and three hours before an international one, but the airline's check-in and baggage cut-off times are what actually matter — check them on your booking confirmation.`,
    },
    {
      q: `Can I book flights from ${a.iata} on Originfacts?`,
      a: `Originfacts is a research and comparison site: the flight search on this page compares live fares from ${a.iata} and hands you over to the airline or agent to complete the booking, so your ticket and payment sit with the seller.`,
    },
  ];
  for (const f of fillers) {
    if (faqs.length >= MIN_AIRPORT_FAQS) break;
    faqs.push(f);
  }
  return faqs;
}

export function airlineFaqs(
  a: StrapiAirline,
  s?: RouteSummary,
  opts?: { alliance?: string | null; topOrigins?: string[] },
): Faq[] {
  const faqs: Faq[] = [];
  const name = a.name;
  const alliance = opts?.alliance ?? null;
  const topOrigins = opts?.topOrigins ?? [];

  faqs.push({
    q: `What is ${name}'s carry-on size allowance?`,
    a: `Carry-on limits on ${name} depend on the fare type and aircraft, and the airline publishes its current size and weight allowance on its official website.${a.type === 'Low-cost' ? ` As a low-cost carrier, ${name} tends to enforce cabin-bag rules strictly at the gate, and larger bags usually cost extra.` : ''} Measure your bag before you fly — paying for luggage at the gate is almost always the most expensive option.`,
  });

  if (a.airport) {
    faqs.push({
      q: `What is ${name}'s primary hub?`,
      a: `${name}'s operations are centred on ${a.airport}${a.city || a.country ? ` in ${[a.city, a.country].filter(Boolean).join(', ')}` : ''}.`,
    });
  }

  faqs.push({
    q: `When are ${name} plane tickets cheapest?`,
    a: `As a rule of thumb, ${name} fares on short-haul routes are cheapest 1–3 months before departure, and 2–6 months ahead for long-haul. Tuesday and Wednesday departures tend to be cheaper than Friday and Sunday, and flying outside school holidays makes the biggest difference of all. Fares are dynamic, so when you see a good price, lock it in.`,
  });

  if (topOrigins.length > 0) {
    faqs.push({
      q: `What are the most popular airports for ${name} flights to depart from?`,
      a: `Among the routes Originfacts tracks, ${name} flights most often depart from ${listProse(topOrigins, 4)}.`,
    });
  }

  if (s && s.destinationCount > 0) {
    faqs.push({
      q: `How many destinations does ${name} fly to?`,
      a: `Originfacts currently tracks ${pluralise(trackedCount(s), 'destination')} on ${name}'s network${sampleComplete(s) && s.countryCount > 1 ? ` across ${pluralise(s.countryCount, 'country', 'countries')}` : ''}. The airline's full network is typically larger — see its official route map for the complete picture.`,
    });
  }

  if (s && s.destinationNames.length) {
    faqs.push({
      q: `Where does ${name} fly to?`,
      a: `Tracked destinations on ${name}'s network include ${listProse(s.destinationNames, 8)}.`,
    });
  } else if (Array.isArray(a.keyDestinations) && a.keyDestinations.length) {
    // Fallback for airlines with no tracked routes: use the generated
    // key-destinations list so the destination questions still appear.
    faqs.push({
      q: `Where does ${name} fly to?`,
      a: `${name}'s network includes destinations such as ${listProse(a.keyDestinations, 10)}. Check the airline's official route map for its full, current network.`,
    });
  }

  faqs.push({
    q: `How does Originfacts find low prices on ${name} flights?`,
    a: `Originfacts compares live ${name} fares alongside hundreds of other airlines and online travel agencies through our search partner Travelpayouts, then surfaces the lowest total price for each itinerary. You complete the booking directly with the airline or agency at the same price — Originfacts never adds a fee.`,
  });

  if (alliance) {
    faqs.push({
      q: `Is ${name} part of an airline alliance?`,
      a: `Yes — ${name} is a member of ${alliance}. Miles earned on ${name} flights can normally be credited to partner programmes across the alliance, and elite-status benefits are typically recognised on other ${alliance} carriers.`,
    });
  }

  return faqs;
}

/* ------------------------------------------------------------------ *
 * schema.org JSON-LD
 * ------------------------------------------------------------------ */

export function airportJsonLd(a: StrapiAirport, url: string): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Airport',
    name: a.name,
    iataCode: a.iata,
    url,
  };
  if (a.icao) ld.icaoCode = a.icao;
  if (a.city || a.country) {
    ld.address = {
      '@type': 'PostalAddress',
      ...(a.city ? { addressLocality: a.city } : {}),
      ...(a.country ? { addressCountry: a.country } : {}),
    };
  }
  if (num(a.latitude) && num(a.longitude)) {
    ld.geo = { '@type': 'GeoCoordinates', latitude: a.latitude, longitude: a.longitude };
  }
  return ld;
}

export function airlineJsonLd(a: StrapiAirline, url: string): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Airline',
    name: a.name,
    url,
  };
  if (a.iataCode) ld.iataCode = a.iataCode;
  if (a.legalName) ld.legalName = a.legalName;
  if (a.country) ld.areaServed = a.country;
  if (a.website) ld.sameAs = a.website.startsWith('http') ? a.website : `https://${a.website}`;
  return ld;
}

export type CountryLike = { code: string; name: string; region?: string; currency?: string };

export function countryFaqs(c: CountryLike, counts: { airports: number; airlines: number }): Faq[] {
  const facts = getCountryFacts(c.code);
  const faqs: Faq[] = [];
  if (counts.airports > 0) {
    faqs.push({
      q: `How many airports does ${c.name} have?`,
      a: `Originfacts lists ${counts.airports.toLocaleString()} commercial airport${counts.airports === 1 ? '' : 's'} in ${c.name}.`,
    });
  }
  if (counts.airlines > 0) {
    faqs.push({
      q: `Which airlines are based in ${c.name}?`,
      a: `Originfacts tracks ${counts.airlines.toLocaleString()} airline${counts.airlines === 1 ? '' : 's'} based in ${c.name}. See the list above for each carrier's profile.`,
    });
  }
  const currencyText = facts?.currencyName
    ? `${facts.currencyName}${facts.currencyCode ? ` (${facts.currencyCode})` : ''}`
    : c.currency || facts?.currencyCode;
  if (currencyText) {
    faqs.push({ q: `What currency is used in ${c.name}?`, a: `${c.name} uses the ${currencyText}.` });
  }
  if (facts?.capital) {
    faqs.push({ q: `What is the capital of ${c.name}?`, a: `The capital of ${c.name} is ${facts.capital}.` });
  }
  if (facts?.languages?.length) {
    faqs.push({
      q: `What languages are spoken in ${c.name}?`,
      a: `The main languages of ${c.name} are ${facts.languages.join(', ')}.`,
    });
  }
  return faqs;
}

export function countryJsonLd(c: CountryLike, url: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Country',
    name: c.name,
    identifier: c.code,
    url,
  };
}

export function faqJsonLd(faqs: Faq[]): Record<string, unknown> | null {
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Small text utilities
 * ------------------------------------------------------------------ */

function pluralise(n: number, singular: string, plural = `${singular}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? singular : plural}`;
}

/** "A, B, C and 4 more" — for inline prose lists. */
function listProse(items: string[], max = 6): string {
  const seen = [...new Set(items.filter(Boolean))];
  if (seen.length === 0) return '';
  const shown = seen.slice(0, max);
  const rest = seen.length - shown.length;
  const joined =
    shown.length === 1
      ? shown[0]
      : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
  return rest > 0 ? `${shown.join(', ')} and ${rest} more` : joined;
}
