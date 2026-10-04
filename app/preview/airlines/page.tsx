import type { Metadata } from 'next';
import Link from 'next/link';
import { getAirlineFacts, resolveModule } from '@/lib/airline-facts';
import { PUBLISHED_AIRLINE_GUIDES } from '@/lib/airline-tier';
import { getRouteFacts } from '@/lib/route-facts';
import { listAirlines, mediaUrl, type StrapiAirline } from '@/lib/strapi';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/SeoBlocks';
import s from './page.module.css';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Verified airline guides — preview',
  description: 'Preview the redesigned Origin Facts airline directory and its reviewed traveller guides.',
  robots: { index: false, follow: false },
};

const SECTION_LABELS: Record<string, string> = {
  carryon: 'Cabin bags',
  baggage: 'Checked bags',
  fares: 'Fare rules',
  cabins: 'Cabins',
  rights: 'Passenger rights',
  checkin: 'Check-in',
  contact: 'Contact',
};

type Guide = {
  airline: StrapiAirline;
  sections: string[];
  verifiedFields: number;
  oldestReview: string | null;
  destinations: number;
};

export default async function AirlineDirectoryPreview() {
  const airlines = await listAirlines().catch(() => []);
  const bySlug = new Map(airlines.map((airline) => [airline.slug, airline]));
  const guides = [...PUBLISHED_AIRLINE_GUIDES]
    .map((slug) => buildGuide(bySlug.get(slug)))
    .filter((guide): guide is Guide => guide !== null);

  const countryCount = new Set(guides.map(({ airline }) => airline.country).filter(Boolean)).size;
  const verifiedFieldCount = guides.reduce((total, guide) => total + guide.verifiedFields, 0);

  const breadcrumbs = breadcrumbJsonLd([{ name: 'Airline Fares', url: '/preview/airlines' }]);

  return (
    <main className={s.page} data-testid="airlines-page">
      <JsonLd data={breadcrumbs} />
      <span className="sr-only" data-testid="airline-directory-preview">Preview airline directory</span>
      <section className={s.hero}>
        <div className={s.heroGlow} aria-hidden="true" />
        <div className={s.flightPath} aria-hidden="true">
          <span className={s.routeDot} />
          <PlaneMark />
        </div>

        <div className={s.heroInner}>
          <div className={s.previewFlag}>Preview directory</div>
          <p className={s.eyebrow}>Origin Facts airline guides</p>
          <h1>Know what your fare really includes.</h1>
          <p className={s.heroCopy}>
            Practical airline policies, checked against official sources. Compare baggage,
            check-in, fare rules and contact details before you book or fly.
          </p>

          <div className={s.heroStats} aria-label="Directory coverage">
            <Stat value={guides.length} label="reviewed guides" />
            <Stat value={countryCount} label="home countries" />
            <Stat value={verifiedFieldCount} label="verified facts" />
          </div>
        </div>
      </section>

      <section className={s.directory} aria-labelledby="directory-heading">
        <div className={s.sectionHeading}>
          <div>
            <p className={s.kicker}>Ready to explore</p>
            <h2 id="directory-heading">Published traveller guides</h2>
          </div>
          <p>
            Only airlines that have passed source checks, fact validation and page review
            appear here. More guides will be added as their evidence is completed.
          </p>
        </div>

        <div className={s.guideGrid}>
          {guides.map((guide, index) => (
            <GuideCard key={guide.airline.slug} guide={guide} index={index} />
          ))}
        </div>
      </section>

      <section className={s.trustBand} aria-labelledby="trust-heading">
        <div className={s.trustIcon} aria-hidden="true"><ShieldMark /></div>
        <div>
          <p className={s.kicker}>How this directory is different</p>
          <h2 id="trust-heading">Sources first. Gaps stay visible.</h2>
        </div>
        <p>
          A fetched number does not become a fact automatically. Each published field keeps
          its official source and review date; incomplete or conflicting information stays
          unpublished until it can be resolved.
        </p>
        <Link href="/about" className={s.textLink}>Our editorial approach <span>→</span></Link>
      </section>
    </main>
  );
}

function buildGuide(airline: StrapiAirline | undefined): Guide | null {
  if (!airline) return null;
  const facts = getAirlineFacts(airline.slug);
  if (!facts) return null;

  const published = facts.modules.map(resolveModule).filter((module) => module.isPublished);
  const dates = published
    .map((module) => module.verified_at)
    .filter((date): date is string => Boolean(date))
    .sort();

  return {
    airline,
    sections: published.map((module) => SECTION_LABELS[module.id] ?? module.title),
    verifiedFields: facts.modules.reduce(
      (total, module) => total + Object.values(module.fields ?? {}).filter((field) => field.status === 'official').length,
      0,
    ),
    oldestReview: dates[0] ?? null,
    destinations: getRouteFacts(airline.iataCode)?.destinationCount ?? 0,
  };
}

function GuideCard({ guide, index }: { guide: Guide; index: number }) {
  const { airline } = guide;
  const logo = mediaUrl(airline.logo ?? null);

  return (
    <article className={s.card} data-testid={`preview-airline-card-${airline.slug}`}>
      <div className={s.cardTop}>
        <span className={s.cardNumber}>{String(index + 1).padStart(2, '0')}</span>
        <span className={s.reviewed}><CheckMark /> Reviewed</span>
      </div>

      <div className={s.identity}>
        <div className={s.logoWrap}>
          {logo ? <img src={logo} alt={`${airline.name} logo`} /> : <span>{airline.iataCode ?? airline.name.charAt(0)}</span>}
        </div>
        <div>
          <p>{[airline.country, airline.type].filter(Boolean).join(' · ')}</p>
          <h3>{airline.name}</h3>
        </div>
      </div>

      <div className={s.quickFacts}>
        {airline.iataCode && <span><small>IATA</small>{airline.iataCode}</span>}
        {guide.destinations > 0 && <span><small>Network</small>{guide.destinations} destinations</span>}
        <span><small>Sources</small>{guide.verifiedFields} verified fields</span>
      </div>

      <div className={s.coverage}>
        <p>Guide covers</p>
        <div>
          {guide.sections.map((section) => <span key={section}>{section}</span>)}
        </div>
      </div>

      <div className={s.cardFooter}>
        <span>{guide.oldestReview ? `Sources checked ${formatDate(guide.oldestReview)}` : 'Sources reviewed'}</span>
        <Link href={`/preview/airlines/${airline.slug}`}>
          Open guide <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </article>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function formatDate(value: string): string {
  const date = new Date(`${value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function CheckMark() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.2 2.8 2.7 6.2-6" /></svg>;
}

function PlaneMark() {
  return <svg viewBox="0 0 48 48"><path d="m5 26 16-5 9-15 4 1-3 15 11 4v3l-12 1-7 12-3-1 2-12-17 1z" /></svg>;
}

function ShieldMark() {
  return <svg viewBox="0 0 48 48"><path d="M24 4 40 10v12c0 10-6.7 18.4-16 22-9.3-3.6-16-12-16-22V10z"/><path d="m16 24 5 5 11-12" /></svg>;
}
