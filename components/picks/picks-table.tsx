"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeText, SignalBadge, toneOf } from "@/components/score";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { num } from "@/lib/format";
import { type Horizon, horizonQuery } from "@/lib/horizon";
import type { Pick } from "@/lib/types";
import { cn } from "@/lib/utils";

const scoreText = { success: "text-success", warning: "text-warning", destructive: "text-destructive" };

export function PicksTable({ picks, horizon }: { picks: Pick[]; horizon: Horizon }) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="pl-4">Stock</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead>What to do</TableHead>
            <TableHead className="hidden text-right md:table-cell">Buy at</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Sell if below</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Take profit</TableHead>
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
              </TableCell>
              <TableCell className="text-right">
                <div className="tabular-nums">{num(p.price)}</div>
                <ChangeText pct={p.changePct} className="text-xs" />
              </TableCell>
              <TableCell>
                <SignalBadge signal={p.signal} />
                {p.signal === "wait" && <div className="mt-1 text-xs text-warning tabular-nums">{p.aboveZonePct}% above buy price</div>}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{num(p.entryLow, 0)}–{num(p.entryHigh, 0)}</TableCell>
              <TableCell className="hidden text-right tabular-nums text-destructive lg:table-cell">{num(p.stopLoss, 0)}</TableCell>
              <TableCell className="hidden text-right tabular-nums text-success lg:table-cell">{num(p.target, 0)}</TableCell>
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
