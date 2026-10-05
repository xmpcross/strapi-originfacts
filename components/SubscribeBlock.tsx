'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function SubscribeBlock() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setStatus('submitting');
    setMessage('');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(data.get('email') ?? ''),
          website: String(data.get('website') ?? ''),
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      // Success only on a 2xx that says ok — anything else is shown as an error.
      if (res.ok && json?.ok) {
        setStatus('success');
        setMessage('Thanks, you’re signed up.');
        form.reset();
      } else {
        setStatus('error');
        setMessage(json?.error || 'Something went wrong. Please try again later.');
      }
    } catch {
      setStatus('error');
      setMessage('Could not reach the server. Please check your connection and try again.');
    }
  }

  const submitting = status === 'submitting';

  return (
    <section className="py-14" data-testid="home-subscribe">
      <div className="mx-auto max-w-7xl px-6">
        <div
          className="fn__subscribe_block relative z-0 flex flex-col items-stretch gap-[50px] overflow-hidden rounded-[5px] bg-[#f5f5f5] px-10 py-14 shadow-[0_1px_3px_rgba(0,0,0,0.15)] sm:flex-row sm:items-center"
        >
          {/* Decorative paperplane — pale gray, behind content */}
          <span
            aria-hidden
            className="sb_icon pointer-events-none absolute -right-[10px] -top-[10px] -z-10 block text-[#e5e5e5]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-60 w-60"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </span>

          <div className="sb_left relative z-10 max-w-[500px] flex-1">
            <h3
              className="!font-bold !text-[#080808]"
              style={{ fontSize: '30px', lineHeight: 1.2, fontWeight: 700 }}
            >
              Stay Informed With the Latest &amp; Most Important News
            </h3>
          </div>

          <div className="sb_right relative z-10 max-w-[500px] flex-1">
            <form onSubmit={onSubmit} data-testid="home-subscribe-form">
              <div className="subscribe_holder flex items-center justify-between gap-[10px] border-b border-black">
                <Label htmlFor="home-subscribe-email" className="sr-only">
                  Email address
                </Label>
                <Input
                  id="home-subscribe-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Your email address"
                  required
                  maxLength={254}
                  disabled={submitting}
                  className="h-11 min-w-0 flex-auto rounded-none border-0 bg-transparent p-0 text-sm text-[#080808] shadow-none placeholder:text-[#333] focus-visible:ring-0 md:text-sm"
                />
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-[30px] rounded-[15px] bg-[#080808] px-[18px] pt-[2px] text-sm font-bold uppercase tracking-wider text-white shadow-none hover:bg-primary-emphasis"
                >
                  {submitting ? 'Sending…' : 'Subscribe'}
                </Button>
              </div>
              <p
                className="agree mt-3 block text-[#080808]"
                style={{ fontSize: '14px', lineHeight: '17px' }}
              >
                We&rsquo;ll email you occasional travel updates. Unsubscribe any time. See our{' '}
                <a
                  href="/legal/privacy"
                  className="font-medium text-[#080808] no-underline"
                  style={{ borderBottom: '1px solid #777' }}
                >
                  Privacy Policy
                </a>
                .
              </p>
              {/* Honeypot — hidden from people, filled in by bots. */}
              <label style={{ display: 'none' }} aria-hidden>
                Leave this field empty if you&rsquo;re human:{' '}
                <input type="text" name="website" defaultValue="" tabIndex={-1} autoComplete="off" />
              </label>
              <p
                role={status === 'error' ? 'alert' : 'status'}
                aria-live="polite"
                data-testid="home-subscribe-message"
                data-status={status}
                className={`mt-3 text-sm font-medium ${status === 'error' ? 'text-red-700' : 'text-[#080808]'}`}
              >
                {message}
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
