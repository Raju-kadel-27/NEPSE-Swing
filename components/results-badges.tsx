import { CalendarCheck, CalendarClock, CalendarX, Flame } from "lucide-react";
import { GLOSSARY, InfoTip } from "@/components/info-tip";
import { shortDay } from "@/lib/market";
import type { Pick } from "@/lib/types";
import { cn } from "@/lib/utils";

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1";

// Quarterly results status during the reporting window: published, due soon, or overdue.
export function ResultsBadge({ p, className }: { p: Pick; className?: string }) {
  const r = p.results;
  if (!r.inSeason || r.status === "unknown") return null;
  const q = r.expected.split(" ")[0];
  if (r.status === "reported") {
    return <span className={cn(pill, "bg-muted text-muted-foreground ring-border", className)}><CalendarCheck className="size-3" />{q} results out</span>;
  }
  if (r.status === "pending") {
    return (
      <span className={cn(pill, "bg-warning/10 text-warning ring-warning/25", className)}>
        <CalendarClock className="size-3" />{q} results due by {shortDay(r.due)}
        <InfoTip text={GLOSSARY.resultsDue} />
      </span>
    );
  }
  return (
    <span className={cn(pill, "bg-destructive/10 text-destructive ring-destructive/20", className)}>
      <CalendarX className="size-3" />Results overdue (latest {r.latest})
      <InfoTip text={GLOSSARY.resultsOverdue} />
    </span>
  );
}

// Quiet accumulation: volume building while the price climbs steadily.
export function AccumulationBadge({ p, className }: { p: Pick; className?: string }) {
  const a = p.accumulation;
  if (!a) return null;
  return (
    <span className={cn(pill, "bg-primary/10 text-primary ring-primary/25", className)}>
      <Flame className="size-3" />Unusual buying
      <InfoTip text={`Volume ${a.volRatio}x normal, price up ${a.ret10Pct}% in 10 days, ${a.upVolPct}% of volume on up days. ${GLOSSARY.accumulation}`} />
    </span>
  );
}
