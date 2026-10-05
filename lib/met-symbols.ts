/**
 * MET Norway weather symbols (Locationforecast `symbol_code`, e.g.
 * "partlycloudy_day", "lightrainshowersandthunder_night") mapped to the labels
 * and icons the site shows. Client-safe: no I/O.
 *
 * Symbol list: https://api.met.no/weatherapi/weathericon/2.0/documentation
 */

export type WeatherKind =
  | 'clear'
  | 'fair'
  | 'partlycloudy'
  | 'cloudy'
  | 'fog'
  | 'lightrain'
  | 'rain'
  | 'rainshowers'
  | 'sleet'
  | 'sleetshowers'
  | 'snow'
  | 'snowshowers'
  | 'thunder'
  | 'unknown';

/** "lightrainshowers_day" → "lightrainshowers" (drops _day/_night/_polartwilight). */
export function baseSymbol(symbolCode: string | null | undefined): string {
  if (typeof symbolCode !== 'string') return '';
  return symbolCode.trim().toLowerCase().replace(/_(day|night|polartwilight)$/, '');
}

export function weatherKind(symbolCode: string | null | undefined): WeatherKind {
  const s = baseSymbol(symbolCode);
  if (!s) return 'unknown';
  // Every "...andthunder" variant (MET also spells some "lightssleet…"/"lightssnow…").
  if (s.includes('thunder')) return 'thunder';
  if (s === 'clearsky') return 'clear';
  if (s === 'fair') return 'fair';
  if (s === 'partlycloudy') return 'partlycloudy';
  if (s === 'cloudy') return 'cloudy';
  if (s === 'fog') return 'fog';
  if (s.includes('sleet')) return s.includes('showers') ? 'sleetshowers' : 'sleet';
  if (s.includes('snow')) return s.includes('showers') ? 'snowshowers' : 'snow';
  if (s.includes('rain')) {
    if (s.includes('showers')) return 'rainshowers';
    return s === 'lightrain' ? 'lightrain' : 'rain';
  }
  return 'unknown';
}

/** Long label, as used on airport pages ("Weather now"). */
const LABELS: Record<WeatherKind, string> = {
  clear: 'Clear sky',
  fair: 'Mainly clear',
  partlycloudy: 'Partly cloudy',
  cloudy: 'Overcast',
  fog: 'Fog',
  lightrain: 'Light rain',
  rain: 'Rain',
  rainshowers: 'Rain showers',
  sleet: 'Sleet',
  sleetshowers: 'Sleet showers',
  snow: 'Snow',
  snowshowers: 'Snow showers',
  thunder: 'Thunderstorm',
  unknown: 'Local conditions',
};

/** Short label + emoji icon, as used by the sidebar weather widget. */
const SHORT: Record<WeatherKind, { label: string; icon: string }> = {
  clear: { label: 'Clear', icon: '☀️' },
  fair: { label: 'Partly cloudy', icon: '⛅' },
  partlycloudy: { label: 'Partly cloudy', icon: '⛅' },
  cloudy: { label: 'Cloudy', icon: '☁️' },
  fog: { label: 'Foggy', icon: '🌫️' },
  lightrain: { label: 'Light rain', icon: '🌦️' },
  rain: { label: 'Rain', icon: '🌧️' },
  rainshowers: { label: 'Rain showers', icon: '🌧️' },
  sleet: { label: 'Sleet', icon: '🌨️' },
  sleetshowers: { label: 'Sleet showers', icon: '🌨️' },
  snow: { label: 'Snow', icon: '🌨️' },
  snowshowers: { label: 'Snow showers', icon: '🌨️' },
  thunder: { label: 'Thunderstorm', icon: '⛈️' },
  unknown: { label: 'Weather', icon: '🌍' },
};

export function weatherLabel(symbolCode?: string | null): string {
  if (!symbolCode) return 'Weather unavailable';
  return LABELS[weatherKind(symbolCode)];
}

export function describeWeather(symbolCode?: string | null): { label: string; icon: string } {
  return SHORT[weatherKind(symbolCode)];
}

export const MET_ATTRIBUTION = {
  name: 'MET Norway',
  url: 'https://api.met.no/',
  licence: 'CC BY 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
} as const;

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "14:00" in the given zone ("05:00 UTC" when the zone is unknown). */
export function formatLocalTime(iso: string | undefined, timeZone?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const s = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(d);
  return tz === 'UTC' && timeZone !== 'UTC' ? `${s} UTC` : `${s} local`;
}
