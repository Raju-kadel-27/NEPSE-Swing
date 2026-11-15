import { describe, expect, it } from "vitest";
import { financialTrend } from "./fundamental";
import { planEntry } from "./entry";
import { moneyCondition, type RateDay } from "./money";

const days = (from: string, n: number, rate: (i: number) => number): RateDay[] =>
  Array.from({ length: n }, (_, i) => ({ date: new Date(Date.parse(from) + i * 86_400_000).toISOString().slice(0, 10), rate: rate(i) }));

describe("moneyCondition", () => {
  it("averages the 30 days up to the latest reading on or before the date", () => {
    const rates = days("2026-01-01", 60, (i) => (i < 30 ? 2 : 5));
    expect(moneyCondition(rates, "2026-03-01")).toEqual({ tight: true, rate: 5, asOf: "2026-03-01" });
    expect(moneyCondition(rates, "2026-01-20")).toEqual({ tight: false, rate: 2, asOf: "2026-01-20" });
  });
  it("is null without data or when the latest reading is too old", () => {
    expect(moneyCondition([], "2026-03-01")).toBeNull();
    expect(moneyCondition(days("2025-01-01", 10, () => 6), "2026-03-01")).toBeNull();
  });
  it("ignores readings after the date (no look-ahead)", () => {
    const rates = days("2026-01-01", 60, (i) => (i < 40 ? 3 : 9));
    expect(moneyCondition(rates, "2026-02-09")!.tight).toBe(false);
  });
});

describe("tight money gate", () => {
  const c = [{ date: "2026-11-13", open: 102, high: 102, low: 102, close: 102, volume: 50_000 }];
  const base = { atr: 4, total: 80, excluded: false, spiked: false, candles: c, snap: { avg120: 100 } };
  it("turns a buy into not yet while money is tight, whatever the score", () => {
    expect(planEntry(base).signal).toBe("ready");
    const e = planEntry({ ...base, tightMoneyRate: 4.6 });
    expect(e.signal).toBe("not_yet");
    expect(e.note).toMatch(/4.6%/);
  });
});

describe("financialTrend", () => {
  const q = (fiscalYear: string, quarter: number, eps: number, netWorthPerShare = 100) => ({ fiscalYear, quarter, eps, netWorthPerShare, roe: 10 });
  it("matches each quarter to the same quarter a year earlier", () => {
    const t = financialTrend([q("081/82", 1, 10, 100), q("081/82", 2, 10), q("082/83", 1, 12), q("082/83", 2, 15, 112)]);
    expect(t.epsGrowth.map((x) => Math.round(x * 100))).toEqual([20, 50]);
    expect(t.bookGrowth).toBeCloseTo(0.12);
  });
  it("is empty with a single year of quarters", () => {
    expect(financialTrend([q("082/83", 1, 10), q("082/83", 2, 11)])).toEqual({ epsGrowth: [], bookGrowth: null });
  });
});
