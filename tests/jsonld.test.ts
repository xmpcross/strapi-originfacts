import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  airportJsonLd,
  airlineJsonLd,
  countryJsonLd,
  destinationJsonLd,
  faqJsonLd,
} from '../lib/entity-seo';
import { breadcrumbJsonLd, organizationJsonLd } from '../lib/jsonld';

const serialisable = (o: unknown) => JSON.parse(JSON.stringify(o));

test('Organization carries name, url, logo and all four social profiles', () => {
  const org = serialisable(organizationJsonLd()) as Record<string, unknown>;
  assert.equal(org['@type'], 'Organization');
  for (const f of ['name', 'url', 'logo']) assert.ok(org[f], `missing ${f}`);
  const sameAs = org.sameAs as string[];
  for (const host of ['x.com/realoriginfacts', 'facebook.com/originfacts', 'linkedin.com/company/143027896', 'reddit.com/r/Originfacts']) {
    assert.ok(sameAs.some((u) => u.includes(host)), `sameAs missing ${host}`);
  }
});

test('Airport schema: required fields present, extras only when provided', () => {
  const a = { id: 1, iata: 'SYD', icao: 'YSSY', name: 'Sydney Airport', city: 'Sydney', country: 'Australia', latitude: -33.9, longitude: 151.2 } as never;
  const ld = serialisable(airportJsonLd(a, 'https://www.originfacts.com/airports/syd', { phone: '+61 2 9667 9111', website: 'https://www.sydneyairport.com.au' })) as Record<string, unknown>;
  assert.equal(ld['@type'], 'Airport');
  assert.equal(ld.iataCode, 'SYD');
  assert.ok(ld.geo && ld.address && ld.telephone && ld.sameAs);
  const bare = serialisable(airportJsonLd({ id: 2, iata: 'XYZ', name: 'X' } as never, 'https://x/airports/xyz')) as Record<string, unknown>;
  assert.ok(!('telephone' in bare) && !('sameAs' in bare) && !('geo' in bare), 'empty fields must be omitted, not emitted blank');
});

test('destination Place schema maps types and never emits empty fields', () => {
  assert.equal(serialisable(destinationJsonLd({ name: 'Japan', type: 'country' }, 'https://x/destinations/japan'))['@type'], 'Country');
  assert.equal(serialisable(destinationJsonLd({ name: 'Asia', type: 'continent' }, 'https://x/destinations/asia'))['@type'], 'Continent');
  const city = serialisable(destinationJsonLd({ name: 'Tokyo', type: 'city', countryCode: 'JP' }, 'https://x/destinations/tokyo')) as Record<string, unknown>;
  assert.equal(city['@type'], 'City');
  assert.ok(city.containedInPlace);
  const unknown = serialisable(destinationJsonLd({ name: 'Somewhere' }, 'https://x/destinations/somewhere')) as Record<string, unknown>;
  assert.equal(unknown['@type'], 'Place');
  assert.ok(!('containedInPlace' in unknown));
});

test('FAQPage markup is exactly the visible Q&A list — no additions', () => {
  const faqs = [
    { q: 'Where is Sydney Airport?', a: 'In Sydney.' },
    { q: 'What is the airport code?', a: 'SYD.' },
  ];
  const ld = serialisable(faqJsonLd(faqs)) as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
  assert.equal(ld.mainEntity.length, faqs.length);
  faqs.forEach((f, i) => {
    assert.equal(ld.mainEntity[i].name, f.q);
    assert.equal(ld.mainEntity[i].acceptedAnswer.text, f.a);
  });
  assert.equal(faqJsonLd([]), null); // empty list → no FAQPage at all
});

test('BreadcrumbList items carry position, name and absolute item URL', () => {
  const ld = serialisable(breadcrumbJsonLd([
    { name: 'Airports', url: '/airports' },
    { name: 'Sydney Airport', url: '/airports/syd' },
  ])) as { itemListElement: { position: number; name: string; item: string }[] };
  // The builder prepends Home, so two inputs yield a three-item trail.
  assert.equal(ld.itemListElement.length, 3);
  assert.equal(ld.itemListElement[0].name, 'Home');
  assert.equal(ld.itemListElement[0].position, 1);
  assert.ok(ld.itemListElement.every((i) => i.item.startsWith('https://')));
});

test('every builder output survives JSON round-trip (parseable when embedded)', () => {
  const outputs = [
    organizationJsonLd(),
    airportJsonLd({ id: 1, iata: 'SYD', name: 'Sydney Airport' } as never, 'https://x/a'),
    airlineJsonLd({ id: 1, name: 'Qantas', slug: 'qantas' } as never, 'https://x/b'),
    countryJsonLd({ code: 'AU', name: 'Australia' } as never, 'https://x/c'),
    destinationJsonLd({ name: 'Japan', type: 'country' }, 'https://x/d'),
  ];
  for (const o of outputs) {
    const parsed = JSON.parse(JSON.stringify(o)) as Record<string, unknown>;
    assert.ok(parsed['@context'] && parsed['@type'] && parsed.name, JSON.stringify(parsed).slice(0, 80));
  }
});
