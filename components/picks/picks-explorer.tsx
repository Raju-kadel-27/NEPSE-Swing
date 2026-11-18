"use client";

import { Hourglass, LayoutGrid, List, Search, SearchX, ShoppingCart, TableProperties } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isBuyableToday, isPreferredPrice, PREFERRED_MAX_PRICE } from "@/lib/scoring";
import type { Horizon } from "@/lib/horizon";
import type { Pick } from "@/lib/types";
import { PickCard } from "./pick-card";
import { PicksTable } from "./picks-table";

type Bucket = "buy" | "wait" | "all";
type SortKey = "total" | "nearest" | "rupees" | "upside" | "pe" | "symbol";
// Minimum net profit per share (after fees and tax) if the target is reached.
const MIN_GAINS = [0, 10, 20, 30, 50] as const;

const isWaiting = (p: Pick) => p.signal === "wait" || ((p.signal === "ready" || p.signal === "breakout") && !isBuyableToday(p));

const TABS: Record<Bucket, { label: string; icon: React.ElementType; hint: string; filter: (p: Pick) => boolean; sort: SortKey; view: "cards" | "table" }> = {
  buy: {
    label: "Buy today", icon: ShoppingCart, filter: isBuyableToday, sort: "total", view: "table",
    hint: "Good stocks trading inside their buy range right now. Place a limit order inside the range.",
  },
  wait: {
    label: "Wait for a dip", icon: Hourglass, filter: isWaiting, sort: "nearest", view: "table",
    hint: "Good stocks that are a bit expensive today. Set a limit order at the top of the buy range and let the price come to you.",
  },
  all: {
    label: "All stocks", icon: TableProperties, filter: () => true, sort: "total", view: "table",
    hint: "Every stock we track, including ones to avoid. Click any row for the full analysis.",
  },
};

const SORTS: Record<SortKey, { label: string; fn: (a: Pick, b: Pick) => number }> = {
  total: { label: "Best score", fn: (a, b) => b.total - a.total },
  nearest: { label: "Closest to buy price", fn: (a, b) => a.aboveZonePct - b.aboveZonePct },
  rupees: { label: "Most Rs per share", fn: (a, b) => b.netGainPerUnit - a.netGainPerUnit },
  upside: { label: "Most upside %", fn: (a, b) => b.target / b.entryHigh - a.target / a.entryHigh },
  pe: { label: "Cheapest (P/E)", fn: (a, b) => (a.metrics.pe ?? Infinity) - (b.metrics.pe ?? Infinity) },
  symbol: { label: "Symbol A–Z", fn: (a, b) => a.symbol.localeCompare(b.symbol) },
};

type PriceBand = "preferred" | "any";
const inBand = (p: Pick, band: PriceBand) => band === "any" || isPreferredPrice(p);

export function PicksExplorer({ picks, horizon, sparks }: { picks: Pick[]; horizon: Horizon; sparks: Record<string, number[]> }) {
  const [bucket, setBucket] = useState<Bucket>("buy");
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("all");
  const [minGain, setMinGain] = useState("0");
  const [priceBand, setPriceBand] = useState<PriceBand>("preferred");
  const [sort, setSort] = useState<SortKey>(TABS.buy.sort);
  const [view, setView] = useState<"cards" | "table">(TABS.buy.view);

  const sectors = useMemo(() => [...new Set(picks.map((p) => p.sector))].sort(), [picks]);
  const counts = useMemo(
    () => Object.fromEntries((Object.keys(TABS) as Bucket[]).map((b) => [b, picks.filter((p) => TABS[b].filter(p) && (b === "all" || inBand(p, priceBand))).length])) as Record<Bucket, number>,
    [picks, priceBand],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return picks
      .filter(TABS[bucket].filter)
      .filter((p) => sector === "all" || p.sector === sector)
      .filter((p) => p.netGainPerUnit >= Number(minGain))
      .filter((p) => bucket === "all" || inBand(p, priceBand))
      .filter((p) => !q || p.symbol.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .sort(SORTS[sort].fn);
  }, [picks, bucket, sector, minGain, priceBand, query, sort]);

  const switchTab = (b: Bucket) => {
    setBucket(b);
    setSort(TABS[b].sort);
    setView(TABS[b].view);
  };

  return (
    <div className="space-y-4">
      <Tabs value={bucket} onValueChange={(v) => switchTab(v as Bucket)} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="h-auto w-max justify-start gap-1 p-1">
          {(Object.keys(TABS) as Bucket[]).map((b) => {
            const T = TABS[b];
            return (
              <TabsTrigger key={b} value={b} className="flex-none gap-1.5 px-3 py-1.5">
                <T.icon className="size-4" />
                {T.label}
                <span className="rounded-full bg-background/60 px-1.5 text-xs tabular-nums text-muted-foreground">{counts[b]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      <p className="text-sm text-muted-foreground">{TABS[bucket].hint}</p>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative w-full lg:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a stock, e.g. NABIL" className="pl-8" aria-label="Search stocks" />
        </div>
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-1 lg:overflow-visible lg:px-0">
          <Select value={sector} onValueChange={setSector}>
            <SelectTrigger className="w-40 shrink-0" aria-label="Sector"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sectors</SelectItem>
              {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priceBand} onValueChange={(v) => setPriceBand(v as PriceBand)}>
            <SelectTrigger className="w-36 shrink-0" aria-label="Price range"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="preferred">Under Rs {PREFERRED_MAX_PRICE}</SelectItem>
              <SelectItem value="any">Any price</SelectItem>
            </SelectContent>
          </Select>
          <Select value={minGain} onValueChange={setMinGain}>
            <SelectTrigger className="w-44 shrink-0" aria-label="Minimum profit per share"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MIN_GAINS.map((g) => <SelectItem key={g} value={String(g)}>{g ? `Profit Rs ${g}+/share` : "Any profit/share"}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-48 shrink-0" aria-label="Sort by"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(SORTS).map(([k, s]) => <SelectItem key={k} value={k}>Sort: {s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && setView(v as "cards" | "table")} aria-label="View" className="ml-auto shrink-0">
            <ToggleGroupItem value="cards" aria-label="Card view"><LayoutGrid className="size-4" /></ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view"><List className="size-4" /></ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          <SearchX className="size-6" />
          {query || sector !== "all" || minGain !== "0" || priceBand !== "any" ? "No stocks match your filters. Try Any price." : "Nothing here today. Check the other tabs."}
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => <PickCard key={p.symbol} p={p} horizon={horizon} spark={sparks[p.symbol]} />)}
        </div>
      ) : (
        <PicksTable picks={shown} horizon={horizon} sparks={sparks} />
      )}
    </div>
  );
}
