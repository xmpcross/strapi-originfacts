/**
 * Contact-form subjects, shared by the form (components/ContactForm.tsx) and
 * the /contact page's "Who should you contact?" cards.
 *
 * SUBJECTS are the exact strings the form posts to /api/contact and that land
 * in the email subject line — do not rename them. SUBJECT_PARAMS maps short
 * `?subject=` values (used by links into the form) onto those strings.
 */
export const SUBJECTS = [
  'General support',
  'Website issue',
  'Affiliate enquiry',
  'Privacy request',
  'Cookie request',
  'Accessibility feedback',
  'User content complaint',
  'Legal notice',
  'Other',
] as const;

export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_PARAMS: Record<string, Subject> = {
  support: 'General support',
  website: 'Website issue',
  correction: 'Website issue',
  error: 'Website issue',
  affiliate: 'Affiliate enquiry',
  partnership: 'Affiliate enquiry',
  advertising: 'Affiliate enquiry',
  privacy: 'Privacy request',
  cookies: 'Cookie request',
  accessibility: 'Accessibility feedback',
  complaint: 'User content complaint',
  legal: 'Legal notice',
  other: 'Other',
};

/** Resolves a `?subject=` value (a short key or an exact subject) to a subject, or null. */
export function subjectFromParam(param: string | null | undefined): Subject | null {
  if (!param) return null;
  const key = param.trim().toLowerCase();
  if (key in SUBJECT_PARAMS) return SUBJECT_PARAMS[key]!;
  return SUBJECTS.find((s) => s.toLowerCase() === key) ?? null;
}

/** Link into the form on /contact with a subject preselected. */
export function contactHref(param: keyof typeof SUBJECT_PARAMS): string {
  return `/contact?subject=${param}#contact-form`;
}
