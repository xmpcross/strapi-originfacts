import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getAirportGuide } from '../lib/airport-guide';

// content/airport-guides/<iata>.json replaces the "not yet verified" placeholder on
// that airport's page, so each file has to be complete and fully cited.
const DIR = path.join(process.cwd(), 'content', 'airport-guides');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));

test('airport guides: there are guide files', () => {
  assert.ok(files.length >= 1);
});

for (const file of files) {
  const iata = file.replace('.json', '');
  test(`airport guide ${iata}: complete, cited and loadable`, () => {
    const raw = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
    assert.equal(String(raw.iata).toLowerCase(), iata, 'iata matches the file name');
    assert.match(raw.verified_at, /^\d{4}-\d{2}-\d{2}$/);
    const ids = new Set<string>(raw.sources.map((s: { id: string }) => s.id));
    assert.equal(ids.size, raw.sources.length, 'source ids are unique');
    for (const s of raw.sources) {
      assert.match(s.url, /^https:\/\//, `${s.id}: https url`);
      assert.ok(s.title && s.publisher && s.verified_at, `${s.id}: title, publisher, verified_at`);
      assert.equal(s.quotes, undefined, `${s.id}: research quotes must not be shipped`);
    }
    const cited = new Set<string>();
    for (const sec of raw.sections)
      for (const p of sec.paragraphs) {
        assert.ok(p.sources.length > 0, `${sec.id}: paragraph without a source`);
        for (const id of p.sources) { assert.ok(ids.has(id), `${sec.id}: unknown source ${id}`); cited.add(id); }
      }
    for (const f of raw.faqs) {
      assert.ok(f.sources.length > 0, `faq without a source: ${f.q}`);
      for (const id of f.sources) { assert.ok(ids.has(id), `faq: unknown source ${id}`); cited.add(id); }
    }
    for (const id of ids) assert.ok(cited.has(id), `source ${id} is never cited`);
    assert.ok(raw.sections.length >= 3, 'at least 3 sections');
    const guide = getAirportGuide(iata);
    assert.ok(guide, 'loader accepts the file');
    assert.equal(guide!.sections.length, raw.sections.length, 'loader dropped no section');
    const paragraphs = raw.sections.reduce((n: number, s: { paragraphs: unknown[] }) => n + s.paragraphs.length, 0);
    assert.ok(paragraphs >= 6, 'at least 6 paragraphs');
  });
}
