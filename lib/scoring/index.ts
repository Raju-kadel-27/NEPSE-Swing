import { netPerShare } from "../costs";
import { DEFAULT_HORIZON, type Horizon, HORIZONS } from "../horizon";
import { tradeWindow } from "../market";
import type { DataSource, Pick, StockData } from "../types";
import { scoreFundamental, type SectorStats, valuation } from "./fundamental";
import { resultsInfo } from "../results";
import { accumulation } from "./accumulation";
import { bearishWarnings } from "./warnings";
import { planEntry } from "./entry";
import { type MoneyCondition, moneyCondition } from "./money";
import { type MarketDay, marketSeries, type Regime } from "./regime";
import { scoreRisk } from "./risk";
import { scoreTechnical } from "./technical";
import { median, r1 } from "./util";


// Backtest: buys under this price beat pricier ones in both 2016-21 (+5.3% vs +1.0%) and 2022-26 (+1.0% vs -1.8%) per 2-month trade.
export const PREFERRED_MAX_PRICE = 500;
const PRICEY_FLAG = `Priced above Rs ${PREFERRED_MAX_PRICE}: in the backtest, buys at these prices did worse (-1.8% vs +1.0% per 2-month trade in 2022-26)`;
export const isPreferredPrice = (p: Pick) => p.price < PREFERRED_MAX_PRICE;

// Price change (%) since the last close at least a year before the latest one; null with less than a year of history.
export function change1y(candles: StockData["candles"]): number | null {
  const last = candles.at(-1);
  if (!last) return null;
  const cutoff = new Date(Date.parse(last.date) - 365 * 86_400_000).toISOString().slice(0, 10);
  const then = candles.findLast((c) => c.date <= cutoff);
  return then ? r1((last.close / then.close - 1) * 100) : null;
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

// `fundamental` overrides the fundamental score (the backtest has no past reports, so it uses a neutral value).
export type ScoreOptions = { regime?: Regime; fundamental?: number; money?: MoneyCondition | null };

export function scoreStock(s: StockData, sector: SectorStats, asOf: string, horizon: Horizon = HORIZONS[DEFAULT_HORIZON], opts: ScoreOptions = {}): Pick | null {
  const last = s.candles.at(-1), prev = s.candles.at(-2);
  if (!last) return null;
  const f = scoreFundamental(s, last.close, sector);
  const t = scoreTechnical(s.candles, s.snapshot);
  const r = scoreRisk(s.candles, s.actions, s.snapshot);
  const w = horizon.weights;
  const fScore = opts.fundamental ?? f.score;
  const total = Math.round(fScore * w.fundamental + t.score * w.technical + r.score * w.risk);
  const warnings = bearishWarnings(s.candles);
  const entry = planEntry({
    warnings,
    candles: s.candles, snap: s.snapshot, atr: r.atr ?? last.close * 0.03, total, excluded: r.excluded, spiked: r.spiked,
    days: horizon.days, targetCap: horizon.targetCap, stopAtr: horizon.stopAtr, regime: opts.regime,
    tightMoneyRate: opts.money?.tight ? opts.money.rate : undefined,
  });
  const gain = entry.target - entry.entryHigh, risk = entry.entryHigh - entry.stopLoss;
  return {
    symbol: s.company.symbol, name: s.company.name, sector: s.company.sector,
    price: last.close,
    changePct: prev ? (last.close / prev.close - 1) * 100 : s.snapshot?.prevClose ? (last.close / s.snapshot.prevClose - 1) * 100 : 0,
    total, fundamental: Math.round(fScore), technical: Math.round(t.score), risk: Math.round(r.score),
    ...entry,
    gainPerUnit: r1(gain), riskPerUnit: r1(risk), rewardRisk: risk > 0 ? r1(gain / risk) : 0,
    netGainPerUnit: r1(netPerShare(entry.entryHigh, entry.target)), netRiskPerUnit: r1(-netPerShare(entry.entryHigh, entry.stopLoss)),
    ...tradeWindow(asOf),
    lockMovePct: r.lockMovePct === null ? null : r1(r.lockMovePct * 100),
    reasons: [...f.reasons, ...t.reasons, ...r.reasons],
    flags: [...warnings, ...f.flags, ...t.flags, ...r.flags, ...(last.close >= PREFERRED_MAX_PRICE ? [PRICEY_FLAG] : [])],
    excluded: r.excluded,
    results: { ...resultsInfo(asOf, s.latestReport ?? { fiscalYear: null, quarter: null }), seenOn: s.latestReport?.seenOn ?? null },
    accumulation: accumulation(s.candles),
    metrics: {
      pe: f.pe, pbv: f.pbv, roe: f.roe, epsGrowthYoY: f.epsGrowthYoY, eps: s.quarters.at(-1)?.eps ?? null, change1y: change1y(s.candles),
      rsi: t.rsi, sma50: t.sma50, sma200: t.sma200, avg120: t.avg120, avg180: t.avg180, avgTurnover: r.avgTurnover, atrPct: r.atrPct,
    },
  };
}

// Market regime on the latest date, or null while history is too short to tell.
export function marketToday(ds: DataSource): MarketDay | null {
  const last = marketSeries(ds.stocks.map((s) => s.candles)).at(-1);
  return last && last.date === ds.asOf ? last : null;
}

export function rankStocks(ds: DataSource, horizon: Horizon = HORIZONS[DEFAULT_HORIZON], market: MarketDay | null = marketToday(ds)): Pick[] {
  const stats = sectorStats(ds.stocks);
  const money = moneyCondition(ds.rates, ds.asOf);
  return ds.stocks
    .map((s) => scoreStock(s, stats.get(s.company.sector) ?? { pe: null, pbv: null }, ds.asOf, horizon, { regime: market?.regime, money }))
    .filter((p): p is Pick => p !== null)
    .sort((a, b) => Number(a.excluded) - Number(b.excluded) || b.total - a.total);
}

// Actionable today: a decent score and a price at a sensible entry.
export const isBuyableToday = (p: Pick) => (p.signal === "ready" || p.signal === "breakout") && p.total >= 60;

// The same data as of the previous trading day, for spotting what changed today.
export function previousDay(ds: DataSource): DataSource | null {
  const dates = new Set(ds.stocks.map((s) => s.candles.at(-2)?.date).filter(Boolean));
  const prev = [...dates].sort().at(-1) as string | undefined;
  if (!prev) return null;
  const stocks = ds.stocks
    .filter((s) => s.candles.at(-2)?.date === prev)
    .map((s) => ({ ...s, candles: s.candles.slice(0, -1), snapshot: { ...s.snapshot, prevClose: s.candles.at(-3)?.close } }));
  return { ...ds, stocks, asOf: prev };
}

// Within this % above the buy zone counts as "about to enter".
export const NEAR_ZONE_PCT = 2;

// Stocks that became buyable today, and good ones a small dip away from their zone.
export function zoneChanges(today: Pick[], yesterday: Pick[]) {
  const before = new Map(yesterday.map((p) => [p.symbol, p]));
  return {
    entered: today.filter((p) => isBuyableToday(p) && before.has(p.symbol) && !isBuyableToday(before.get(p.symbol)!)),
    near: today.filter((p) => p.signal === "wait" && p.total >= 60 && p.aboveZonePct > 0 && p.aboveZonePct <= NEAR_ZONE_PCT),
  };
}
