import type { Signal } from "./scoring/entry";

export type Candle ={ date: string; open: number; high: number; low: number; close: number; volume: number; turnover?: number };
export type Quarter = { fiscalYear: string; quarter: number; eps: number; netWorthPerShare: number; roe: number; npl?: number; car?: number; netProfit?: number };
export type Action = { fiscalYear: string; cashDividendPct: number; bonusPct: number; bookClosureDate?: string; rightRatio?: string };
export type Company = { symbol: string; name: string; sector: string };

// Rolling stats published by the source, used until enough daily candles have been collected.
export type Snapshot = { prevClose?: number; avg120?: number; avg180?: number; high52?: number; low52?: number; avgVolume30?: number };

export type StockData = { company: Company; candles: Candle[]; quarters: Quarter[]; actions: Action[]; snapshot?: Snapshot };

export type Metrics = {
  pe: number | null; pbv: number | null; roe: number | null; epsGrowthYoY: number | null;
  rsi: number | null; sma50: number | null; sma200: number | null; avg120: number | null; avg180: number | null; avgTurnover: number | null; atrPct: number | null;
};
export type Pick = {
  symbol: string; name: string; sector: string; price: number; changePct: number;
  total: number; fundamental: number; technical: number; risk: number;
  // Entry timing: buy zone anchored to support, with the stop under it.
  signal: Signal; note: string; aboveZonePct: number;
  support: number | null; supportLabel: string | null; resistance: number | null;
  entryLow: number; entryHigh: number; stopLoss: number; target: number;
  // Next session to buy in, first day those shares can be sold, and the typical move (%) in between.
  buyDate: string; sellableFrom: string; lockMovePct: number | null;
  reasons: string[]; flags: string[]; excluded: boolean; metrics: Metrics;
};
export type DataSource = { stocks: StockData[]; isDemo: boolean; asOf: string; historyDays: number };
