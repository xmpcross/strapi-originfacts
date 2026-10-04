'use client';

import { useEffect, useState } from 'react';

const SHOW_THRESHOLD = 400;

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

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
      data-testid="fixed-scroll-to-top"
      style={{ mixBlendMode: 'difference' }}
      className={`fixed bottom-[30px] left-[50px] z-40 hidden flex-col items-center transition-[opacity,transform] duration-500 lg:flex ${
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
  );
}
