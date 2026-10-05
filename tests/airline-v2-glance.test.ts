import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { getAirlineFacts, type AirlineFactsFile } from '../lib/airline-facts';

// facts-view reaches a React component that imports a CSS module; Node cannot
// load CSS, so stub it out (Next handles it in the real build).
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'commonjs', source: 'module.exports = {};', shortCircuit: true };
    return nextLoad(url, context);
  },
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { glanceHasValues, loadModules } = require('../components/airline-v2/facts-view') as typeof import('../components/airline-v2/facts-view');

const has = (slug: string) => glanceHasValues(loadModules(getAirlineFacts(slug)));

test('airline v2 glance: shown when at least one tile has an official value', () => {
  assert.equal(has('qantas'), true);
  assert.equal(has('american-airlines'), true);
  assert.equal(has('air-greenland'), true);
});

test('airline v2 glance: hidden when no tile has an official value', () => {
  assert.equal(glanceHasValues(loadModules({ slug: 'test-airline', official_website: 'https://example.com', modules: [] })), false);
  assert.equal(glanceHasValues(loadModules(null)), false);
});

test('airline v2 glance: pending or disputed fields alone never show the grid', () => {
  const facts = {
    modules: [
      {
        id: 'carryon',
        required: ['carryon_bag_dimensions'],
        fields: {
          carryon_bag_dimensions: { value: null, status: 'pending' },
          carryon_weight: { value: null, status: 'disputed' },
        },
      },
    ],
  } as unknown as AirlineFactsFile;
  assert.equal(glanceHasValues(loadModules(facts)), false);

  const verified = {
    modules: [
      {
        id: 'carryon',
        required: ['carryon_bag_dimensions'],
        fields: {
          carryon_bag_dimensions: {
            value: '56 x 36 x 23 cm',
            status: 'official',
            source_url: 'https://example.com/',
            verified_at: '2026-09-01',
          },
        },
      },
    ],
  } as unknown as AirlineFactsFile;
  assert.equal(glanceHasValues(loadModules(verified)), true);
});
