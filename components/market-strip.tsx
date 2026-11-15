import { InfoTip } from "@/components/info-tip";
import { Sparkline } from "@/components/sparkline";
import { num } from "@/lib/format";
import { type MoneyCondition, TIGHT_RATE } from "@/lib/scoring/money";
import { REGIME_LABEL, type Regime } from "@/lib/scoring/regime";
import { cn } from "@/lib/utils";

const REGIME_TONE: Record<Regime, string> = {
  bull: "bg-success/12 text-success ring-success/25",
  neutral: "bg-warning/12 text-warning ring-warning/25",
  bear: "bg-destructive/12 text-destructive ring-destructive/25",
};

function Cell({ label, tip, children, className }: { label: string; tip?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 p-4", className)}>
      <p className="flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
        {tip && <InfoTip text={tip} />}
      </p>
      {children}
    </div>
  );
}

// Market overview: our equal-weight index, today's mood (regime + breadth), and how many stocks rose or fell.
export function MarketStrip({ points, last, changePct, up, down, flat, checked, money }: {
  points: number[]; last: { index: number; breadth: number; regime: Regime } | null; changePct: number | null;
  up: number; down: number; flat: number; checked: number; money: MoneyCondition | null;
}) {
  const total = up + down + flat || 1;
  const chg = changePct ?? 0;
  return (
    <section aria-label="Market today" className="grid grid-cols-2 divide-border overflow-hidden rounded-2xl border bg-card lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:divide-x [&>*:nth-child(n+2)]:border-t lg:[&>*:nth-child(n+2)]:border-t-0">
      <Cell label="Market index" tip="Equal-weight average of every stock we track, not the official NEPSE index. It shows how the typical stock is doing." className="col-span-2 lg:col-span-1">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{last ? num(last.index, 0) : "–"}</p>
            {changePct != null && (
              <p className={cn("text-sm font-medium tabular-nums", chg > 0 ? "text-success" : chg < 0 ? "text-destructive" : "text-muted-foreground")}>
                {chg > 0 ? "+" : ""}{chg.toFixed(2)}% <span className="font-normal text-muted-foreground">today</span>
              </p>
            )}
          </div>
          <Sparkline points={points} height={44} className="max-w-56" />
        </div>
      </Cell>
      <Cell label="Market mood" tip={`Rising when the index is above its 50- and 200-day averages and most stocks are too; falling when both are weak. Money is tight when banks lend to each other at ${TIGHT_RATE}% or more (NRB interbank rate, 30-day average).`}>
        {last ? (
          <>
            <span className={cn("inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset", REGIME_TONE[last.regime])}>
              {REGIME_LABEL[last.regime]}
            </span>
            <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground tabular-nums">{Math.round(last.breadth * 100)}%</span> of stocks above their 50-day average</p>
            {money && (
              <p className="text-xs text-muted-foreground">
                Interbank rate <span className={cn("font-medium tabular-nums", money.tight ? "text-destructive" : "text-foreground")}>{money.rate}%</span>
                {money.tight ? ": money is tight" : ": money is easy"}
              </p>
            )}
          </>
        ) : <p className="text-sm text-muted-foreground">Not enough history yet</p>}
      </Cell>
      <Cell label="Today">
        <p className="text-sm tabular-nums">
          <span className="font-semibold text-success">{up} up</span>
          <span className="text-muted-foreground"> · </span>
          <span className="font-semibold text-destructive">{down} down</span>
          {flat > 0 && <span className="text-muted-foreground"> · {flat} flat</span>}
        </p>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${up} up, ${down} down, ${flat} unchanged`}>
          <div className="bg-success" style={{ width: `${(up / total) * 100}%` }} />
          <div className="bg-muted-foreground/30" style={{ width: `${(flat / total) * 100}%` }} />
          <div className="bg-destructive" style={{ width: `${(down / total) * 100}%` }} />
        </div>
      </Cell>
      <Cell label="Coverage" className="col-span-2 lg:col-span-1">
        <p className="text-sm"><span className="font-semibold tabular-nums">{checked}</span> <span className="text-muted-foreground">stocks scored on results, trend and volume</span></p>
      </Cell>
    </section>
  );
}
