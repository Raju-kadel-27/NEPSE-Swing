import { FILL_DAYS } from "../backtest";
import { netPerShare } from "../costs";
import { SELLABLE_AFTER_TRADING_DAYS } from "../market";
import type { Candle } from "../types";

// One saved "Buy today" pick, as written by the daily scrape (raw prices on the day it was made).
export type SavedPick = {
  symbol: string; sector: string; asOf: string; price: number; total: number; signal: string;
  entryLow: number; entryHigh: number; stopLoss: number; target: number;
};

export type Status = "waiting" | "missed" | "open" | "target" | "stop" | "time";
export const CLOSED: Status[] = ["target", "stop", "time"];

// Where the price went after the pick, to today, ignoring the stop and the holding period.
export type PriceMove = {
  from: number; fromDate: string; bought: boolean; // the fill price if bought, else the pick-day close
  last: number; lastDate: string; days: number; // latest close and trading days since `fromDate`
  changePct: number; netIfSoldPct: number; // gross change, and net of costs if sold at the latest close
  bestPct: number; worstPct: number; // highest high and lowest low since, against `from`
  targetReach: number | null; // share of the way from `from` to the target at the best high (0-1), null if the target was at or below `from`
};

export type GradedPick = SavedPick & {
  status: Status;
  // Levels rescaled to today's bonus/right-adjusted prices, so they line up with the candles.
  levels: { entryLow: number; entryHigh: number; stopLoss: number; target: number };
  fillDate: string | null; entry: number | null;
  exitDate: string | null; exit: number | null; // for open picks: the latest close, as if sold today
  heldDays: number | null; netPct: number | null;
  marketPct: number | null; // median NEPSE stock over the same days, for comparison
  move: PriceMove | null;
  moveMarketPct: number | null; // median NEPSE stock over the `move` days
};

const FILL = FILL_DAYS.buy_now;
const r2 = (x: number) => Math.round(x * 100) / 100;

// Grades one pick against the candles after it, with the backtest's rules (fill within FILL days, T+3, stop before target, costs).
export function priceMove(cs: Candle[], i: number, target: number, fill: { index: number; price: number } | null): PriceMove {
  const start = fill?.index ?? i, from = fill?.price ?? cs[i].close, last = cs.at(-1)!;
  let hi = from, lo = from;
  for (let d = start + 1; d < cs.length; d++) {
    hi = Math.max(hi, cs[d].high);
    lo = Math.min(lo, cs[d].low);
  }
  const pctOf = (x: number) => r2((x / from - 1) * 100);
  return {
    from: r2(from), fromDate: cs[start].date, bought: fill !== null,
    last: last.close, lastDate: last.date, days: cs.length - 1 - start,
    changePct: pctOf(last.close), netIfSoldPct: r2((netPerShare(from, last.close) / from) * 100),
    bestPct: pctOf(hi), worstPct: pctOf(lo),
    targetReach: target > from ? r2(Math.min(1, Math.max(0, (hi - from) / (target - from)))) : null,
  };
}

export function gradePick(p: SavedPick, cs: Candle[], holdDays: number): Omit<GradedPick, "marketPct" | "move" | "moveMarketPct"> & { fillIndex: number } | null {
  const i = cs.findIndex((c) => c.date === p.asOf);
  if (i < 0) return null;
  const k = cs[i].close / p.price;
  const lv = { entryLow: p.entryLow * k, entryHigh: p.entryHigh * k, stopLoss: p.stopLoss * k, target: p.target * k };
  const base = { ...p, levels: lv, fillDate: null, entry: null, exitDate: null, exit: null, heldDays: null, netPct: null, fillIndex: -1 };

  let f = -1, entry = 0;
  for (let d = i + 1; d <= Math.min(i + FILL, cs.length - 1); d++) {
    if (cs[d].open <= lv.stopLoss) return { ...base, status: "missed" };
    if (cs[d].low <= lv.entryHigh) { f = d; entry = Math.min(cs[d].open, lv.entryHigh); break; }
  }
  if (f < 0) return { ...base, status: cs.length - 1 - i >= FILL ? "missed" : "waiting" };

  const done = (d: number, exit: number, status: Status) => ({
    ...base, status, fillIndex: f, fillDate: cs[f].date, entry, exitDate: cs[d].date, exit, heldDays: d - f, netPct: r2((netPerShare(entry, exit) / entry) * 100),
  });
  const last = f + holdDays;
  for (let d = f + SELLABLE_AFTER_TRADING_DAYS; d <= Math.min(last, cs.length - 1); d++) {
    const c = cs[d];
    if (c.low <= lv.stopLoss) return done(d, Math.min(c.open, lv.stopLoss), "stop");
    if (c.high >= lv.target) return done(d, Math.max(c.open, lv.target), "target");
  }
  if (last < cs.length) return done(last, cs[last].close, "time");
  const now = cs.length - 1;
  return done(now, cs[now].close, "open");
}

// Grades every saved pick for one holding period; like the backtest, a stock gets no new pick while an earlier one is waiting or held.
export function gradePicks(saved: SavedPick[], candles: Map<string, Candle[]>, holdDays: number): GradedPick[] {
  const busyUntil = new Map<string, string>();
  const out: GradedPick[] = [];
  const sorted = [...saved].sort((a, b) => a.asOf.localeCompare(b.asOf) || a.symbol.localeCompare(b.symbol));
  for (const p of sorted) {
    const cs = candles.get(p.symbol);
    if (!cs || (busyUntil.get(p.symbol) ?? "") >= p.asOf) continue;
    const graded = gradePick(p, cs, holdDays);
    if (!graded) continue;
    const { fillIndex, ...g } = graded;
    const i = cs.findIndex((c) => c.date === p.asOf);
    const move = priceMove(cs, i, g.levels.target, fillIndex >= 0 ? { index: fillIndex, price: g.entry! } : null);
    const until = g.status === "waiting" || g.status === "open" ? "9999" : g.exitDate ?? cs[Math.min(cs.findIndex((c) => c.date === p.asOf) + FILL, cs.length - 1)].date;
    busyUntil.set(p.symbol, until);
    out.push({
      ...g, move,
      marketPct: g.fillDate && g.exitDate ? marketChange(candles, g.fillDate, g.exitDate) : null,
      moveMarketPct: move.days > 0 ? marketChange(candles, move.fromDate, move.lastDate) : null,
    });
  }
  return out.sort((a, b) => b.asOf.localeCompare(a.asOf) || a.symbol.localeCompare(b.symbol));
}

// Median close-to-close change (%) across all stocks that traded on both days.
export function marketChange(candles: Map<string, Candle[]>, from: string, to: string): number | null {
  const ch: number[] = [];
  for (const cs of candles.values()) {
    const a = cs.find((c) => c.date === from), b = cs.find((c) => c.date === to);
    if (a && b && a.close > 0) ch.push((b.close / a.close - 1) * 100);
  }
  if (!ch.length) return null;
  ch.sort((x, y) => x - y);
  return r2(ch[Math.floor(ch.length / 2)]);
}

export type TrackSummary = {
  picks: number; waiting: number; missed: number; open: number; closed: number;
  winRate: number | null; avgNetPct: number | null; medianNetPct: number | null; avgMarketPct: number | null;
  openAvgNetPct: number | null; targets: number; stops: number; timeExits: number;
};

export type MoveSummary = {
  picks: number; tracked: number; up: number; inProfit: number; halfway: number; reachedTarget: number;
  avgChangePct: number | null; medianChangePct: number | null; avgBestPct: number | null; avgMarketPct: number | null;
};

// Price-since-pick view over picks with at least one day after the reference day.
export function summarizeMoves(g: GradedPick[]): MoveSummary {
  const m = g.flatMap((p) => (p.move && p.move.days > 0 ? [p] : []));
  const ch = m.map((p) => p.move!.changePct).sort((a, b) => a - b);
  return {
    picks: g.length, tracked: m.length,
    up: m.filter((p) => p.move!.changePct > 0).length,
    inProfit: m.filter((p) => p.move!.netIfSoldPct > 0).length,
    halfway: m.filter((p) => (p.move!.targetReach ?? 0) >= 0.5).length,
    reachedTarget: m.filter((p) => p.move!.targetReach === 1).length,
    avgChangePct: avg(ch), medianChangePct: ch.length ? ch[Math.floor(ch.length / 2)] : null,
    avgBestPct: avg(m.map((p) => p.move!.bestPct)),
    avgMarketPct: avg(m.flatMap((p) => (p.moveMarketPct == null ? [] : [p.moveMarketPct]))),
  };
}

const avg = (xs: number[]) => (xs.length ? r2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function summarizeTrack(g: GradedPick[]): TrackSummary {
  const closed = g.filter((p) => CLOSED.includes(p.status));
  const open = g.filter((p) => p.status === "open");
  const net = closed.map((p) => p.netPct!).sort((a, b) => a - b);
  return {
    picks: g.length, waiting: g.filter((p) => p.status === "waiting").length, missed: g.filter((p) => p.status === "missed").length,
    open: open.length, closed: closed.length,
    winRate: closed.length ? r2(closed.filter((p) => p.netPct! > 0).length / closed.length) : null,
    avgNetPct: avg(net), medianNetPct: net.length ? net[Math.floor(net.length / 2)] : null,
    avgMarketPct: avg(closed.flatMap((p) => (p.marketPct == null ? [] : [p.marketPct]))),
    openAvgNetPct: avg(open.map((p) => p.netPct!)),
    targets: closed.filter((p) => p.status === "target").length, stops: closed.filter((p) => p.status === "stop").length,
    timeExits: closed.filter((p) => p.status === "time").length,
  };
}
