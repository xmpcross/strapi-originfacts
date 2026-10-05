import nodemailer from 'nodemailer';

/**
 * Shared form-mail plumbing for the /api/contact and /api/subscribe routes.
 *
 * Form mail goes through the Google Workspace SMTP relay, which accepts this
 * host's IPs without a login and only sends From a Workspace domain. The local
 * Stalwart server this used to default to was removed on 4 Oct 2026.
 */

export const CONTACT_FROM =
  process.env.CONTACT_FROM_EMAIL ?? 'Originfacts Contact <contact@originfacts.com>';
export const CONTACT_TO = process.env.CONTACT_TO_EMAIL ?? 'contact@originfacts.com';

/** The subset of a nodemailer transport the form routes use (lets tests inject a fake). */
export type MailTransport = {
  sendMail(options: {
    from: string;
    to: string;
    replyTo?: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ messageId?: string }>;
};

export function createSmtpTransporter(): MailTransport {
  const host = process.env.SMTP_HOST || 'smtp-relay.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure, // never send form contents in clear text on 587
    // Without this nodemailer EHLOs with the OS host name and Google's relay
    // closes the connection with 421 4.7.0.
    name: 'www.originfacts.com',
    ...(user && pass ? { auth: { user, pass } } : {}),
  });
}

/** Naive in-memory per-key sliding-window limiter. Returns true when `key` is over the limit. */
export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();
  return function rateLimited(key: string): boolean {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      hits.set(key, arr);
      return true;
    }
    arr.push(now);
    hits.set(key, arr);
    return false;
  };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function ipFromRequest(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
