// NEPSE trading costs for individual investors (SEBON broker tiers, SEBON levy, CDSC DP fee, short-term CGT).
const BROKER_TIERS: [upTo: number, rate: number][] = [
  [50_000, 0.0036], [500_000, 0.0033], [2_000_000, 0.0031], [10_000_000, 0.0027], [Infinity, 0.0024],
];
const MIN_COMMISSION = 10;
const SEBON_FEE = 0.00015;
const DP_FEE = 25;
// Listed shares held under 365 days; 5% after that.
export const CGT_SHORT = 0.075;

// Default trade size the per-share figures assume.
export const DEFAULT_TRADE_NPR = 100_000;

export function brokerage(amount: number): number {
  const rate = BROKER_TIERS.find(([upTo]) => amount <= upTo)![1];
  return Math.max(MIN_COMMISSION, amount * rate);
}

const fees = (amount: number) => brokerage(amount) + amount * SEBON_FEE;

// Net profit for a round trip after commission, SEBON fee, DP fee on the sell and CGT on a gain.
export function netProfit(buy: number, sell: number, qty: number): number {
  const cost = buy * qty + fees(buy * qty);
  const proceeds = sell * qty - fees(sell * qty) - DP_FEE;
  const gain = proceeds - cost;
  return gain > 0 ? gain * (1 - CGT_SHORT) : gain;
}

// Shares a trade of `budget` buys at `price` (at least one).
export const sharesFor = (price: number, budget = DEFAULT_TRADE_NPR) => Math.max(1, Math.floor(budget / price));

// Net profit or loss per share for a default-size trade.
export const netPerShare = (buy: number, sell: number, budget = DEFAULT_TRADE_NPR) => {
  const qty = sharesFor(buy, budget);
  return netProfit(buy, sell, qty) / qty;
};
