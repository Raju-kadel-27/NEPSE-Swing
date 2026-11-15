import { num } from "@/lib/format";
import { cn } from "@/lib/utils";

// Horizontal ladder from stop to target: red risk area, highlighted buy zone, green upside, and a marker at today's price.
export function ZoneBar({ stop, low, high, target, price, compact, caption = true, className }: {
  stop: number; low: number; high: number; target: number; price: number; compact?: boolean; caption?: boolean; className?: string;
}) {
  const min = Math.min(stop, price) * 0.995;
  const max = Math.max(target, price) * 1.005;
  const at = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  const inZone = price >= low && price <= high;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative h-2 rounded-full bg-muted">
        <div className="absolute inset-y-0 rounded-l-full bg-destructive/25" style={{ left: at(stop), width: `calc(${at(low)} - ${at(stop)})` }} />
        <div className="absolute inset-y-0 bg-success" style={{ left: at(low), width: `calc(${at(high)} - ${at(low)})` }} />
        <div className="absolute inset-y-0 rounded-r-full bg-success/20" style={{ left: at(high), width: `calc(${at(target)} - ${at(high)})` }} />
        <div
          className={cn("absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow", inZone ? "bg-success" : "bg-foreground")}
          style={{ left: at(price) }}
          title={`Last price ${num(price)}`}
        />
      </div>
      {!caption ? null : compact ? (
        <p className="text-[11px] text-muted-foreground">
          <span className={cn("mr-1 inline-block size-2 rounded-full align-middle", inZone ? "bg-success" : "bg-foreground")} />
          Today&apos;s price {num(price)}{inZone ? ", inside the buy range" : price > high ? ", above the buy range" : ", below the buy range"}
        </p>
      ) : (
        <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
          <span className="text-destructive">Stop {num(stop)}</span>
          <span className="font-medium text-success">Buy {num(low, 0)}–{num(high, 0)}</span>
          <span className="text-success">Target {num(target)}</span>
        </div>
      )}
    </div>
  );
}
