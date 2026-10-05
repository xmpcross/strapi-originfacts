/**
 * Pure matching logic for verify-sources.mjs (no I/O, unit-tested in
 * tests/route-research-match.test.ts).
 *
 * The bar: a claim survives only if
 *  1. its quote appears in the fetched page text (whitespace, quote marks,
 *     dashes and case normalised; no ellipses), and
 *  2. every number, date part, month, airline name and strong word
 *     (daily, first, busiest…) in the claim text appears in that quote, and
 *  3. for route claims (operator / seasonal / history) the quote or the page
 *     title names both ends of the route.
 * When the model's quote is not on the page, locateQuote() looks for one or
 * two consecutive sentences that satisfy 2 and 3 on their own; such a quote is
 * marked `located` and must also pass the semantic check before publishing.
 */
import { norm } from './lib.mjs';

/* ------------------------------------------------------------------ html */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', eacute: 'é', egrave: 'è', uuml: 'ü', ouml: 'ö', auml: 'ä', ccedil: 'ç', aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', middot: '·', bull: '•', copy: '©', reg: '®', trade: '™', deg: '°' };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Visible text of an HTML page, one block element per line. */
export function htmlToText(html) {
  return decodeEntities(
    String(html)
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(p|div|li|ul|ol|h[1-6]|tr|td|th|section|article|header|footer|blockquote|figcaption|dd|dt|table)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function metaContent(html, attr, name) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  return tag ? decodeEntities(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? '').trim() || null : null;
}

/** Title, publisher and publication date as the page itself declares them. */
export function extractMeta(html) {
  const s = String(html);
  const title =
    metaContent(s, 'property', 'og:title') ||
    decodeEntities(s.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim() ||
    null;
  const siteName = metaContent(s, 'property', 'og:site_name');
  const published =
    metaContent(s, 'property', 'article:published_time') ||
    metaContent(s, 'name', 'date') ||
    metaContent(s, 'itemprop', 'datePublished') ||
    s.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] ||
    null;
  return { title, siteName, published };
}

/* --------------------------------------------------------------- quotes */

const ELLIPSIS = /\.\.\.|…|\[\s*\.\.\.\s*\]/;

/** Normalised page text with list punctuation collapsed, for substring search. */
export function searchable(text) {
  return norm(text);
}

/** Is the quote, verbatim apart from normalisation, in the page text? */
export function quoteOnPage(pageText, quote) {
  const q = norm(quote);
  if (q.length < 20 || ELLIPSIS.test(quote)) return false;
  return searchable(pageText).includes(q);
}

/* ---------------------------------------------------------- key tokens */

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/g;
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14, twenty: 20, thirty: 30, once: 1, twice: 2, single: 1, double: 2, triple: 3 };
/** Words that change what a sentence asserts; the quote must carry them too. */
const STRONG = ['daily', 'weekly', 'seasonal', 'year-round', 'first', 'only', 'last', 'busiest', 'longest', 'shortest', 'largest', 'biggest', 'most', 'fastest', 'cheapest'];

function monthOf(tok) {
  return MONTHS.find((m) => m.startsWith(tok.slice(0, 3))) ?? null;
}

/** Digit groups (commas dropped, ordinals stripped) plus number words, as numbers-as-strings. */
export function numbersIn(s) {
  const t = norm(s).replace(/(\d),(\d{3})/g, '$1$2');
  const out = new Set();
  for (const m of t.matchAll(/\d+(?:[.:]\d+)?/g)) out.add(String(m[0]).replace(/^0+(?=\d)/, ''));
  for (const [w, n] of Object.entries(NUMBER_WORDS)) if (new RegExp(`\\b${w}\\b`).test(t)) out.add(String(n));
  return out;
}

export function monthsIn(s) {
  return new Set([...norm(s).matchAll(MONTH_RE)].map((m) => monthOf(m[1])).filter(Boolean));
}

/**
 * Everything in a claim that must also be in its quote.
 * `airlines` are the names the claim says it is about; `knownAirlines` are
 * site airline names, so an airline mentioned in the text but not listed in
 * `airlines` is still required.
 */
export function keyTokens(claimText, airlines = [], knownAirlines = []) {
  const t = norm(claimText);
  const names = new Set(airlines.map((a) => norm(a)).filter(Boolean));
  for (const k of knownAirlines) {
    const n = norm(k);
    if (n.length >= 4 && new RegExp(`(^|[^a-z])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(t)) names.add(n);
  }
  // Drop a name contained in a longer listed name ("air india" inside "air india express").
  const airlineList = [...names].filter((n) => ![...names].some((o) => o !== n && o.includes(n) && t.includes(o)));
  return {
    numbers: [...numbersIn(t)],
    months: [...monthsIn(t)],
    airlines: airlineList,
    strong: STRONG.filter((w) => new RegExp(`\\b${w}\\b`).test(t)),
  };
}

export function tokenCount(k) {
  return k.numbers.length + k.months.length + k.airlines.length + k.strong.length;
}

/** Which key tokens are missing from the quote (empty = all present). */
export function missingTokens(k, quote) {
  const q = norm(quote);
  const qNums = numbersIn(q);
  const qMonths = monthsIn(q);
  const missing = [];
  for (const n of k.numbers) if (!qNums.has(n)) missing.push(`number:${n}`);
  for (const m of k.months) if (!qMonths.has(m)) missing.push(`month:${m}`);
  for (const a of k.airlines) if (!q.includes(a)) missing.push(`airline:${a}`);
  for (const w of k.strong) if (!new RegExp(`\\b${w}\\b`).test(q)) missing.push(`word:${w}`);
  return missing;
}

/* ------------------------------------------------------------ endpoints */

const GENERIC = new Set(['international', 'airport', 'airports', 'the', 'of', 'and', 'regional', 'domestic', 'terminal', 'city', 'aeropuerto', 'aeroport', 'aeroporto', 'flughafen', 'intl', 'de', 'la', 'el']);

/** Names a reader would use for an airport: IATA, city, distinctive airport-name words. */
export function placeNames(airport) {
  const names = new Set();
  if (airport.city) names.add(norm(airport.city));
  for (const w of norm(airport.name ?? '').split(/[^a-z0-9'-]+/)) if (w.length >= 4 && !GENERIC.has(w)) names.add(w);
  for (const a of airport.aliases ?? []) names.add(norm(a));
  return { iata: String(airport.iata ?? '').toUpperCase(), names: [...names].filter(Boolean) };
}

/** Does raw text name this airport? IATA is matched case-sensitively as a whole word. */
export function mentionsPlace(rawText, place) {
  if (place.iata && new RegExp(`\\b${place.iata}\\b`).test(String(rawText))) return true;
  const t = norm(rawText);
  return place.names.some((n) => new RegExp(`(^|[^a-z])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(t));
}

/* ------------------------------------------------------------ locating */

export function sentences(text) {
  return String(text)
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9“"'(])/))
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 15);
}

/**
 * One or two consecutive sentences of the page that carry every key token
 * (and at least two of them), and — when `ends` is given — name both route
 * ends between them. Shortest window wins. Returns the original-case text.
 *
 * @param {string} pageText
 * @param {ReturnType<typeof keyTokens>} k
 * @param {{ iata: string; names: string[] }[] | null} [ends]
 */
export function locateQuote(pageText, k, ends = null) {
  if (tokenCount(k) < 2) return null;
  const ss = sentences(pageText);
  let best = null;
  for (let i = 0; i < ss.length; i++) {
    for (const w of [ss[i], i + 1 < ss.length ? `${ss[i]} ${ss[i + 1]}` : null]) {
      if (!w || w.length > 700) continue;
      if (missingTokens(k, w).length) continue;
      if (ends && !(mentionsPlace(w, ends[0]) && mentionsPlace(w, ends[1]))) continue;
      if (!best || w.length < best.length) best = w;
    }
  }
  return best;
}

/* ---------------------------------------------------------------- robots */

/**
 * Minimal RFC 9309 robots.txt: the group for our product token if there is
 * one, else `*`; longest matching rule wins, Allow wins ties; `*` and `$`.
 */
export function parseRobots(txt, product = 'originfacts') {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const raw of String(txt).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) groups.push((cur = { agents: [], rules: [], delay: null }));
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (key === 'allow' || key === 'disallow') cur.rules.push({ allow: key === 'allow', path: val });
    else if (key === 'crawl-delay' && Number.isFinite(Number(val))) cur.delay = Number(val);
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && product.includes(a.replace(/\/.*$/, ''))));
  const group = mine.length
    ? { rules: mine.flatMap((g) => g.rules), delay: mine.find((g) => g.delay !== null)?.delay ?? null }
    : { rules: groups.filter((g) => g.agents.includes('*')).flatMap((g) => g.rules), delay: groups.find((g) => g.agents.includes('*') && g.delay !== null)?.delay ?? null };
  const toRe = (p) => new RegExp(`^${p.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$|\$$/, '$')}`);
  return {
    crawlDelay: group.delay,
    isAllowed(urlOrPath) {
      let p = urlOrPath;
      try {
        const u = new URL(urlOrPath);
        p = u.pathname + u.search;
      } catch {
        /* already a path */
      }
      let best = null;
      for (const r of group.rules) {
        if (r.path === '') continue; // "Disallow:" with no path allows everything
        if (!toRe(r.path).test(p)) continue;
        if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
      }
      return best ? best.allow : true;
    },
  };
}

/* ----------------------------------------------------------- source rules */

/** Hosts whose pages are not acceptable sources (UGC, booking/route-search, social). */
export const REJECTED_HOSTS = [
  'wikipedia.org', 'wikiwand.com', 'reddit.com', 'quora.com', 'tripadvisor.', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com',
  'youtube.com', 'tiktok.com', 'linkedin.com', 'skyscanner.', 'kayak.', 'expedia.', 'google.com', 'flightconnections.com', 'trip.com',
  'wego.', 'cheapflights.', 'momondo.', 'kiwi.com', 'flightsfrom.com', 'directflights.com', 'airportia.com', 'flightaware.com',
  'flightradar24.com', 'makemytrip.com', 'cleartrip.com', 'ixigo.com', 'goibibo.com', 'booking.com', 'agoda.com', 'edreams.', 'opodo.',
  'kiwi.', 'aviasales.', 'jetradar.', 'rome2rio.com', 'medium.com', 'quora.', 'originfacts.com',
];

export function rejectedHost(url) {
  let h;
  try {
    h = new URL(url).hostname.toLowerCase();
  } catch {
    return 'invalid url';
  }
  const hit = REJECTED_HOSTS.find((r) => (r.endsWith('.') ? h.includes(r) : h === r || h.endsWith(`.${r}`)));
  return hit ? `rejected source host (${hit})` : null;
}
