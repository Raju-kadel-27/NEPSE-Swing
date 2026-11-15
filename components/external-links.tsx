"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const EXTERNAL_SITES = [
  { name: "Merolagani", url: (symbol: string) => `https://merolagani.com/CompanyDetail.aspx?symbol=${encodeURIComponent(symbol)}` },
  { name: "ShareSansar", url: (symbol: string) => `https://www.sharesansar.com/company/${encodeURIComponent(symbol.toLowerCase())}` },
];

// Opens the stock's page on Merolagani and ShareSansar in a new tab, for their live charts and news.
export function ExternalLinks({ symbol, className, compact }: { symbol: string; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {!compact && <span className="text-xs text-muted-foreground">Charts and news:</span>}
      {EXTERNAL_SITES.map((s) => (
        <a key={s.name} href={s.url(symbol)} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          aria-label={`Open ${symbol} on ${s.name} in a new tab`}>
          {s.name} <ExternalLink className="size-3" />
        </a>
      ))}
    </div>
  );
}
