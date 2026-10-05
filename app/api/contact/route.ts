import { NextResponse } from 'next/server';
import {
  CONTACT_FROM as FROM,
  CONTACT_TO as TO,
  createRateLimiter,
  createSmtpTransporter,
  EMAIL_RE,
  escapeHtml,
  ipFromRequest,
} from '@/lib/mailer';

export const runtime = 'nodejs';

// Naive in-memory per-IP rate limit: max 5 submissions per 15 minutes.
const rateLimited = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

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
  if (!EMAIL_RE.test(email)) {
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
