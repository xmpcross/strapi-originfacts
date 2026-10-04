import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMetaDescription,
  stripMarkdown,
  clampDescription,
  programmaticTitle,
  DESCRIPTION_MAX,
  TITLE_MAX,
} from '../lib/seo';

test('programmaticTitle: normal case keeps the keyword tail', () => {
  assert.equal(programmaticTitle('Qantas (QF)', 'Routes, Hubs & Fleet'), 'Qantas (QF) — Routes, Hubs & Fleet');
});

test('programmaticTitle: long names drop the tail whole, name never truncated', () => {
  const long = 'Saint Helena, Ascension and Tristan da Cunha Travel Guide';
  const out = programmaticTitle(long, 'Flights, Airports & Airlines');
  assert.equal(out, long);
  assert.ok(out.length <= Math.max(TITLE_MAX, long.length));
});

test('programmaticTitle: boundary exactly at TITLE_MAX keeps the tail', () => {
  const base = 'x'.repeat(TITLE_MAX - ' — tail'.length);
  assert.equal(programmaticTitle(base, 'tail'), `${base} — tail`);
});

test('markdown-heavy input is stripped before slicing', () => {
  const md = [
    '## Overview',
    '',
    '**Sydney Airport** (SYD) is _the_ main gateway, see [the guide](https://example.com/guide).',
    '',
    '- busiest airport in Australia',
    '- three terminals',
    '',
    '```js',
    'const code = true;',
    '```',
    '',
    '> A quoted line here.',
  ].join('\n');
  const out = buildMetaDescription([md]);
  assert.equal(
    out,
    'Sydney Airport (SYD) is the main gateway, see the guide. busiest airport in Australia three terminals A quoted line here.',
  );
  assert.ok(!/[#*_`>\[\]]/.test(out), `markdown chars leaked: "${out}"`);
});

test('the "## Overview" defect: heading lines are dropped whole', () => {
  const out = buildMetaDescription(['## Overview\n\nSydney Airport is the primary gateway to Australia.']);
  assert.equal(out, 'Sydney Airport is the primary gateway to Australia.');
});

test('input shorter than the limit is returned whole, no ellipsis', () => {
  const short = 'Qantas is the flag carrier of Australia.';
  assert.equal(buildMetaDescription([short]), short);
});

test('boundary landing mid-word backs off to the previous word, single ellipsis', () => {
  // Construct input where char 155 falls inside "Australia's".
  const base =
    'Qantas traces its history to 1920, when Queensland and Northern Territory Aerial Services was founded in outback Queensland. Today it is Australia';
  const input = `${base}'s flag carrier and largest airline by fleet size.`;
  const out = buildMetaDescription([input]);
  assert.ok(out.length <= DESCRIPTION_MAX, `len ${out.length}`);
  assert.ok(out.endsWith('…'), out);
  assert.ok(!out.includes('……'), out);
  // The visible text before the ellipsis must be a full word from the input.
  const visible = out.slice(0, -1);
  assert.ok(input.replace(/\s+/g, ' ').includes(visible), `mid-word cut: "${visible}"`);
  assert.ok(!visible.endsWith("Australia's f"), 'reproduced the mid-word defect');
});

test('input that is entirely markdown syntax yields empty string', () => {
  assert.equal(buildMetaDescription(['## \n\n---\n\n**__** \n\n> ']), '');
  assert.equal(stripMarkdown('```\ncode only\n```'), '');
});

test('summary field is preferred over body text', () => {
  const out = buildMetaDescription(['A purpose-written summary.', '## Body\n\nDerived body text.']);
  assert.equal(out, 'A purpose-written summary.');
});

test('falls through empty and markup-only sources to the first real one', () => {
  const out = buildMetaDescription([undefined, '', '## \n', 'Derived body text wins here.']);
  assert.equal(out, 'Derived body text wins here.');
});

test('whitespace is collapsed', () => {
  assert.equal(buildMetaDescription(['Too   many\n\n\nspaces\there.']), 'Too many spaces here.');
});

test('clampDescription appends ellipsis only when text was removed', () => {
  assert.ok(!clampDescription('Short and sweet.').endsWith('…'));
  const long = 'word '.repeat(60).trim();
  const clamped = clampDescription(long);
  assert.ok(clamped.endsWith('…'));
  assert.ok(clamped.length <= DESCRIPTION_MAX);
});
