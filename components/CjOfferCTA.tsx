import { cjLink, CJ_ADVERTISERS, type CjAdvertiserKey } from '@/lib/cj';

/**
 * Sponsored affiliate CTA for a CJ advertiser, styled like the site's other
 * sponsored blocks. Renders a compliant rel="sponsored noopener" link.
 */
export default function CjOfferCTA({
  advertiser,
  title,
  subtitle,
  cta = 'View deals',
  destination,
}: {
  advertiser: CjAdvertiserKey;
  title: string;
  subtitle?: string;
  cta?: string;
  /** Deep-link destination (Booking.com only); ignored for non-deep-link advertisers. */
  destination?: string;
}) {
  const href = cjLink(advertiser, destination);
  const name = CJ_ADVERTISERS[advertiser].name;

  return (
    <aside
      className="my-10 overflow-hidden rounded-[0.4rem] border border-primary-emphasis/15 bg-gradient-to-br from-primary-emphasis/5 to-primary-pressed/10 p-6 shadow-sm"
      data-testid={`cj-cta-${advertiser}`}
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary-emphasis">
            Sponsored · {name}
          </p>
          <p className="mt-1.5 text-lg font-bold text-forest-950">{title}</p>
          {subtitle && <p className="mt-1 text-sm text-forest-900/65">{subtitle}</p>}
        </div>
        <a
          href={href}
          target="_blank"
          rel="sponsored noopener"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary-emphasis px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-pressed"
        >
          {cta}
          <span aria-hidden>→</span>
        </a>
      </div>
    </aside>
  );
}
