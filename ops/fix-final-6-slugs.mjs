#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const STORE_DIR = path.join(process.cwd(), 'content', 'airline-facts');
const TIER_FILE = path.join(process.cwd(), 'lib', 'airline-tier.ts');

const MAP = {
  'jet2': 'jet2com',
  'klm': 'klm-royal-dutch-airlines',
  'norwegian': 'norwegian-air-sweden',
  'pegasus': 'pegasus-airlines',
  'rex': 'rex-regional-express',
  'starlux': 'starlux-airlines',
};

for (const [oldSlug, newSlug] of Object.entries(MAP)) {
  const oldFile = path.join(STORE_DIR, `${oldSlug}.json`);
  const newFile = path.join(STORE_DIR, `${newSlug}.json`);

  if (fs.existsSync(oldFile)) {
    const data = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
    data.slug = newSlug;
    fs.writeFileSync(newFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
    fs.unlinkSync(oldFile);
    console.log(`Renamed ${oldSlug}.json -> ${newSlug}.json`);
  }
}

// Update lib/airline-tier.ts
const validFiles = fs.readdirSync(STORE_DIR).filter(f => f.endsWith('.json'));
const validSlugs = validFiles.map(f => f.replace('.json', '')).sort();

const tierContent = fs.readFileSync(TIER_FILE, 'utf8');
const formattedSet = `export const PUBLISHED_AIRLINE_GUIDES = new Set([\n` +
  validSlugs.map(s => `  '${s}',`).join('\n') +
  `\n]);`;

const updatedTierContent = tierContent.replace(
  /export const PUBLISHED_AIRLINE_GUIDES = new Set\(\[\s*[\s\S]*?\s*\]\);/,
  formattedSet
);

fs.writeFileSync(TIER_FILE, updatedTierContent, 'utf8');
console.log(`\nUpdated PUBLISHED_AIRLINE_GUIDES with ${validSlugs.length} valid Strapi slugs.`);
