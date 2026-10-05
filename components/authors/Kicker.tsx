/** Numbered chapter label, matching the About page. */
export default function Kicker({ n, label }: { n: string; label: string }) {
  return (
    <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-primary-emphasis">
      <span className="font-mono text-forest-900/45">{n}</span>
      <span aria-hidden className="h-px w-8 bg-primary-emphasis/40" />
      {label}
    </p>
  );
}
