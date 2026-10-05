import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TPWL_CURRENCY_BOOT_JS, tpwlCookieDomain, tpwlCurrencyCode, withTpwlCurrency } from '../lib/tpwl-currency';

test('maps the four header currencies to the widget codes', () => {
  assert.equal(tpwlCurrencyCode('AUD'), 'AUD');
  assert.equal(tpwlCurrencyCode('eur'), 'EUR');
  assert.equal(tpwlCurrencyCode('GBP'), 'GBP');
  assert.equal(tpwlCurrencyCode('XYZ'), 'USD');
});

test('cookie domain matches the one the widget writes', () => {
  assert.equal(tpwlCookieDomain('www.originfacts.com'), '.originfacts.com');
  assert.equal(tpwlCookieDomain('flights.originfacts.com'), '.originfacts.com');
  assert.equal(tpwlCookieDomain('127.0.0.1'), null);
  assert.equal(tpwlCookieDomain('localhost'), null);
});

test('partner links carry the currency, other links are untouched', () => {
  assert.equal(
    withTpwlCurrency('https://flights.originfacts.com/?flightSearch=SYD1511LON22111&marker=314807', 'EUR'),
    'https://flights.originfacts.com/?flightSearch=SYD1511LON22111&marker=314807&currency=EUR',
  );
  assert.equal(withTpwlCurrency('/flight-search?flightSearch=X', 'EUR'), '/flight-search?flightSearch=X');
});

function runBoot(cookie: string, hostname: string): string[] {
  const writes: string[] = [];
  const document = {
    get cookie() {
      return cookie;
    },
    set cookie(v: string) {
      writes.push(v);
    },
  };
  new Function('document', 'location', TPWL_CURRENCY_BOOT_JS)(document, { hostname });
  return writes;
}

test('boot script copies of_currency into tpwl_currency', () => {
  assert.deepEqual(runBoot('a=1; of_currency=GBP', 'www.originfacts.com'), [
    'tpwl_currency=GBP; path=/; max-age=31536000; samesite=lax; domain=.originfacts.com',
  ]);
  assert.deepEqual(runBoot('of_currency=AUD', '127.0.0.1'), ['tpwl_currency=AUD; path=/; max-age=31536000; samesite=lax']);
  assert.deepEqual(runBoot('of_currency=JPY', 'www.originfacts.com'), []);
  assert.deepEqual(runBoot('', 'www.originfacts.com'), []);
});
