import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

const FROM = process.env.CONTACT_FROM_EMAIL ?? 'Originfacts Contact <contact@originfacts.com>';
const TO = process.env.CONTACT_TO_EMAIL ?? 'contact@originfacts.com';

// Naive in-memory per-IP rate limit: max 5 submissions per 15 minutes.
const RATE = { windowMs: 15 * 60 * 1000, max: 5 };
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE.windowMs);
  if (arr.length >= RATE.max) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ipFromRequest(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

function createSmtpTransporter() {
  const host = process.env.SMTP_HOST || '127.0.0.1';
  const port = parseInt(process.env.SMTP_PORT || '25', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    name: 'www.originfacts.com',
    ...(user && pass ? { auth: { user, pass } } : {}),
    tls: {
      rejectUnauthorized: false,
      servername: process.env.SMTP_SERVERNAME || 'mail.fxnstudio.com',
    },
  });
}

export async function POST(req: Request) {
  const ip = ipFromRequest(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Too many submissions. Please try again in a few minutes.' },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  // Honeypot — bots typically fill all visible fields.
  if (typeof body.website === 'string' && body.website.length > 0) {
    return NextResponse.json({ ok: true }); // pretend success, drop silently
  }

  const name = (body.name as string | undefined)?.trim() ?? '';
  const email = (body.email as string | undefined)?.trim() ?? '';
  const subject = (body.subject as string | undefined)?.trim() ?? '';
  const pageUrl = (body.pageUrl as string | undefined)?.trim() ?? '';
  const message = (body.message as string | undefined)?.trim() ?? '';

  if (!name || !email || !subject || !message) {
    return NextResponse.json(
      { ok: false, error: 'Name, email, subject, and message are required.' },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 });
  }
  if (name.length > 200 || subject.length > 200 || message.length > 5000 || pageUrl.length > 500) {
    return NextResponse.json({ ok: false, error: 'One or more fields exceed the allowed length.' }, { status: 400 });
  }

  const transporter = createSmtpTransporter();

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#07142b;line-height:1.5">
      <h2 style="margin:0 0 16px;font-size:18px;color:#030303">New contact-form submission</h2>
      <table style="border-collapse:collapse;width:100%;max-width:560px">
        <tr><td style="padding:8px 12px;background:#f0f2f4;font-weight:600;width:120px">From</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</td></tr>
        <tr><td style="padding:8px 12px;background:#f0f2f4;font-weight:600">Subject</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${escapeHtml(subject)}</td></tr>
        ${pageUrl ? `<tr><td style="padding:8px 12px;background:#f0f2f4;font-weight:600">Page URL</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb"><a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a></td></tr>` : ''}
        <tr><td style="padding:8px 12px;background:#f0f2f4;font-weight:600;vertical-align:top">Message</td><td style="padding:8px 12px;white-space:pre-wrap">${escapeHtml(message)}</td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#07142bb3">Sent from originfacts.com contact form · IP ${escapeHtml(ip)}</p>
    </div>
  `;

  const text = [
    `From:    ${name} <${email}>`,
    `Subject: ${subject}`,
    pageUrl ? `Page:    ${pageUrl}` : null,
    '',
    message,
    '',
    `--`,
    `Sent from originfacts.com contact form · IP ${ip}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const info = await transporter.sendMail({
      from: FROM,
      to: TO,
      replyTo: `${name} <${email}>`,
      subject: `[Originfacts contact] ${subject}`,
      html,
      text,
    });
    return NextResponse.json({ ok: true, id: info.messageId });
  } catch (err) {
    console.error('[contact] SMTP send failure', err);
    return NextResponse.json({ ok: false, error: 'Could not send the message. Please try again later.' }, { status: 502 });
  }
}
