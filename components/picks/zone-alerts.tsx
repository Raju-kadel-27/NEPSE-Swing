import { BellRing, CalendarClock, Crosshair, Flame } from "lucide-react";
import Link from "next/link";
import { GLOSSARY, InfoTip } from "@/components/info-tip";
import { num } from "@/lib/format";
import { type Horizon, horizonQuery } from "@/lib/horizon";
import { shortDay } from "@/lib/market";
import { NEAR_ZONE_PCT } from "@/lib/scoring";
import type { Pick } from "@/lib/types";

// Rows per panel; the rest is summarised as "+N more".
const MAX_ROWS = 5;

function Group({ icon: Icon, tone, title, tip, picks, horizon, sub }: {
  icon: React.ElementType; tone: string; title: string; tip?: string; picks: Pick[]; horizon: Horizon; sub: (p: Pick) => string;
}) {
  if (!picks.length) return null;
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border bg-card p-4">
      <div className="mb-2 flex items-start gap-2.5">
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg bg-current/10 ${tone}`}><Icon className="size-3.5" /></span>
        <p className="flex-1 text-sm leading-snug font-semibold">
          {title}
          {tip && <span className="ml-1 inline-flex align-middle"><InfoTip text={tip} /></span>}
        </p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{picks.length}</span>
      </div>
      <ul className="-mx-2 flex-1">
        {picks.slice(0, MAX_ROWS).map((p) => (
          <li key={p.symbol}>
            <Link href={`/stock/${p.symbol}${horizonQuery(horizon)}`}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted">
              <span className="font-semibold">{p.symbol}</span>
              <span className="truncate text-xs text-muted-foreground tabular-nums">{sub(p)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {picks.length > MAX_ROWS && <p className="mt-1 text-xs text-muted-foreground">+{picks.length - MAX_ROWS} more</p>}
    </div>
  );
}

// Today's alerts: new entries into the buy zone, good stocks a small dip away, quiet accumulation, and results still to come.
export function ZoneAlerts({ entered, near, picks, horizon }: { entered: Pick[]; near: Pick[]; picks: Pick[]; horizon: Horizon }) {
  const accumulating = picks.filter((p) => p.accumulation && !p.excluded && p.total >= 55).sort((a, b) => b.total - a.total);
  const awaiting = picks
    .filter((p) => p.results.inSeason && p.results.status === "pending" && !p.excluded && p.total >= 60 && p.signal !== "avoid")
    .sort((a, b) => b.total - a.total);
  if (!entered.length && !near.length && !accumulating.length && !awaiting.length) return null;
  const due = awaiting[0]?.results;
  return (
    <section aria-label="Today's signals" className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Today&apos;s signals</h2>
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4 [&>*]:w-[85%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto">
        <Group icon={BellRing} tone="text-success" title="Entered the buy zone today" picks={[...entered].sort((a, b) => b.netGainPerUnit - a.netGainPerUnit)}
          horizon={horizon} sub={(p) => `+Rs ${num(p.netGainPerUnit, 0)}/share`} />
        <Group icon={Crosshair} tone="text-warning" title={`Within ${NEAR_ZONE_PCT}% of the buy zone`}
          picks={[...near].sort((a, b) => a.aboveZonePct - b.aboveZonePct)} horizon={horizon} sub={(p) => `limit at ${num(p.entryHigh, 0)}`} />
        <Group icon={Flame} tone="text-primary" title="Unusual buying" tip={GLOSSARY.accumulation}
          picks={accumulating} horizon={horizon} sub={(p) => `vol ${p.accumulation!.volRatio}x, +${p.accumulation!.ret10Pct}%`} />
        {due && (
          <Group icon={CalendarClock} tone="text-warning" title={`${due.expected.split(" ")[0]} results due by ${shortDay(due.due)}`} tip={GLOSSARY.resultsDue}
            picks={awaiting} horizon={horizon} sub={(p) => `score ${p.total}`} />
        )}
      </div>
    </section>
  );
}
