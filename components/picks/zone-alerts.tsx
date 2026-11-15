import { BellRing, CalendarClock, Crosshair, Flame } from "lucide-react";
import Link from "next/link";
import { GLOSSARY, InfoTip } from "@/components/info-tip";
import { num } from "@/lib/format";
import { type Horizon, horizonQuery } from "@/lib/horizon";
import { shortDay } from "@/lib/market";
import { NEAR_ZONE_PCT } from "@/lib/scoring";
import type { Pick } from "@/lib/types";

// Chips per group; a long list is cut with a "+N more" note.
const MAX_CHIPS = 12;

function Group({ icon: Icon, tone, title, tip, picks, horizon, sub }: {
  icon: React.ElementType; tone: string; title: string; tip?: string; picks: Pick[]; horizon: Horizon; sub: (p: Pick) => string;
}) {
  if (!picks.length) return null;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icon className={`size-4 ${tone}`} /> {title}
        {tip && <InfoTip text={tip} />}
      </p>
      <div className="flex flex-wrap gap-2">
        {picks.slice(0, MAX_CHIPS).map((p) => (
          <Link key={p.symbol} href={`/stock/${p.symbol}${horizonQuery(horizon)}`}
            className="rounded-lg border bg-card px-2.5 py-1 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5">
            <span className="font-semibold">{p.symbol}</span>
            <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{sub(p)}</span>
          </Link>
        ))}
        {picks.length > MAX_CHIPS && <span className="self-center text-xs text-muted-foreground">+{picks.length - MAX_CHIPS} more</span>}
      </div>
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
    <section aria-label="Alerts" className="grid gap-5 rounded-xl border bg-card p-4 md:grid-cols-2">
      <Group icon={BellRing} tone="text-success" title="Entered the buy zone today" picks={[...entered].sort((a, b) => b.netGainPerUnit - a.netGainPerUnit)}
        horizon={horizon} sub={(p) => `+Rs ${num(p.netGainPerUnit, 0)}/share`} />
      <Group icon={Crosshair} tone="text-warning" title={`Within ${NEAR_ZONE_PCT}% of the buy zone: set a limit order`}
        picks={[...near].sort((a, b) => a.aboveZonePct - b.aboveZonePct)} horizon={horizon} sub={(p) => `at ${num(p.entryHigh, 0)}`} />
      <Group icon={Flame} tone="text-primary" title="Unusual buying: watch these" tip={GLOSSARY.accumulation}
        picks={accumulating} horizon={horizon} sub={(p) => `vol ${p.accumulation!.volRatio}x, +${p.accumulation!.ret10Pct}%`} />
      {due && (
        <Group icon={CalendarClock} tone="text-warning" title={`${due.expected} results still due (by ${shortDay(due.due)})`} tip={GLOSSARY.resultsDue}
          picks={awaiting} horizon={horizon} sub={(p) => `score ${p.total}`} />
      )}
    </section>
  );
}
