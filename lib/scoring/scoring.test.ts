import { describe, expect, it } from "vitest";
import type { Candle, StockData } from "../types";
import { accumulation } from "./accumulation";
import { bearishWarnings } from "./warnings";
import { lowerHighs, planEntry } from "./entry";
import { change1y, rankStocks } from "./index";
import { scoreFundamental } from "./fundamental";
import { MIN_TURNOVER, scoreRisk } from "./risk";
import { scoreTechnical } from "./technical";
import { r1, scale } from "./util";

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

describe("planEntry", () => {
  const one = (close: number, volume = 50_000): Candle[] => [{ date: "2026-11-13", open: close, high: close, low: close, close, volume }];
  const base = { atr: 4, total: 75, excluded: false, spiked: false };

  it("is ready when price sits just above support, with the zone anchored to support", () => {
    const e = planEntry({ ...base, candles: one(102), snap: { avg120: 100, avg180: 90 } });
    expect(e.signal).toBe("ready");
    expect([e.entryLow, e.entryHigh]).toEqual([100, 104]);
    expect(e.supportLabel).toBe("120-day average");
    expect(e.stopLoss).toBe(96); // min(100 - 4, 104 - 8)
    expect(e.target).toBe(120); // zone top 104 + 2 * 8
  });
  it("waits when price is above the zone and says how far", () => {
    const e = planEntry({ ...base, candles: one(110), snap: { avg120: 100, avg180: 90 } });
    expect(e.signal).toBe("wait");
    expect(e.aboveZonePct).toBeCloseTo(5.8, 1);
  });
  it("waits after a spike even inside the zone", () => {
    expect(planEntry({ ...base, spiked: true, candles: one(102), snap: { avg120: 100 } }).signal).toBe("wait");
  });
  it("is not yet when price is below every support", () => {
    const e = planEntry({ ...base, candles: one(90), snap: { avg120: 100, avg180: 105 } });
    expect(e.signal).toBe("not_yet");
    expect(e.note).toMatch(/120-day average/);
  });
  it("flags a breakout at a new high on heavy volume", () => {
    const e = planEntry({ ...base, candles: one(120, 30_000), snap: { avg120: 100, high52: 120, avgVolume30: 10_000 } });
    expect(e.signal).toBe("breakout");
  });
  it("avoids low scores and illiquid stocks regardless of price", () => {
    expect(planEntry({ ...base, total: 50, candles: one(102), snap: { avg120: 100 } }).signal).toBe("avoid");
    expect(planEntry({ ...base, excluded: true, candles: one(102), snap: { avg120: 100 } }).signal).toBe("avoid");
  });
  it("caps the target at +35% of the zone top", () => {
    const e = planEntry({ ...base, atr: 20, candles: one(102), snap: { avg120: 100 } });
    expect(e.target).toBe(r1(120 * 1.35));
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

describe("lowerHighs", () => {
  const bar = (h: number, i: number): Candle => ({ date: `2026-02-${String((i % 28) + 1).padStart(2, "0")}`, open: h - 2, high: h, low: h - 4, close: h - 1, volume: 1000 });
  it("finds a peak below the 52-week high and ignores the high itself", () => {
    const highs = [250, 270, 290, 312, 300, 280, 260, 250, 260, 275, 288, 275, 262, 255, 250, 248, 252, 255, 258, 260, 262];
    const lh = lowerHighs(highs.map(bar), 120, 3);
    expect(lh).toContain(288);
    expect(lh).not.toContain(312);
  });
  it("sets firstTarget to a lower high between the zone and the target", () => {
    // Zone 100-104, target 120; a single peak at 114 sits in between, the 140 top does not.
    const highs = [140, ...Array(10).fill(104), 108, 111, 114, 110, 107, ...Array(10).fill(104)];
    const e = planEntry({ atr: 4, total: 75, excluded: false, spiked: false, candles: highs.map(bar), snap: { avg120: 100 } });
    expect([e.entryHigh, e.target]).toEqual([104, 120]);
    expect(e.firstTarget).toBe(114);
  });
});

describe("accumulation", () => {
  const mk = (closes: number[], vols: number[]): Candle[] => closes.map((c, i) => ({ date: `d${i}`, open: c, high: c * 1.01, low: c * 0.99, close: c, volume: vols[i] }));
  it("flags a steady rise on double volume and ignores a quiet market", () => {
    const flat = Array(60).fill(100);
    const rising = Array.from({ length: 10 }, (_, i) => 100 + (i + 1) * 0.6);
    const hit = accumulation(mk([...flat, ...rising], [...Array(60).fill(1000), ...Array(10).fill(3000)]));
    expect(hit?.volRatio).toBeGreaterThanOrEqual(1.5);
    expect(hit?.ret10Pct).toBeCloseTo(6, 0);
    expect(accumulation(mk([...flat, ...rising], Array(70).fill(1000)))).toBeNull();
  });
  it("ignores a spike, which is not quiet buying", () => {
    const closes = [...Array(65).fill(100), 100, 100, 100, 100, 109];
    expect(accumulation(mk(closes, [...Array(60).fill(1000), ...Array(10).fill(3000)]))).toBeNull();
  });
});

describe("bearishWarnings", () => {
  const mk = (closes: number[], vols?: number[]): Candle[] => closes.map((c, i) => ({ date: `d${i}`, open: c, high: c, low: c, close: c, volume: vols?.[i] ?? 1000 }));
  it("flags a recent lower circuit and blocks the buy signal", () => {
    const closes = [...Array(70).fill(100), 89, 90];
    expect(bearishWarnings(mk(closes))[0]).toMatch(/-10% lower circuit 1 trading day ago/);
    const e = planEntry({ atr: 4, total: 75, excluded: false, spiked: false, candles: mk(closes), snap: { avg120: 88 }, warnings: bearishWarnings(mk(closes)) });
    expect(e.signal).toBe("not_yet");
  });
  it("flags heavy selling volume and stays quiet on a calm stock", () => {
    const closes = [...Array(60).fill(100), ...Array.from({ length: 10 }, (_, i) => 99 - i * 0.5)];
    expect(bearishWarnings(mk(closes, [...Array(60).fill(1000), ...Array(10).fill(3000)])).join(" ")).toMatch(/Heavy selling/);
    expect(bearishWarnings(mk(Array(80).fill(100)))).toEqual([]);
  });
});

describe("change1y", () => {
  it("measures from the last close at least a year back, and needs a year of history", () => {
    const cs = (pairs: [string, number][]): Candle[] => pairs.map(([date, close]) => ({ date, open: close, high: close, low: close, close, volume: 1 }));
    expect(change1y(cs([["2025-11-12", 100], ["2025-11-14", 104], ["2026-11-13", 115]]))).toBe(15);
    expect(change1y(cs([["2026-01-01", 100], ["2026-11-13", 115]]))).toBeNull();
  });
});
