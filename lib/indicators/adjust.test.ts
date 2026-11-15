import { describe, expect, it } from "vitest";
import { parseHistoryCsv } from "../ingest/history";
import type { Candle } from "../types";
import { adjustCandles, adjustmentFactor } from "./adjust";

const c = (date: string, close: number, extra: Partial<Candle> = {}): Candle => ({ date, open: close, high: close, low: close, close, volume: 100, ...extra });

describe("adjustCandles", () => {
  it("uses the exchange's adjusted previous close for a bonus day", () => {
    // 25% bonus: 1250 -> 1000 adjusted prev, closed 1010 (+1%).
    const out = adjustCandles([c("2024-01-01", 1250), c("2024-01-02", 1250), c("2024-01-03", 1010, { prevClose: 1000 })]);
    expect(out.map((x) => x.close)).toEqual([1000, 1000, 1010]);
    expect(out[0].volume).toBe(125);
  });

  it("treats a drop beyond the ±10% circuit as an adjustment when no adjusted close is known", () => {
    const out = adjustCandles([c("2016-01-01", 2000), c("2016-01-02", 1500, { open: 1500 })]);
    expect(out[0].close).toBeCloseTo(1500);
  });

  it("leaves real moves inside the circuit alone", () => {
    const out = adjustCandles([c("2024-01-01", 100), c("2024-01-02", 91, { prevClose: 100 })]);
    expect(out[0].close).toBe(100);
    expect(adjustmentFactor(c("a", 100), c("b", 91))).toBe(1);
  });
});

describe("parseHistoryCsv", () => {
  const csv = `published_date,open,high,low,close,per_change,traded_quantity,traded_amount,status
2015-12-31,10,11,9,10,nan,5,50,0
2024-01-01,100,105,99,104,4.0,1000,104000,1
2024-01-01,100,105,99,104,4.0,1000,104000,1
2024-01-02,800,810,790,805,0.63,10,8050,1`;

  it("dedupes dates, skips rows before `since` and derives the previous close from per_change", () => {
    const rows = parseHistoryCsv(csv, "2016-01-01");
    expect(rows.map((r) => r.date)).toEqual(["2024-01-01", "2024-01-02"]);
    expect(rows[0].prevClose).toBeCloseTo(100);
    expect(rows[0].volume).toBe(1000);
  });
});
