import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSubscribeHandler } from '../lib/subscribe';
import { createSmtpTransporter, type MailTransport } from '../lib/mailer';

type Sent = Parameters<MailTransport['sendMail']>[0];

function fakeTransport(fail = false) {
  const sent: Sent[] = [];
  const transport = {
    sendMail: async (opts: Sent) => {
      if (fail) throw new Error('421 4.7.0 simulated relay failure');
      sent.push(opts);
      return { messageId: '<test@local>' };
    },
  } as unknown as MailTransport;
  return { sent, transport };
}

function handler(t: MailTransport, rateLimited = () => false) {
  return createSubscribeHandler({
    getTransport: () => t,
    rateLimited,
    from: 'Originfacts <contact@originfacts.com>',
    to: 'inbox@originfacts.com',
  });
}

function req(body: unknown, raw?: string) {
  return new Request('http://127.0.0.1/api/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    body: raw ?? JSON.stringify(body),
  });
}

test('valid email → 200, one notification to the site inbox', async () => {
  const { sent, transport } = fakeTransport();
  const res = await handler(transport)(req({ email: '  traveller@example.com ', website: '' }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.from, 'Originfacts <contact@originfacts.com>');
  assert.equal(sent[0]!.to, 'inbox@originfacts.com');
  assert.equal(sent[0]!.replyTo, 'traveller@example.com');
  assert.equal(sent[0]!.subject, 'New newsletter signup: traveller@example.com');
  assert.match(String(sent[0]!.text), /203\.0\.113\.9/);
});

test('invalid or missing email → 400, nothing sent', async () => {
  const { sent, transport } = fakeTransport();
  const h = handler(transport);
  for (const body of [{ email: 'not-an-email' }, {}, { email: 'a b@c.com' }, { email: `${'x'.repeat(250)}@a.com` }]) {
    const res = await h(req(body));
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal((await res.json()).ok, false);
  }
  assert.equal((await h(req(null, 'not json'))).status, 400);
  assert.equal(sent.length, 0);
});

test('honeypot filled → 200 but nothing sent', async () => {
  const { sent, transport } = fakeTransport();
  const res = await handler(transport)(req({ email: 'bot@example.com', website: 'http://spam' }));
  assert.equal(res.status, 200);
  assert.equal(sent.length, 0);
});

test('transport failure → 502 with an error message', async () => {
  const { transport } = fakeTransport(true);
  const orig = console.error;
  console.error = () => {};
  try {
    const res = await handler(transport)(req({ email: 'traveller@example.com' }));
    assert.equal(res.status, 502);
    const json = await res.json();
    assert.equal(json.ok, false);
    assert.ok(json.error);
  } finally {
    console.error = orig;
  }
});

test('rate limited → 429, nothing sent', async () => {
  const { sent, transport } = fakeTransport();
  const res = await handler(transport, () => true)(req({ email: 'traveller@example.com' }));
  assert.equal(res.status, 429);
  assert.equal(sent.length, 0);
});

test('default limiter allows 5 per IP then 429s', async () => {
  const { sent, transport } = fakeTransport();
  const h = createSubscribeHandler({ getTransport: () => transport, from: 'f@originfacts.com', to: 't@originfacts.com' });
  const codes: number[] = [];
  for (let i = 0; i < 6; i++) codes.push((await h(req({ email: `t${i}@example.com` }))).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429]);
  assert.equal(sent.length, 5);
});

test('real SMTP transport sets the EHLO name the Google relay requires', () => {
  // Builds the transport only; nothing is sent.
  const t = createSmtpTransporter() as unknown as { options: { name?: string; requireTLS?: boolean } };
  assert.equal(t.options.name, 'www.originfacts.com');
});
