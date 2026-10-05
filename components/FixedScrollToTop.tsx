'use client';

import { useEffect, useState } from 'react';

const SHOW_THRESHOLD = 400;

// Full rail (bottom-left progress track + vertical label) from 1728px, where it
// sits in the gutter beside the 1420px content column (see FixedPopularNow).
// From 1600px to 1727px a compact 44px button bottom-right still fits in the
// gutter: 16px offset + 44px <= (1600 - 15px scrollbar - 1420) / 2. Below
// 1600px there is no gutter, so neither renders (as below `lg` before).

export default function FixedScrollToTop() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setVisible(y > SHOW_THRESHOLD);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(100, Math.max(0, (y / max) * 100)) : 0;
      setProgress(pct);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <>
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Scroll to top"
        data-testid="fixed-scroll-to-top"
        style={{ mixBlendMode: 'difference' }}
        className={`fixed bottom-[30px] left-[50px] z-40 hidden flex-col items-center transition-[opacity,transform] duration-500 min-[1728px]:flex ${
          visible
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-[60px] opacity-0'
        }`}
      >
        {/* Progress track — fills as the user scrolls down the page.
            Source colors are white; mix-blend-mode:difference on the
            outer button inverts them automatically — black on light
            backgrounds, white on dark backgrounds. */}
        <span
          aria-hidden
          className="relative mb-[10px] h-20 w-[2px] overflow-hidden bg-[#ffffff]/40"
        >
          <span
            className="absolute inset-x-0 top-0 bg-[#ffffff] transition-[height] duration-100 ease-linear"
            style={{ height: `${progress}%` }}
          />
        </span>

        {/* Vertical text — reads bottom-to-top */}
        <span className="text-[14px] font-bold uppercase leading-[80px] tracking-[0.05em] text-[#ffffff] [writing-mode:vertical-rl] [transform:rotate(180deg)]">
          Scroll to Top
        </span>
      </button>

      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Scroll to top"
        data-testid="fixed-scroll-to-top-compact"
        className={`fixed bottom-4 right-4 z-40 hidden h-11 w-11 items-center justify-center rounded-full bg-white text-forest-900 shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-[opacity,transform,color] duration-300 hover:text-primary-emphasis min-[1600px]:max-[1727.98px]:flex ${
          visible
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-[20px] opacity-0'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden
        >
          <polyline points="6 15 12 9 18 15" />
        </svg>
      </button>
    </>
  );
}
