import { sma } from "../indicators";
import type { Candle } from "../types";

export type Accumulation = { volRatio: number; ret10Pct: number; upVolPct: number };

// Quiet accumulation: volume well above normal, a steady rise with no spike, most volume on up days, above the 20-day average.
// Backtest 2016-2026: beat the market by ~1.1-1.4% over the next 40 trading days on average, but only ~47% of signals did.
export function accumulation(candles: Candle[]): Accumulation | null {
  const n = candles.length;
  if (n < 61) return null;
  const c = candles.map((x) => x.close), v = candles.map((x) => x.volume);
  const i = n - 1;
  const avg = (from: number) => v.slice(from, n).reduce((a, b) => a + b, 0) / (n - from);
  const vol10 = avg(n - 10), vol60 = avg(n - 60);
  if (vol60 <= 0) return null;
  const ret10 = c[i] / c[i - 10] - 1;
  let up = 0, tot = 0, biggest = 0;
  for (let j = i - 9; j <= i; j++) {
    tot += v[j];
    if (c[j] > c[j - 1]) up += v[j];
    biggest = Math.max(biggest, Math.abs(c[j] / c[j - 1] - 1));
  }
  const s20 = sma(c, 20).at(-1);
  const ok = vol10 / vol60 >= 1.5 && ret10 >= 0.03 && ret10 <= 0.12 && tot > 0 && up / tot >= 0.6 && s20 != null && c[i] > s20 && biggest < 0.08;
  return ok ? { volRatio: Math.round((vol10 / vol60) * 10) / 10, ret10Pct: Math.round(ret10 * 1000) / 10, upVolPct: Math.round((up / tot) * 100) } : null;
}
