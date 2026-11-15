import { describe, expect, it } from "vitest";
import { simulate } from "../backtest";
import { netPerShare } from "../costs";
import type { Candle, Pick } from "../types";
import { gradePick, gradePicks, marketChange, type SavedPick, summarizeTrack } from "./index";

const date = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
const day = (i: number, o: number, h: number, l: number, c: number): Candle => ({ date: date(i), open: o, high: h, low: l, close: c, volume: 1000 });
const flat = (n: number, p = 100) => Array.from({ length: n }, (_, i) => day(i, p, p + 1, p - 1, p));
const pick = (over: Partial<SavedPick> = {}): SavedPick => ({
  symbol: "ABC", sector: "Bank", asOf: date(0), price: 100, total: 70, signal: "ready",
  entryLow: 95, entryHigh: 100, stopLoss: 90, target: 120, ...over,
});

describe("gradePick", () => {
  it("matches the backtest's simulate() once a trade is finished", () => {
    const cases: Candle[][] = [flat(30), flat(30), flat(30)];
    cases[0][6] = day(6, 110, 125, 109, 121); // target
    cases[1][5] = day(5, 80, 82, 78, 80); // gap below the stop
    // cases[2] stays flat: time exit
    for (const cs of cases) {
      const s = simulate(cs, 0, { entryHigh: 100, stopLoss: 90, target: 120 } as Pick, 20, 3);
      const g = gradePick(pick(), cs, 20)!;
      expect(s && s.filled).toBeTruthy();
      if (!s || !s.filled) continue;
      expect([g.status, g.entry, g.exit, g.exitDate]).toEqual([s.outcome, s.entry, s.exit, cs[s.d].date]);
      expect(g.netPct).toBeCloseTo((netPerShare(s.entry, s.exit) / s.entry) * 100, 1);
    }
  });

  it("is waiting while the fill window is still open, and missed after it", () => {
    const high = (n: number) => Array.from({ length: n }, (_, i) => day(i, 110, 111, 109, 110));
    const cs = high(3);
    cs[0] = day(0, 100, 101, 99, 100);
    expect(gradePick(pick(), cs, 20)!.status).toBe("waiting");
    const later = [...cs, day(3, 110, 111, 109, 110)];
    expect(gradePick(pick(), later, 20)!.status).toBe("missed");
  });

  it("stays open with the latest close as the would-be exit", () => {
    const cs = flat(10);
    cs[9] = day(9, 104, 106, 103, 105);
    const g = gradePick(pick(), cs, 20)!;
    expect([g.status, g.exit, g.exitDate]).toEqual(["open", 105, date(9)]);
  });

  it("rescales saved levels when a bonus issue later adjusts the price history", () => {
    // Saved at a raw close of 200; history is now halved by a 100% bonus, so 200 shows as 100.
    const g = gradePick(pick({ price: 200, entryLow: 190, entryHigh: 200, stopLoss: 180, target: 240 }), flat(30), 20)!;
    expect(g.levels).toEqual({ entryLow: 95, entryHigh: 100, stopLoss: 90, target: 120 });
    expect(g.status).toBe("time");
  });
});

describe("gradePicks", () => {
  it("skips new picks of a stock while an earlier one is still held", () => {
    const cs = flat(40);
    const saved = [pick(), pick({ asOf: date(1) }), pick({ asOf: date(2) })];
    const g = gradePicks(saved, new Map([["ABC", cs]]), 20);
    expect(g.map((p) => p.asOf)).toEqual([date(0)]);
  });

  it("allows a new pick once the earlier one has closed", () => {
    const cs = flat(60);
    const g = gradePicks([pick(), pick({ asOf: date(30) })], new Map([["ABC", cs]]), 20);
    expect(g.map((p) => p.asOf)).toEqual([date(30), date(0)]);
  });
});

describe("marketChange and summarizeTrack", () => {
  it("takes the median stock's change", () => {
    const up = flat(5).map((c, i) => ({ ...c, close: i === 4 ? 110 : 100 }));
    const down = flat(5).map((c, i) => ({ ...c, close: i === 4 ? 90 : 100 }));
    const same = flat(5);
    expect(marketChange(new Map([["A", up], ["B", down], ["C", same]]), date(0), date(4))).toBe(0);
  });

  it("only counts finished trades in the win rate", () => {
    const cs = flat(30);
    cs[6] = day(6, 110, 125, 109, 121);
    const open = flat(10);
    const g = gradePicks([pick(), pick({ symbol: "XYZ" })], new Map([["ABC", cs], ["XYZ", open]]), 20);
    const s = summarizeTrack(g);
    expect([s.picks, s.closed, s.open, s.targets, s.winRate]).toEqual([2, 1, 1, 1, 1]);
  });
});
