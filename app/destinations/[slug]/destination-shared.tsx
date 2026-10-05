// Helpers shared by the destination templates in page.tsx and city-guide-page.tsx.
import Link from 'next/link';
import type { listRoutesToDestination, StrapiDestination } from '@/lib/strapi';
import { getYourGuideLink } from '@/lib/partner-links';
import GygConsentNotice from '@/components/GygConsentNotice';

const GYG_EXCLUDED_TOUR_IDS_BY_DESTINATION: Record<string, string> = {
  bangkok: '1457595',
};

export function countryNameFromCode(code?: string) {
  if (!code || code.length !== 2) return '';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || '';
  } catch {
    return '';
  }
}

export function unique(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

export function formatList(items: string[]) {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function buildActivityWidgetQuery(
  destination: Pick<StrapiDestination, 'name' | 'countryCode'>,
  routes: Awaited<ReturnType<typeof listRoutesToDestination>>,
) {
  const country = routes.find((route) => route.destination?.country)?.destination?.country;
  const countryHint = country || countryNameFromCode(destination.countryCode) || destination.countryCode;
  return [destination.name, countryHint].filter(Boolean).join(', ');
}

export type AboutSection = { heading: string | null; paragraphs: string[] };

export function parseAboutSections(md: string): AboutSection[] {
  const sections: AboutSection[] = [];
  let current: AboutSection = { heading: null, paragraphs: [] };
  for (const block of md.split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const headingMatch = trimmed.match(/^##\s+(.+)$/m);
    if (headingMatch && trimmed.startsWith('##')) {
      if (current.heading || current.paragraphs.length) sections.push(current);
      current = { heading: headingMatch[1].trim(), paragraphs: [] };
      const remainder = trimmed.replace(/^##\s+.+\n?/, '').trim();
      if (remainder) current.paragraphs.push(remainder);
    } else {
      current.paragraphs.push(trimmed);
    }
  }
  if (current.heading || current.paragraphs.length) sections.push(current);
  return sections;
}

export function RouteCard({ r }: { r: Awaited<ReturnType<typeof listRoutesToDestination>>[number] }) {
  return (
    <Link
      href={`/flight-routes/${r.slug}`}
      className="group flex items-center justify-between rounded-lg border border-forest-900/10 bg-paper p-5 transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm"
      data-testid={`destination-route-${r.slug}`}
    >
      <div>
        <div className="text-xs font-bold tracking-wider text-forest-900/70">
          {r.origin?.iata} → {r.destination?.iata}
        </div>
        <div className="mt-2 text-base font-bold text-forest-900 group-hover:text-forest-700">
          From {r.origin?.city || r.origin?.name}
        </div>
        <div className="mt-1 text-xs text-forest-900/60">{r.origin?.country}</div>
      </div>
      {r.distanceKm && (
        <div className="text-right text-xs text-forest-900/50">
          <div className="font-bold text-forest-900/70">
            {r.distanceKm.toLocaleString()} km
          </div>
          {r.durationMinutes && (
            <div className="mt-1">{formatDuration(r.durationMinutes)}</div>
          )}
        </div>
      )}
    </Link>
  );
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function GetYourGuideActivityWidget({
  destination,
  query,
}: {
  destination: StrapiDestination;
  query: string;
}) {
  const campaign = `originfacts-destination-${destination.slug}`.slice(0, 80);
  const excludedTourIds = GYG_EXCLUDED_TOUR_IDS_BY_DESTINATION[destination.slug];

  return (
    <section
      className="my-12 overflow-hidden rounded-2xl border border-forest-900/10 bg-gradient-to-br from-white via-sand-50 to-sky-50 p-6 shadow-sm sm:p-8"
      data-nosnippet
      data-testid="destination-activity-widget"
    >
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-forest-700/70">
            Sponsored activities
          </div>
          <h2 className="editorial-h mt-3 text-3xl font-bold text-forest-900">
            What are the top things to do in {destination.name}?
          </h2>
          <p className="mt-4 text-base leading-7 text-forest-900/70">
            Compare tours, tickets, day trips and local experiences related to {destination.name}.
            The activity feed is supplied by GetYourGuide and updates based on live availability.
          </p>
          <p className="mt-3 text-sm leading-6 text-forest-900/55">
            Origin Facts may earn a commission when you book through this widget, at no extra cost to you.
          </p>
        </div>

        <div className="min-h-[360px] rounded-xl border border-white/70 bg-white/80 p-4 shadow-inner">
          <GygConsentNotice />
          <div
            data-gyg-href="https://widget.getyourguide.com/default/activities.frame"
            data-gyg-locale-code="en-US"
            data-gyg-locale-currency="USD"
            data-gyg-widget="activities"
            data-gyg-number-of-items="3"
            data-gyg-partner-id="H8Y3KHZ"
            data-gyg-campaign={campaign}
            data-gyg-cmp={campaign}
            data-gyg-q={query}
            data-gyg-excluded-tour-ids={excludedTourIds}
          >
            <span className="text-sm text-forest-900/55">
              Powered by{' '}
              <a
                target="_blank"
                rel="sponsored nofollow noopener noreferrer"
                href={getYourGuideLink(query)}
                className="font-medium text-forest-800 underline underline-offset-4"
              >
                GetYourGuide
              </a>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
