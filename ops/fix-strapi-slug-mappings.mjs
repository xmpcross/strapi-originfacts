#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const STORE_DIR = path.join(process.cwd(), 'content', 'airline-facts');
const TIER_FILE = path.join(process.cwd(), 'lib', 'airline-tier.ts');

async function fixMappings() {
  const files = fs.readdirSync(STORE_DIR).filter(f => f.endsWith('.json'));
  console.log(`Checking ${files.length} fact files against Strapi database...`);

  const slugFixes = new Map();

  for (const file of files) {
    const currentSlug = file.replace('.json', '');
    const res = await fetch(`https://cms.fxnstudio.com/api/airlines?filters[slug][$eq]=${currentSlug}`);
    const json = await res.json();

    if (!json.data || json.data.length === 0) {
      // Try searching by IATA code inside the json file or carrier name
      const filePath = path.join(STORE_DIR, file);
      const factData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const officialSite = factData.official_website || '';
      
      // Query Strapi for matching carrier by website or name
      const searchRes = await fetch(`https://cms.fxnstudio.com/api/airlines?filters[website][$contains]=${encodeURIComponent(officialSite.replace(/^https?:\/\//, ''))}`);
      const searchJson = await searchRes.json();
      
      if (searchJson.data && searchJson.data.length > 0) {
        const correctSlug = searchJson.data[0].slug;
        console.log(`Mapping fix: ${currentSlug} -> ${correctSlug}`);
        slugFixes.set(currentSlug, correctSlug);
      }
    }
  }

  for (const [oldSlug, newSlug] of slugFixes.entries()) {
    const oldFile = path.join(STORE_DIR, `${oldSlug}.json`);
    const newFile = path.join(STORE_DIR, `${newSlug}.json`);

    const data = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
    data.slug = newSlug;
    fs.writeFileSync(newFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
    fs.unlinkSync(oldFile);
    console.log(`Renamed ${oldSlug}.json -> ${newSlug}.json`);
  }

  // Update lib/airline-tier.ts with all current valid slugs in STORE_DIR
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
  console.log(`\nUpdated PUBLISHED_AIRLINE_GUIDES with ${validSlugs.length} perfectly matched Strapi slugs.`);
}

fixMappings().catch(console.error);
