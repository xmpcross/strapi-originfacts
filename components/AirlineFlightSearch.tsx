import CustomFlightSearch from '@/components/CustomFlightSearch';

/**
 * Airline-hero flight search — a fully custom form (no Travelpayouts widget).
 * On submit it deep-links to /flight-search, and results route through
 * Travelpayouts (same fares + commission) with full control over the form.
 *
 * Per-carrier result filtering is DISABLED: the airline code is intentionally
 * not passed to the form, so no ?airline= filter is applied downstream and every
 * airline page shows normal, unfiltered results. (Re-enable by forwarding the
 * airlineIata / airlineName props to <CustomFlightSearch> again.)
 */
export default function AirlineFlightSearch() {
  return (
    <div
      data-testid="airline-flight-search"
      className="rounded-[8px] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]"
    >
      <CustomFlightSearch />
    </div>
  );
}
