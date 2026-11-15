import type { Candle } from "../types";

// NEPSE's daily circuit is ±10%, so a bigger overnight drop is a bonus or right share adjustment, not a real move.
const CIRCUIT_DROP = 0.885;
// The exchange's previous close sits this far below the raw close only after an adjustment.
const ADJUSTED_PREV = 0.97;

// Price factor applied on day i (1 = no corporate action that day).
export function adjustmentFactor(prev: Candle, c: Candle): number {
  if (prev.close <= 0) return 1;
  if (c.prevClose && c.prevClose > 0 && c.prevClose < prev.close * ADJUSTED_PREV) return c.prevClose / prev.close;
  const open = c.open / prev.close, close = c.close / prev.close;
  if (close < CIRCUIT_DROP) return open < 0.9 ? open : close;
  return 1;
}

// Back-adjusts older candles for bonus and right shares so history has no fake crashes; volume scales the other way.
export function adjustCandles(candles: Candle[]): Candle[] {
  const out = candles.map((c) => ({ ...c }));
  let k = 1;
  for (let i = out.length - 1; i >= 0; i--) {
    if (k !== 1) {
      const c = out[i];
      c.open *= k; c.high *= k; c.low *= k; c.close *= k;
      c.volume = Math.round(c.volume / k);
      if (c.prevClose) c.prevClose *= k;
    }
    if (i > 0) k *= adjustmentFactor(candles[i - 1], candles[i]);
  }
  return out;
}
