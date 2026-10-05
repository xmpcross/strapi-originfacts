import { NextResponse } from 'next/server';
import {
  CONTACT_FROM,
  CONTACT_TO,
  createRateLimiter,
  createSmtpTransporter,
  EMAIL_RE,
  escapeHtml,
  ipFromRequest,
  type MailTransport,
} from '@/lib/mailer';

/**
 * Newsletter signup handler behind POST /api/subscribe.
 *
 * No newsletter provider (Mailchimp etc.) is configured for this site, so a
 * signup is delivered to the site inbox (CONTACT_TO_EMAIL) as a notification
 * email through the same SMTP relay as the contact form. Nothing is stored here.
 *
 * Body: JSON { email: string, website?: string } — `website` is the honeypot.
 * Responses: { ok: true } (200) or { ok: false, error } (400 / 429 / 502).
 */

type Deps = {
  getTransport?: () => MailTransport;
  rateLimited?: (key: string) => boolean;
  from?: string;
  to?: string;
};

export function createSubscribeHandler(deps: Deps = {}) {
  const getTransport = deps.getTransport ?? createSmtpTransporter;
  // 5 signups per IP per 15 minutes, same as the contact form.
  const rateLimited = deps.rateLimited ?? createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
  const from = deps.from ?? CONTACT_FROM;
  const to = deps.to ?? CONTACT_TO;

  return async function POST(req: Request): Promise<Response> {
    const ip = ipFromRequest(req);
    if (rateLimited(ip)) {
      return NextResponse.json(
        { ok: false, error: 'Too many attempts. Please try again in a few minutes.' },
        { status: 429 },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
      if (!body || typeof body !== 'object') throw new Error('not an object');
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
    }

    // Honeypot: pretend success to bots, send nothing.
    if (typeof body.website === 'string' && body.website.length > 0) {
      return NextResponse.json({ ok: true });
    }

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const when = new Date().toISOString();
    const text = [
      `New newsletter signup: ${email}`,
      '',
      `Signed up: ${when}`,
      `Form: originfacts.com homepage newsletter form`,
      `IP: ${ip}`,
    ].join('\n');
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#07142b;line-height:1.5">
        <h2 style="margin:0 0 16px;font-size:18px;color:#030303">New newsletter signup</h2>
        <p style="margin:0 0 8px"><strong>${escapeHtml(email)}</strong></p>
        <p style="margin:16px 0 0;font-size:12px;color:#07142bb3">Signed up ${escapeHtml(when)} via the originfacts.com homepage newsletter form · IP ${escapeHtml(ip)}</p>
      </div>
    `;

    try {
      await getTransport().sendMail({
        from,
        to,
        replyTo: email,
        subject: `New newsletter signup: ${email}`,
        text,
        html,
      });
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('[subscribe] SMTP send failure', err);
      return NextResponse.json(
        { ok: false, error: 'Could not complete your signup. Please try again later.' },
        { status: 502 },
      );
    }
  };
}
