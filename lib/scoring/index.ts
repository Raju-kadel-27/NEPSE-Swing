import { tradeWindow } from "../market";
import type { DataSource, Pick, StockData } from "../types";
import { scoreFundamental, type SectorStats, valuation } from "./fundamental";
import { scoreRisk } from "./risk";
import { scoreTechnical } from "./technical";
import { median, r1 } from "./util";

export const WEIGHTS = { fundamental: 0.4, technical: 0.35, risk: 0.25 };

// Stop at 2.5 ATR, target at 2x the risk (capped at +35%) for a 2-3 month swing.
export function levels(close: number, atr: number) {
  const stopLoss = close - 2.5 * atr;
  const target = Math.min(close + 2 * (close - stopLoss), close * 1.35);
  return { entryLow: r1(close - 0.5 * atr), entryHigh: r1(close + 0.25 * atr), stopLoss: r1(stopLoss), target: r1(target) };
}

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

export function scoreStock(s: StockData, sector: SectorStats, asOf: string): Pick | null {
  const last = s.candles.at(-1), prev = s.candles.at(-2);
  if (!last) return null;
  const f = scoreFundamental(s, last.close, sector);
  const t = scoreTechnical(s.candles, s.snapshot);
  const r = scoreRisk(s.candles, s.actions, asOf, s.snapshot);
  const total = f.score * WEIGHTS.fundamental + t.score * WEIGHTS.technical + r.score * WEIGHTS.risk;
  return {
    symbol: s.company.symbol, name: s.company.name, sector: s.company.sector,
    price: last.close,
    changePct: prev ? (last.close / prev.close - 1) * 100 : s.snapshot?.prevClose ? (last.close / s.snapshot.prevClose - 1) * 100 : 0,
    total: Math.round(total), fundamental: Math.round(f.score), technical: Math.round(t.score), risk: Math.round(r.score),
    ...levels(last.close, r.atr ?? last.close * 0.03),
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

export function rankStocks(ds: DataSource): Pick[] {
  const stats = sectorStats(ds.stocks);
  return ds.stocks
    .map((s) => scoreStock(s, stats.get(s.company.sector) ?? { pe: null, pbv: null }, ds.asOf))
    .filter((p): p is Pick => p !== null)
    .sort((a, b) => Number(a.excluded) - Number(b.excluded) || b.total - a.total);
}

export function verdict(total: number): { label: string; tone: "good" | "ok" | "bad" } {
  if (total >= 70) return { label: "Strong buy candidate", tone: "good" };
  if (total >= 55) return { label: "Watchlist", tone: "ok" };
  return { label: "Avoid for now", tone: "bad" };
}
