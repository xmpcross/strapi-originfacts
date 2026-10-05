/**
 * Rough "where is the visitor" from the browser's IANA time zone, with no
 * network request and nothing sent to a third party. Used as the default for
 * the nearest-airport / weather widgets and the default display currency, in
 * place of an IP geolocation lookup.
 *
 * Each zone maps to its namesake (or main) city: the city's IATA code, the
 * name to show and the city's coordinates. A zone not listed here gives null,
 * and the caller falls back to its fixed default. Visitors who want a precise
 * result can pick a city or use the browser location prompt.
 */

export type TimeZonePlace = { iata: string; city: string; lat: number; lon: number; country: string };

// [iata, city, lat, lon, ISO 3166-1 alpha-2 country]
type Row = [string, string, number, number, string];

const ZONES: Record<string, Row> = {
  // Europe
  'Europe/London': ['LON', 'London', 51.507, -0.128, 'GB'],
  'Europe/Dublin': ['DUB', 'Dublin', 53.35, -6.26, 'IE'],
  'Europe/Lisbon': ['LIS', 'Lisbon', 38.72, -9.14, 'PT'],
  'Europe/Madrid': ['MAD', 'Madrid', 40.42, -3.7, 'ES'],
  'Europe/Paris': ['PAR', 'Paris', 48.857, 2.352, 'FR'],
  'Europe/Brussels': ['BRU', 'Brussels', 50.85, 4.35, 'BE'],
  'Europe/Amsterdam': ['AMS', 'Amsterdam', 52.37, 4.9, 'NL'],
  'Europe/Luxembourg': ['LUX', 'Luxembourg', 49.61, 6.13, 'LU'],
  'Europe/Berlin': ['BER', 'Berlin', 52.52, 13.405, 'DE'],
  'Europe/Zurich': ['ZRH', 'Zurich', 47.377, 8.54, 'CH'],
  'Europe/Vienna': ['VIE', 'Vienna', 48.21, 16.37, 'AT'],
  'Europe/Rome': ['ROM', 'Rome', 41.9, 12.5, 'IT'],
  'Europe/Malta': ['MLA', 'Malta', 35.9, 14.51, 'MT'],
  'Europe/Copenhagen': ['CPH', 'Copenhagen', 55.68, 12.57, 'DK'],
  'Europe/Oslo': ['OSL', 'Oslo', 59.91, 10.75, 'NO'],
  'Europe/Stockholm': ['STO', 'Stockholm', 59.33, 18.07, 'SE'],
  'Europe/Helsinki': ['HEL', 'Helsinki', 60.17, 24.94, 'FI'],
  'Europe/Warsaw': ['WAW', 'Warsaw', 52.23, 21.01, 'PL'],
  'Europe/Prague': ['PRG', 'Prague', 50.08, 14.44, 'CZ'],
  'Europe/Budapest': ['BUD', 'Budapest', 47.5, 19.04, 'HU'],
  'Europe/Bucharest': ['BUH', 'Bucharest', 44.43, 26.1, 'RO'],
  'Europe/Sofia': ['SOF', 'Sofia', 42.7, 23.32, 'BG'],
  'Europe/Athens': ['ATH', 'Athens', 37.98, 23.73, 'GR'],
  'Europe/Istanbul': ['IST', 'Istanbul', 41.01, 28.98, 'TR'],
  'Europe/Kyiv': ['IEV', 'Kyiv', 50.45, 30.52, 'UA'],
  'Europe/Kiev': ['IEV', 'Kyiv', 50.45, 30.52, 'UA'],
  'Europe/Moscow': ['MOW', 'Moscow', 55.76, 37.62, 'RU'],
  'Atlantic/Reykjavik': ['REK', 'Reykjavik', 64.15, -21.94, 'IS'],
  'Atlantic/Canary': ['LPA', 'Gran Canaria', 28.1, -15.41, 'ES'],
  // Middle East & Africa
  'Asia/Dubai': ['DXB', 'Dubai', 25.2, 55.27, 'AE'],
  'Asia/Qatar': ['DOH', 'Doha', 25.29, 51.53, 'QA'],
  'Asia/Riyadh': ['RUH', 'Riyadh', 24.71, 46.68, 'SA'],
  'Asia/Jerusalem': ['TLV', 'Tel Aviv', 32.09, 34.78, 'IL'],
  'Asia/Tel_Aviv': ['TLV', 'Tel Aviv', 32.09, 34.78, 'IL'],
  'Africa/Cairo': ['CAI', 'Cairo', 30.04, 31.24, 'EG'],
  'Africa/Casablanca': ['CAS', 'Casablanca', 33.57, -7.59, 'MA'],
  'Africa/Lagos': ['LOS', 'Lagos', 6.52, 3.38, 'NG'],
  'Africa/Nairobi': ['NBO', 'Nairobi', -1.29, 36.82, 'KE'],
  'Africa/Johannesburg': ['JNB', 'Johannesburg', -26.2, 28.05, 'ZA'],
  // Asia
  'Asia/Karachi': ['KHI', 'Karachi', 24.86, 67.0, 'PK'],
  'Asia/Kolkata': ['DEL', 'Delhi', 28.61, 77.21, 'IN'],
  'Asia/Calcutta': ['DEL', 'Delhi', 28.61, 77.21, 'IN'],
  'Asia/Colombo': ['CMB', 'Colombo', 6.93, 79.86, 'LK'],
  'Asia/Kathmandu': ['KTM', 'Kathmandu', 27.72, 85.32, 'NP'],
  'Asia/Dhaka': ['DAC', 'Dhaka', 23.81, 90.41, 'BD'],
  'Asia/Bangkok': ['BKK', 'Bangkok', 13.756, 100.502, 'TH'],
  'Asia/Ho_Chi_Minh': ['SGN', 'Ho Chi Minh City', 10.82, 106.63, 'VN'],
  'Asia/Saigon': ['SGN', 'Ho Chi Minh City', 10.82, 106.63, 'VN'],
  'Asia/Jakarta': ['JKT', 'Jakarta', -6.2, 106.85, 'ID'],
  'Asia/Makassar': ['DPS', 'Denpasar', -8.65, 115.22, 'ID'],
  'Asia/Kuala_Lumpur': ['KUL', 'Kuala Lumpur', 3.139, 101.687, 'MY'],
  'Asia/Singapore': ['SIN', 'Singapore', 1.352, 103.82, 'SG'],
  'Asia/Manila': ['MNL', 'Manila', 14.6, 120.98, 'PH'],
  'Asia/Hong_Kong': ['HKG', 'Hong Kong', 22.32, 114.17, 'HK'],
  'Asia/Taipei': ['TPE', 'Taipei', 25.03, 121.57, 'TW'],
  'Asia/Shanghai': ['SHA', 'Shanghai', 31.23, 121.47, 'CN'],
  'Asia/Seoul': ['SEL', 'Seoul', 37.57, 126.98, 'KR'],
  'Asia/Tokyo': ['TYO', 'Tokyo', 35.68, 139.69, 'JP'],
  // Oceania
  'Australia/Perth': ['PER', 'Perth', -31.95, 115.86, 'AU'],
  'Australia/Darwin': ['DRW', 'Darwin', -12.46, 130.84, 'AU'],
  'Australia/Adelaide': ['ADL', 'Adelaide', -34.93, 138.6, 'AU'],
  'Australia/Brisbane': ['BNE', 'Brisbane', -27.47, 153.03, 'AU'],
  'Australia/Sydney': ['SYD', 'Sydney', -33.87, 151.21, 'AU'],
  'Australia/Melbourne': ['MEL', 'Melbourne', -37.81, 144.96, 'AU'],
  'Australia/Hobart': ['HBA', 'Hobart', -42.88, 147.33, 'AU'],
  'Pacific/Auckland': ['AKL', 'Auckland', -36.85, 174.76, 'NZ'],
  'Pacific/Honolulu': ['HNL', 'Honolulu', 21.31, -157.86, 'US'],
  // Americas
  'America/New_York': ['NYC', 'New York', 40.713, -74.006, 'US'],
  'America/Toronto': ['YTO', 'Toronto', 43.65, -79.38, 'CA'],
  'America/Chicago': ['CHI', 'Chicago', 41.88, -87.63, 'US'],
  'America/Denver': ['DEN', 'Denver', 39.74, -104.99, 'US'],
  'America/Phoenix': ['PHX', 'Phoenix', 33.45, -112.07, 'US'],
  'America/Los_Angeles': ['LAX', 'Los Angeles', 34.05, -118.24, 'US'],
  'America/Vancouver': ['YVR', 'Vancouver', 49.28, -123.12, 'CA'],
  'America/Anchorage': ['ANC', 'Anchorage', 61.22, -149.9, 'US'],
  'America/Mexico_City': ['MEX', 'Mexico City', 19.43, -99.13, 'MX'],
  'America/Bogota': ['BOG', 'Bogota', 4.71, -74.07, 'CO'],
  'America/Lima': ['LIM', 'Lima', -12.05, -77.04, 'PE'],
  'America/Santiago': ['SCL', 'Santiago', -33.45, -70.67, 'CL'],
  'America/Sao_Paulo': ['SAO', 'Sao Paulo', -23.55, -46.63, 'BR'],
  'America/Argentina/Buenos_Aires': ['BUE', 'Buenos Aires', -34.6, -58.38, 'AR'],
  'America/Buenos_Aires': ['BUE', 'Buenos Aires', -34.6, -58.38, 'AR'],
};

// Zones with no city row above whose country is still unambiguous, so the
// default currency can follow them (e.g. a Riga visitor gets EUR).
const ZONE_COUNTRY: Record<string, string> = {
  'Europe/Belfast': 'GB', 'Europe/Guernsey': 'GG', 'Europe/Jersey': 'JE', 'Europe/Isle_of_Man': 'IM',
  'Europe/Gibraltar': 'GI', 'Europe/Andorra': 'AD', 'Europe/Monaco': 'MC', 'Europe/San_Marino': 'SM',
  'Europe/Vatican': 'VA', 'Europe/Podgorica': 'ME', 'Europe/Zagreb': 'HR', 'Europe/Ljubljana': 'SI',
  'Europe/Bratislava': 'SK', 'Europe/Vilnius': 'LT', 'Europe/Riga': 'LV', 'Europe/Tallinn': 'EE',
  'Asia/Nicosia': 'CY', 'Asia/Famagusta': 'CY', 'Europe/Nicosia': 'CY', 'Europe/Busingen': 'DE',
  'Atlantic/Madeira': 'PT', 'Atlantic/Azores': 'PT', 'Africa/Ceuta': 'ES', 'Europe/Mariehamn': 'FI',
  'Antarctica/Macquarie': 'AU',
};

/** The place for an IANA time zone name, or null when it is not one we map. */
export function placeForTimeZone(timeZone: string | null | undefined): TimeZonePlace | null {
  if (!timeZone) return null;
  const row = ZONES[timeZone];
  if (!row) return null;
  const [iata, city, lat, lon, country] = row;
  return { iata, city, lat, lon, country };
}

/** ISO country code for an IANA time zone, or null when the zone does not pin one down. */
export function countryForTimeZone(timeZone: string | null | undefined): string | null {
  if (!timeZone) return null;
  const row = ZONES[timeZone];
  if (row) return row[4];
  if (ZONE_COUNTRY[timeZone]) return ZONE_COUNTRY[timeZone];
  // Every Australia/* zone (Lord_Howe, Broken_Hill, Lindeman, …) is in Australia.
  if (timeZone.startsWith('Australia/')) return 'AU';
  return null;
}

/** Region from a BCP 47 language tag ("en-GB" → "GB"), or null when it has none. */
export function countryForLanguage(tag: string | null | undefined): string | null {
  if (!tag) return null;
  try {
    const region = new Intl.Locale(tag).region;
    return region && /^[A-Z]{2}$/.test(region) ? region : null;
  } catch {
    return null;
  }
}

/** English name for a country code ("TH" → "Thailand"), or '' when unknown. */
export function countryName(code: string | null | undefined): string {
  if (!code) return '';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || '';
  } catch {
    return '';
  }
}

function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** The browser's time zone, mapped to a place. Null on the server, without Intl, or for an unmapped zone. */
export function placeFromBrowserTimeZone(): TimeZonePlace | null {
  return placeForTimeZone(browserTimeZone());
}

/**
 * The visitor's likely country from the browser alone: the time zone first,
 * then the region of the browser's language list. Nothing leaves the device.
 */
export function countryFromBrowser(): string | null {
  const fromZone = countryForTimeZone(browserTimeZone());
  if (fromZone) return fromZone;
  if (typeof navigator === 'undefined') return null;
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of langs) {
    const cc = countryForLanguage(lang);
    if (cc) return cc;
  }
  return null;
}
