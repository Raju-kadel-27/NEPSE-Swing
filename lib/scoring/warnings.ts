import { sma } from "../indicators";
import type { Candle } from "../types";

// Bearish signals that, in the 2016-2026 backtest, marked buys that lost money (about -1% to -1.7% per trade vs +1% for the rest).
export function bearishWarnings(candles: Candle[]): string[] {
  const n = candles.length;
  const out: string[] = [];
  if (n < 61) return out;
  const c = candles.map((x) => x.close), v = candles.map((x) => x.volume);
  const i = n - 1;

  for (let d = 0; d < 10; d++) {
    if (c[i - d] / c[i - d - 1] - 1 <= -0.095) {
      out.push(`Hit the -10% lower circuit ${d === 0 ? "today" : `${d} trading day${d === 1 ? "" : "s"} ago`}: panic selling tends to continue`);
      break;
    }
  }

  if (n >= 221) {
    const s50 = sma(c, 50), s200 = sma(c, 200);
    for (let d = 0; d < 20; d++) {
      if (s50[i - d - 1]! >= s200[i - d - 1]! && s50[i - d]! < s200[i - d]!) {
        out.push("Death cross: the 50-day average fell below the 200-day average in the last 4 weeks");
        break;
      }
    }
  }

  const v10 = v.slice(i - 9).reduce((a, b) => a + b, 0) / 10, v60 = v.slice(i - 59).reduce((a, b) => a + b, 0) / 60;
  let down = 0, total = 0;
  for (let j = i - 9; j <= i; j++) {
    total += v[j];
    if (c[j] < c[j - 1]) down += v[j];
  }
  if (v60 > 0 && total > 0 && v10 / v60 >= 1.5 && down / total >= 0.55) {
    out.push(`Heavy selling: volume ${Math.round((v10 / v60) * 10) / 10}x normal with ${Math.round((down / total) * 100)}% of it on down days`);
  }
  return out;
}
