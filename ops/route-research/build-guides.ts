/**
 * Step 3 — write content/route-guides/<slug>.json from verified claims only,
 * in the schema lib/route-guide.ts reads (same as bah-to-doh.json), plus a
 * committed ledger ops/route-research/claims/<slug>.json holding every kept
 * claim's exact quote and every dropped claim's reason.
 *
 * Airline identity: a claim's airline name must resolve to exactly one site
 * airline by name (never by IATA code alone), and that airline must pass
 * lib/route-carriers.ts — carrierCodeMismatch() for the code it holds, and
 * judgeRouteCarrier() when it is on the route record. Only then does its IATA
 * code go into operating_airlines.
 *
 * Prose is assembled, not generated: each paragraph is one verified claim's
 * text citing that claim's source; the intro and FAQ answers only join
 * verified claims. A route with no verified operator, or fewer than
 * --min-claims verified claims in all, gets no guide file.
 *
 *   npx tsx ops/route-research/build-guides.ts --routes syd-to-mel[,…] [--min-claims 3] [--dry-run]
 *     [--verified <file>]  build from one verified file (fixtures; implies --dry-run unless --write)
 */
import fs from 'node:fs';
import path from 'node:path';

import { carrierCodeMismatch, judgeRouteCarrier, normCountry, type RouteCarrier } from '../../lib/route-carriers';
import { getCeasedAirline, isNonAirline } from '../../lib/airline-status';
import airlineStatus from '../../data/airline-status/wikidata.json';
import type { RouteGuide, GuideSource, GuideParagraph, GuideSection, GuideFaq } from '../../lib/route-guide';

type Airport = { iata: string; name: string; city?: string | null; country?: string; countryCode?: string };
type Airline = RouteCarrier & { iataCode?: string | null; country?: string | null };
type Route = { slug: string; origin: Airport; destination: Airport; carriers?: Airline[]; createdAt?: string | null };
type Claim = {
  category: 'operator' | 'seasonal' | 'history' | 'airport' | 'ground';
  text: string;
  date?: string | null;
  airlines?: string[];
  airport?: string | null;
  status: string;
  quote_origin?: string;
  verified_quote?: string;
  reasons?: string[];
  source?: { url: string; title: string | null; site_name: string | null; published: string | null; fetched_at: string };
};

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '..', '..');
const DATA = path.join(HERE, 'data');

function arg(name: string): string | true | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return null;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

/* ---------------------------------------------------------------- airlines */

const NOISE = new Set(['airlines', 'airline', 'airways', 'royal', 'dutch', 'lines', 'limited', 'ltd', 'inc', 'plc', 'group', 'company', 'sa', 'ag', 'the']);
export const foldName = (v?: string | null) =>
  (v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const core = (v?: string | null) => foldName(v).split(' ').filter((t) => t && !NOISE.has(t)).join(' ');
const initials = (v?: string | null) => foldName(v).split(' ').filter(Boolean).map((t) => t[0]).join('');

/**
 * The one site airline a name denotes, or why not. Exact folded name, or the
 * same name once suffixes like "Airlines"/"Airways"/"Royal Dutch" are dropped,
 * or an all-caps acronym of the full name (ANA). "Express", "Asia", "Connect"
 * etc. are NOT noise: Air India Express is not Air India.
 */
export function resolveAirline(name: string, airlines: Airline[]): { airline: Airline } | { reason: string } {
  const f = foldName(name);
  const c = core(name);
  if (!f) return { reason: 'empty airline name' };
  let hits = airlines.filter((a) => foldName(a.name) === f);
  if (!hits.length) hits = airlines.filter((a) => c && core(a.name) === c);
  if (!hits.length && /^[A-Z]{2,5}$/.test(name.trim())) hits = airlines.filter((a) => initials(a.name) === f);
  const uniq = [...new Map(hits.map((a) => [a.slug, a])).values()];
  if (uniq.length === 1) return { airline: uniq[0] };
  return { reason: uniq.length ? `"${name}" matches ${uniq.length} site airlines (${uniq.map((a) => a.name).join(', ')})` : `"${name}" is not a site airline` };
}

/** IATA code for an operator, only if identity checks pass. */
export function operatorIata(name: string, route: Route, airlines: Airline[]): { iata: string; name: string; onRecord: boolean } | { reason: string } {
  const r = resolveAirline(name, airlines);
  if ('reason' in r) return r;
  const a = r.airline;
  const code = (a.iataCode ?? '').trim().toUpperCase();
  if (!code) return { reason: `${a.name} has no IATA code on the site` };
  const mismatch = carrierCodeMismatch(a);
  if (mismatch) return { reason: `${a.name} (${code}): ${mismatch}` };
  if (isNonAirline(a.slug)) return { reason: `${a.name} is not an airline (NON_AIRLINE_SLUGS)` };
  const ceased = getCeasedAirline(a.slug) ?? (airlineStatus.ceased as Record<string, { ceasedOn: string }>)[a.slug] ?? null;
  if (ceased) return { reason: `${a.name} ceased ${ceased.ceasedOn} per data/airline-status (held entries included)` };
  const onRecord = (route.carriers ?? []).find((c) => c.slug === a.slug);
  if (onRecord) {
    const v = judgeRouteCarrier(route, onRecord);
    if (!v.keep) return { reason: `${a.name} (${code}) on the route record but dropped by route-carriers: ${v.reason}` };
  } else {
    const home = normCountry(a.country);
    if (home && home !== normCountry(route.origin.country) && home !== normCountry(route.destination.country)) {
      return { reason: `${a.name} is from neither end and not on the route record (possible fifth-freedom/tag leg): manual review` };
    }
  }
  return { iata: code, name: a.name, onRecord: !!onRecord };
}

/* ----------------------------------------------------------------- sources */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatPublished(v?: string | null): string | null {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

function publisherOf(src: NonNullable<Claim['source']>): string {
  if (src.site_name) return src.site_name.replace(/\s+/g, ' ').trim();
  return new URL(src.url).hostname.replace(/^www\./, '');
}

function sourceId(src: NonNullable<Claim['source']>, taken: Set<string>): string {
  const host = new URL(src.url).hostname.replace(/^www\./, '').split('.').slice(0, -1).join('-') || 'source';
  const year = src.published?.match(/^\d{4}/)?.[0] ?? (src.title?.match(/\b(19|20)\d{2}\b/)?.[0] ?? null);
  const base = `${host.replace(/[^a-z0-9-]/g, '')}${year ? `-${year}` : ''}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

/* ------------------------------------------------------------------- build */

const joinNames = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

export function buildGuide(
  route: Route,
  claims: Claim[],
  airlines: Airline[],
  opts: { minClaims: number; today: string; fareAirlines?: string[] | null; editorDrops?: { prefix: string; why: string }[] },
): { guide: RouteGuide | null; ledger: unknown; why?: string; missingOperators?: string[] } {
  const verified = claims.filter((c) => c.status === 'verified' && c.source && c.verified_quote);
  const dropped: { text: string; category: string; reasons: string[] }[] = claims
    .filter((c) => c.status !== 'verified')
    .map((c) => ({ text: c.text, category: c.category, reasons: c.status === 'needs-judge' ? ['located quote not semantically checked'] : c.reasons ?? [] }));

  // One source entry per final URL.
  const taken = new Set<string>();
  const byUrl = new Map<string, GuideSource>();
  // The same page reached as www./non-www., with or without a trailing slash, is one source.
  const urlKey = (u: string) => {
    const x = new URL(u);
    return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}`;
  };
  const sid = (c: Claim) => {
    const s = c.source!;
    const key = urlKey(s.url);
    if (!byUrl.has(key)) {
      byUrl.set(key, {
        id: sourceId(s, taken),
        title: (s.title ?? publisherOf(s)).replace(/\s+/g, ' ').trim(),
        publisher: publisherOf(s),
        url: s.url,
        published: formatPublished(s.published),
        verified_at: s.fetched_at.slice(0, 10),
      });
    }
    return byUrl.get(key)!.id;
  };

  // Editor drops: verified claims a reviewer removed (e.g. conflicts with another sourced field on the page).
  for (let i = verified.length - 1; i >= 0; i--) {
    const hit = (opts.editorDrops ?? []).find((d) => verified[i].text.startsWith(d.prefix));
    if (hit) {
      dropped.push({ text: verified[i].text, category: verified[i].category, reasons: [`editor: ${hit.why}`] });
      verified.splice(i, 1);
    }
  }

  // De-duplicate claims with the same text.
  const seen = new Set<string>();
  const kept: Claim[] = [];
  for (const c of verified) {
    const k = `${c.category}|${foldName(c.text)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    kept.push(c);
  }

  // Current-service claims need a dated source from the last 18 months:
  // an old or undated page can describe a carrier that has since stopped
  // flying (Jetstar Asia, July 2025).
  const cutoff = new Date(`${opts.today}T00:00:00Z`);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 18);
  const fresh = (c: Claim) => {
    const p = c.source?.published ? new Date(c.source.published) : null;
    return !!p && !Number.isNaN(p.getTime()) && p >= cutoff;
  };
  for (let i = kept.length - 1; i >= 0; i--) {
    const c = kept[i];
    if ((c.category === 'operator' || c.category === 'seasonal') && !fresh(c)) {
      dropped.push({ text: c.text, category: c.category, reasons: [c.source?.published ? `current-service claim from a source dated ${c.source.published} (older than 18 months)` : 'current-service claim from an undated source'] });
      kept.splice(i, 1);
    }
  }

  // Operators: identity-checked.
  const ops = new Map<string, { iata: string; name: string; sources: Set<string> }>();
  const final: Claim[] = [];
  for (const c of kept) {
    if (c.category === 'operator') {
      const names = c.airlines ?? [];
      const res = names.map((n) => operatorIata(n, route, airlines));
      const bad = res.find((r) => 'reason' in r) as { reason: string } | undefined;
      if (bad || !res.length) {
        dropped.push({ text: c.text, category: c.category, reasons: [bad?.reason ?? 'no airline'] });
        continue;
      }
      for (const r of res as { iata: string; name: string }[]) {
        const e = ops.get(r.iata) ?? { iata: r.iata, name: r.name, sources: new Set<string>() };
        e.sources.add(sid(c));
        ops.set(r.iata, e);
      }
    }
    final.push(c);
  }

  const total = final.length;
  if (!ops.size) return { guide: null, ledger: { kept: final, dropped }, why: 'no verified nonstop operator' };
  if (total < opts.minClaims) return { guide: null, ledger: { kept: final, dropped }, why: `only ${total} verified claims (< ${opts.minClaims})` };

  const o = route.origin;
  const d = route.destination;
  const from = o.city || o.name;
  const to = d.city || d.name;
  const opList = [...ops.values()];
  const opSources = [...new Set(opList.flatMap((x) => [...x.sources]))];
  const para = (c: Claim): GuideParagraph => ({ text: sentence(c.text), sources: [sid(c)] });
  const byDate = (a: Claim, b: Claim) => String(a.date ?? '9999').localeCompare(String(b.date ?? '9999'));

  const sections: GuideSection[] = [];
  const seasonal = final.filter((c) => c.category === 'seasonal').sort(byDate);
  if (seasonal.length) sections.push({ id: 'nonstop-service', heading: `What should you know about nonstop ${from}–${to} service?`, paragraphs: seasonal.map(para) });
  const history = final.filter((c) => c.category === 'history').sort(byDate);
  if (history.length) sections.push({ id: 'route-history', heading: `How has nonstop ${from}–${to} service changed over time?`, paragraphs: history.map(para) });
  const airport = final.filter((c) => c.category === 'airport');
  if (airport.length) sections.push({ id: 'airports', heading: 'What should you know about the airports at each end?', paragraphs: airport.map(para) });
  const ground = final.filter((c) => c.category === 'ground');
  if (ground.length) sections.push({ id: 'getting-there', heading: 'How do you get to and from the airports?', paragraphs: ground.map(para) });

  // Is the sourced operator list complete? Live fare data (the same
  // Travelpayouts call the page makes) shows who sells nonstop seats; if it
  // has a carrier we could not source, the list is partial. Then the page
  // keeps the fare-data list (operating_airlines left empty), and the text
  // says "include" instead of naming the operators as the full set.
  const saysNonstop = final.filter((c) => c.category === 'operator').every((c) => /non-?stop|direct/i.test(c.verified_quote ?? ''));
  const missingOperators = (opts.fareAirlines ?? []).filter((c) => !ops.has(c));
  const complete = opts.fareAirlines != null && missingOperators.length === 0;
  const faqs: GuideFaq[] = complete
    ? [{ q: `Which airlines fly${saysNonstop ? ' nonstop' : ''} from ${from} to ${to}?`, a: `${joinNames(opList.map((x) => x.name))}.`, sources: opSources }]
    : [];
  for (const ap of [o, d]) {
    const g = ground.filter((c) => String(c.airport ?? '').toUpperCase() === ap.iata.toUpperCase());
    if (g.length) faqs.push({ q: `How do I get to and from ${ap.name} by public transport?`, a: g.map((c) => sentence(c.text)).join(' '), sources: [...new Set(g.map(sid))] });
  }

  const guide: RouteGuide = {
    slug: route.slug,
    verified_at: opts.today,
    intro: {
      // "Nonstop" only when every operator quote says nonstop/direct itself.
      text: `Flights from ${from} to ${to} run from ${o.name} (${o.iata}) to ${d.name} (${d.iata}). ${
        complete
          ? `${joinNames(opList.map((x) => x.name))} ${opList.length === 1 ? 'flies' : 'fly'} the route${saysNonstop ? ' nonstop' : ''}.`
          : `Airlines flying the route${saysNonstop ? ' nonstop' : ''} include ${joinNames(opList.map((x) => x.name))}.`
      }`,
      sources: opSources,
    },
    operating_airlines: complete ? opList.map((x) => ({ iata: x.iata, sources: [...x.sources] })) : [],
    sections,
    faqs,
    sources: [...byUrl.values()],
  };
  const ledger = {
    slug: route.slug,
    verified_at: opts.today,
    operators: { sourced: opList.map((x) => x.iata), fare_data: opts.fareAirlines ?? null, missing_from_sources: missingOperators, list_published: complete },
    kept: final.map((c) => ({ category: c.category, text: c.text, date: c.date ?? null, airlines: c.airlines ?? [], source_id: sid(c), url: c.source!.url, quote: c.verified_quote, quote_origin: c.quote_origin })),
    dropped,
  };
  return { guide, ledger, missingOperators };
}

/** IATA codes with nonstop fares in Travelpayouts data (the page's own fallback list), or null if unavailable. */
async function fareAirlines(o: string, d: string): Promise<string[] | null> {
  let token = process.env.TRAVELPAYOUTS_API_TOKEN;
  if (!token) {
    try {
      token = fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^TRAVELPAYOUTS_API_TOKEN=(.*)$/m)?.[1]?.trim();
    } catch {
      /* none */
    }
  }
  if (!token) return null;
  const qs = new URLSearchParams({ origin: o, destination: d, currency: 'usd', direct: 'true', one_way: 'true', sorting: 'price', limit: '1000' });
  try {
    const res = await fetch(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${qs}`, { headers: { 'X-Access-Token': token } });
    if (!res.ok) return null;
    const j = (await res.json()) as { data?: { airline: string; transfers?: number }[] };
    return [...new Set((j.data ?? []).filter((f) => !f.transfers).map((f) => f.airline))].sort();
  } catch {
    return null;
  }
}

async function main() {
  const slugs = String(arg('routes') ?? '').split(',').filter(Boolean);
  const minClaims = Number(arg('min-claims') ?? 3);
  const dry = !!arg('dry-run') || (!!arg('verified') && !arg('write'));
  const routes: Route[] = JSON.parse(fs.readFileSync(path.join(DATA, 'strapi-routes.json'), 'utf8'));
  const airlines: Airline[] = JSON.parse(fs.readFileSync(path.join(DATA, 'strapi-airlines.json'), 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  for (const slug of slugs) {
    const route = routes.find((r) => r.slug === slug);
    const vf = (arg('verified') as string | null) || path.join(DATA, 'verified', `${slug}.json`);
    if (!route || !fs.existsSync(vf)) {
      console.error(`${slug}: ${route ? `no verified file ${vf}` : 'not a route'}`);
      continue;
    }
    const { claims } = JSON.parse(fs.readFileSync(vf, 'utf8')) as { claims: Claim[] };
    const fares = await fareAirlines(route.origin.iata, route.destination.iata);
    // ops/route-research/editor-drops.json: { "<slug>": [{ "prefix": "<claim text start>", "why": "..." }] }
    const dropsFile = path.join(HERE, 'editor-drops.json');
    const editorDrops = fs.existsSync(dropsFile) ? (JSON.parse(fs.readFileSync(dropsFile, 'utf8'))[slug] ?? []) : [];
    const { guide, ledger, why, missingOperators } = buildGuide(route, claims, airlines, { minClaims, today, fareAirlines: fares, editorDrops });
    if (missingOperators?.length) console.log(`${slug}: fare data also shows ${missingOperators.join(', ')} — operator list not published (page keeps fare-data airlines)`);
    if (!guide) {
      console.log(`${slug}: NO GUIDE — ${why}`);
      if (!dry) fs.mkdirSync(path.join(HERE, 'claims'), { recursive: true });
      if (!dry) fs.writeFileSync(path.join(HERE, 'claims', `${slug}.json`), `${JSON.stringify({ slug, verified_at: today, guide_written: false, why, ...(ledger as object) }, null, 2)}\n`);
      continue;
    }
    const nPara = guide.sections.reduce((n, s) => n + s.paragraphs.length, 0);
    console.log(`${slug}: ${guide.operating_airlines.map((a) => a.iata).join('/')} · ${nPara} paragraphs · ${guide.faqs.length} FAQs · ${guide.sources.length} sources`);
    if (dry) {
      console.log(JSON.stringify(guide, null, 2));
      continue;
    }
    const target = path.join(REPO, 'content', 'route-guides', `${slug}.json`);
    if (fs.existsSync(target) && !fs.existsSync(path.join(HERE, 'claims', `${slug}.json`)) && !arg('overwrite')) {
      console.log(`${slug}: content/route-guides/${slug}.json exists and was not written by this pipeline — left alone (--overwrite to replace)`);
      continue;
    }
    fs.mkdirSync(path.join(HERE, 'claims'), { recursive: true });
    fs.writeFileSync(path.join(REPO, 'content', 'route-guides', `${slug}.json`), `${JSON.stringify(guide, null, 2)}\n`);
    fs.writeFileSync(path.join(HERE, 'claims', `${slug}.json`), `${JSON.stringify({ ...(ledger as object), guide_written: true }, null, 2)}\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
