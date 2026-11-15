import { describe, expect, it } from "vitest";
import { brokerage, netProfit } from "../costs";
import { classify } from "../scoring/regime";
import type { Candle, Pick } from "../types";
import { simulate, summarize, type Trade } from "./index";

const day = (i: number, o: number, h: number, l: number, c: number): Candle => ({ date: `2025-01-${String(i + 1).padStart(2, "0")}`, open: o, high: h, low: l, close: c, volume: 1000 });
const flat = (n: number, p = 100) => Array.from({ length: n }, (_, i) => day(i, p, p + 1, p - 1, p));
const plan = { entryHigh: 100, stopLoss: 90, target: 120 } as Pick;

describe("simulate", () => {
  it("can't exit before T+3 even if the stop is hit on day 1", () => {
    const cs = flat(30);
    cs[2] = day(2, 100, 101, 85, 95); // filled on day 1, crash on day 2 while locked
    cs[3] = day(3, 95, 96, 94, 95);
    const r = simulate(cs, 0, plan, 20, 3);
    expect(r && r.filled && r.outcome).toBe("time");
  });

  it("counts a day that touches both stop and target as stopped", () => {
    const cs = flat(30);
    cs[4] = day(4, 100, 125, 85, 110);
    const r = simulate(cs, 0, plan, 20, 3);
    expect(r && r.filled && [r.outcome, r.exit]).toEqual(["stop", 90]);
  });

  it("exits a gap below the stop at the open, not the stop price", () => {
    const cs = flat(30);
    cs[5] = day(5, 80, 82, 78, 80);
    const r = simulate(cs, 0, plan, 20, 3);
    expect(r && r.filled && r.exit).toBe(80);
  });

  it("does not fill when price never comes down to the zone", () => {
    const r = simulate(flat(30, 110), 0, plan, 20, 3);
    expect(r && r.filled).toBe(false);
  });
});

describe("costs", () => {
  it("applies the broker tier and minimum", () => {
    expect(brokerage(1000)).toBe(10);
    expect(brokerage(100_000)).toBeCloseTo(330);
  });
  it("takes CGT from gains only", () => {
    const win = netProfit(100, 120, 100), loss = netProfit(100, 90, 100);
    expect(win).toBeLessThan(2000 * 0.925);
    expect(win).toBeGreaterThan(1500);
    expect(loss).toBeLessThan(-1000);
  });
});

describe("regime", () => {
  it("is bear below the 50-day average with weak breadth and bull above both with strong breadth", () => {
    expect(classify(90, 100, 95, 0.3)).toBe("bear");
    expect(classify(110, 100, 95, 0.7)).toBe("bull");
    expect(classify(110, 100, 95, 0.45)).toBe("neutral");
  });
});

describe("summarize", () => {
  it("computes win rate and losing streak", () => {
    const t = (d: string, net: number) => ({ fillDate: d, netPerShare: net, netPct: net, outcome: net > 0 ? "target" : "stop" }) as Trade;
    const s = summarize([t("2025-01-01", 5), t("2025-01-02", -2), t("2025-01-03", -3), t("2025-01-04", 4)]);
    expect(s.winRate).toBe(0.5);
    expect(s.worstLosingStreak).toBe(2);
  });
});
