/**
 * Pure join and derivation rules for the airport enrichment dataset
 * (data/airport-enrichment/, built by ops/build-airport-enrichment.mjs).
 *
 * Plain ES module so the ops script (node) and the tests (tsx) share one copy.
 * No network, no file access.
 *
 * Identity rules:
 *   - an airport is joined to OurAirports by ICAO first. IATA is not an
 *     identity (content/airline-facts/CLAUDE.md): it is used only when the
 *     airport record has no ICAO code, and then only when the country and the
 *     name agree as well;
 *   - a Wikidata item is accepted only when its ICAO (P239) equals the
 *     airport's ICAO and any IATA (P238) it carries equals the airport's IATA;
 *   - when both sides have coordinates, a match more than MAX_JOIN_KM apart is
 *     rejected (the code points at a different place).
 */

export const MAX_JOIN_KM = 30;

/* ------------------------------------------------------------------ *
 * Text
 * ------------------------------------------------------------------ */

/** @param {string | null | undefined} v */
export function fold(v) {
  return (v ?? '')
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NAME_NOISE = new Set([
  'airport', 'airports', 'international', 'intl', 'regional', 'municipal', 'national', 'domestic', 'airfield',
  'aerodrome', 'airstrip', 'air', 'base', 'field', 'the', 'of', 'de', 'del', 'da', 'do', 'di', 'la', 'le', 'el',
  'aeroporto', 'aeropuerto', 'aeroport', 'flughafen', 'lufthavn', 'flygplats', 'lotnisko', 'and', 'county', 'city',
]);

/** Significant name tokens ("Dublin Airport" → ["dublin"]). @param {string | null | undefined} v */
export function nameTokens(v) {
  return fold(v)
    .split(' ')
    .filter((t) => t.length > 1 && !NAME_NOISE.has(t));
}

/**
 * Do two airport names share a significant word? Used only for the IATA
 * fallback join, where a false "same" would attach another airport's data, so
 * it requires a real shared token (not just "International Airport").
 * @param {string | null | undefined} a @param {string | null | undefined} b
 */
export function airportNamesMatch(a, b) {
  const ta = nameTokens(a);
  const tb = new Set(nameTokens(b));
  if (!ta.length || !tb.size) return false;
  return ta.some((t) => tb.has(t));
}

/* ------------------------------------------------------------------ *
 * CSV
 * ------------------------------------------------------------------ */

/**
 * RFC 4180 CSV → array of objects keyed by the header row.
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [head, ...body] = rows;
  return body
    .filter((r) => r.length === head.length)
    .map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

const toRad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in km. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Initial bearing in degrees (0 = north) from point 1 to point 2. */
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const COMPASS_WORDS = {
  N: 'north', NNE: 'north-northeast', NE: 'northeast', ENE: 'east-northeast', E: 'east', ESE: 'east-southeast',
  SE: 'southeast', SSE: 'south-southeast', S: 'south', SSW: 'south-southwest', SW: 'southwest', WSW: 'west-southwest',
  W: 'west', WNW: 'west-northwest', NW: 'northwest', NNW: 'north-northwest',
};

/** 16-point compass abbreviation for a bearing. */
export function compass16(deg) {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

export function compassWords(abbr) {
  return COMPASS_WORDS[abbr] ?? abbr;
}

/* ------------------------------------------------------------------ *
 * OurAirports
 * ------------------------------------------------------------------ */

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * Index OurAirports airports.csv rows by ICAO-like idents and by IATA.
 * @param {Record<string, string>[]} rows
 */
export function indexOurAirports(rows) {
  /** @type {Map<string, Record<string,string>[]>} */
  const byIcao = new Map();
  /** @type {Map<string, Record<string,string>[]>} */
  const byIata = new Map();
  const push = (m, k, r) => {
    if (!k) return;
    const key = k.toUpperCase();
    const list = m.get(key) ?? [];
    if (!list.includes(r)) list.push(r);
    m.set(key, list);
  };
  for (const r of rows) {
    push(byIcao, r.icao_code, r);
    push(byIcao, r.ident, r);
    push(byIcao, r.gps_code, r);
    push(byIata, r.iata_code, r);
  }
  return { byIcao, byIata };
}

/** Is the row too far from the airport record's coordinates to be the same place? */
function tooFar(cms, row) {
  const lat = num(row.latitude_deg);
  const lon = num(row.longitude_deg);
  if (typeof cms.latitude !== 'number' || typeof cms.longitude !== 'number' || lat == null || lon == null) return false;
  return haversineKm(cms.latitude, cms.longitude, lat, lon) > MAX_JOIN_KM;
}

/**
 * Join an airport record to an OurAirports row.
 *
 * @param {{ iata: string; icao?: string | null; name: string; countryCode?: string | null; latitude?: number | null; longitude?: number | null }} cms
 * @param {ReturnType<typeof indexOurAirports>} index
 * @returns {{ row: Record<string,string>; joinedBy: 'icao' | 'iata+name+country'; supersededIcao?: string } | { row: null; reason: string }}
 */
export function joinOurAirports(cms, index) {
  const icao = (cms.icao ?? '').trim().toUpperCase();
  if (icao) {
    const hits = index.byIcao.get(icao) ?? [];
    // Prefer the row whose official ICAO field is this code, then its ident;
    // a gps_code-only hit is the weakest.
    const ranked = [
      ...hits.filter((r) => r.icao_code?.toUpperCase() === icao),
      ...hits.filter((r) => r.icao_code?.toUpperCase() !== icao && r.ident?.toUpperCase() === icao),
      ...hits.filter((r) => r.icao_code?.toUpperCase() !== icao && r.ident?.toUpperCase() !== icao),
    ].filter((r) => r.type !== 'closed');
    const row = ranked[0];
    if (!row) {
      // The record's ICAO is not in OurAirports at all — usually a superseded
      // code (Kuwait OKBK → OKKK, Goa VAGO → VOGO). Fall back to IATA, but
      // only with country, name and coordinates (within 30 km) all agreeing.
      if (typeof cms.latitude !== 'number' || typeof cms.longitude !== 'number') return { row: null, reason: 'icao-not-found' };
      const viaIata = joinByIata(cms);
      return viaIata.row ? { row: viaIata.row, joinedBy: 'iata+name+country', supersededIcao: icao } : { row: null, reason: 'icao-not-found' };
    }
    // ICAO and IATA both agreeing is enough: the record's coordinates are
    // often rounded or point at the city (or an airport's predecessor site).
    // With only the ICAO agreeing, the coordinates must agree as well — a
    // mistyped ICAO on the record would otherwise attach another airport.
    // Both codes agreeing on a different country and name is a record that
    // carries another airport's codes (Sun Moon Lake, Taiwan, with Sorriso's).
    const iataAgrees = row.iata_code?.toUpperCase() === (cms.iata ?? '').toUpperCase();
    const country = (cms.countryCode ?? '').trim().toUpperCase();
    const corroborated = iataAgrees && ((country && row.iso_country?.toUpperCase() === country) || airportNamesMatch(cms.name, row.name));
    if (!corroborated && tooFar(cms, row)) return { row: null, reason: 'icao-coordinates-disagree' };
    return { row, joinedBy: 'icao' };
  }

  // No ICAO on the record: IATA only with country and name agreeing.
  return joinByIata(cms);

  function joinByIata(cms) {
  const iata = (cms.iata ?? '').trim().toUpperCase();
  const country = (cms.countryCode ?? '').trim().toUpperCase();
  if (!iata || !country) return { row: null, reason: 'no-icao-and-no-country' };
  const hits = (index.byIata.get(iata) ?? []).filter(
    (r) => r.type !== 'closed' && r.iso_country?.toUpperCase() === country && airportNamesMatch(cms.name, r.name),
  );
  if (hits.length !== 1) return { row: null, reason: hits.length ? 'iata-ambiguous' : 'iata-name-country-mismatch' };
  if (tooFar(cms, hits[0])) return { row: null, reason: 'iata-coordinates-disagree' };
  return { row: hits[0], joinedBy: 'iata+name+country' };
  }
}

const SURFACES = [
  [/^(ASP|ASPH|ASPHALT|BIT|BITUMEN|TAR|BLACKTOP|ASF)/i, 'asphalt'],
  [/^(CON|CONC|CONCRETE|PEM)/i, 'concrete'],
  [/^(GRS|GRASS|TURF)/i, 'grass'],
  [/^(GVL|GRVL|GRAVEL|GRV)/i, 'gravel'],
  [/^(DIRT|SAND|SOIL|EARTH|LAT|LATERITE|CLAY)/i, 'unpaved'],
  [/^(WATER|WAT)/i, 'water'],
  [/^(SNOW|ICE)/i, 'snow/ice'],
  [/^(COR|CORAL)/i, 'coral'],
];

/** OurAirports surface codes are free text; map the common ones, else null. */
export function surfaceLabel(code) {
  const c = (code ?? '').trim();
  if (!c) return null;
  for (const [re, label] of SURFACES) if (re.test(c)) return label;
  return null;
}

/**
 * Runways for one airport from runways.csv rows: open runways only (closed
 * ones are counted separately), helipads left out, longest first.
 * @param {Record<string,string>[]} rows
 */
export function runwaysFor(rows) {
  const out = [];
  let closed = 0;
  for (const r of rows) {
    if (/^H\d*$/i.test(r.le_ident ?? '')) continue;
    if (r.closed === '1') {
      closed++;
      continue;
    }
    const lengthFt = num(r.length_ft);
    if (!lengthFt) continue;
    out.push({
      ident: [r.le_ident, r.he_ident].filter(Boolean).join('/') || null,
      lengthFt,
      widthFt: num(r.width_ft),
      surface: surfaceLabel(r.surface),
      surfaceRaw: r.surface || null,
      lighted: r.lighted === '1',
    });
  }
  out.sort((a, b) => b.lengthFt - a.lengthFt);
  return { runways: out, closedCount: closed };
}

/* ------------------------------------------------------------------ *
 * Wikidata
 * ------------------------------------------------------------------ */

/**
 * Accept a Wikidata item for an airport only on an ICAO match, and only when
 * the item's IATA codes (if any) include the airport's IATA.
 * @param {{ iata: string; icao: string }} airport
 * @param {{ qid: string; icao: string[]; iata: string[]; dissolved?: boolean }[]} candidates
 */
export function pickWikidataItem(airport, candidates) {
  const icao = airport.icao.toUpperCase();
  const iata = airport.iata.toUpperCase();
  const ok = candidates.filter(
    (c) =>
      !c.dissolved &&
      c.icao.map((x) => x.toUpperCase()).includes(icao) &&
      (c.iata.length === 0 || c.iata.map((x) => x.toUpperCase()).includes(iata)),
  );
  return ok.length === 1 ? ok[0] : null;
}

const PRECISION = { 9: 'year', 10: 'month', 11: 'day' };

/**
 * One opening date from Wikidata time values, keeping the stated precision.
 * Returns null when the values disagree on the year (the item mixes events).
 * @param {{ time: string; precision: number; prop: string }[]} values
 */
export function pickOpening(values) {
  const usable = values
    .filter((v) => PRECISION[v.precision])
    .map((v) => ({ ...v, year: Number(v.time.replace(/^\+/, '').slice(0, 4)) }))
    .filter((v) => v.year > 1850 && v.year <= new Date().getUTCFullYear());
  if (!usable.length) return null;
  // Official opening (P1619) is the better answer to "when did it open".
  const pool = usable.some((v) => v.prop === 'P1619') ? usable.filter((v) => v.prop === 'P1619') : usable;
  const years = new Set(pool.map((v) => v.year));
  if (years.size !== 1) return null;
  const best = pool.sort((a, b) => b.precision - a.precision)[0];
  const precision = PRECISION[best.precision];
  const iso = best.time.replace(/^\+/, '');
  const value = precision === 'year' ? iso.slice(0, 4) : precision === 'month' ? iso.slice(0, 7) : iso.slice(0, 10);
  return { value, precision, prop: best.prop };
}

/**
 * Latest patronage (P3872) statement with a point in time (P585). Statements
 * scoped to a part (P518) or with "of" (P642) are left out. A tie on the year
 * with different values is treated as ambiguous.
 * @param {{ value: number; time: string | null; scoped?: boolean; refUrl?: string | null }[]} statements
 */
export function pickPatronage(statements) {
  const dated = statements
    .filter((s) => !s.scoped && s.time && Number.isFinite(s.value) && s.value > 0)
    .map((s) => ({ ...s, year: Number(s.time.replace(/^\+/, '').slice(0, 4)) }));
  if (!dated.length) return null;
  const latest = Math.max(...dated.map((s) => s.year));
  const same = dated.filter((s) => s.year === latest);
  const values = new Set(same.map((s) => s.value));
  if (values.size !== 1) return null;
  const pick = same.find((s) => s.refUrl) ?? same[0];
  return { value: pick.value, year: latest, refUrl: pick.refUrl ?? null };
}

/* ------------------------------------------------------------------ *
 * Climate (NASA POWER daily → monthly normals)
 * ------------------------------------------------------------------ */

/**
 * Aggregate POWER daily values (YYYYMMDD → value) to 12 monthly means:
 * mean daily max, mean daily min, mean monthly precipitation total.
 * Fill values (-999) are skipped; a month with under 80% of its days is null.
 * @param {Record<string, number>} tmax @param {Record<string, number>} tmin @param {Record<string, number>} precip
 */
export function monthlyNormals(tmax, tmin, precip) {
  const FILL = -999;
  const months = Array.from({ length: 12 }, () => ({ hi: [], lo: [], pr: new Map(), days: new Map() }));
  for (const day of Object.keys(tmax)) {
    const m = Number(day.slice(4, 6)) - 1;
    const ym = day.slice(0, 6);
    const b = months[m];
    if (!b) continue;
    if (tmax[day] !== FILL) b.hi.push(tmax[day]);
    if (tmin[day] !== FILL) b.lo.push(tmin[day]);
    if (precip[day] !== FILL && precip[day] != null) {
      b.pr.set(ym, (b.pr.get(ym) ?? 0) + precip[day]);
      b.days.set(ym, (b.days.get(ym) ?? 0) + 1);
    }
  }
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  return months.map((b, i) => {
    const full = [...b.pr.entries()].filter(([ym]) => (b.days.get(ym) ?? 0) >= daysIn(ym) * 0.8).map(([, v]) => v);
    const hi = mean(b.hi);
    const lo = mean(b.lo);
    const pr = mean(full);
    return {
      month: i + 1,
      hiC: hi == null ? null : Math.round(hi * 10) / 10,
      loC: lo == null ? null : Math.round(lo * 10) / 10,
      precipMm: pr == null ? null : Math.round(pr),
    };
  });
}

function daysIn(ym) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/* ------------------------------------------------------------------ *
 * Fares (Travelpayouts /v1/prices/direct)
 * ------------------------------------------------------------------ */

/** The CMS and Travelpayouts spell some countries differently. */
const COUNTRY_ALIASES = {
  'people s republic of china': 'china',
  'republic of korea': 'south korea',
  'korea republic of': 'south korea',
  'hong kong sar of china': 'hong kong',
  'hong kong sar': 'hong kong',
  'macau sar of china': 'macau',
  macao: 'macau',
  'united states of america': 'united states',
  usa: 'united states',
  'russian federation': 'russia',
  turkiye: 'turkey',
  'viet nam': 'vietnam',
  czechia: 'czech republic',
  uk: 'united kingdom',
};

export function normCountry(v) {
  const f = fold(v).replace(/^the /, '');
  return COUNTRY_ALIASES[f] ?? f;
}

/**
 * Drop the fare evidence most likely to be a marketing codeshare or a data
 * error rather than a flight the named airline operates from this airport:
 * an airline named on exactly one fare from the airport, whose home country
 * is known and is neither the airport's nor the destination's country
 * (American Airlines on a single Paris-Orly–Santiago fare). Airlines with
 * several fares from the airport (easyJet's French bases, Ryanair's) and
 * airlines whose home country is unknown are kept. A destination left with
 * no airline is dropped. Every exclusion is returned with its reason.
 *
 * @param {{ code: string; name: string; cc: string | null; country: string | null; airlines: string[] }[]} dests
 * @param {{ originCountry: string | null; homeOf: (code: string) => string | null }} ctx
 */
export function filterFareEvidence(dests, ctx) {
  const counts = {};
  for (const d of dests) for (const c of d.airlines) counts[c] = (counts[c] ?? 0) + 1;
  const origin = normCountry(ctx.originCountry);
  const kept = [];
  const excluded = [];
  for (const d of dests) {
    const dest = normCountry(d.country);
    const airlines = d.airlines.filter((c) => {
      const home = ctx.homeOf(c);
      const drop = counts[c] === 1 && home && origin && dest && normCountry(home) !== origin && normCountry(home) !== dest;
      if (drop) excluded.push({ code: d.code, airline: c, reason: 'single fare; airline based in neither country' });
      return !drop;
    });
    if (airlines.length) kept.push({ ...d, airlines });
  }
  return { kept, excluded };
}
