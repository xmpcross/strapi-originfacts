#!/usr/bin/env node
// Generates cover (hero) images for city destinations that have none, with
// fal.ai FLUX.1 [dev] at 1024×576 (the size the existing covers use).
//
// Two steps, so nothing reaches the site unreviewed:
//
//   node ops/generate-city-covers.mjs                  # generate into /root/originfacts-city-covers/
//   node ops/generate-city-covers.mjs --slugs paris    # (re)generate some
//   node ops/generate-city-covers.mjs --upload         # upload reviewed images and attach them in Strapi
//
// Generation skips cities that already have a cover in Strapi or an image in
// the output folder (delete a file, or pass --overwrite, to redo it). Upload
// only attaches to destinations that still have no cover, so it never
// replaces an image someone chose.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile('/opt/strapi-cms-git/backend/ai-writer-cli/.env');

const STRAPI_URL = (process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.fxnstudio.com').replace(/\/$/, '');
const STRAPI_WRITE_TOKEN = process.env.STRAPI_WRITE_TOKEN || process.env.STRAPI_API_TOKEN || '';
const FAL_KEY = process.env.FAL_KEY || '';
const OUT_DIR = '/root/originfacts-city-covers';
const FAL_MODEL = 'fal-ai/flux/dev';
const COST_PER_IMAGE = 0.025; // fal.ai FLUX.1 [dev], $0.025 per megapixel, rounded up to 1 MP.

const STYLE =
  'photorealistic editorial travel photograph, natural colours, no text, no signage, no logos, no watermarks, ' +
  'no close-up faces, wide 16:9 composition, cinematic lighting, ultra-detailed';

/** One scene per city: a recognisable, verifiable view, kept simple so the model gets it right. */
const PROMPTS = {
  darwin: 'Darwin Waterfront in the Northern Territory of Australia at sunset, palm trees, calm harbour water, low-rise modern buildings, tropical golden light',
  tasmania: 'Cradle Mountain in Tasmania reflected in Dove Lake on a clear morning, rugged dolerite peaks, button grass and alpine scrub',
  paris: 'the Eiffel Tower seen across the Seine in Paris at golden hour, Haussmann-style stone buildings along the river, soft evening sky',
  london: 'the Palace of Westminster and Elizabeth Tower (Big Ben) beside the River Thames in London at dusk, Westminster Bridge, warm lights on the water',
  rome: 'the Colosseum in Rome at golden hour, travertine arches glowing warm, umbrella pines and a clear sky',
  barcelona: 'a wide view over Barcelona at sunset from a hilltop, the dense grid of the Eixample district, the Mediterranean Sea on the horizon and the Sagrada Família basilica small in the distance',
  istanbul: 'the Istanbul skyline across the Bosphorus at sunset, domes and minarets of the old city, a ferry crossing the water',
  amsterdam: 'a canal in central Amsterdam at golden hour, narrow gabled canal houses, an arched bridge with bicycles parked along the railing, reflections in the water',
  prague: 'Charles Bridge and Prague Castle above the Vltava river at sunrise, baroque statues on the bridge, misty morning light',
  vienna: 'Schönbrunn Palace in Vienna on a sunny day, the long yellow baroque facade and formal gardens with fountains',
  'new-york': 'the Manhattan skyline at dusk seen from Brooklyn Bridge Park, the Brooklyn Bridge in the foreground, city lights reflecting on the East River',
  'los-angeles': 'downtown Los Angeles skyline at sunset with palm trees in the foreground and the San Gabriel Mountains behind',
  chicago: 'the Chicago skyline along the Chicago River at blue hour, tall towers and illuminated bridges reflected in the water',
  houston: 'the downtown Houston skyline at sunset seen across Buffalo Bayou Park, green parkland and walking paths in the foreground',
  dallas: 'the Dallas skyline at dusk with Reunion Tower lit up and the Margaret Hunt Hill Bridge across the Trinity River',
  'san-francisco': 'the Golden Gate Bridge in San Francisco at sunset, low fog rolling over the hills, the bay in the foreground',
  kuressaare: 'Kuressaare Episcopal Castle on Saaremaa island, Estonia, a plain square medieval fortress of grey dolomite stone with flat walls and two simple square towers, no pointed turrets, surrounded by a moat and green lawns, summer evening',
  okinawa: 'a turquoise beach and white coral sand on the Okinawa coast, Japan, lush green headland and clear tropical water',
  krabi: 'Railay Beach in Krabi, Thailand, towering limestone karst cliffs, longtail boats on emerald water, white sand',
  'ho-chi-minh-city': 'Ho Chi Minh City skyline along the Saigon River at dusk, modern towers lit up, boats on the river',
  'rhodes-town': 'the medieval Old Town of Rhodes, Greece, the stone walls and the Palace of the Grand Master at golden hour',
  guangzhou: 'the Canton Tower in Guangzhou at night, a single very tall slender tower with a twisted hyperboloid lattice that narrows at the waist, lit in soft colours, beside the Pearl River with city lights reflected in the water',
  shenzhen: 'the Shenzhen skyline at dusk, modern glass skyscrapers along Shenzhen Bay, waterfront promenade',
  nagoya: 'Nagoya Castle in Japan in spring, white walls and green copper roofs with golden shachihoko, cherry blossoms in front',
  interlaken: 'Interlaken in Switzerland between Lake Thun and Lake Brienz, turquoise lake water, snow-capped Alps behind, summer morning',
  gothenburg: 'the Gothenburg harbour in Sweden at golden hour, waterfront buildings, moored sailing ships and the canal',
  heraklion: 'the Venetian Koules fortress at the old harbour of Heraklion, Crete, stone walls by the deep blue sea, fishing boats',
  chania: 'the Venetian harbour of Chania, Crete, colourful waterfront houses and the lighthouse at sunset, calm water',
  fukuoka: 'the Fukuoka skyline along Hakata Bay at sunset, Fukuoka Tower and the Momochi seaside, calm water',
  chengdu: 'a giant panda eating bamboo in a green bamboo forest at the Chengdu Research Base of Giant Panda Breeding, soft natural light',
  sapporo: 'Odori Park in Sapporo, Japan, in winter, snow-covered park with the Sapporo TV Tower, evening lights',
  kiruna: 'green northern lights over a snowy Lapland landscape near Kiruna, Sweden, snow-covered spruce trees, starry winter night',
  chennai: 'Marina Beach in Chennai, India, at sunrise, wide sandy shore along the Bay of Bengal, fishing boats on the sand',
  hamburg: 'the Speicherstadt warehouse district in Hamburg at dusk, tall neo-gothic red-brick warehouses with green copper turrets lining a narrow canal, iron footbridges, warm lights reflected in the water',
  athens: 'the Acropolis and the Parthenon above Athens at sunset, ancient marble columns glowing warm over the city',
  hiroshima: 'the floating torii gate of Itsukushima Shrine at Miyajima near Hiroshima at high tide, sunset over the Seto Inland Sea',
  kyoto: 'the Kinkaku-ji Golden Pavilion in Kyoto reflected in its pond, autumn maple trees in red and orange, calm morning',
  osaka: 'Osaka Castle in Japan surrounded by cherry blossoms in spring, white and green castle tower above stone walls and a moat',
  munich: 'the Marienplatz square in Munich with the Neues Rathaus gothic town hall, Bavarian spring day, clear sky',
  'luang-prabang': 'the Mekong river at sunset near Luang Prabang, Laos, a gilded temple roof among palm trees, wooden boats on the river',
  mumbai: 'the Gateway of India on the Mumbai waterfront at sunset, basalt arch by the Arabian Sea, boats in the harbour',
  'puerto-princesa': 'the Puerto Princesa Underground River entrance in Palawan, Philippines, limestone karst cliffs, emerald lagoon, jungle',
  beijing: 'the Forbidden City in Beijing at sunset, golden glazed roofs and red walls of the palace halls, seen from above',
};

const args = parseArgs(process.argv.slice(2));
const slugFilter = args.slugs ? new Set(String(args.slugs).split(',').map((s) => s.trim())) : null;
const overwrite = Boolean(args.overwrite);
const upload = Boolean(args.upload);

if (!upload && !FAL_KEY) fatal('FAL_KEY is not set.');
if (upload && !STRAPI_WRITE_TOKEN) fatal('STRAPI_WRITE_TOKEN or STRAPI_API_TOKEN is required to upload.');
fs.mkdirSync(OUT_DIR, { recursive: true });

const cities = (await strapiGet('/api/destinations?filters[type][$eq]=city&pagination[pageSize]=200&populate=heroImage')).data
  .filter((c) => !c.heroImage && PROMPTS[c.slug] && (!slugFilter || slugFilter.has(c.slug)));

let spent = 0;
let failed = 0;
for (const city of cities) {
  try {
    console.log(upload ? await attach(city) : await generate(city));
  } catch (error) {
    failed++;
    console.error(`${city.slug}: FAILED ${error.message}`);
  }
}
if (!upload) console.log(`fal.ai spend this run: about $${spent.toFixed(3)}`);
if (failed) process.exitCode = 1;

async function generate(city) {
  const file = path.join(OUT_DIR, `${city.slug}.jpg`);
  if (!overwrite && fs.existsSync(file)) return `${city.slug}: image exists, skipped`;
  const prompt = `${PROMPTS[city.slug]}, ${STYLE}`;
  const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_size: 'landscape_16_9', num_images: 1, enable_safety_checker: true, output_format: 'jpeg' }),
  });
  if (!res.ok) throw new Error(`fal.ai ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const out = await res.json();
  const image = out.images?.[0];
  if (!image?.url) throw new Error('fal.ai returned no image');
  if (out.has_nsfw_concepts?.[0]) throw new Error('safety checker blanked the image');
  spent += COST_PER_IMAGE;
  const bytes = Buffer.from(await (await fetch(image.url)).arrayBuffer());
  fs.writeFileSync(file, bytes);
  fs.writeFileSync(path.join(OUT_DIR, `${city.slug}.json`), JSON.stringify({ slug: city.slug, model: FAL_MODEL, prompt, seed: out.seed, width: image.width, height: image.height, generatedAt: new Date().toISOString() }, null, 2) + '\n');
  return `${city.slug}: ${image.width}×${image.height}, ${(bytes.length / 1024).toFixed(0)} KB`;
}

async function attach(city) {
  const file = path.join(OUT_DIR, `${city.slug}.jpg`);
  if (!fs.existsSync(file)) return `${city.slug}: no image, skipped`;
  const form = new FormData();
  form.append('files', new Blob([fs.readFileSync(file)], { type: 'image/jpeg' }), `${city.slug}_hero.jpg`);
  form.append('fileInfo', JSON.stringify({ alternativeText: `${city.name} travel guide` }));
  const up = await fetch(`${STRAPI_URL}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${STRAPI_WRITE_TOKEN}` }, body: form });
  if (!up.ok) throw new Error(`upload ${up.status}: ${(await up.text()).slice(0, 240)}`);
  const [media] = await up.json();
  const put = await fetch(`${STRAPI_URL}/api/destinations/${city.documentId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${STRAPI_WRITE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { heroImage: media.id } }),
  });
  if (!put.ok) throw new Error(`attach ${put.status}: ${(await put.text()).slice(0, 240)}`);
  return `${city.slug}: attached media ${media.id}`;
}

async function strapiGet(p) {
  const res = await fetch(`${STRAPI_URL}${p}`);
  if (!res.ok) throw new Error(`Strapi ${res.status} on ${p}`);
  return res.json();
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const [key, ...rest] = argv[i].slice(2).split('=');
    if (rest.length) out[key] = rest.join('=');
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[key] = argv[++i];
    else out[key] = true;
  }
  return out;
}

function loadEnvFile(filename) {
  if (!fs.existsSync(filename)) return;
  for (const line of fs.readFileSync(filename, 'utf8').split(/\n/)) {
    const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

function fatal(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
