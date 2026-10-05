/**
 * FAQ entries built from the airport enrichment dataset (lib/airport-enrichment.ts).
 *
 * Each answer restates values the page shows and names the dataset. A question
 * appears only when its data exists, so which questions an airport gets
 * depends on what is known about it. No filler, no advice the data does not
 * support.
 */
import type { Faq } from './faqs';
import {
  compassWords,
  formatElevation,
  formatKm,
  formatLength,
  formatOpened,
  formatPassengers,
  type ClimateSummary,
  type Runway,
  type WikidataEntry,
} from '@/lib/airport-enrichment';

export type EnrichmentFaqInput = {
  name: string;
  iata: string;
  city?: string | null;
  runways?: Runway[];
  elevationFt?: number | null;
  opened?: WikidataEntry['opened'];
  operators?: string[];
  owners?: string[];
  patronage?: { value: number; year: number } | null;
  hubAirlines?: string[];
  cityCentre?: { name: string; km: number; compass: string } | null;
  climate?: (ClimateSummary & { period: string }) | null;
  fares?: { destinations: number; countries: number; topCountries: { country: string; count: number }[]; retrieved: string } | null;
  /** Upper bound on entries returned. */
  max?: number;
};

export function enrichmentFaqs(x: EnrichmentFaqInput): Faq[] {
  const out: Faq[] = [];
  const rw = x.runways ?? [];

  if (rw.length) {
    const list = rw
      .slice(0, 4)
      .map((r) => `${r.ident ? `${r.ident} (` : ''}${formatLength(r.lengthFt)}${r.surface ? `, ${r.surface}` : ''}${r.ident ? ')' : ''}`)
      .join('; ');
    out.push({
      q: `How many runways does ${x.name} have?`,
      a: `OurAirports lists ${rw.length === 1 ? 'one open runway' : `${rw.length} open runways`} at ${x.iata}: ${list}${rw.length > 4 ? '; and others' : ''}.`,
    });
  }

  if (x.fares && x.fares.destinations > 0) {
    const top = x.fares.topCountries.filter((c) => c.count > 1).slice(0, 3);
    out.push({
      q: `Where can you fly nonstop from ${x.iata}?`,
      a: `Travelpayouts fare data retrieved ${x.fares.retrieved} showed nonstop fares from ${x.iata} to ${x.fares.destinations} ${
        x.fares.destinations === 1 ? 'destination' : 'destinations'
      }${x.fares.countries > 1 ? ` in ${x.fares.countries} countries` : ''}${
        top.length ? `, the most in ${listProse(top.map((c) => `${c.country} (${c.count})`))}` : ''
      }. That reflects fares travellers found, not a complete or live schedule.`,
    });
  }

  if (x.opened) {
    out.push({
      q: `When did ${x.name} open?`,
      a: `Wikidata gives ${formatOpened(x.opened)} as its ${x.opened.prop === 'P1619' ? 'official opening date' : 'inception date'}.`,
    });
  }

  if (x.patronage) {
    out.push({
      q: `How many passengers use ${x.name}?`,
      a: `Wikidata records ${formatPassengers(x.patronage.value)} passengers for ${x.patronage.year}, the latest year it holds.`,
    });
  }

  if (x.operators?.length || x.owners?.length) {
    const ops = x.operators ?? [];
    const own = (x.owners ?? []).filter((o) => !ops.includes(o));
    const parts = [
      ops.length ? `operated by ${listProse(ops)}` : '',
      own.length ? `owned by ${listProse(own)}` : ops.length && x.owners?.length ? 'which also owns it' : '',
    ].filter(Boolean);
    out.push({
      q: ops.length ? `Who operates ${x.name}?` : `Who owns ${x.name}?`,
      a: `Per Wikidata, ${x.iata} is ${parts.join(', ')}.`,
    });
  }

  if (x.hubAirlines?.length) {
    out.push({
      q: `Which airlines have a hub at ${x.iata}?`,
      a: `Wikidata lists ${x.iata} as a hub of ${listProse(x.hubAirlines.slice(0, 8))}${x.hubAirlines.length > 8 ? ` and ${x.hubAirlines.length - 8} more` : ''}.`,
    });
  }

  if (x.cityCentre) {
    out.push({
      q: `How far is ${x.iata} from ${x.cityCentre.name} city centre?`,
      a: `${x.name} is about ${formatKm(x.cityCentre.km)} ${compassWords(x.cityCentre.compass)} of ${x.cityCentre.name} city centre in a straight line, calculated from coordinates. The distance by road is longer.`,
    });
  }

  if (x.climate) {
    const c = x.climate;
    out.push({
      q: `What is the weather like at ${x.iata} through the year?`,
      a: `NASA POWER averages for ${c.period} put the warmest month at ${c.warmest.month} (average high ${round(c.warmest.hi)}°C, low ${round(
        c.warmest.lo,
      )}°C) and the coolest at ${c.coolest.month} (${round(c.coolest.hi)}°C / ${round(c.coolest.lo)}°C)${
        c.wettest && c.driest ? `; ${c.wettest.month} is the wettest (${c.wettest.mm} mm) and ${c.driest.month} the driest (${c.driest.mm} mm)` : ''
      }.`,
    });
  }

  if (typeof x.elevationFt === 'number') {
    out.push({
      q: `What is the elevation of ${x.name}?`,
      a:
        x.elevationFt < 0
          ? `OurAirports gives ${x.iata}’s elevation as ${formatElevation(Math.abs(x.elevationFt))} below sea level.`
          : `OurAirports gives ${x.iata}’s elevation as ${formatElevation(x.elevationFt)} above sea level.`,
    });
  }

  return out.slice(0, x.max ?? 6);
}

function round(n: number): number {
  return Math.round(n);
}

function listProse(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
