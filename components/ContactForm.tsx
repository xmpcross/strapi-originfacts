'use client';

import { Suspense, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { SUBJECTS, subjectFromParam, type Subject } from '@/lib/contact';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/*
 * The request is unchanged from the original form: same fields, same JSON
 * payload, same endpoint (/api/contact), same honeypot. Validation here mirrors
 * the route's own required-field and email checks so readers see problems
 * before sending; the route still validates everything server-side.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // same pattern as app/api/contact/route.ts
const MESSAGE_MAX = 5000;

type FieldName = 'name' | 'email' | 'subject' | 'message';
type Errors = Partial<Record<FieldName, string>>;

const FIELD_ORDER: FieldName[] = ['name', 'email', 'subject', 'message'];
const FIELD_ID: Record<FieldName, string> = {
  name: 'contact-name',
  email: 'contact-email',
  subject: 'contact-subject',
  message: 'contact-message',
};
const FIELD_LABEL: Record<FieldName, string> = {
  name: 'Name',
  email: 'Email',
  subject: 'Subject',
  message: 'Message',
};

function validate(v: Record<FieldName, string>): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = 'Enter your name.';
  if (!v.email.trim()) e.email = 'Enter your email address.';
  else if (!EMAIL_RE.test(v.email.trim())) e.email = 'Enter a valid email address, like name@example.com.';
  if (!v.subject.trim()) e.subject = 'Choose a subject.';
  if (!v.message.trim()) e.message = 'Write your message.';
  return e;
}

// Applied on top of the shadcn Input/Textarea/SelectTrigger defaults (cn() lets
// these win), so the fields keep the site's size and colours.
const inputBase =
  'block h-auto w-full rounded-[0.3rem] border bg-white px-4 py-3 text-base text-forest-950 shadow-none placeholder:text-forest-900/40 transition focus:outline-none focus-visible:ring-2 focus:ring-2 md:text-base';
const inputOk = 'border-forest-900/20 focus:border-primary-emphasis focus:ring-primary-emphasis/25';
const inputBad = 'border-danger-emphasis focus:border-danger-emphasis focus:ring-danger-emphasis/25';

type Status = { type: 'idle' } | { type: 'sending' } | { type: 'ok' } | { type: 'error'; msg: string };

export default function ContactForm() {
  const [status, setStatus] = useState<Status>({ type: 'idle' });
  const [subject, setSubject] = useState<string>('');
  const [presetFrom, setPresetFrom] = useState<Subject | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [invalidSubmits, setInvalidSubmits] = useState(0);
  const [messageLength, setMessageLength] = useState(0);

  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const focusAfterReset = useRef(false);
  const summaryId = useId();

  const errorCount = FIELD_ORDER.filter((f) => errors[f]).length;

  // Each blocked submit moves focus to the error summary, so keyboard and
  // screen-reader users land on the list of problems.
  useEffect(() => {
    if (invalidSubmits > 0) summaryRef.current?.focus();
  }, [invalidSubmits]);

  useEffect(() => {
    if (status.type === 'ok') successRef.current?.focus();
    if (status.type === 'error') failureRef.current?.focus();
    if (status.type === 'idle' && focusAfterReset.current) {
      focusAfterReset.current = false;
      document.getElementById(FIELD_ID.name)?.focus();
    }
  }, [status]);

  function currentValues(): Record<FieldName, string> {
    const fd = new FormData(formRef.current ?? undefined);
    return {
      name: String(fd.get('name') ?? ''),
      email: String(fd.get('email') ?? ''),
      subject: String(fd.get('subject') ?? ''),
      message: String(fd.get('message') ?? ''),
    };
  }

  // After the first attempt, keep each field's message in step with what is typed.
  function revalidate() {
    if (attempted) setErrors(validate(currentValues()));
  }

  function applyPreset(s: Subject) {
    setSubject(s);
    setPresetFrom(s);
    setErrors((prev) => ({ ...prev, subject: undefined }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.type === 'sending') return;
    // Capture form ref synchronously — React nullifies e.currentTarget once
    // the handler returns / hits the first await.
    const form = e.currentTarget;

    const found = validate(currentValues());
    setAttempted(true);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      if (status.type === 'error') setStatus({ type: 'idle' });
      setInvalidSubmits((n) => n + 1);
      return;
    }

    setStatus({ type: 'sending' });

    const fd = new FormData(form);
    const payload = {
      name: String(fd.get('name') ?? ''),
      email: String(fd.get('email') ?? ''),
      subject: String(fd.get('subject') ?? ''),
      pageUrl: String(fd.get('pageUrl') ?? ''),
      message: String(fd.get('message') ?? ''),
      website: String(fd.get('website') ?? ''), // honeypot
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setStatus({ type: 'error', msg: data.error ?? 'Could not send the message. Please try again later.' });
        return;
      }
      setStatus({ type: 'ok' });
      form.reset();
      setSubject('');
      setPresetFrom(null);
      setMessageLength(0);
      setAttempted(false);
      setErrors({});
    } catch {
      setStatus({ type: 'error', msg: 'Network error. Please try again.' });
    }
  }

  const sending = status.type === 'sending';

  return (
    <div className="min-w-0">
      <Suspense fallback={null}>
        <SubjectFromQuery onSubject={applyPreset} />
      </Suspense>

      {status.type === 'ok' ? (
        <div className="rounded-[0.3rem] border border-forest-900/15 bg-paper p-6 sm:p-10" data-testid="contact-form-success">
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full bg-success-emphasis text-xl font-bold text-white"
          >
            ✓
          </span>
          <h3
            ref={successRef}
            tabIndex={-1}
            className="mt-5 text-2xl font-bold leading-tight text-forest-950 focus:outline-none sm:text-3xl"
          >
            Thanks — message sent.
          </h3>
          <p className="mt-3 text-base leading-relaxed text-forest-900/80">
            We&apos;ve received your note. Any reply will go to the email address you gave us. You can also reach us at{' '}
            <a
              href="mailto:contact@originfacts.com"
              className="font-semibold text-primary-emphasis underline-offset-2 hover:underline"
            >
              contact@originfacts.com
            </a>
            .
          </p>
          <Button
            type="button"
            onClick={() => {
              focusAfterReset.current = true;
              setStatus({ type: 'idle' });
            }}
            className="mt-8 h-12 rounded-full bg-forest-950 px-7 text-sm font-bold text-white shadow-none hover:bg-forest-800 focus-visible:ring-4 focus-visible:ring-primary-emphasis/40"
          >
            Send another message
          </Button>
        </div>
      ) : (
        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="rounded-[0.3rem] border border-forest-900/15 bg-paper p-5 sm:p-8"
          data-testid="contact-form"
          aria-labelledby="contact-form-heading"
          aria-describedby="contact-form-note"
          noValidate
        >
          <p
            id="contact-form-note"
            className="flex gap-3 rounded-[0.3rem] bg-sand-100 p-4 text-sm leading-relaxed text-forest-900/80"
          >
            <span aria-hidden className="font-bold text-terracotta-600">
              !
            </span>
            <span>
              Please don&apos;t send sensitive information — passport numbers, payment details and the like — through this
              form. All fields are required unless marked optional.
            </span>
          </p>

          {errorCount > 0 && (
            <div
              ref={summaryRef}
              tabIndex={-1}
              role="alert"
              aria-labelledby={summaryId}
              className="mt-6 rounded-[0.3rem] border-l-4 border-danger-emphasis bg-danger-emphasis/5 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-emphasis/40"
              data-testid="contact-form-errors"
            >
              <p id={summaryId} className="text-sm font-bold text-danger-emphasis">
                {errorCount === 1 ? 'There is 1 problem with your message' : `There are ${errorCount} problems with your message`}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {FIELD_ORDER.filter((f) => errors[f]).map((f) => (
                  <li key={f}>
                    <a
                      href={`#${FIELD_ID[f]}`}
                      onClick={(ev) => {
                        ev.preventDefault();
                        document.getElementById(FIELD_ID[f])?.focus();
                      }}
                      className="font-semibold text-danger-emphasis underline underline-offset-2"
                    >
                      {FIELD_LABEL[f]}: {errors[f]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field id={FIELD_ID.name} label="Name" error={errors.name}>
              <Input
                id={FIELD_ID.name}
                name="name"
                type="text"
                autoComplete="name"
                required
                maxLength={200}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? `${FIELD_ID.name}-error` : undefined}
                onChange={revalidate}
                className={`${inputBase} ${errors.name ? inputBad : inputOk}`}
              />
            </Field>

            <Field id={FIELD_ID.email} label="Email" hint="Replies go to this address." error={errors.email}>
              <Input
                id={FIELD_ID.email}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                maxLength={200}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={describedBy(FIELD_ID.email, true, !!errors.email)}
                onChange={revalidate}
                className={`${inputBase} ${errors.email ? inputBad : inputOk}`}
              />
            </Field>

            <Field
              id={FIELD_ID.subject}
              label="Subject"
              hint={
                presetFrom && subject === presetFrom
                  ? `Set to “${presetFrom}” from the link you followed — change it if it doesn’t fit.`
                  : 'Pick the closest match so your message reaches the right reviewer.'
              }
              error={errors.subject}
              className="sm:col-span-2"
            >
              <Select
                name="subject"
                required
                value={subject}
                onValueChange={(value) => {
                  setSubject(value);
                  if (attempted) setErrors((prev) => ({ ...prev, subject: value ? undefined : 'Choose a subject.' }));
                }}
              >
                <SelectTrigger
                  id={FIELD_ID.subject}
                  aria-invalid={errors.subject ? true : undefined}
                  aria-describedby={describedBy(FIELD_ID.subject, true, !!errors.subject)}
                  className={`${inputBase} ${errors.subject ? inputBad : inputOk} flex items-center justify-between data-[placeholder]:text-forest-900/40`}
                  data-testid="contact-subject"
                >
                  <SelectValue placeholder="Select a topic…" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s} className="py-2 text-base">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              id="contact-url"
              label="Page URL"
              optional
              hint="If your message is about a specific page, paste its address."
              className="sm:col-span-2"
            >
              <Input
                id="contact-url"
                name="pageUrl"
                type="url"
                inputMode="url"
                maxLength={500}
                placeholder="https://www.originfacts.com/…"
                aria-describedby="contact-url-hint"
                className={`${inputBase} ${inputOk}`}
              />
            </Field>

            <Field
              id={FIELD_ID.message}
              label="Message"
              hint="For a correction, quote the exact text that looks wrong and link a source we can verify."
              error={errors.message}
              className="sm:col-span-2"
              aside={
                <span
                  className={`text-xs tabular-nums ${
                    messageLength > MESSAGE_MAX * 0.9 ? 'font-bold text-terracotta-600' : 'text-forest-900/55'
                  }`}
                  aria-live={messageLength > MESSAGE_MAX * 0.9 ? 'polite' : 'off'}
                >
                  {messageLength.toLocaleString('en-GB')} / {MESSAGE_MAX.toLocaleString('en-GB')}
                </span>
              }
            >
              <Textarea
                id={FIELD_ID.message}
                name="message"
                rows={7}
                required
                maxLength={MESSAGE_MAX}
                aria-invalid={errors.message ? true : undefined}
                aria-describedby={describedBy(FIELD_ID.message, true, !!errors.message)}
                onChange={(ev) => {
                  setMessageLength(ev.target.value.length);
                  revalidate();
                }}
                className={`${inputBase} ${errors.message ? inputBad : inputOk} resize-y`}
              />
            </Field>

            {/* Honeypot: invisible to humans, bots usually fill all fields */}
            <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
              Website
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          {status.type === 'error' && (
            <div
              ref={failureRef}
              tabIndex={-1}
              role="alert"
              className="mt-6 rounded-[0.3rem] border-l-4 border-danger-emphasis bg-danger-emphasis/5 p-4 text-sm leading-relaxed text-forest-900 focus:outline-none"
              data-testid="contact-form-failure"
            >
              <p className="font-bold text-danger-emphasis">Your message wasn&apos;t sent.</p>
              <p className="mt-1">{status.msg}</p>
              <p className="mt-1 text-forest-900/75">
                What you typed is still in the form. You can also email{' '}
                <a
                  href="mailto:contact@originfacts.com"
                  className="font-semibold text-primary-emphasis underline-offset-2 hover:underline"
                >
                  contact@originfacts.com
                </a>
                .
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-4 border-t border-forest-900/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-forest-900/65">
              By submitting, you agree to our{' '}
              <a href="/legal/privacy" className="font-semibold underline underline-offset-2 hover:text-forest-950">
                Privacy Policy
              </a>
              .
            </p>
            <Button
              type="submit"
              disabled={sending}
              className="h-12 shrink-0 rounded-full bg-forest-950 px-8 text-sm font-bold text-white shadow-none hover:bg-forest-800 focus-visible:ring-4 focus-visible:ring-primary-emphasis/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? 'Sending…' : 'Send message'}
              {!sending && <span aria-hidden>→</span>}
            </Button>
          </div>
          <p className="sr-only" aria-live="polite">
            {sending ? 'Sending your message…' : ''}
          </p>
        </form>
      )}
    </div>
  );
}

function describedBy(id: string, hasHint: boolean, hasError: boolean): string | undefined {
  const ids = [hasHint ? `${id}-hint` : '', hasError ? `${id}-error` : ''].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

/** Reads ?subject= (e.g. /contact?subject=privacy) and preselects the matching subject. */
function SubjectFromQuery({ onSubject }: { onSubject: (s: Subject) => void }) {
  const params = useSearchParams();
  const raw = params.get('subject');
  const onSubjectRef = useRef(onSubject);
  useEffect(() => {
    onSubjectRef.current = onSubject;
  });
  useEffect(() => {
    const s = subjectFromParam(raw);
    if (s) onSubjectRef.current(s);
  }, [raw]);
  return null;
}

function Field({
  id,
  label,
  hint,
  error,
  optional = false,
  className,
  aside,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className ?? ''}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="text-sm font-bold leading-normal text-forest-950">
          {label}
          {optional && <span className="ml-1.5 font-normal text-forest-900/60">(optional)</span>}
        </Label>
        {aside}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mb-2 text-xs leading-relaxed text-forest-900/65">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex gap-1.5 text-sm font-semibold text-danger-emphasis">
          <span aria-hidden>✕</span>
          {error}
        </p>
      )}
    </div>
  );
}
