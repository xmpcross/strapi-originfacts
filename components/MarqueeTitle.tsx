export default function MarqueeTitle({ text, repeat = 8 }: { text: string; repeat?: number }) {
  const items = Array.from({ length: repeat });
  return (
    <div
      className="overflow-hidden border-y border-forest-900/10 bg-white py-3"
      data-testid="marquee-title"
    >
      <div className="cities-marquee flex w-max items-center">
        {items.map((_, i) => (
          <span
            key={i}
            className="text-4xl font-bold uppercase tracking-tight text-forest-900 sm:text-5xl"
          >
            <span>{text}</span>
            <span aria-hidden className="mx-8 inline-block text-primary-emphasis">✱</span>
          </span>
        ))}
        {/* Duplicate set for seamless loop */}
        {items.map((_, i) => (
          <span
            key={`dup-${i}`}
            className="text-4xl font-bold uppercase tracking-tight text-forest-900 sm:text-5xl"
            aria-hidden
          >
            <span>{text}</span>
            <span className="mx-8 inline-block text-primary-emphasis">✱</span>
          </span>
        ))}
      </div>
    </div>
  );
}
