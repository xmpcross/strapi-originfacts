'use client';

import { useEffect, useRef } from 'react';

const CAR_WIDGET_URL =
  'https://tpscr.com/content?trs=401311&shmarker=314807&locale=en&country=23&city=23571&powered_by=false&campaign_id=87&promo_id=2466';

export default function TravelpayoutsCarSearch() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.replaceChildren();
    const script = document.createElement('script');
    script.src = CAR_WIDGET_URL;
    script.async = true;
    script.charset = 'utf-8';
    script.dataset.originfactsWidget = 'travelpayouts-cars';
    host.appendChild(script);

    return () => {
      host.replaceChildren();
    };
  }, []);

  return (
    <section data-testid="travelpayouts-car-search" className="rounded-[18px] border border-[#b8c9e2] bg-white p-4 shadow-[0_12px_28px_rgba(11,42,91,0.12)] sm:p-6">
      <div ref={hostRef} className="min-h-[110px] w-full" />
      <p className="mt-3 text-xs text-forest-900/55">
        Car rental results are provided by Travelpayouts and open with the selected rental partner.
      </p>
    </section>
  );
}
