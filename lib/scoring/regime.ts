import { sma } from "../indicators";
import type { Candle } from "../types";
import { median } from "./util";

export type Regime = "bull" | "neutral" | "bear";
export type MarketDay = { date: string; index: number; breadth: number; regime: Regime };

// Fewer stocks than this on a day is not a market reading.
const MIN_STOCKS = 20;

export function classify(index: number, sma50: number | null, sma200: number | null, breadth: number): Regime {
  if (sma50 === null) return "neutral";
  if (index < sma50 && breadth < 0.4) return "bear";
  if (index > sma50 && (sma200 === null || index > sma200) && breadth > 0.55) return "bull";
  return "neutral";
}

// Equal-weight market index (chained median daily return) and breadth (share of stocks above their 50-day average), per date.
export function marketSeries(series: Candle[][]): MarketDay[] {
  const byDate = new Map<string, { rets: number[]; above: number; n: number }>();
  for (const cs of series) {
    const s50 = sma(cs.map((c) => c.close), 50);
    for (let i = 1; i < cs.length; i++) {
      const d = byDate.get(cs[i].date) ?? byDate.set(cs[i].date, { rets: [], above: 0, n: 0 }).get(cs[i].date)!;
      d.rets.push(cs[i].close / cs[i - 1].close - 1);
      const avg = s50[i];
      if (avg != null) {
        d.n++;
        if (cs[i].close > avg) d.above++;
      }
    }
  }
  const dates = [...byDate.keys()].filter((d) => byDate.get(d)!.rets.length >= MIN_STOCKS).sort();
  let level = 1000;
  const index = dates.map((d) => (level *= 1 + (median(byDate.get(d)!.rets) ?? 0)));
  const i50 = sma(index, 50), i200 = sma(index, 200);
  return dates.map((date, i) => {
    const d = byDate.get(date)!;
    const breadth = d.n ? d.above / d.n : 0.5;
    return { date, index: index[i], breadth, regime: classify(index[i], i50[i], i200[i], breadth) };
  });
}

export const REGIME_LABEL: Record<Regime, string> = { bull: "Rising market", neutral: "Sideways market", bear: "Falling market" };
