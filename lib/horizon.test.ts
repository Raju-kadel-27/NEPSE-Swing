import { describe, expect, it } from "vitest";
import { DEFAULT_HORIZON, daysToExit, HORIZON_KEYS, HORIZONS, horizonQuery, parseHorizon } from "./horizon";
import { planEntry } from "./scoring/entry";
import type { Candle } from "./types";

describe("horizons", () => {
  it("weights add up to 1 for every horizon", () => {
    for (const k of HORIZON_KEYS) {
      const w = HORIZONS[k].weights;
      expect(w.fundamental + w.technical + w.risk).toBeCloseTo(1, 10);
    }
  });
  it("short holds lean on trend, long holds on company quality", () => {
    expect(HORIZONS["1w"].weights.technical).toBeGreaterThan(HORIZONS["1w"].weights.fundamental);
    expect(HORIZONS["3m"].weights.fundamental).toBeGreaterThan(HORIZONS["3m"].weights.technical);
  });
  it("parses the query param and falls back to the default", () => {
    expect(parseHorizon("1W").key).toBe("1w");
    expect(parseHorizon(["15d"]).key).toBe("15d");
    expect(parseHorizon("bogus").key).toBe(DEFAULT_HORIZON);
    expect(parseHorizon(undefined).key).toBe(DEFAULT_HORIZON);
  });
  it("omits the query for the default horizon", () => {
    expect(horizonQuery(HORIZONS[DEFAULT_HORIZON])).toBe("");
    expect(horizonQuery(HORIZONS["30d"])).toBe("?h=30d");
  });
  it("a 1-week hold leaves 2 trading days to exit after T+3", () => {
    expect(daysToExit(HORIZONS["1w"])).toBe(2);
  });
});

describe("targets scale with the holding period", () => {
  const candles: Candle[] = [{ date: "2026-11-13", open: 102, high: 102, low: 102, close: 102, volume: 50_000 }];
  const plan = (k: keyof typeof HORIZONS) =>
    planEntry({ candles, snap: { avg120: 100 }, atr: 4, total: 75, excluded: false, spiked: false, days: HORIZONS[k].days, targetCap: HORIZONS[k].targetCap, stopAtr: HORIZONS[k].stopAtr });

  it("gives a 1-week hold a tighter stop and smaller target than a 3-month hold", () => {
    const week = plan("1w"), quarter = plan("3m");
    expect(week.stopLoss).toBeGreaterThan(quarter.stopLoss);
    expect(week.target).toBeLessThan(quarter.target);
    expect(week.target).toBeLessThanOrEqual(104 * 1.08); // capped at +8% for 1 week
  });
  it("stops widen and targets grow as the holding period gets longer", () => {
    const plans = HORIZON_KEYS.map(plan);
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].target).toBeGreaterThanOrEqual(plans[i - 1].target);
      expect(plans[i].stopLoss).toBeLessThanOrEqual(plans[i - 1].stopLoss);
    }
  });
});
