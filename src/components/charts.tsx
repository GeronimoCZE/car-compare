/**
 * Two small server-rendered SVG charts. Single series each, so one brand hue; the highlighted
 * listing gets ink + a surface ring. Native <title> elements give a per-mark hover tooltip, and
 * every chart has a table view next to it on the page.
 */
const BRAND = "#2554e8";
const RANGE = "#c7d5fb";
const INK = "#0f172a";
const GRID = "#e5e7eb";
const MUTED = "#64748b";

export function YearPriceChart({
  data,
  highlight,
  format,
  label,
}: {
  data: { year: number; p10: number; median: number; p90: number; n: number }[];
  highlight?: { year: number; price: number } | null;
  format: (v: number) => string;
  label: string;
}) {
  if (data.length < 2) return null;
  const W = 720, H = 260, L = 64, R = 16, T = 16, B = 32;
  const years = data.map((d) => d.year);
  const minY = Math.min(...years), maxY = Math.max(...years);
  const maxV = Math.max(...data.map((d) => d.p90), highlight?.price ?? 0) * 1.08;
  const x = (yr: number) => L + ((yr - minY) / Math.max(1, maxY - minY)) * (W - L - R);
  const y = (v: number) => T + (1 - v / maxV) * (H - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxV);
  const step = Math.ceil(years.length / 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth="1" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{format(v)}</text>
        </g>
      ))}
      {data.map((d, i) => (
        <g key={d.year}>
          <title>{`${d.year}: ${format(d.p10)} – ${format(d.p90)}, medián ${format(d.median)} (n=${d.n})`}</title>
          <rect x={x(d.year) - 12} y={T} width={24} height={H - T - B} fill="transparent" />
          <line x1={x(d.year)} x2={x(d.year)} y1={y(d.p10)} y2={y(d.p90)} stroke={RANGE} strokeWidth="8" strokeLinecap="round" />
          <circle cx={x(d.year)} cy={y(d.median)} r="5" fill={BRAND} stroke="#fff" strokeWidth="2" />
          {i % step === 0 && <text x={x(d.year)} y={H - 10} textAnchor="middle" fontSize="11" fill={MUTED}>{d.year}</text>}
        </g>
      ))}
      {highlight && highlight.year >= minY && highlight.year <= maxY && (
        <g>
          <title>{`${highlight.year}: ${format(highlight.price)}`}</title>
          <circle cx={x(highlight.year)} cy={y(highlight.price)} r="7" fill={INK} stroke="#fff" strokeWidth="2.5" />
        </g>
      )}
    </svg>
  );
}

export function PriceHistoryChart({ points, format, label }: { points: { at: Date; price: number }[]; format: (v: number) => string; label: string }) {
  if (points.length < 2) return null;
  const W = 520, H = 140, L = 56, R = 12, T = 12, B = 24;
  const t0 = points[0].at.getTime();
  const t1 = Math.max(Date.now(), points[points.length - 1].at.getTime());
  const vals = points.map((p) => p.price);
  const lo = Math.min(...vals) * 0.95, hi = Math.max(...vals) * 1.05;
  const x = (t: number) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - T - B);
  let d = `M${x(t0)},${y(points[0].price)}`;
  for (let i = 1; i < points.length; i++) d += ` H${x(points[i].at.getTime())} V${y(points[i].price)}`;
  d += ` H${x(t1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      {[lo, (lo + hi) / 2, hi].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={GRID} />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill={MUTED}>{format(v)}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke={BRAND} strokeWidth="2" />
      {points.map((p, i) => (
        <g key={i}>
          <title>{`${p.at.toLocaleDateString()}: ${format(p.price)}`}</title>
          <circle cx={x(p.at.getTime())} cy={y(p.price)} r="4.5" fill={BRAND} stroke="#fff" strokeWidth="2" />
        </g>
      ))}
    </svg>
  );
}
