import { History } from "lucide-react";
import type { Stats } from "@/lib/backtest";
import { cn } from "@/lib/utils";

// Fewer past trades than this says nothing about a single stock.
const MIN_TRADES = 5;

const pct = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}%`;

// How this stock's past buy signals turned out in the backtest.
export function TrackRecord({ symbol, stats, from, className }: { symbol: string; stats?: Stats; from: string; className?: string }) {
  if (!stats || stats.n < MIN_TRADES) {
    return (
      <p className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <History className="size-3.5 shrink-0" /> Too few past signals on {symbol} to judge its track record.
      </p>
    );
  }
  const good = stats.avgNetPct > 0;
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", className)}>
      <History className="size-4 shrink-0 text-muted-foreground" />
      <span>
        Past signals on {symbol} since {from.slice(0, 4)}: <span className="font-semibold tabular-nums">{Math.round(stats.winRate * stats.n)} of {stats.n}</span> made money,
        averaging <span className={cn("font-semibold tabular-nums", good ? "text-success" : "text-destructive")}>{pct(stats.avgNetPct)}</span> per trade after costs.
      </span>
    </p>
  );
}
