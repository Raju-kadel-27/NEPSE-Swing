import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "destructive";

export const toneOf = (score: number): Tone => (score >= 70 ? "success" : score >= 55 ? "warning" : "destructive");

export const verdictOf = (score: number, excluded = false) =>
  excluded ? "Illiquid" : score >= 70 ? "Strong candidate" : score >= 55 ? "Watchlist" : "Avoid for now";

const text: Record<Tone, string> = { success: "text-success", warning: "text-warning", destructive: "text-destructive" };
const bar: Record<Tone, string> = { success: "bg-success", warning: "bg-warning", destructive: "bg-destructive" };
const soft: Record<Tone, string> = {
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/10 text-warning ring-warning/25",
  destructive: "bg-destructive/10 text-destructive ring-destructive/20",
};

export function ScoreRing({ score, size = 56, className }: { score: number; size?: number; className?: string }) {
  const stroke = size >= 72 ? 6 : 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = toneOf(score);
  return (
    <div className={cn("relative shrink-0", text[tone], className)} style={{ width: size, height: size }} aria-label={`Score ${score} of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span className={cn("absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-foreground", size >= 72 ? "text-2xl" : "text-base")}>
        {score}
      </span>
    </div>
  );
}

export function ScoreMeter({ label, score, weight }: { label: string; score: number; weight?: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-xs">
      <span className="text-muted-foreground">
        {label}
        {weight && <span className="ml-1 text-muted-foreground/60">{weight}</span>}
      </span>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", bar[toneOf(score)])} style={{ width: `${score}%` }} />
      </div>
      <span className="text-right font-medium tabular-nums">{score}</span>
    </div>
  );
}

export function ToneBadge({ score, excluded, className }: { score: number; excluded?: boolean; className?: string }) {
  const tone = excluded ? "destructive" : toneOf(score);
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ring-1 ring-inset", soft[tone], className)}>
      {verdictOf(score, excluded)}
    </span>
  );
}

export function ChangeText({ pct, className }: { pct: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", pct > 0 ? "text-success" : pct < 0 ? "text-destructive" : "text-muted-foreground", className)}>
      {pct > 0 ? "▲" : pct < 0 ? "▼" : ""} {Math.abs(pct).toFixed(2)}%
    </span>
  );
}
