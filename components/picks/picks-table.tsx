"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { ExternalLinks } from "@/components/external-links";
import { Sparkline } from "@/components/sparkline";
import { ChangeText, SignalBadge, toneOf } from "@/components/score";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { num } from "@/lib/format";
import { type Horizon, horizonQuery } from "@/lib/horizon";
import type { Pick } from "@/lib/types";
import { cn } from "@/lib/utils";

const scoreText = { success: "text-success", warning: "text-warning", destructive: "text-destructive" };

export function PicksTable({ picks, horizon, sparks }: { picks: Pick[]; horizon: Horizon; sparks?: Record<string, number[]> }) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="pl-4">Stock</TableHead>
            <TableHead className="text-right">Price</TableHead>
            {sparks && <TableHead className="hidden w-28 md:table-cell">60 days</TableHead>}
            <TableHead>What to do</TableHead>
            <TableHead className="hidden text-right xl:table-cell">EPS</TableHead>
            <TableHead className="hidden text-right xl:table-cell">P/E</TableHead>
            <TableHead className="hidden text-right lg:table-cell">1Y</TableHead>
            <TableHead className="hidden text-right md:table-cell">Buy at</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Sell if below</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Take profit</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Net Rs/share</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="w-8 pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {picks.map((p) => (
            <TableRow key={p.symbol} className="group cursor-pointer" onClick={() => router.push(`/stock/${p.symbol}${horizonQuery(horizon)}`)}>
              <TableCell className="pl-4">
                <div className="font-semibold">{p.symbol}</div>
                <div className="max-w-48 truncate text-xs text-muted-foreground">{p.sector}</div>
                <ExternalLinks symbol={p.symbol} compact className="mt-1 hidden gap-1 sm:flex" />
              </TableCell>
              <TableCell className="text-right">
                <div className="tabular-nums">{num(p.price)}</div>
                <ChangeText pct={p.changePct} className="text-xs" />
              </TableCell>
              {sparks && (
                <TableCell className="hidden md:table-cell">
                  <Sparkline points={sparks[p.symbol] ?? []} band={[p.entryLow, p.entryHigh]} height={28} className="w-24" />
                </TableCell>
              )}
              <TableCell>
                <SignalBadge signal={p.signal} />
                {p.signal === "wait" && <div className="mt-1 text-xs text-warning tabular-nums">{p.aboveZonePct}% above buy price</div>}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums xl:table-cell">{num(p.metrics.eps)}</TableCell>
              <TableCell className="hidden text-right tabular-nums xl:table-cell">{num(p.metrics.pe)}</TableCell>
              <TableCell className={cn("hidden text-right tabular-nums lg:table-cell", p.metrics.change1y == null ? "" : p.metrics.change1y >= 0 ? "text-success" : "text-destructive")}>
                {p.metrics.change1y == null ? "–" : `${p.metrics.change1y > 0 ? "+" : ""}${num(p.metrics.change1y)}%`}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{num(p.entryLow, 0)}–{num(p.entryHigh, 0)}</TableCell>
              <TableCell className="hidden text-right tabular-nums text-destructive lg:table-cell">{num(p.stopLoss, 0)}</TableCell>
              <TableCell className="hidden text-right tabular-nums text-success lg:table-cell">{num(p.target, 0)}</TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                <span className="text-success">+{num(p.netGainPerUnit, 0)}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-destructive">-{num(p.netRiskPerUnit, 0)}</span>
              </TableCell>
              <TableCell className="text-right">
                <span className={cn("text-base font-semibold tabular-nums", scoreText[toneOf(p.total)])}>{p.total}</span>
              </TableCell>
              <TableCell className="pr-4"><ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
