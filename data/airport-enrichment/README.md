# Airport enrichment data

Per-airport facts from free, open sources for the airport pages
(`components/airport-v2/AirportGuideV2.tsx`). Built by
`ops/build-airport-enrichment.mjs`; read from disk by `lib/airport-enrichment.ts`
at build/revalidate time. **No source is called at runtime**, and nothing here
is written to Strapi. No LLM or paid API is involved.

Each file is `{ source, sourceUrl, licence, retrieved, …, airports: { IATA: {…} } }`,
one airport per line. `meta.json` lists each file's retrieval date, airport
count and size.

| File | Source | Licence | Airports | What |
| --- | --- | --- | --- | --- |
| `ourairports.json` | [OurAirports](https://ourairports.com/data/) `airports.csv`, `runways.csv` | Public domain | every CMS airport that joins | size class, elevation, scheduled-service flag, coordinates, home link, Wikipedia link, open runways (length, width, surface, lighting) |
| `wikidata.json` | [Wikidata Query Service](https://query.wikidata.org/) | CC0 | every CMS airport with an ICAO that joins | opening date (P1619, else P571, precision kept), operator (P137), owner (P127), named after (P138), place served (P931 + coordinates), latest patronage (P3872 + P585, with reference URL), hub airlines (inverse P113, no end date, not dissolved), official website (P856) |
| `fares.json` | Travelpayouts Data API `/v1/prices/direct` (partner token, free) | Travelpayouts partner terms | indexable airports (reviewed guides + airports with route records), plus any passed with `--only` | destinations with a nonstop fare in Aviasales' recent search cache, and the airline named on each fare |
| `climate.json` | [NASA POWER](https://power.larc.nasa.gov/) daily point API | NASA open data, no restrictions (cite NASA Langley POWER) | same as `fares.json` | monthly mean daily high/low and mean monthly precipitation, 2016–2025 |
| `computed.json` | calculated, no network | — | every CMS airport with coordinates | distance and compass direction from the city centre; nearest airports with scheduled service |

## Identity rules

- **OurAirports** is joined by ICAO (`icao_code`, then `ident`, then `gps_code`).
  The match is accepted when the IATA also agrees *and* the country or name
  agrees, or when the coordinates are within 30 km. IATA is used only when the
  record has no ICAO, and then only when country and name agree. IATA codes are
  not identities (`content/airline-facts/CLAUDE.md`).
- **Wikidata** items are accepted only on an ICAO (P239) match, with any IATA
  (P238) on the item equal to the airport's, not dissolved, and exactly one
  candidate.
- **Airline codes** on fares and Wikidata hubs link to a site airline only via
  `resolveAirlineCode()` in `lib/airport-enrichment.ts`: the CMS airline must
  hold the code, pass `carrierCodeMismatch()` (Duffel's current holder is the
  same carrier — PR #162), not be ceased or a non-airline, and match the name
  the source gives. Otherwise the code and source name are shown, unlinked.
- **Fares** are evidence that travellers found a nonstop fare, not a schedule.
  An airline named on a single fare from the airport whose home country is
  neither end's is excluded as a likely codeshare or data error (listed per
  airport under `excluded`).

## Why these sources

- Travelpayouts' static `data/routes.json` was **not** used: it is the 2014-era
  OpenFlights route set (Air Berlin, Flybe, DJ as Virgin Blue), so it cannot
  support "current routes".
- Open-Meteo was **not** used for climate: its free API is non-commercial only
  ("websites … that display advertisements" need a paid plan). NASA POWER is
  free for any use. POWER's climatology endpoint reports monthly *extremes* for
  T2M_MAX/T2M_MIN, so daily values are fetched and averaged instead.
- OurAirports has no street address or phone number: those fields (previously
  from the paid RapidAPI airport-info lookup) are no longer shown.

## Refresh (quarterly)

```bash
cd /opt/projects/originfacts.com          # or a worktree
export PATH=/usr/local/lib/nodejs/current/bin:$PATH
node ops/build-airport-enrichment.mjs                      # every step, indexable airports for fares/climate
node ops/build-airport-enrichment.mjs --steps fares,climate --only DUB,ORY   # a few airports
node ops/build-airport-enrichment.mjs --network all        # fares + climate for every airport (slow: ~2 h)
```

Wikidata takes about 40 minutes for all airports (batched 60 ICAOs per query,
1.5 s between queries, backoff on 429/5xx, descriptive User-Agent). Fares run
at under 90 requests a minute (limit 180), NASA POWER at one a second. Order
matters: `computed` reads `ourairports.json` and `wikidata.json`. Commit the
changed files and redeploy; pages pick them up on the next build.
