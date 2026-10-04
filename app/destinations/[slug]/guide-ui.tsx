// The guide-style building blocks shared by the city and country templates:
// hero, jump nav, and the written guide as one card of numbered sections.
import { Fragment } from 'react';
import Link from 'next/link';
import { renderBulletContent } from '@/components/CountryAbout';
import type { AboutSection } from './destination-shared';

export type HeroCrumb = { label: string; href?: string };
export type HeroAction = { label: string; href: string; primary?: boolean };

/** Hero shared by the city, country and continent templates. */
export function DestinationHero({
  hero,
  title,
  lead,
  crumbs,
  actions = [],
}: {
  hero: string | null;
  title: string;
  lead?: string;
  crumbs: HeroCrumb[];
  actions?: HeroAction[];
}) {
  return (
    <section className="relative overflow-hidden bg-forest-950">
      {hero && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hero} alt={title} className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/55 to-forest-950/10" />
      <div className="relative mx-auto flex min-h-[460px] max-w-7xl flex-col justify-end px-6 pb-12 pt-24 text-white sm:min-h-[520px]">
        <nav aria-label="Breadcrumb" className="text-xs font-semibold text-white/75">
          {crumbs.map((crumb, i) => (
            <Fragment key={crumb.label}>
              {i > 0 && <span className="mx-2 text-white/40">/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-white hover:underline">{crumb.label}</Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
        <h1 className="editorial-h mt-4 text-4xl font-bold leading-tight !text-[#ffffff] sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {lead && <p className="mt-5 max-w-3xl text-lg leading-8 text-white/90">{lead}</p>}
        {actions.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-3">
            {actions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={
                  action.primary
                    ? 'rounded-full bg-white px-5 py-2.5 text-sm font-bold text-forest-950 transition hover:bg-sand-100'
                    : 'rounded-full border border-white/40 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10'
                }
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Jump links under the hero. Callers pass only sections that render. */
export function SectionNav({ label, sections }: { label: string; sections: { id: string; label: string }[] }) {
  if (sections.length < 2) return null;
  return (
    <nav aria-label={label} className="border-b border-forest-900/10 bg-paper" data-testid="destination-section-nav">
      <div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-6 text-sm font-semibold text-forest-900/70">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="shrink-0 border-b-2 border-transparent py-4 hover:border-primary-emphasis hover:text-forest-950">
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export const sectionAnchor = (heading: string) =>
  heading.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export type GuideKind =
  | 'stay' | 'todo' | 'around' | 'when' | 'tips'
  | 'overview' | 'visa' | 'facts' | 'resources' | 'other';

// First match wins, so the longer country prefixes sit before generic ones.
const GUIDE_KINDS: { prefix: string; kind: GuideKind; label: string }[] = [
  { prefix: 'Where to stay', kind: 'stay', label: 'Where to stay' },
  { prefix: 'Things to do', kind: 'todo', label: 'Things to do' },
  { prefix: 'Famous Attractions', kind: 'todo', label: 'Attractions' },
  { prefix: 'Highlights', kind: 'todo', label: 'Highlights' },
  { prefix: 'Getting around', kind: 'around', label: 'Getting around' },
  { prefix: 'When to visit', kind: 'when', label: 'When to visit' },
  { prefix: 'Weather', kind: 'when', label: 'Weather' },
  { prefix: 'Practical tips', kind: 'tips', label: 'Tips' },
  { prefix: 'Practical', kind: 'tips', label: 'Practical' },
  { prefix: 'Overview', kind: 'overview', label: 'Overview' },
  { prefix: 'Visa', kind: 'visa', label: 'Visa' },
  { prefix: 'Interesting Facts', kind: 'facts', label: 'Facts' },
  { prefix: 'Official Resources', kind: 'resources', label: 'Resources' },
];

function guideKind(heading: string) {
  return GUIDE_KINDS.find((k) => heading.startsWith(k.prefix)) ?? { kind: 'other' as const, label: heading };
}

// Heroicons outline paths (MIT), drawn at 24×24.
const GUIDE_ICON_PATHS: Record<GuideKind, string[]> = {
  stay: ['M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25'],
  todo: ['M15 10.5a3 3 0 11-6 0 3 3 0 016 0z', 'M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z'],
  around: ['M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5'],
  when: ['M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z'],
  tips: ['M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18'],
  overview: ['M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418'],
  visa: ['M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z'],
  facts: ['M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z'],
  resources: ['M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244'],
  other: ['M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25'],
};

export function GuideIcon({ kind, className }: { kind: GuideKind; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {GUIDE_ICON_PATHS[kind].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const isBulletList = (paragraph: string) => {
  const lines = paragraph.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length > 1 && lines.every((l) => /^[-*]\s+/.test(l));
};

/** One guide section's body: prose paragraphs, or a bullet list as tip cards. */
export function GuideBody({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="space-y-5">
      {paragraphs.map((p) =>
        isBulletList(p) ? (
          <ul key={p} className="grid gap-3 sm:grid-cols-2">
            {p.split('\n').map((l) => l.trim().replace(/^[-*]\s+/, '')).filter(Boolean).map((tip) => (
              <li key={tip} className="flex gap-3 rounded-xl border border-forest-900/10 bg-forest-50/60 p-4 text-[15px] leading-6 text-forest-900/80">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary-emphasis">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>{renderBulletContent(tip)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={p} className="leading-8 text-forest-900/80">{p}</p>
        ),
      )}
    </div>
  );
}

/** A destination's written guide: its `## ` sections, one row each, with jump chips. */
export function GuideSections({ name, sections }: { name: string; sections: AboutSection[] }) {
  if (sections.length === 0) return null;
  return (
    <section id="guide" className="mx-auto max-w-7xl scroll-mt-28 px-6 pt-14" data-testid="destination-guide">
      <div className="overflow-hidden rounded-2xl border border-forest-900/10 bg-white">
        <header className="flex flex-col gap-5 border-b border-forest-900/10 bg-gradient-to-br from-forest-50 via-white to-sand-50 px-6 py-7 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-emphasis">Travel guide</div>
            <div className="editorial-h mt-2 text-2xl font-bold text-forest-950 sm:text-3xl">The {name} guide</div>
          </div>
          <nav aria-label="In this guide" className="flex flex-wrap gap-2">
            {sections.map((section) => {
              const { kind, label } = guideKind(section.heading ?? '');
              return (
                <a
                  key={section.heading}
                  href={`#${sectionAnchor(section.heading ?? '')}`}
                  className="inline-flex items-center gap-2 rounded-full border border-forest-900/15 bg-white px-3.5 py-2 text-sm font-semibold text-forest-900/80 transition hover:border-primary-emphasis hover:text-primary-emphasis"
                >
                  <GuideIcon kind={kind} className="h-4 w-4" />
                  {label}
                </a>
              );
            })}
          </nav>
        </header>

        <div className="divide-y divide-forest-900/10">
          {sections.map((section, i) => {
            const { kind } = guideKind(section.heading ?? '');
            return (
              <article
                key={section.heading}
                id={sectionAnchor(section.heading ?? '')}
                className="grid scroll-mt-28 gap-5 px-6 py-9 sm:px-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12 lg:py-12"
              >
                <div className="lg:sticky lg:top-28 lg:self-start">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-hover text-primary-emphasis">
                      <GuideIcon kind={kind} className="h-6 w-6" />
                    </span>
                    <span className="text-sm font-bold tabular-nums text-forest-900/35">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <h2 className="editorial-h mt-4 text-2xl font-bold leading-tight text-forest-950">{section.heading}</h2>
                </div>
                <GuideBody paragraphs={section.paragraphs} />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
