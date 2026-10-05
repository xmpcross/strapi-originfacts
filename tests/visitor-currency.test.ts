import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/visitor-currency/route';

// The route must never look anything up: fail the test on any outbound fetch.
function withNoFetch(run: () => Promise<void>) {
  return async () => {
    const real = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      throw new Error('unexpected outbound fetch');
    }) as typeof fetch;
    try {
      await run();
      assert.equal(calls, 0, 'visitor-currency made an outbound request');
    } finally {
      globalThis.fetch = real;
    }
  };
}

const IP_HEADERS = { 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '203.0.113.9' };

test(
  'visitor-currency: uses CF-IPCountry when Cloudflare sent it',
  withNoFetch(async () => {
    for (const [cc, cur] of [['AU', 'AUD'], ['gb', 'GBP'], ['DE', 'EUR'], ['TH', 'USD']]) {
      const res = await GET(new Request('http://x/api/visitor-currency', { headers: { ...IP_HEADERS, 'cf-ipcountry': cc } }));
      assert.deepEqual(await res.json(), { country: cc.toUpperCase(), currency: cur });
    }
  }),
);

test(
  'visitor-currency: without a usable CF-IPCountry it answers null and does not look the IP up',
  withNoFetch(async () => {
    for (const headers of [IP_HEADERS, { ...IP_HEADERS, 'cf-ipcountry': 'XX' }, { ...IP_HEADERS, 'cf-ipcountry': 'T1' }, {}]) {
      const res = await GET(new Request('http://x/api/visitor-currency', { headers }));
      assert.deepEqual(await res.json(), { country: null, currency: null });
    }
  }),
);
