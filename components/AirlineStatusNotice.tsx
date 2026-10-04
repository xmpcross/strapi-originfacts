import { AIRLINE_STATUS_SOURCE, ceasedOnPhrase, type CeasedAirline } from '@/lib/airline-status';

/**
 * Banner for carriers that have stopped flying. Rendered above every airline
 * layout so nobody reads a historical carrier as bookable; the booking widget
 * is removed separately by the page.
 *
 * Every figure here is sourced: the date is Wikidata's P576 value and the
 * link goes to the item it came from.
 */
export default function AirlineStatusNotice({ name, ceased }: { name: string; ceased: CeasedAirline }) {
  const when = ceasedOnPhrase(ceased.ceasedOn);
  return (
    <div className="mx-auto mt-6 max-w-7xl px-6" data-testid="airline-status-notice">
      <div
        role="note"
        className="flex flex-col gap-2 border-l-4 border-amber-500 bg-amber-50 px-5 py-4 text-sm leading-6 text-forest-900 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
      >
        <p>
          <strong className="font-urbanist text-base font-bold">{name} has ceased operations</strong>
          <span className="block text-forest-900/80">
            Wikidata records this carrier as dissolved {when}. This page is kept as a historical reference
            — the airline does not currently sell tickets, and the codes, contacts and policies below describe
            it as it operated.
          </span>
        </p>
        <a
          href={ceased.wikidata}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-none self-start font-mono text-[11px] uppercase tracking-wider text-forest-900/60 underline-offset-2 hover:underline"
        >
          Source · Wikidata{AIRLINE_STATUS_SOURCE.retrieved() ? ` · retrieved ${AIRLINE_STATUS_SOURCE.retrieved()}` : ''}
        </a>
      </div>
    </div>
  );
}
