import { r1 } from "./util";

export type RateDay = { date: string; rate: number };
export type MoneyCondition = { tight: boolean; rate: number; asOf: string };

// Backtest 2016-2026 (2-month hold): buys with the 30-day average interbank rate at 4-6% averaged -7.2% (-6.3% / -8.6% in each half), vs +1.6% at 2-4% and +6.5% under 2%.
export const TIGHT_RATE = 4;
const AVG_DAYS = 30;
// Older data than this says nothing about money today.
const MAX_STALE_DAYS = 120;

const minus = (d: string, n: number) => new Date(Date.parse(d) - n * 86_400_000).toISOString().slice(0, 10);

// Last index with date <= d in a date-sorted list, or -1.
function upTo(xs: RateDay[], d: string): number {
  let lo = 0, hi = xs.length - 1, ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (xs[m].date <= d) { ans = m; lo = m + 1; } else hi = m - 1;
  }
  return ans;
}

// Interbank conditions known on `asOf`: the average rate over the 30 days up to the latest reading; null without recent data.
export function moneyCondition(rates: RateDay[], asOf: string): MoneyCondition | null {
  const j = upTo(rates, asOf);
  if (j < 0 || rates[j].date < minus(asOf, MAX_STALE_DAYS)) return null;
  const from = minus(rates[j].date, AVG_DAYS);
  let sum = 0, n = 0;
  for (let i = j; i >= 0 && rates[i].date > from; i--) { sum += rates[i].rate; n++; }
  const rate = r1(sum / n);
  return { tight: rate >= TIGHT_RATE, rate, asOf: rates[j].date };
}

export const TIGHT_MONEY_NOTE = (rate: number) =>
  `Money is tight: banks are lending to each other at ${rate}% (30-day average). In the 2016-2026 backtest, buys at 4% or more lost money on average. Wait for rates to ease.`;
