import type { Faq, HowToStep } from '@/lib/entity-seo';

/** Renders a schema.org JSON-LD object into a script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Visible numbered steps — the on-page counterpart to HowTo JSON-LD on
 * step-based articles. ids match the schema's step url anchors (#step-N).
 */
export function HowToSteps({
  steps,
  title = 'Step by step',
}: {
  steps: HowToStep[];
  title?: string;
}) {
  if (!steps.length) return null;
  return (
    <section className="mt-12 border-t border-forest-900/10 pt-8" data-testid="howto-steps">
      <h2 className="editorial-h text-2xl font-bold text-forest-900">{title}</h2>
      <ol className="mt-6 space-y-6">
        {steps.map((s, i) => (
          <li key={i} id={`step-${i + 1}`} className="flex gap-4">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-emphasis font-urbanist text-sm font-bold text-white"
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <h3 className="font-urbanist text-lg font-bold leading-snug text-forest-900">{s.name}</h3>
              <p className="mt-1.5 text-[15px] font-light leading-7 text-forest-900/78">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Accessible FAQ block. Real, on-page Q&A content (the visible counterpart to
 * the FAQPage JSON-LD) — adds substantive, unique text to the entity pages.
 */
export function FaqSection({
  faqs,
  title = 'Frequently asked questions',
  eyebrowClassName = 'section-eyebrow',
}: {
  faqs: Faq[];
  title?: string;
  /** Airline pages pass "eyebrow-tag" for the boarding-pass style eyebrow. */
  eyebrowClassName?: string;
}) {
  if (!faqs.length) return null;
  return (
    <section id="faq" className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-6 pb-4" data-testid="faq">
      {/* Title + description — single full-width column */}
      <div>
        <p className={eyebrowClassName}>
          <span className="inline-block h-px w-8 bg-forest-800/60" />
          FAQ
        </p>
        <h2 id="faq-heading" className="editorial-h mt-3 text-2xl font-bold text-2xl">{title}</h2>
        <p className="mt-4 text-sm font-light leading-7 text-forest-900/78">
          Quick answers to the details travellers usually check first, from codes and locations to the practical basics that help with planning.
        </p>
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-forest-900/45">
          {faqs.length} common question{faqs.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Accordions — two columns below the title section */}
      <dl className="mt-8 grid gap-x-10 gap-y-3 lg:grid-cols-2 lg:items-start">
        {faqs.map((f, i) => (
          <details key={i} className="group border-b border-forest-900/10 pb-3">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-3 font-urbanist text-base font-bold leading-snug text-forest-900 marker:content-none">
              <span>{f.q}</span>
              <span className="mt-0.5 text-lg font-light text-forest-900/45 transition group-open:rotate-45">+</span>
            </summary>
            <dd className="pr-8 text-sm font-light leading-7 text-forest-900/78">{f.a}</dd>
          </details>
        ))}
      </dl>
    </section>
  );
}
