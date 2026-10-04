#!/usr/bin/env python3
"""Import written city guides from the content-tracker CSV.

    python3 ops/import-city-guides-csv.py /root/originfacts-city-guides-updated-v3.csv
    python3 ops/import-city-guides-csv.py <csv> --dry-run      # report only

Each row becomes data/destination-guides/<slug>.json, and lib/destination-guides.ts
is regenerated to load every guide file, which switches those cities to the
city guide layout.

Two kinds of sentence are dropped on the way in:

- Sentences shared across cities. A sentence whose six-word sequences mostly
  recur in REPEAT_MIN_CITIES or more other rows is template text, not writing
  about the city; the v3 tracker had about twelve of them in all 52 rows.
- Prices and visa rules, which the guides do not state (they change faster
  than the pages are reviewed).

An FAQ that asks about visas, or whose answer ends up empty, is dropped.
Rows listed in SKIP_SLUGS (live guides maintained by hand) and destinations
the site no longer serves are not touched.
"""
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'destination-guides'
LOADER = ROOT / 'lib' / 'destination-guides.ts'

SKIP_SLUGS = {'perth', 'bangkok', 'athens'}
REMOVED_SLUGS = {'patagonia', 'provence', 'tuscany', 'yucatan-peninsula'}  # see lib/strapi.ts
REPEAT_MIN_CITIES = 5
REPEAT_SHARE = 0.5

COL = {
    'intro': 'Intro (45-70 words)',
    'stay': 'Where to stay (120-170 words)',
    'todo': 'Things to do (130-180 words)',
    'around': 'Getting around (110-160 words)',
    'when': 'When to visit (100-150 words)',
    'tips': 'Practical tips (4-6, one per line)',
    'tldr': 'Summary box (40-60 words)',
    'keyfacts': 'Key facts (4-6, "Label: value" per line)',
    'sources': 'Sources (one URL per line)',
}
PROSE = ['intro', 'stay', 'todo', 'around', 'when', 'tldr']

PRICE = re.compile(
    r'[$€£¥฿₩₹]\s?\d'
    r'|\b\d[\d,.]*\s?(?:USD|AUD|EUR|GBP|THB|JPY|CNY|RMB|SEK|CZK|HKD|SGD|baht|yen|yuan|dollars|euros|pounds|kronor|rupees?|dong|rupiah)\b',
    re.I,
)
VISA = re.compile(r'\bvisas?\b', re.I)


def sentences(text):
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text.strip()) if s.strip()]


def grams(sentence, city):
    words = re.findall(r"[a-z0-9']+", sentence.lower().replace(city.lower(), 'xx'))
    return {tuple(words[i:i + 6]) for i in range(len(words) - 5)}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    if not args:
        sys.exit(__doc__)
    rows = [r for r in csv.DictReader(open(args[0], encoding='utf-8-sig'))
            if r['Slug'] not in SKIP_SLUGS | REMOVED_SLUGS]

    def units(r):
        """Every sentence or line of text the row would publish."""
        for k in PROSE:
            for para in (r[COL[k]] or '').split('\n'):
                yield from sentences(para)
        yield from (l.strip() for l in (r[COL['tips']] or '').split('\n') if l.strip())
        for i in range(1, 7):
            yield from sentences(r.get(f'FAQ {i} answer (30-60 words)') or '')

    # In how many cities does each six-word sequence occur?
    gram_cities = defaultdict(set)
    for r in rows:
        for u in units(r):
            for g in grams(u, r['City']):
                gram_cities[g].add(r['Slug'])

    report = defaultdict(lambda: defaultdict(int))

    def keep(u, r):
        if PRICE.search(u):
            report[r['Slug']]['price'] += 1
            return False
        if VISA.search(u):
            report[r['Slug']]['visa'] += 1
            return False
        g = grams(u, r['City'])
        if g:
            shared = sum(1 for x in g if len(gram_cities[x] - {r['Slug']}) >= REPEAT_MIN_CITIES)
            if shared / len(g) >= REPEAT_SHARE:
                report[r['Slug']]['repeated'] += 1
                return False
        return True

    def clean_prose(text, r):
        paras = []
        for para in (text or '').split('\n'):
            kept = [s for s in sentences(para) if keep(s, r)]
            if kept:
                paras.append(' '.join(kept))
        return '\n\n'.join(paras)

    slugs = []
    for r in rows:
        city, slug = r['City'], r['Slug']
        s = {k: clean_prose(r[COL[k]], r) for k in PROSE}
        tips = [l.strip().lstrip('-•* ').strip() for l in (r[COL['tips']] or '').split('\n') if l.strip()]
        tips = [t for t in tips if keep(t, r)]
        blocks = [s['intro']] if s['intro'] else []
        for key, heading in [('stay', f'Where to stay in {city}'), ('todo', f'Things to do in {city}'),
                             ('around', f'Getting around {city}'), ('when', f'When to visit {city}')]:
            if s[key]:
                blocks.append(f'## {heading}\n\n{s[key]}')
        if tips:
            blocks.append(f'## Practical tips for {city}\n\n' + '\n'.join(f'- {t}' for t in tips))

        key_facts = []
        for line in (r[COL['keyfacts']] or '').split('\n'):
            if ':' not in line or PRICE.search(line) or VISA.search(line):
                continue
            label, value = line.split(':', 1)
            if label.strip() and value.strip():
                key_facts.append({'label': label.strip(), 'value': value.strip()})

        faqs = []
        for i in range(1, 7):
            q = (r.get(f'FAQ {i} question') or '').strip()
            a = clean_prose(r.get(f'FAQ {i} answer (30-60 words)') or '', r)
            if not q or not a:
                continue
            if VISA.search(q):
                report[slug]['visa faq'] += 1
                continue
            faqs.append({'q': q, 'a': a})

        guide = {
            'slug': slug,
            'source': 'content tracker CSV (v3), imported by ops/import-city-guides-csv.py',
            'description': '\n\n'.join(blocks),
            'tldr': s['tldr'],
            'keyFacts': key_facts,
            'faqs': faqs,
            'sources': [{'url': u.strip(), 'title': u.strip()} for u in (r[COL['sources']] or '').split('\n') if u.strip()],
        }
        words = sum(len(s[k].split()) for k in ['intro', 'stay', 'todo', 'around', 'when'])
        report[slug]['guide words'] = words
        report[slug]['faqs'] = len(faqs)
        slugs.append(slug)
        if not dry:
            (OUT / f'{slug}.json').write_text(json.dumps(guide, indent=2, ensure_ascii=False) + '\n')

    if not dry:
        write_loader()

    totals = defaultdict(int)
    for slug in slugs:
        for k in ('repeated', 'price', 'visa', 'visa faq'):
            totals[k] += report[slug][k]
    words = sorted(report[s]['guide words'] for s in slugs)
    print(f'{len(slugs)} guides{" (dry run)" if dry else ""}; dropped: '
          + ', '.join(f'{v} {k}' for k, v in totals.items()))
    print(f'guide words per city: median {words[len(words) // 2]}, min {words[0]}, max {words[-1]}')


def write_loader():
    """Regenerate the import block in lib/destination-guides.ts from the files on disk."""
    files = sorted(p.stem for p in OUT.glob('*.json'))
    ident = lambda s: re.sub(r'[^a-zA-Z0-9]+(.)', lambda m: m.group(1).upper(), s)
    src = LOADER.read_text()
    imports = '\n'.join(f"import {ident(s)} from '@/data/destination-guides/{s}.json';" for s in files)
    src = re.sub(r"(import type \{ StrapiDestination \} from '@/lib/strapi';\n)(?:import \w+ from '@/data/destination-guides/[^']+';\n)+",
                 lambda m: m.group(1) + imports + '\n', src)
    entries = ', '.join(f"'{s}': {ident(s)}" if ident(s) != s else s for s in files)
    src = re.sub(r'const GUIDES: Record<string, DestinationGuide> = \{[^}]*\};',
                 f'const GUIDES: Record<string, DestinationGuide> = {{ {entries} }};', src)
    LOADER.write_text(src)


if __name__ == '__main__':
    main()
