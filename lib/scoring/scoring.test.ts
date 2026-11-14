import { describe, expect, it } from "vitest";
import type { Candle, StockData } from "../types";
import { levels, rankStocks } from "./index";
import { scoreFundamental } from "./fundamental";
import { MIN_TURNOVER, scoreRisk } from "./risk";
import { scoreTechnical } from "./technical";
import { scale } from "./util";

const candles = (closes: number[], volume = 50_000): Candle[] =>
  closes.map((c, i) => ({ date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, open: c, high: c * 1.01, low: c * 0.99, close: c, volume }));

const stock = (over: Partial<StockData> = {}): StockData => ({
  company: { symbol: "TEST", name: "Test", sector: "Commercial Banks" },
  candles: candles(Array.from({ length: 260 }, (_, i) => 100 + i * 0.2)),
  quarters: [
    { fiscalYear: "081/82", quarter: 1, eps: 10, netWorthPerShare: 120, roe: 8, npl: 2, car: 13, netProfit: 1 },
    { fiscalYear: "082/83", quarter: 1, eps: 13, netWorthPerShare: 125, roe: 16, npl: 1.5, car: 14, netProfit: 1 },
  ],
  actions: [{ fiscalYear: "081/82", cashDividendPct: 5, bonusPct: 10 }],
  ...over,
});

describe("scale", () => {
  it("maps both directions and clamps", () => {
    expect(scale(5, 0, 10)).toBe(50);
    expect(scale(5, 10, 0)).toBe(50);
    expect(scale(20, 0, 10)).toBe(100);
    expect(scale(-1, 0, 10)).toBe(0);
  });
});

describe("fundamental", () => {
  it("rewards growth, cheap valuation and clean books", () => {
    const f = scoreFundamental(stock(), 150, { pe: 18, pbv: 1.6 });
    expect(f.epsGrowthYoY).toBeCloseTo(0.3);
    expect(f.score).toBeGreaterThan(80);
    expect(f.reasons.join(" ")).toMatch(/EPS up 30%/);
  });
  it("penalises loss-making companies", () => {
    const s = stock({ quarters: [{ fiscalYear: "082/83", quarter: 1, eps: -2, netWorthPerShare: 90, roe: -2, netProfit: -1 }] });
    const f = scoreFundamental(s, 150, { pe: 18, pbv: 1.6 });
    expect(f.pe).toBeNull();
    expect(f.flags).toContain("Loss-making or zero EPS");
  });
});

describe("technical", () => {
  it("scores a steady uptrend higher than a downtrend", () => {
    const up = scoreTechnical(candles(Array.from({ length: 260 }, (_, i) => 100 + i * 0.3 + Math.sin(i) * 2)));
    const down = scoreTechnical(candles(Array.from({ length: 260 }, (_, i) => 200 - i * 0.3 + Math.sin(i) * 2)));
    expect(up.score).toBeGreaterThan(down.score);
    expect(down.flags.join(" ")).toMatch(/Downtrend/);
  });
});

describe("risk", () => {
  it("excludes illiquid stocks", () => {
    const r = scoreRisk(candles(Array(100).fill(100), 100), [], "2026-11-12");
    expect(r.avgTurnover).toBeLessThan(MIN_TURNOVER);
    expect(r.excluded).toBe(true);
  });
  it("flags upcoming book closure and right shares", () => {
    const r = scoreRisk(candles(Array(100).fill(100)), [{ fiscalYear: "x", cashDividendPct: 0, bonusPct: 10, bookClosureDate: "2026-12-01", rightRatio: "1:1" }], "2026-11-12");
    expect(r.flags.some((f) => f.includes("Book closure"))).toBe(true);
    expect(r.flags.some((f) => f.includes("Right share"))).toBe(true);
  });
});

describe("levels", () => {
  it("puts stop below and target at 2R above", () => {
    expect(levels(100, 4)).toEqual({ entryLow: 98, entryHigh: 101, stopLoss: 90, target: 120 });
  });
  it("caps target at +35%", () => {
    expect(levels(100, 10).target).toBe(135);
  });
});

describe("rankStocks", () => {
  it("puts excluded stocks last", () => {
    const thin = stock({ company: { symbol: "THIN", name: "Thin", sector: "Commercial Banks" }, candles: candles(Array.from({ length: 260 }, (_, i) => 100 + i * 0.2), 10) });
    const ranked = rankStocks({ stocks: [thin, stock()], isDemo: true, asOf: "2026-11-12", historyDays: 260 });
    expect(ranked.at(-1)?.symbol).toBe("THIN");
    expect(ranked.at(-1)?.excluded).toBe(true);
  });
});
