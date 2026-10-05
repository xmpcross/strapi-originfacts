/**
 * Writes data/reports/route-carrier-suspects.csv: every route–carrier link in
 * Strapi that lib/route-carriers.ts keeps off the site, with the reason, so
 * the CMS relation can be cleaned by hand. Read-only: one GET to Strapi (or
 * --routes <saved /api/routes response>), nothing is written to Strapi.
 *
 *   npx tsx ops/report-route-carriers.ts [--routes routes.json]
 */
import fs from 'node:fs';
import path from 'node:path';

import { assessRouteCarriers, CARRIER_DROP_REASONS } from '../lib/route-carriers';

const i = process.argv.indexOf('--routes');
const file = i >= 0 ? process.argv[i + 1] : null;

async function load() {
  if (file) return JSON.parse(fs.readFileSync(file, 'utf8')).data;
  const base = (process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');
  const q =
    'populate[origin]=true&populate[destination]=true&populate[carriers][fields][0]=name&populate[carriers][fields][1]=slug' +
    '&populate[carriers][fields][2]=iataCode&populate[carriers][fields][3]=country&pagination[pageSize]=1000';
  const res = await fetch(`${base}/api/routes?${q}`);
  if (!res.ok) throw new Error(`Strapi returned ${res.status}`);
  return (await res.json()).data;
}

async function main() {
  const routes = await load();
  const csv = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [
    [
      'route_slug',
      'carrier_slug',
      'iata',
      'reason',
      'carrier_name',
      'carrier_country',
      'route_countries',
      'explanation',
    ],
  ];
  const counts: Record<string, number> = {};
  let links = 0;
  for (const r of routes) {
    for (const { carrier, verdict } of assessRouteCarriers(r)) {
      links++;
      if (verdict.keep) continue;
      counts[verdict.reason] = (counts[verdict.reason] ?? 0) + 1;
      rows.push([
        r.slug,
        carrier.slug,
        carrier.iataCode ?? '',
        verdict.reason,
        carrier.name,
        carrier.country ?? '',
        `${r.origin?.country ?? ''} -> ${r.destination?.country ?? ''}`,
        CARRIER_DROP_REASONS[verdict.reason],
      ]);
    }
  }
  const out = path.join(process.cwd(), 'data', 'reports', 'route-carrier-suspects.csv');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, rows.map((row) => row.map(csv).join(',')).join('\n') + '\n');
  console.log({
    routes: routes.length,
    links,
    suspect: rows.length - 1,
    counts,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
