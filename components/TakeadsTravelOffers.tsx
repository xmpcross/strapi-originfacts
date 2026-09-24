import { getContextualTakeadsOffers } from '@/lib/takeads';

export default async function TakeadsTravelOffers({
  articleSlug,
  title,
  category,
}: {
  articleSlug: string;
  title: string;
  category?: string;
}) {
  const offers = await getContextualTakeadsOffers({
    articleSlug,
    context: `${title} ${category ?? ''}`,
  });

  if (offers.length === 0) return null;

  return (
    <aside
      className="my-9 rounded-[0.4rem] border border-forest-900/10 bg-sand-100/45 p-5 sm:p-6"
      aria-labelledby="takeads-travel-options"
      data-testid="takeads-travel-offers"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-urbanist text-[10px] font-bold uppercase tracking-[0.2em] text-primary-emphasis">
            Sponsored travel options
          </p>
          <h2 id="takeads-travel-options" className="editorial-h mt-1 text-xl text-forest-950">
            How can you plan the next stage of your trip?
          </h2>
        </div>
        <p className="text-xs text-forest-900/50">We may earn when you visit a partner.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {offers.map((offer) => (
          <a
            key={offer.key}
            href={offer.href}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            className="group flex min-h-32 flex-col rounded-[0.35rem] border border-forest-900/10 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-emphasis/35 hover:shadow-md"
            data-takeads-merchant={offer.key}
          >
            <div className="flex min-h-8 items-center justify-between gap-3">
              <span className="font-urbanist text-xs font-bold uppercase tracking-wider text-forest-900/55">
                {offer.name}
              </span>
              {offer.imageUrl && (
                // The logo URL is supplied by Takeads and can vary by advertiser.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={offer.imageUrl} alt={`${offer.name} logo`} className="max-h-8 max-w-24 object-contain" loading="lazy" />
              )}
            </div>
            <span className="mt-3 font-urbanist text-base font-bold text-forest-950 group-hover:text-primary-emphasis">
              {offer.title}
            </span>
            <span className="mt-1 text-sm leading-5 text-forest-900/65">{offer.description}</span>
            <span className="mt-auto pt-3 font-urbanist text-xs font-bold text-primary-emphasis">
              {offer.cta} <span aria-hidden>→</span>
            </span>
          </a>
        ))}
      </div>
    </aside>
  );
}
