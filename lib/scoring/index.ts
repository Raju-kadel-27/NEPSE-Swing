import { DEFAULT_HORIZON, type Horizon, HORIZONS } from "../horizon";
import { tradeWindow } from "../market";
import type { DataSource, Pick, StockData } from "../types";
import { scoreFundamental, type SectorStats, valuation } from "./fundamental";
import { planEntry } from "./entry";
import { scoreRisk } from "./risk";
import { scoreTechnical } from "./technical";
import { median, r1 } from "./util";


export function sectorStats(stocks: StockData[]): Map<string, SectorStats> {
  const by = new Map<string, { pe: number[]; pbv: number[] }>();
  for (const s of stocks) {
    const price = s.candles.at(-1)?.close;
    if (!price) continue;
    const v = valuation(s, price);
    const b = by.get(s.company.sector) ?? { pe: [], pbv: [] };
    if (v.pe !== null) b.pe.push(v.pe);
    if (v.pbv !== null) b.pbv.push(v.pbv);
    by.set(s.company.sector, b);
  }
  return new Map([...by].map(([k, v]) => [k, { pe: median(v.pe), pbv: median(v.pbv) }]));
}

export function scoreStock(s: StockData, sector: SectorStats, asOf: string, horizon: Horizon = HORIZONS[DEFAULT_HORIZON]): Pick | null {
  const last = s.candles.at(-1), prev = s.candles.at(-2);
  if (!last) return null;
  const f = scoreFundamental(s, last.close, sector);
  const t = scoreTechnical(s.candles, s.snapshot);
  const r = scoreRisk(s.candles, s.actions, asOf, s.snapshot);
  const w = horizon.weights;
  const total = Math.round(f.score * w.fundamental + t.score * w.technical + r.score * w.risk);
  const entry = planEntry({
    candles: s.candles, snap: s.snapshot, atr: r.atr ?? last.close * 0.03, total, excluded: r.excluded, spiked: r.spiked,
    days: horizon.days, targetCap: horizon.targetCap, stopAtr: horizon.stopAtr,
  });
  return {
    symbol: s.company.symbol, name: s.company.name, sector: s.company.sector,
    price: last.close,
    changePct: prev ? (last.close / prev.close - 1) * 100 : s.snapshot?.prevClose ? (last.close / s.snapshot.prevClose - 1) * 100 : 0,
    total, fundamental: Math.round(f.score), technical: Math.round(t.score), risk: Math.round(r.score),
    ...entry,
    ...tradeWindow(asOf),
    lockMovePct: r.lockMovePct === null ? null : r1(r.lockMovePct * 100),
    reasons: [...f.reasons, ...t.reasons, ...r.reasons],
    flags: [...f.flags, ...t.flags, ...r.flags],
    excluded: r.excluded,
    metrics: {
      pe: f.pe, pbv: f.pbv, roe: f.roe, epsGrowthYoY: f.epsGrowthYoY,
      rsi: t.rsi, sma50: t.sma50, sma200: t.sma200, avg120: t.avg120, avg180: t.avg180, avgTurnover: r.avgTurnover, atrPct: r.atrPct,
    },
  };
}

export function rankStocks(ds: DataSource, horizon: Horizon = HORIZONS[DEFAULT_HORIZON]): Pick[] {
  const stats = sectorStats(ds.stocks);
  return ds.stocks
    .map((s) => scoreStock(s, stats.get(s.company.sector) ?? { pe: null, pbv: null }, ds.asOf, horizon))
    .filter((p): p is Pick => p !== null)
    .sort((a, b) => Number(a.excluded) - Number(b.excluded) || b.total - a.total);
}

// Actionable today: a decent score and a price at a sensible entry.
export const isBuyableToday = (p: Pick) => (p.signal === "ready" || p.signal === "breakout") && p.total >= 60;
