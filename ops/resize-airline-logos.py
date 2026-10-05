#!/usr/bin/env python3
"""Trim padding from airline logos and scale them to fit inside 200x100, keeping proportions.

The artwork fills the file edge to edge (no padding, no stretching): one side is
200 or 100px, the other is smaller. Files are uploaded as `<slug>-logo-trim.png`
and Strapi stores them as `<slug>_logo_trim_<hash>.png`; lib/strapi.ts
isTrimmedLogo() keys off that name.

Dry run by default: downloads, writes previews + report.json under --out, touches nothing in the CMS.
  python3 ops/resize-airline-logos.py --out scratch/logos
Apply (needs STRAPI_WRITE_TOKEN in .env.local); old logo ids go to <out>/rollback.json:
  python3 ops/resize-airline-logos.py --apply --only singapore-airlines
  python3 ops/resize-airline-logos.py --apply            # every airline
"""
import argparse, io, json, os, sys, urllib.parse, urllib.request, uuid
from PIL import Image

BASE = 'https://cms.fxnstudio.com'
W, H = 200, 100

def token():
    for line in open('.env.local'):
        if line.startswith('STRAPI_WRITE_TOKEN='):
            return line.split('=', 1)[1].strip().strip('"\'')
    sys.exit('STRAPI_WRITE_TOKEN not found in .env.local')

def call(method, path, body=None, headers=None):
    h = {'Authorization': 'Bearer ' + token(), **(headers or {})}
    req = urllib.request.Request(BASE + path, data=body, method=method, headers=h)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())

def upload(slug, name, png):
    b = uuid.uuid4().hex
    info = json.dumps({'name': f'{slug}-logo-trim.png', 'alternativeText': f'{name} logo'})
    parts = []
    for k, v in (('fileInfo', info),):
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f'--{b}\r\nContent-Disposition: form-data; name="files"; filename="{slug}-logo-trim.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + png + b'\r\n')
    parts.append(f'--{b}--\r\n'.encode())
    return call('POST', '/api/upload', b''.join(parts), {'Content-Type': f'multipart/form-data; boundary={b}'})[0]

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'originfacts-logo-tool'}), timeout=60) as r:
        return r.read()

def airlines():
    page = 1
    while True:
        q = f'{BASE}/api/airlines?populate=logo&fields[0]=name&fields[1]=slug&fields[2]=iataCode&pagination[page]={page}&pagination[pageSize]=100'
        d = json.loads(get(q))
        yield from d['data']
        if page >= d['meta']['pagination']['pageCount']:
            return
        page += 1

def trim(im):
    im = im.convert('RGBA')
    bbox = im.getchannel('A').getbbox()
    if not bbox:
        return None
    # transparent canvas is the common case; if fully opaque, trim near-white borders instead
    if bbox == (0, 0, *im.size):
        px = Image.new('RGB', im.size, (255, 255, 255))
        from PIL import ImageChops
        diff = ImageChops.difference(im.convert('RGB'), px).convert('L').point(lambda v: 255 if v > 12 else 0)
        bbox = diff.getbbox() or bbox
    return im.crop(bbox)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='scratch/logos')
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--src', default='', help='source image URL override (use with a single --only slug)')
    ap.add_argument('--only', default='', help='comma-separated slugs')
    a = ap.parse_args()
    os.makedirs(a.out + '/new', exist_ok=True)
    rows = []
    only = {x for x in a.only.split(',') if x}
    rollback_path = a.out + '/rollback.json'
    rollback = json.load(open(rollback_path)) if os.path.exists(rollback_path) else {}
    for al in airlines():
        if only and al['slug'] not in only:
            continue
        logo = al.get('logo')
        row = {'slug': al['slug'], 'name': al['name'], 'iata': al.get('iataCode'), 'documentId': al['documentId']}
        if not logo:
            row['status'] = 'no-logo'; rows.append(row); continue
        row['logoId'] = logo['id']; row['url'] = logo['url']
        if '_logo_trim_' in logo['url'] and not a.src:
            row['status'] = 'already-done'; rows.append(row); continue
        try:
            src = a.src or logo['url']
            raw = get(src if src.startswith('http') else BASE + src)
            im = Image.open(io.BytesIO(raw))
        except Exception as e:
            row['status'] = f'unreadable: {e}'; rows.append(row); continue
        if (im.format or '').upper() == 'SVG' or logo.get('ext') == '.svg':
            row['status'] = 'svg-skip'; rows.append(row); continue
        c = trim(im)
        if c is None:
            row['status'] = 'blank'; rows.append(row); continue
        ar = c.width / c.height
        scale = min(W / c.width, H / c.height)
        size = (max(1, round(c.width * scale)), max(1, round(c.height * scale)))
        row.update(status='ok', src=list(im.size), trimmed=list(c.size), out=list(size))
        out = c.resize(size, Image.LANCZOS)
        path = f"{a.out}/new/{al['slug']}.png"
        out.save(path, optimize=True)
        if a.apply:
            up = upload(al['slug'], al['name'], open(path, 'rb').read())
            rollback[al['documentId']] = {'slug': al['slug'], 'oldLogoId': logo['id'], 'oldUrl': logo['url'], 'newLogoId': up['id'], 'newUrl': up['url']}
            call('PUT', f"/api/airlines/{al['documentId']}", json.dumps({'data': {'logo': up['id']}}).encode(), {'Content-Type': 'application/json'})
            json.dump(rollback, open(rollback_path, 'w'), indent=1)
            row['status'] = 'applied'; row['newUrl'] = up['url']
        rows.append(row)
    json.dump(rows, open(a.out + '/report.json', 'w'), indent=1)
    from collections import Counter
    print(len(rows), 'airlines;', Counter(r['status'].split(':')[0] for r in rows))
    for r in rows:
        if r['status'] == 'applied':
            print(r['slug'], r['trimmed'], '->', r['out'], r['newUrl'])

main()
