/**
 * Cabin bag drawing with a size guide on three sides, drawn from the airline's
 * own published size. The bag's proportions follow the numbers; the sizes are
 * printed on the guide lines, largest on the tall side. It labels sizes, not
 * axes: airline wording does not reliably say which side is which.
 */
export default function CabinBagGuide({
  sides,
  size = 'md',
}: {
  sides: [number, number, number];
  size?: 'sm' | 'md';
}) {
  const [a, b, c] = sides;
  const H = 150;
  const W = Math.max(60, Math.min(H, (H * b) / a));
  const D = Math.max(34, Math.min(H * 0.6, (H * c) / a));
  const dx = D * 0.62;
  const dy = -D * 0.42;
  const x0 = 62;
  const y0 = 64;
  const bottom = y0 + H;
  const right = x0 + W;
  const vbW = right + dx + 78;
  const vbH = bottom + 62;

  const label = 'fill-primary-emphasis text-[15px] font-bold';
  const line = 'stroke-primary-emphasis';

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      role="img"
      aria-label={`Cabin bag size guide: sides of ${a} cm, ${b} cm and ${c} cm`}
      className={`h-auto w-full ${size === 'sm' ? 'max-w-[17rem]' : 'max-w-[19rem]'}`}
      data-testid="cabin-bag-guide"
    >
      {/* handle and wheels */}
      <path
        d={`M${x0 + W * 0.3} ${y0} V${y0 - 16} M${x0 + W * 0.7} ${y0} V${y0 - 16} M${x0 + W * 0.3} ${y0 - 16} H${x0 + W * 0.7}`}
        className="fill-none stroke-forest-950"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x0 + 16} cy={bottom + 6} r="6" className="fill-forest-950" />
      <circle cx={right - 16} cy={bottom + 6} r="6" className="fill-forest-950" />

      {/* top, side, front faces */}
      <path d={`M${x0} ${y0} L${x0 + dx} ${y0 + dy} H${right + dx} L${right} ${y0} Z`} className="fill-forest-900/25" />
      <path d={`M${right} ${y0} L${right + dx} ${y0 + dy} V${bottom + dy} L${right} ${bottom} Z`} className="fill-forest-900/45" />
      <rect x={x0} y={y0} width={W} height={H} rx="8" className="fill-forest-950" />
      {/* ribs on the front */}
      {[0.28, 0.5, 0.72].map((f) => (
        <line
          key={f}
          x1={x0 + 14}
          x2={right - 14}
          y1={y0 + H * f}
          y2={y0 + H * f}
          className="stroke-white/25"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}

      {/* height, left */}
      <g className={line} strokeWidth="1.75" fill="none" strokeLinecap="round">
        <path d={`M${x0 - 22} ${y0} V${bottom} M${x0 - 28} ${y0} H${x0 - 16} M${x0 - 28} ${bottom} H${x0 - 16}`} />
      </g>
      <text transform={`translate(${x0 - 32} ${y0 + H / 2}) rotate(-90)`} textAnchor="middle" className={label}>
        {a} cm
      </text>

      {/* width, below the wheels */}
      <g className={line} strokeWidth="1.75" fill="none" strokeLinecap="round">
        <path d={`M${x0} ${bottom + 26} H${right} M${x0} ${bottom + 20} V${bottom + 32} M${right} ${bottom + 20} V${bottom + 32}`} />
      </g>
      <text x={x0 + W / 2} y={bottom + 50} textAnchor="middle" className={label}>
        {b} cm
      </text>

      {/* depth, along the bottom right edge */}
      <g className={line} strokeWidth="1.75" fill="none" strokeLinecap="round">
        <path d={`M${right + 14} ${bottom + 12} L${right + dx + 14} ${bottom + dy + 12} M${right + 8} ${bottom + 8} L${right + 20} ${bottom + 16} M${right + dx + 8} ${bottom + dy + 8} L${right + dx + 20} ${bottom + dy + 16}`} />
      </g>
      <text x={right + dx + 26} y={bottom + dy + 20} className={label}>
        {c} cm
      </text>
    </svg>
  );
}
