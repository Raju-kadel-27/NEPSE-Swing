import { netPerShare } from "../costs";
import { type Features, features } from "../model/features";
import type { Horizon } from "../horizon";
import { SELLABLE_AFTER_TRADING_DAYS } from "../market";
import { BEAR_MIN_SCORE } from "../scoring/entry";
import { scoreStock } from "../scoring";
import type { MarketDay } from "../scoring/regime";
import type { Candle, Pick, StockData } from "../types";

// Candles each replayed day sees, about what the live pages load; and days needed before the first signal.
const WINDOW = 300;
export const WARMUP = 220;
// Fundamentals have no history, so the backtest scores every company as average to avoid look-ahead.
const NEUTRAL_FUNDAMENTAL = 50;

export type Strategy = "buy_now" | "buy_now_regime" | "limit_wait";
export const STRATEGY_LABEL: Record<Strategy, string> = {
  buy_now: "Buy ready/breakout picks",
  buy_now_regime: "Same, skipping falling markets",
  limit_wait: "Limit order at the zone on 'wait' picks",
};
// How long an unfilled buy order stays open, in trading days.
export const FILL_DAYS: Record<Strategy, number> = { buy_now: 3, buy_now_regime: 3, limit_wait: 10 };
const MIN_TOTAL = 60;
const MAX_WAIT_GAP = 15;

export type Trade = {
  symbol: string; sector: string; strategy: Strategy; signal: string; signalDate: string; fillDate: string; exitDate: string;
  entry: number; stop: number; target: number; exit: number; outcome: "target" | "stop" | "time";
  heldDays: number; netPerShare: number; netPct: number; regime: string; x: Features;
};

function wants(s: Strategy, p: Pick, m: MarketDay | undefined): boolean {
  if (p.excluded || p.total < MIN_TOTAL) return false;
  if (s === "limit_wait") return p.signal === "wait" && p.aboveZonePct > 0 && p.aboveZonePct <= MAX_WAIT_GAP;
  if (p.signal !== "ready" && p.signal !== "breakout") return false;
  return s === "buy_now" || m?.regime !== "bear" || p.total >= BEAR_MIN_SCORE;
}

// Simulates one order placed after day `i`'s close; returns null if it never fills or the holding period runs past the data.
export function simulate(cs: Candle[], i: number, p: Pick, days: number, fillDays: number) {
  let f = -1, entry = 0;
  for (let d = i + 1; d <= Math.min(i + fillDays, cs.length - 1); d++) {
    if (cs[d].open <= p.stopLoss) return { filled: false as const, until: d };
    if (cs[d].low <= p.entryHigh) {
      f = d;
      entry = Math.min(cs[d].open, p.entryHigh);
      break;
    }
  }
  if (f < 0) return { filled: false as const, until: Math.min(i + fillDays, cs.length - 1) };
  const last = f + days;
  if (last >= cs.length) return null;
  for (let d = f + SELLABLE_AFTER_TRADING_DAYS; d <= last; d++) {
    const c = cs[d];
    // Stop first when both levels are inside one day's range: the cautious assumption.
    if (c.low <= p.stopLoss) return { filled: true as const, f, d, entry, exit: Math.min(c.open, p.stopLoss), outcome: "stop" as const };
    if (c.high >= p.target) return { filled: true as const, f, d, entry, exit: Math.max(c.open, p.target), outcome: "target" as const };
  }
  return { filled: true as const, f, d: last, entry, exit: cs[last].close, outcome: "time" as const };
}

// Replays one stock day by day with only the data known on each day; one open order or position per strategy at a time.
export function replayStock(s: StockData, horizon: Horizon, market: Map<string, MarketDay>, strategies: Strategy[]): Trade[] {
  const cs = s.candles;
  const trades: Trade[] = [];
  const busyUntil = Object.fromEntries(strategies.map((k) => [k, -1])) as Record<Strategy, number>;
  for (let i = WARMUP; i < cs.length - 1; i++) {
    if (strategies.every((k) => busyUntil[k] >= i)) continue;
    const window: StockData = { ...s, candles: cs.slice(Math.max(0, i + 1 - WINDOW), i + 1), quarters: [], actions: [], snapshot: {} };
    const p = scoreStock(window, { pe: null, pbv: null }, cs[i].date, horizon, { fundamental: NEUTRAL_FUNDAMENTAL });
    if (!p) continue;
    const m = market.get(cs[i].date);
    for (const k of strategies) {
      if (busyUntil[k] >= i || !wants(k, p, m)) continue;
      const r = simulate(cs, i, p, horizon.days, FILL_DAYS[k]);
      if (r === null) { busyUntil[k] = cs.length; continue; }
      if (!r.filled) { busyUntil[k] = r.until; continue; }
      busyUntil[k] = r.d;
      const net = netPerShare(r.entry, r.exit);
      trades.push({
        symbol: s.company.symbol, sector: s.company.sector, strategy: k, signal: p.signal, signalDate: cs[i].date,
        fillDate: cs[r.f].date, exitDate: cs[r.d].date, entry: r.entry, stop: p.stopLoss, target: p.target, exit: r.exit, outcome: r.outcome,
        heldDays: r.d - r.f, netPerShare: Math.round(net * 10) / 10, netPct: Math.round((net / r.entry) * 10000) / 100,
        regime: m?.regime ?? "neutral", x: features(p, m),
      });
    }
  }
  return trades;
}

export type Stats = {
  n: number; winRate: number; targetRate: number; stopRate: number;
  avgNetPerShare: number; avgNetPct: number; medianNetPct: number; profitFactor: number; worstLosingStreak: number;
};

export function summarize(trades: Trade[]): Stats {
  const n = trades.length;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  if (!n) return { n, winRate: 0, targetRate: 0, stopRate: 0, avgNetPerShare: 0, avgNetPct: 0, medianNetPct: 0, profitFactor: 0, worstLosingStreak: 0 };
  const pct = trades.map((t) => t.netPct).sort((a, b) => a - b);
  const wins = trades.filter((t) => t.netPerShare > 0);
  const gains = wins.reduce((a, t) => a + t.netPct, 0), losses = -trades.filter((t) => t.netPerShare <= 0).reduce((a, t) => a + t.netPct, 0);
  let streak = 0, worst = 0;
  for (const t of [...trades].sort((a, b) => a.fillDate.localeCompare(b.fillDate))) {
    streak = t.netPerShare > 0 ? 0 : streak + 1;
    worst = Math.max(worst, streak);
  }
  return {
    n, winRate: r2(wins.length / n), targetRate: r2(trades.filter((t) => t.outcome === "target").length / n), stopRate: r2(trades.filter((t) => t.outcome === "stop").length / n),
    avgNetPerShare: r2(trades.reduce((a, t) => a + t.netPerShare, 0) / n), avgNetPct: r2(pct.reduce((a, b) => a + b, 0) / n),
    medianNetPct: r2(pct[Math.floor(n / 2)]), profitFactor: losses > 0 ? r2(gains / losses) : 99, worstLosingStreak: worst,
  };
}

export function groupStats<K extends string>(trades: Trade[], key: (t: Trade) => K): Record<K, Stats> {
  const m = new Map<K, Trade[]>();
  for (const t of trades) (m.get(key(t)) ?? m.set(key(t), []).get(key(t))!).push(t);
  return Object.fromEntries([...m].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, summarize(v)])) as Record<K, Stats>;
}
