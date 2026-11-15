import { ArrowRight, CalendarClock, TrendingDown } from "lucide-react";
import Link from "next/link";
import { GLOSSARY, InfoTip } from "@/components/info-tip";
import { ChangeText, ScorePill, SignalBadge } from "@/components/score";
import { AccumulationBadge, ResultsBadge } from "@/components/results-badges";
import { Sparkline } from "@/components/sparkline";
import { ZoneBar } from "@/components/zone-bar";
import { num, pctFrom } from "@/lib/format";
import { shortDay } from "@/lib/market";
import { type Horizon, horizonQuery } from "@/lib/horizon";
import type { Pick } from "@/lib/types";

function PlanCell({ label, tip, value, sub, tone }: { label: string; tip: string; value: string; sub?: string; tone?: "bad" | "good" }) {
  const color = tone === "bad" ? "text-destructive" : tone === "good" ? "text-success" : "text-foreground";
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label} <InfoTip text={tip} />
      </div>
      <div className={`mt-0.5 truncate text-[15px] font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className={`text-[11px] tabular-nums ${tone ? color : "text-success"} opacity-80`}>{sub}</div>}
    </div>
  );
}

// Per-share profit and risk in rupees, gross and after fees and tax, plus any lower high on the way to the target.
export function RupeeLine({ p, className }: { p: Pick; className?: string }) {
  return (
    <div className={`space-y-1 text-xs text-muted-foreground ${className ?? ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Profit <span className="font-semibold text-success tabular-nums">+Rs {num(p.gainPerUnit, 0)}</span>/share
          <span className="tabular-nums"> (Rs {num(p.netGainPerUnit, 0)} after fees and tax)</span>
        </span>
        <span>
          Risk <span className="font-semibold text-destructive tabular-nums">Rs {num(p.netRiskPerUnit, 0)}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          Reward:risk <span className="font-semibold text-foreground tabular-nums">{num(p.rewardRisk, 1)}</span>
          <InfoTip text={GLOSSARY.rupees} />
        </span>
      </div>
      {p.firstTarget !== null && (
        <div className="inline-flex flex-wrap items-center gap-1 text-warning">
          <TrendingDown className="size-3.5 shrink-0" />
          Recent peak at <span className="font-semibold tabular-nums">{num(p.firstTarget, 0)}</span>
          <span className="tabular-nums">(+Rs {num(p.firstTarget - p.entryHigh, 0)}/share)</span> may stall the rise
          <InfoTip text={GLOSSARY.lowerHigh} />
        </div>
      )}
    </div>
  );
}

export function PickCard({ p, horizon, spark }: { p: Pick; horizon: Horizon; spark?: number[] }) {
  const inZone = p.price >= p.entryLow && p.price <= p.entryHigh;
  return (
    <Link href={`/stock/${p.symbol}${horizonQuery(horizon)}`}
      className="group flex flex-col rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">{p.symbol}</span>
            <span className="truncate rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{p.sector}</span>
          </div>
          <p className="truncate text-xs text-muted-foreground">{p.name}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-semibold tabular-nums">{num(p.price)}</div>
          <ChangeText pct={p.changePct} className="text-xs font-medium" />
        </div>
      </div>

      {spark && spark.length > 1 && (
        <Sparkline points={spark} band={[p.entryLow, p.entryHigh]} height={48} className="mt-3" />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <SignalBadge signal={p.signal} />
        <ScorePill p={p} />
        {p.signal === "wait" && <span className="text-xs font-medium text-warning tabular-nums">{p.aboveZonePct}% above buy range</span>}
        {p.results.inSeason && p.results.status !== "reported" && <ResultsBadge p={p} />}
        {p.accumulation && <AccumulationBadge p={p} />}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3">
        <PlanCell label="Buy at" tip={GLOSSARY.buyAt} value={`${num(p.entryLow, 0)}–${num(p.entryHigh, 0)}`} sub={inZone ? "In range now" : undefined} />
        <PlanCell label="Stop" tip={GLOSSARY.sellIfBelow} value={num(p.stopLoss, 0)} sub={`${pctFrom(p.stopLoss, p.entryHigh).toFixed(1)}%`} tone="bad" />
        <PlanCell label="Target" tip={GLOSSARY.takeProfit} value={num(p.target, 0)} sub={`+${pctFrom(p.target, p.entryHigh).toFixed(1)}%`} tone="good" />
      </div>
      <ZoneBar stop={p.stopLoss} low={p.entryLow} high={p.entryHigh} target={p.target} price={p.price} caption={false} className="mt-3" />

      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          <span className="font-semibold text-success">+Rs {num(p.netGainPerUnit, 0)}</span>/share net
          <span className="mx-1.5 text-border">|</span>
          R:R <span className="font-semibold text-foreground">{num(p.rewardRisk, 1)}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3.5" />
          Sell from {shortDay(p.sellableFrom)}
          <ArrowRight className="size-3.5 text-primary transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
