/**
 * Rough "where is the visitor" from the browser's IANA time zone, with no
 * network request and nothing sent to a third party. Used as the default for
 * the nearest-airport / weather widgets in place of an IP geolocation lookup.
 *
 * Each zone maps to its namesake (or main) city: the city's IATA code, the
 * name to show and the city's coordinates. A zone not listed here gives null,
 * and the caller falls back to its fixed default. Visitors who want a precise
 * result can pick a city or use the browser location prompt.
 */

export type TimeZonePlace = { iata: string; city: string; lat: number; lon: number };

// [iata, city, lat, lon]
type Row = [string, string, number, number];

const ZONES: Record<string, Row> = {
  // Europe
  'Europe/London': ['LON', 'London', 51.507, -0.128],
  'Europe/Dublin': ['DUB', 'Dublin', 53.35, -6.26],
  'Europe/Lisbon': ['LIS', 'Lisbon', 38.72, -9.14],
  'Europe/Madrid': ['MAD', 'Madrid', 40.42, -3.7],
  'Europe/Paris': ['PAR', 'Paris', 48.857, 2.352],
  'Europe/Brussels': ['BRU', 'Brussels', 50.85, 4.35],
  'Europe/Amsterdam': ['AMS', 'Amsterdam', 52.37, 4.9],
  'Europe/Luxembourg': ['LUX', 'Luxembourg', 49.61, 6.13],
  'Europe/Berlin': ['BER', 'Berlin', 52.52, 13.405],
  'Europe/Zurich': ['ZRH', 'Zurich', 47.377, 8.54],
  'Europe/Vienna': ['VIE', 'Vienna', 48.21, 16.37],
  'Europe/Rome': ['ROM', 'Rome', 41.9, 12.5],
  'Europe/Malta': ['MLA', 'Malta', 35.9, 14.51],
  'Europe/Copenhagen': ['CPH', 'Copenhagen', 55.68, 12.57],
  'Europe/Oslo': ['OSL', 'Oslo', 59.91, 10.75],
  'Europe/Stockholm': ['STO', 'Stockholm', 59.33, 18.07],
  'Europe/Helsinki': ['HEL', 'Helsinki', 60.17, 24.94],
  'Europe/Warsaw': ['WAW', 'Warsaw', 52.23, 21.01],
  'Europe/Prague': ['PRG', 'Prague', 50.08, 14.44],
  'Europe/Budapest': ['BUD', 'Budapest', 47.5, 19.04],
  'Europe/Bucharest': ['BUH', 'Bucharest', 44.43, 26.1],
  'Europe/Sofia': ['SOF', 'Sofia', 42.7, 23.32],
  'Europe/Athens': ['ATH', 'Athens', 37.98, 23.73],
  'Europe/Istanbul': ['IST', 'Istanbul', 41.01, 28.98],
  'Europe/Kyiv': ['IEV', 'Kyiv', 50.45, 30.52],
  'Europe/Kiev': ['IEV', 'Kyiv', 50.45, 30.52],
  'Europe/Moscow': ['MOW', 'Moscow', 55.76, 37.62],
  'Atlantic/Reykjavik': ['REK', 'Reykjavik', 64.15, -21.94],
  'Atlantic/Canary': ['LPA', 'Gran Canaria', 28.1, -15.41],
  // Middle East & Africa
  'Asia/Dubai': ['DXB', 'Dubai', 25.2, 55.27],
  'Asia/Qatar': ['DOH', 'Doha', 25.29, 51.53],
  'Asia/Riyadh': ['RUH', 'Riyadh', 24.71, 46.68],
  'Asia/Jerusalem': ['TLV', 'Tel Aviv', 32.09, 34.78],
  'Asia/Tel_Aviv': ['TLV', 'Tel Aviv', 32.09, 34.78],
  'Africa/Cairo': ['CAI', 'Cairo', 30.04, 31.24],
  'Africa/Casablanca': ['CAS', 'Casablanca', 33.57, -7.59],
  'Africa/Lagos': ['LOS', 'Lagos', 6.52, 3.38],
  'Africa/Nairobi': ['NBO', 'Nairobi', -1.29, 36.82],
  'Africa/Johannesburg': ['JNB', 'Johannesburg', -26.2, 28.05],
  // Asia
  'Asia/Karachi': ['KHI', 'Karachi', 24.86, 67.0],
  'Asia/Kolkata': ['DEL', 'Delhi', 28.61, 77.21],
  'Asia/Calcutta': ['DEL', 'Delhi', 28.61, 77.21],
  'Asia/Colombo': ['CMB', 'Colombo', 6.93, 79.86],
  'Asia/Kathmandu': ['KTM', 'Kathmandu', 27.72, 85.32],
  'Asia/Dhaka': ['DAC', 'Dhaka', 23.81, 90.41],
  'Asia/Bangkok': ['BKK', 'Bangkok', 13.756, 100.502],
  'Asia/Ho_Chi_Minh': ['SGN', 'Ho Chi Minh City', 10.82, 106.63],
  'Asia/Saigon': ['SGN', 'Ho Chi Minh City', 10.82, 106.63],
  'Asia/Jakarta': ['JKT', 'Jakarta', -6.2, 106.85],
  'Asia/Makassar': ['DPS', 'Denpasar', -8.65, 115.22],
  'Asia/Kuala_Lumpur': ['KUL', 'Kuala Lumpur', 3.139, 101.687],
  'Asia/Singapore': ['SIN', 'Singapore', 1.352, 103.82],
  'Asia/Manila': ['MNL', 'Manila', 14.6, 120.98],
  'Asia/Hong_Kong': ['HKG', 'Hong Kong', 22.32, 114.17],
  'Asia/Taipei': ['TPE', 'Taipei', 25.03, 121.57],
  'Asia/Shanghai': ['SHA', 'Shanghai', 31.23, 121.47],
  'Asia/Seoul': ['SEL', 'Seoul', 37.57, 126.98],
  'Asia/Tokyo': ['TYO', 'Tokyo', 35.68, 139.69],
  // Oceania
  'Australia/Perth': ['PER', 'Perth', -31.95, 115.86],
  'Australia/Darwin': ['DRW', 'Darwin', -12.46, 130.84],
  'Australia/Adelaide': ['ADL', 'Adelaide', -34.93, 138.6],
  'Australia/Brisbane': ['BNE', 'Brisbane', -27.47, 153.03],
  'Australia/Sydney': ['SYD', 'Sydney', -33.87, 151.21],
  'Australia/Melbourne': ['MEL', 'Melbourne', -37.81, 144.96],
  'Australia/Hobart': ['HBA', 'Hobart', -42.88, 147.33],
  'Pacific/Auckland': ['AKL', 'Auckland', -36.85, 174.76],
  'Pacific/Honolulu': ['HNL', 'Honolulu', 21.31, -157.86],
  // Americas
  'America/New_York': ['NYC', 'New York', 40.713, -74.006],
  'America/Toronto': ['YTO', 'Toronto', 43.65, -79.38],
  'America/Chicago': ['CHI', 'Chicago', 41.88, -87.63],
  'America/Denver': ['DEN', 'Denver', 39.74, -104.99],
  'America/Phoenix': ['PHX', 'Phoenix', 33.45, -112.07],
  'America/Los_Angeles': ['LAX', 'Los Angeles', 34.05, -118.24],
  'America/Vancouver': ['YVR', 'Vancouver', 49.28, -123.12],
  'America/Anchorage': ['ANC', 'Anchorage', 61.22, -149.9],
  'America/Mexico_City': ['MEX', 'Mexico City', 19.43, -99.13],
  'America/Bogota': ['BOG', 'Bogota', 4.71, -74.07],
  'America/Lima': ['LIM', 'Lima', -12.05, -77.04],
  'America/Santiago': ['SCL', 'Santiago', -33.45, -70.67],
  'America/Sao_Paulo': ['SAO', 'Sao Paulo', -23.55, -46.63],
  'America/Argentina/Buenos_Aires': ['BUE', 'Buenos Aires', -34.6, -58.38],
  'America/Buenos_Aires': ['BUE', 'Buenos Aires', -34.6, -58.38],
};

/** The place for an IANA time zone name, or null when it is not one we map. */
export function placeForTimeZone(timeZone: string | null | undefined): TimeZonePlace | null {
  if (!timeZone) return null;
  const row = ZONES[timeZone];
  if (!row) return null;
  const [iata, city, lat, lon] = row;
  return { iata, city, lat, lon };
}

/** The browser's time zone, mapped to a place. Null on the server, without Intl, or for an unmapped zone. */
export function placeFromBrowserTimeZone(): TimeZonePlace | null {
  try {
    return placeForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return null;
  }
}
