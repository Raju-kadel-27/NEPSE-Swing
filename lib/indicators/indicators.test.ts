import { describe, it, expect } from "vitest";
import { sma, ema, rsi, atr } from "./index";

describe("indicators", () => {
  it("sma", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
  it("ema seeds with sma", () => {
    const r = ema([1, 2, 3, 4, 5], 3);
    expect(r[2]).toBe(2);
    expect(r[3]).toBeCloseTo(3, 10);
  });
  it("rsi is 100 on monotonic rise and 0 on monotonic fall", () => {
    const up = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(rsi(up)[19]).toBe(100);
    expect(rsi([...up].reverse())[19]).toBe(0);
  });
  it("atr on constant range", () => {
    const n = 20;
    const h = Array(n).fill(11), l = Array(n).fill(9), c = Array(n).fill(10);
    expect(atr(h, l, c)[n - 1]).toBeCloseTo(2, 10);
  });
});
