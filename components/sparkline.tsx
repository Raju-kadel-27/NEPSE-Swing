import { useId } from "react";
import { cn } from "@/lib/utils";

// Tiny SVG price line with a soft area fill and an optional shaded band (e.g. the buy range).
export function Sparkline({ points, band, tone, className, height = 40 }: {
  points: number[]; band?: [number, number]; tone?: "up" | "down"; className?: string; height?: number;
}) {
  const id = useId();
  if (points.length < 2) return <div className={cn("w-full", className)} style={{ height }} />;
  const w = 100;
  const lo = Math.min(...points, ...(band ?? [])), hi = Math.max(...points, ...(band ?? []));
  const pad = (hi - lo) * 0.08 || 1;
  const min = lo - pad, max = hi + pad;
  const y = (v: number) => ((max - v) / (max - min)) * height;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const line = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join("");
  const dir = tone ?? (points.at(-1)! >= points[0] ? "up" : "down");
  const color = dir === "up" ? "var(--success)" : "var(--destructive)";
  return (
    <div className={cn("relative w-full", className)} style={{ height }} aria-hidden>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="size-full overflow-visible">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {band && <rect x={0} width={w} y={y(band[1])} height={Math.max(1, y(band[0]) - y(band[1]))} fill="var(--success)" fillOpacity={0.16} />}
        <path d={`${line}L${w},${height}L0,${height}Z`} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="absolute size-1.5 -translate-1/2 rounded-full ring-2 ring-card" style={{ left: "100%", top: `${(y(points.at(-1)!) / height) * 100}%`, background: color }} />
    </div>
  );
}
