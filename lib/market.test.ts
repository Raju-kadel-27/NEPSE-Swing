import { describe, expect, it } from "vitest";
import { addTradingDays, tradeWindow } from "./market";
import { scoreRisk } from "./scoring/risk";
import type { Candle } from "./types";

describe("trading calendar", () => {
  it("skips Saturday and Sunday", () => {
    expect(addTradingDays("2026-11-13", 1)).toBe("2026-11-16"); // Fri -> Mon
    expect(addTradingDays("2026-11-16", 3)).toBe("2026-11-19"); // Mon -> Thu
  });
  it("buy Monday, sell from Thursday after Friday's data", () => {
    expect(tradeWindow("2026-11-13")).toEqual({ buyDate: "2026-11-16", sellableFrom: "2026-11-19" });
  });
  it("a Wednesday buy is sellable the next Monday", () => {
    expect(tradeWindow("2026-11-17")).toEqual({ buyDate: "2026-11-18", sellableFrom: "2026-11-23" });
  });
});

describe("settlement lock risk", () => {
  const series = (closes: number[]): Candle[] =>
    closes.map((c, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, open: c, high: c * 1.01, low: c * 0.99, close: c, volume: 100_000 }));

  it("flags and penalises a 5-day spike", () => {
    const calm = scoreRisk(series([...Array(25).fill(100), 100, 101, 101, 102, 102]), []);
    const spike = scoreRisk(series([...Array(25).fill(100), 100, 104, 108, 112, 116]), []);
    expect(spike.flags.some((f) => f.includes("pullback is likely"))).toBe(true);
    expect(calm.flags.some((f) => f.includes("pullback is likely"))).toBe(false);
    expect(spike.score).toBeLessThan(calm.score);
  });
  it("uses the previous close when only one day of history exists", () => {
    const r = scoreRisk(series([107]), [], { prevClose: 100 });
    expect(r.flags.some((f) => f.includes("Up 7% in 1 day"))).toBe(true);
    expect(r.lockMovePct).not.toBeNull();
  });
});
