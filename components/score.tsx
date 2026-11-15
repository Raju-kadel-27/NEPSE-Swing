import { Ban, CircleCheck, CircleDashed, Hourglass, Rocket } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SIGNAL_LABEL, type Signal } from "@/lib/scoring/entry";
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

export function ScoreMeter({ label, score, tip }: { label: string; score: number; tip?: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-xs">
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        {label}
        {tip && <InfoTip text={tip} />}
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

const SIGNAL_STYLE: Record<Signal, { cls: string; Icon: React.ElementType }> = {
  ready: { cls: "bg-success text-white dark:text-background", Icon: CircleCheck },
  breakout: { cls: "bg-primary text-primary-foreground", Icon: Rocket },
  wait: { cls: "bg-warning/15 text-warning ring-1 ring-inset ring-warning/30", Icon: Hourglass },
  not_yet: { cls: "bg-muted text-muted-foreground ring-1 ring-inset ring-border", Icon: CircleDashed },
  avoid: { cls: "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20", Icon: Ban },
};

export function SignalBadge({ signal, className }: { signal: Signal; className?: string }) {
  const { cls, Icon } = SIGNAL_STYLE[signal];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold", cls, className)}>
      <Icon className="size-3.5" />
      {SIGNAL_LABEL[signal]}
    </span>
  );
}

// Visitor-facing names for the three sub-scores.
export const PART_LABEL = { fundamental: "Company", technical: "Price trend", risk: "Safety" } as const;

export function ScorePill({ p }: { p: { total: number; fundamental: number; technical: number; risk: number } }) {
  const tone = toneOf(p.total);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset", soft[tone])}>
          Score {p.total}<span className="font-normal opacity-70">/100</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="w-56">
        <p className="mb-1.5 font-medium">Quality score</p>
        <div className="space-y-1">
          {(["fundamental", "technical", "risk"] as const).map((k) => (
            <div key={k} className="flex justify-between gap-4"><span className="opacity-80">{PART_LABEL[k]}</span><span className="tabular-nums">{p[k]}</span></div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function ChangeText({ pct, className }: { pct: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", pct > 0 ? "text-success" : pct < 0 ? "text-destructive" : "text-muted-foreground", className)}>
      {pct > 0 ? "▲" : pct < 0 ? "▼" : ""} {Math.abs(pct).toFixed(2)}%
    </span>
  );
}
