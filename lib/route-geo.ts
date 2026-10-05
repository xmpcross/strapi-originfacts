/**
 * Facts computed from the two airport records, with the method stated on the
 * page: UTC offsets from each airport's IANA time zone (via Intl, so daylight
 * saving is applied for the date given) and the great-circle distance between
 * the airport coordinates.
 */

/** Minutes east of UTC for an IANA zone at `at`, or null if the zone is unknown. */
export function utcOffsetMinutes(timeZone: string | null | undefined, at: Date = new Date()): number | null {
  if (!timeZone) return null;
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value;
    if (!part) return null;
    if (part === 'GMT') return 0;
    const m = /^GMT([+-])(\d{2}):?(\d{2})?$/.exec(part);
    if (!m) return null;
    const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
    return m[1] === '-' ? -minutes : minutes;
  } catch {
    return null;
  }
}

/** "UTC+3", "UTC−4:30", "UTC". */
export function formatUtcOffset(minutes: number): string {
  if (minutes === 0) return 'UTC';
  const sign = minutes > 0 ? '+' : '−';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/** Great-circle distance in km between two coordinates (mean Earth radius 6,371 km). */
export function greatCircleKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
