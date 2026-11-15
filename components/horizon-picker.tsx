import { Clock } from "lucide-react";
import Link from "next/link";
import { type Horizon, HORIZON_KEYS, HORIZONS, horizonQuery } from "@/lib/horizon";
import { cn } from "@/lib/utils";

// Segmented "How long will you hold?" control; each option is a plain link that sets ?h=.
export function HorizonPicker({ current, basePath = "/", className }: { current: Horizon; basePath?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3", className)}>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
        <Clock className="size-4 text-muted-foreground" />
        How long will you hold?
      </span>
      <nav aria-label="Holding period" className="inline-grid grid-cols-6 rounded-lg bg-muted p-1">
        {HORIZON_KEYS.map((k) => {
          const h = HORIZONS[k];
          const active = h.key === current.key;
          return (
            <Link
              key={k}
              href={`${basePath}${horizonQuery(h)}`}
              scroll={false}
              replace
              aria-current={active ? "page" : undefined}
              title={h.label}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-center text-sm font-medium tabular-nums transition-colors sm:px-3",
                active ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/10" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {h.short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
