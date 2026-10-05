import type { ReactNode } from 'react';
import { CloudSun, Droplets, Thermometer, Wind } from 'lucide-react';
import { baseSymbol, weatherKind, weatherLabel, type WeatherKind } from '@/lib/met-symbols';
import type { AirportWeather } from '@/lib/met-weather';
import s from './WeatherCard.module.css';

/**
 * "Weather now" card for the airport at-a-glance grid: an animated sky scene
 * chosen from MET's symbol code (sun, moon and stars, clouds, rain, snow,
 * thunder, fog; day or night), the temperature, and humidity, wind and the
 * 24-hour range drawn as small graphics. Same figures as before; the source
 * line is passed in so the page keeps its MET Norway attribution.
 */

type Sky = { from: string; to: string };

function skyFor(kind: WeatherKind, night: boolean): Sky {
  if (kind === 'thunder') return { from: '#1f2340', to: '#4a5078' };
  if (kind === 'snow' || kind === 'snowshowers' || kind === 'sleet' || kind === 'sleetshowers')
    return night ? { from: '#1a2a4d', to: '#4d6490' } : { from: '#5f7ca6', to: '#a9bcd6' };
  if (kind === 'rain' || kind === 'rainshowers' || kind === 'lightrain')
    return night ? { from: '#101c3a', to: '#34466b' } : { from: '#43557a', to: '#7a8aa8' };
  if (kind === 'fog') return night ? { from: '#222c40', to: '#56627a' } : { from: '#76849b', to: '#aab4c3' };
  if (kind === 'cloudy') return night ? { from: '#16213d', to: '#3d4b6b' } : { from: '#4d6288', to: '#8496b3' };
  return night ? { from: '#061b46', to: '#1d3d82' } : { from: '#1b5cc4', to: '#5b9be6' };
}

function Cloud({ x, y, scale = 1, fill = '#fff', opacity = 0.95, className = '' }: { x: number; y: number; scale?: number; fill?: string; opacity?: number; className?: string }) {
  return (
    <g className={className}>
      <g transform={`translate(${x} ${y}) scale(${scale})`} fill={fill} opacity={opacity}>
        <circle cx="22" cy="30" r="12" />
        <circle cx="38" cy="22" r="16" />
        <circle cx="56" cy="29" r="12" />
        <rect x="14" y="28" width="50" height="14" rx="7" />
      </g>
    </g>
  );
}

function Scene({ kind, night }: { kind: WeatherKind; night: boolean }) {
  const sunny = kind === 'clear' || kind === 'fair' || kind === 'partlycloudy';
  const precip = kind === 'lightrain' || kind === 'rain' || kind === 'rainshowers' || kind === 'thunder';
  const snowy = kind === 'snow' || kind === 'snowshowers' || kind === 'sleet' || kind === 'sleetshowers';
  const dark = kind === 'thunder' || precip || snowy || kind === 'cloudy';
  const cloudFill = kind === 'thunder' ? '#9aa0c0' : dark ? '#dbe3f0' : '#fff';
  const drops = kind === 'lightrain' ? 5 : 9;

  return (
    <svg viewBox="0 0 160 120" className="h-full w-full" aria-hidden focusable="false">
      {night && (kind === 'clear' || kind === 'fair' || kind === 'partlycloudy') &&
        [[22, 18], [60, 10], [118, 20], [140, 52], [96, 6], [12, 56]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 2 ? 1.2 : 1.8} fill="#fff" className={s.star} style={{ animationDelay: `${i * 0.5}s` }} />
        ))}

      {sunny && !night && (
        <g transform="translate(70 -4)">
          <g className={s.sunRays} stroke="#ffe27a" strokeWidth="3" strokeLinecap="round">
            {Array.from({ length: 12 }, (_, i) => (
              <line key={i} x1="50" y1="14" x2="50" y2={i % 2 ? 20 : 24} transform={`rotate(${i * 30} 50 50)`} />
            ))}
          </g>
          <circle cx="50" cy="50" r="24" fill="#ffd84a" className={s.sunPulse} />
          <circle cx="50" cy="50" r="31" fill="#ffd84a" opacity="0.2" className={s.sunPulse} />
        </g>
      )}

      {sunny && night && (
        <g transform="translate(76 -2)" className={s.moonGlow}>
          <circle cx="50" cy="50" r="30" fill="#fff6c8" opacity="0.12" />
          <path d="M60 24a26 26 0 1 0 14 38A22 22 0 0 1 60 24Z" fill="#fff3b8" />
        </g>
      )}

      {(kind === 'partlycloudy' || kind === 'fair') && <Cloud x={62} y={48} scale={1.15} className={s.cloudA} />}
      {kind === 'partlycloudy' && <Cloud x={14} y={66} scale={0.7} opacity={0.8} className={s.cloudB} />}

      {(kind === 'cloudy' || precip || snowy || kind === 'fog') && (
        <>
          <Cloud x={20} y={20} scale={1.25} fill={cloudFill} className={s.cloudB} />
          <Cloud x={72} y={34} scale={1} fill={cloudFill} opacity={0.85} className={s.cloudA} />
        </>
      )}

      {precip &&
        Array.from({ length: drops }, (_, i) => (
          <line
            key={i}
            x1={34 + i * 11}
            y1="66"
            x2={31 + i * 11}
            y2="76"
            stroke="#a6d4ff"
            strokeWidth="2"
            strokeLinecap="round"
            className={s.drop}
            style={{ animationDelay: `${(i % 5) * 0.22}s`, animationDuration: `${0.9 + (i % 3) * 0.15}s` }}
          />
        ))}

      {snowy &&
        Array.from({ length: 8 }, (_, i) => (
          <circle key={i} cx={36 + i * 12} cy="68" r={i % 2 ? 2 : 2.8} fill="#fff" className={s.flake} style={{ animationDelay: `${i * 0.5}s` }} />
        ))}

      {kind === 'thunder' && (
        <path d="M82 58 68 82h11l-6 20 20-28H80l7-16Z" fill="#ffe14a" className={s.bolt} />
      )}

      {kind === 'fog' &&
        [70, 82, 94].map((y, i) => (
          <rect key={y} x={i % 2 ? 30 : 12} y={y} width="110" height="6" rx="3" fill="#fff" opacity={0.55 - i * 0.1} className={s.fog} style={{ animationDelay: `${i * 1.2}s` }} />
        ))}
    </svg>
  );
}

export default function WeatherCard({
  weather,
  source,
}: {
  weather: AirportWeather;
  /** Attribution line (MET Norway link and local time), rendered by the page. */
  source: ReactNode;
}) {
  const cur = weather.current;
  if (!cur || typeof cur.airTemperature !== 'number') return null;

  const kind = weatherKind(cur.symbolCode);
  const night = /_night$/.test((cur.symbolCode ?? '').toLowerCase());
  const sky = skyFor(kind, night);
  const temp = Math.round(cur.airTemperature);
  const rh = typeof cur.relativeHumidity === 'number' ? Math.round(cur.relativeHumidity) : null;
  const wind = typeof cur.windSpeedKmh === 'number' ? Math.round(cur.windSpeedKmh) : null;
  const lo = weather.next24h?.min;
  const hi = weather.next24h?.max;
  const hasRange = typeof lo === 'number' && typeof hi === 'number';
  const span = hasRange ? Math.max(hi - lo, 1) : 1;
  const pos = hasRange ? Math.min(100, Math.max(0, ((cur.airTemperature - lo) / span) * 100)) : 0;
  // Faster fan for stronger wind: 6 s a turn at calm, 0.6 s in a gale.
  const fanSeconds = wind === null ? 3 : Math.max(0.6, 6 - wind / 8);

  return (
    <li
      className="relative flex h-[200px] flex-col overflow-hidden rounded-[0.5rem] border border-forest-900/10 text-white shadow-[0_1px_2px_rgba(15,39,102,0.08)] sm:col-span-2 lg:col-span-1"
      style={{ backgroundImage: `linear-gradient(160deg, ${sky.from}, ${sky.to})` }}
      data-testid="airport-v2-weather"
      data-weather={baseSymbol(cur.symbolCode) || 'unknown'}
    >
      <div aria-hidden className="pointer-events-none absolute -right-2 -top-1 h-28 w-36 sm:h-32 sm:w-40">
        <Scene kind={kind} night={night} />
      </div>

      <div className="relative flex-none px-4 pb-1 pt-2.5">
        <h3 className="flex items-center gap-2.5 text-base leading-snug !text-white">
          <span aria-hidden className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/20 text-sand-300">
            <CloudSun className="h-4 w-4" />
          </span>
          Weather now
        </h3>

        <div className="mt-1 flex items-end gap-2.5">
          <p className="flex items-start leading-none">
            <span className="text-4xl font-bold tracking-tight" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
              {temp}
            </span>
            <span className="text-lg font-semibold">°C</span>
          </p>
          <p className="pb-0.5 text-sm font-semibold leading-tight">{weatherLabel(cur.symbolCode)}</p>
        </div>
      </div>

      <dl className="relative mt-auto min-h-0 space-y-1 overflow-y-auto border-t border-white/20 bg-black/10 px-4 py-1.5 text-sm backdrop-blur-[2px]">
        <div className="grid grid-cols-2 gap-3">
          {rh !== null && (
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/80">
                <Droplets aria-hidden className={`h-3.5 w-3.5 ${s.tide}`} />
                Humidity
              </dt>
              <dd className="font-semibold leading-4">{rh}%</dd>
              <dd aria-hidden className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/25">
                <span className={`block h-full rounded-full bg-sand-300 ${s.fill}`} style={{ width: `${rh}%` }} />
              </dd>
            </div>
          )}
          {wind !== null && (
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/80">
                <Wind aria-hidden className="h-3.5 w-3.5" />
                Wind
              </dt>
              <dd className="flex items-center gap-2 font-semibold leading-4">
                {wind} km/h
                <svg aria-hidden viewBox="0 0 24 24" className={`h-5 w-5 ${s.fan}`} style={{ animationDuration: `${fanSeconds}s` }} fill="#fff">
                  <path d="M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
                  <path d="M12 3c2 0 3 2 2 4l-1.5 3.2L12 11Zm7.8 12.5c-1 1.7-3.2 1.6-4.6.4l-2.7-2.3 1.4-.6Zm-15.6 0c-1-1.7 0-3.7 2-4.1l3.5-.4.5 1.4Z" />
                </svg>
              </dd>
            </div>
          )}
        </div>

        {hasRange && (
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/80">
              <Thermometer aria-hidden className="h-3.5 w-3.5" />
              Next 24 h
            </dt>
            <dd className="flex items-center gap-2.5 font-semibold leading-4">
              <span>{Math.round(lo)}°</span>
              <span aria-hidden className="relative h-2 flex-1 rounded-full bg-gradient-to-r from-sky-200 via-sand-300 to-orange-400">
                <span
                  className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-forest-950 ${s.marker}`}
                  style={{ left: `${pos}%` }}
                />
              </span>
              <span>
                <span className="sr-only">to </span>
                {Math.round(hi)}°
              </span>
            </dd>
          </div>
        )}

        <p className="text-[11px] leading-4 text-white/80 [&_a]:text-white [&_a]:underline">{source}</p>
      </dl>
    </li>
  );
}
