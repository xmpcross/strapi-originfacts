'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mediaUrl, type StrapiAirline } from '@/lib/strapi';

export type Tier1GuideSlide = {
  airline: StrapiAirline;
  verifiedFields: number;
  destinations: number;
  homeCountry: string;
};

export default function Tier1AirlineCarousel({ slides }: { slides: Tier1GuideSlide[] }) {
  const [startIndex, setStartIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [activeRegion, setActiveRegion] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'carousel' | 'grid'>('carousel');
  const touchStartX = useRef<number | null>(null);

  // Region filter tabs
  const regionTabs = ['All', 'Oceania', 'Asia', 'Europe', 'North America', 'Middle East'];

  const filteredSlides = useMemo(() => {
    if (activeRegion === 'All') return slides;
    if (activeRegion === 'Middle East') {
      return slides.filter(
        (s) =>
          ['Qatar', 'United Arab Emirates', 'Saudi Arabia', 'Oman', 'Bahrain', 'Kuwait', 'Jordan', 'Israel', 'Turkey', 'Türkiye'].includes(s.homeCountry) ||
          s.airline.region === 'Asia' && ['Qatar', 'UAE', 'Oman'].includes(s.homeCountry),
      );
    }
    return slides.filter((s) => s.airline.region === activeRegion || s.homeCountry.includes(activeRegion));
  }, [slides, activeRegion]);

  const totalSlides = filteredSlides.length;
  const CARDS_PER_PAGE = 4;

  const nextSlide = useCallback(() => {
    if (totalSlides === 0) return;
    setStartIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    if (totalSlides === 0) return;
    setStartIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  // Reset pagination when filter changes
  useEffect(() => {
    setStartIndex(0);
  }, [activeRegion]);

  // Auto slide interval (4.5 seconds)
  useEffect(() => {
    if (isPaused || totalSlides <= 1 || viewMode === 'grid') return;
    const timer = setInterval(() => {
      nextSlide();
    }, 4500);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide, totalSlides, viewMode]);

  if (slides.length === 0) return null;

  // Build visible 4 cards array (wrapping around)
  const visibleCards: Tier1GuideSlide[] = [];
  if (totalSlides > 0) {
    for (let i = 0; i < Math.min(CARDS_PER_PAGE, totalSlides); i++) {
      const idx = (startIndex + i) % totalSlides;
      visibleCards.push(filteredSlides[idx]);
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diffX) > 40) {
      if (diffX > 0) nextSlide();
      else prevSlide();
    }
    touchStartX.current = null;
  };

  return (
    <section
      className="relative mt-10 rounded-2xl border border-forest-900/10 bg-gradient-to-b from-emerald-950/[0.03] via-forest-900/[0.01] to-transparent p-6 sm:p-8 text-forest-900 shadow-sm"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Featured Policy Guides Section"
      data-testid="tier1-airline-carousel"
    >
      {/* Header bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-forest-900/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700/10 px-3 py-1 font-mono text-xs font-semibold text-emerald-800 border border-emerald-700/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              Verified Policy Guides
            </span>
            <span className="text-xs font-medium text-forest-900/50">Top Global Carriers</span>
          </div>
          <h2 className="editorial-h mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-forest-900">
            Which airline policy guides should you read?
          </h2>
          <p className="mt-1 text-sm text-forest-900/70">
            Hand-verified baggage rules, seat specifications, WiFi policies, and carry-on limits for top airlines.
          </p>
        </div>

        {/* Region Tabs & View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-forest-900/5 p-1 border border-forest-900/10">
            {regionTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveRegion(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeRegion === tab
                    ? 'bg-forest-900 text-sand-100 shadow-sm'
                    : 'text-forest-900/70 hover:text-forest-900 hover:bg-forest-900/10'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-forest-900/5 p-1 border border-forest-900/10">
            <button
              onClick={() => setViewMode('carousel')}
              title="Carousel view"
              className={`rounded-lg p-1.5 text-xs font-medium transition ${
                viewMode === 'carousel' ? 'bg-white text-forest-900 shadow-sm' : 'text-forest-900/60 hover:text-forest-900'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 12h8m-8 5h8M4 7h.01M4 12h.01M4 17h.01" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              title="Grid view"
              className={`rounded-lg p-1.5 text-xs font-medium transition ${
                viewMode === 'grid' ? 'bg-white text-forest-900 shadow-sm' : 'text-forest-900/60 hover:text-forest-900'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>

          {/* Carousel controls (shown only in carousel mode) */}
          {viewMode === 'carousel' && totalSlides > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={prevSlide}
                aria-label="Previous slide"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-forest-900/15 bg-white text-forest-900 shadow-sm transition hover:bg-forest-900 hover:text-sand-100 focus:outline-none"
              >
                ←
              </button>
              <span className="font-mono text-xs font-bold text-forest-900/70 px-1">
                {String(startIndex + 1).padStart(2, '0')}/{String(totalSlides).padStart(2, '0')}
              </span>
              <button
                onClick={nextSlide}
                aria-label="Next slide"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-forest-900/15 bg-white text-forest-900 shadow-sm transition hover:bg-forest-900 hover:text-sand-100 focus:outline-none"
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>

      {totalSlides === 0 ? (
        <div className="py-12 text-center text-sm text-forest-900/60">
          No featured policy guides available for this region tab.
        </div>
      ) : viewMode === 'carousel' ? (
        /* Carousel View */
        <>
          <div className="mt-6 grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {visibleCards.map((slide) => (
              <FeaturedGuideCard key={slide.airline.slug} slide={slide} />
            ))}
          </div>

          {/* Pagination Indicators */}
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {filteredSlides.map((slide, idx) => (
              <button
                key={slide.airline.slug}
                onClick={() => setStartIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === startIndex ? 'w-6 bg-forest-900' : 'w-1.5 bg-forest-900/20 hover:bg-forest-900/40'
                }`}
              />
            ))}
          </div>
        </>
      ) : (
        /* Grid View */
        <div className="mt-6 grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSlides.map((slide) => (
            <FeaturedGuideCard key={slide.airline.slug} slide={slide} />
          ))}
        </div>
      )}
    </section>
  );
}

function FeaturedGuideCard({ slide }: { slide: Tier1GuideSlide }) {
  const logo = mediaUrl(slide.airline.logo ?? null);
  return (
    <article
      className="group relative flex flex-col justify-between rounded-xl border border-forest-900/10 bg-white/90 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-forest-900/30 hover:shadow-md"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-16 w-32 flex-none items-center justify-start overflow-hidden bg-transparent">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={slide.airline.name} className="h-full w-full object-contain object-left scale-105" />
            ) : (
              <span className="font-urbanist text-lg font-bold text-forest-900/60">
                {(slide.airline.iataCode || slide.airline.name).slice(0, 3)}
              </span>
            )}
          </div>
          {slide.airline.iataCode && (
            <span className="rounded-md bg-forest-900/90 px-2 py-0.5 font-mono text-[11px] font-bold text-sand-100 shadow-xs">
              {slide.airline.iataCode}
            </span>
          )}
        </div>

        <h3 className="mt-3 font-urbanist text-lg font-bold text-forest-900 group-hover:text-forest-700 line-clamp-1">
          {slide.airline.name}
        </h3>
        <p className="mt-0.5 text-xs text-forest-900/60 truncate">
          {[slide.homeCountry, slide.airline.type || 'Commercial Carrier'].filter(Boolean).join(' · ')}
        </p>

        <div className="mt-4 space-y-1.5 border-t border-forest-900/10 pt-3 text-[11px] font-mono text-forest-900/80">
          <div className="flex items-center justify-between">
            <span className="text-forest-900/60">Verified Policy Facts:</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">
              <svg className="h-3 w-3 fill-current text-emerald-600" viewBox="0 0 16 16"><path d="m3.5 8.2 2.8 2.7 6.2-6" /></svg>
              {slide.verifiedFields} facts
            </span>
          </div>
          {slide.destinations > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-forest-900/60">Route Destinations:</span>
              <strong className="text-forest-900">{slide.destinations} airports</strong>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <Link
          href={`/airlines/${slide.airline.slug}`}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-forest-900 px-3 py-2.5 text-center text-xs font-bold text-sand-100 shadow-sm transition-all group-hover:bg-forest-800 group-hover:shadow"
        >
          <span>Explore Policy Guide</span>
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </article>
  );
}

