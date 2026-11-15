import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, TrendingDown } from "lucide-react";
import Link from "next/link";
import { GLOSSARY, InfoTip } from "@/components/info-tip";
import { ChangeText, ScorePill, SignalBadge } from "@/components/score";
import { Card } from "@/components/ui/card";
import { ExternalLinks } from "@/components/external-links";
import { AccumulationBadge, ResultsBadge } from "@/components/results-badges";
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
      <div className={`mt-0.5 truncate text-base font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className={`text-xs tabular-nums ${color} opacity-80`}>{sub}</div>}
    </div>
  );
}

// EPS, P/E and 1-year price change in one compact row.
export function KeyStats({ p, className }: { p: Pick; className?: string }) {
  const m = p.metrics;
  const stat = (label: string, value: string, tone = "text-foreground", tip?: string) => (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">{label}{tip && <InfoTip text={tip} />}</div>
      <div className={`text-sm font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
  return (
    <div className={`grid grid-cols-3 gap-3 rounded-lg bg-muted/30 px-3 py-2 ${className ?? ""}`}>
      {stat("EPS", m.eps == null ? "–" : `Rs ${num(m.eps)}`, m.eps != null && m.eps < 0 ? "text-destructive" : undefined)}
      {stat("P/E", m.pe == null ? "–" : num(m.pe))}
      {stat("1-year change", m.change1y == null ? "–" : `${m.change1y > 0 ? "+" : ""}${num(m.change1y)}%`,
        m.change1y == null ? undefined : m.change1y >= 0 ? "text-success" : "text-destructive", GLOSSARY.change1y)}
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

export function PickCard({ p, horizon }: { p: Pick; horizon: Horizon }) {
  const why = p.reasons[0];
  const warning = p.flags[0];
  return (
    <Card className="group gap-0 py-0 transition-shadow hover:shadow-md hover:ring-primary/30">
      <Link href={`/stock/${p.symbol}${horizonQuery(horizon)}`} className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold tracking-tight">{p.symbol}</span>
              <span className="truncate text-xs text-muted-foreground">{p.sector}</span>
            </div>
            <p className="truncate text-sm text-muted-foreground">{p.name}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-lg font-semibold tabular-nums">Rs {num(p.price)}</div>
            <ChangeText pct={p.changePct} className="text-xs" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SignalBadge signal={p.signal} />
          <ScorePill p={p} />
          {p.signal === "wait" && <span className="text-xs text-warning">{p.aboveZonePct}% above the buy price</span>}
          <AccumulationBadge p={p} />
          <ResultsBadge p={p} />
        </div>

        <KeyStats p={p} />

        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="grid grid-cols-3 gap-3">
            <PlanCell label="Buy at" tip={GLOSSARY.buyAt} value={`${num(p.entryLow, 0)}–${num(p.entryHigh, 0)}`} />
            <PlanCell label="Sell if below" tip={GLOSSARY.sellIfBelow} value={num(p.stopLoss, 0)} sub={`${pctFrom(p.stopLoss, p.entryHigh).toFixed(1)}%`} tone="bad" />
            <PlanCell label="Take profit" tip={GLOSSARY.takeProfit} value={num(p.target, 0)} sub={`+${pctFrom(p.target, p.entryHigh).toFixed(1)}%`} tone="good" />
          </div>
          <ZoneBar stop={p.stopLoss} low={p.entryLow} high={p.entryHigh} target={p.target} price={p.price} compact className="mt-3" />
          <RupeeLine p={p} className="mt-3 border-t pt-2" />
        </div>

        <div className="space-y-1.5 text-sm">
          {why && (
            <p className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />{why}</p>
          )}
          {warning && (
            <p className="flex gap-2 text-muted-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />{warning}</p>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5" />
            Sellable from {shortDay(p.sellableFrom)}
            <InfoTip text={GLOSSARY.sellable} />
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            Full analysis <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
      <ExternalLinks symbol={p.symbol} className="border-t px-4 py-2.5" />
    </Card>
  );
}
