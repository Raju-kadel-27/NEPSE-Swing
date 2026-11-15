import { sma } from "../indicators";
import type { Candle, Snapshot } from "../types";
import { mean, r1 } from "./util";

export type Signal = "ready" | "breakout" | "wait" | "not_yet" | "avoid";

export type EntryPlan = {
  signal: Signal;
  entryLow: number; entryHigh: number; stopLoss: number; target: number;
  support: number | null; supportLabel: string | null; resistance: number | null;
  // % the last close sits above the top of the buy zone (negative = below the zone).
  aboveZonePct: number;
  note: string;
};

export type EntryInput = {
  candles: Candle[]; snap?: Snapshot; atr: number; total: number; excluded: boolean; spiked: boolean;
  // Holding period in trading days and the max target above the buy price; defaults suit a 3-month hold.
  days?: number; targetCap?: number; stopAtr?: number;
};
// Support further below than this is too far to wait for; treat the stock as extended.
const MAX_PULLBACK = 0.15;

type Level = { label: string; value: number };

// Moving averages and recent lows that can act as support, shortest first.
function levelsOf(candles: Candle[], snap: Snapshot = {}): Level[] {
  const closes = candles.map((c) => c.close);
  const out: Level[] = [];
  const add = (label: string, v: number | null | undefined) => v != null && Number.isFinite(v) && v > 0 && out.push({ label, value: v });
  if (candles.length >= 20) {
    add("20-day average", sma(closes, 20).at(-1));
    add("20-day low", Math.min(...candles.slice(-20).map((c) => c.low)));
  }
  if (candles.length >= 50) add("50-day average", sma(closes, 50).at(-1));
  add("120-day average", snap.avg120);
  add("180-day average", snap.avg180);
  return out;
}

// Highest high before today, and today's volume against its recent average.
function breakoutInputs(candles: Candle[], snap: Snapshot = {}) {
  const last = candles.at(-1)!;
  if (candles.length >= 21) {
    const prior = candles.slice(-21, -1);
    return { prevHigh: Math.max(...prior.map((c) => c.high)), volRatio: last.volume / mean(prior.map((c) => c.volume)) };
  }
  return { prevHigh: snap.high52 ?? null, volRatio: snap.avgVolume30 ? last.volume / snap.avgVolume30 : null };
}

// Typical distance a stock travels over `days` trading days, used to keep short-hold targets realistic.
const reach = (atr: number, days: number) => 1.25 * atr * Math.sqrt(days);

function withRisk(entryLow: number, entryHigh: number, atr: number, days: number, cap: number, stopAtr: number) {
  // Stop one ATR under the zone, and at least stopAtr (2+) ATR under its top so the T+3 lock can't hit it on noise.
  const stopLoss = Math.min(entryLow - atr, entryHigh - stopAtr * atr);
  // Measured from the top of the zone: 2x the risk, but no further than the stock usually moves in the holding period.
  const target = Math.min(entryHigh + Math.min(2 * (entryHigh - stopLoss), reach(atr, days)), entryHigh * (1 + cap));
  return { entryLow: r1(entryLow), entryHigh: r1(entryHigh), stopLoss: r1(stopLoss), target: r1(target) };
}

export function planEntry({ candles, snap, atr, total, excluded, spiked, days = 63, targetCap = 0.35, stopAtr = 2 }: EntryInput): EntryPlan {
  const close = candles.at(-1)!.close;
  const levels = levelsOf(candles, snap);
  const below = levels.filter((l) => l.value <= close * 1.01).sort((a, b) => b.value - a.value);
  const above = levels.filter((l) => l.value > close * 1.01).sort((a, b) => a.value - b.value);
  const support = below[0] ?? null;
  const { prevHigh, volRatio } = breakoutInputs(candles, snap);
  const resistance = prevHigh ?? above[0]?.value ?? null;

  const make = (signal: Signal, zoneLow: number, zoneHigh: number, note: string, sup: Level | null = support): EntryPlan => ({
    signal, ...withRisk(zoneLow, zoneHigh, atr, days, targetCap, stopAtr),
    support: sup ? r1(sup.value) : null, supportLabel: sup?.label ?? null, resistance: resistance ? r1(resistance) : null,
    aboveZonePct: r1((close / zoneHigh - 1) * 100), note,
  });

  // Zone sits on top of the nearest support: from the support up to one ATR above it.
  const supportZone = (s: Level) => [s.value, s.value + atr] as const;

  if (excluded || total < 55) {
    const [lo, hi] = support ? supportZone(support) : [close - atr, close];
    return make("avoid", lo, hi, excluded ? "Too illiquid to trade safely." : "Score is too low; not a buy at any price for now.");
  }

  const isBreakout = prevHigh !== null && volRatio !== null && close >= prevHigh * 0.995 && volRatio >= 1.3 && !spiked;
  if (isBreakout) {
    return make("breakout", Math.max(prevHigh!, close - 0.5 * atr), close + 0.25 * atr,
      `Closed at a new high above ${r1(prevHigh!)} on ${r1(volRatio!)}x normal volume. Buy only inside the zone; don't chase a gap up.`,
      { label: "breakout level", value: prevHigh! });
  }

  if (!support) {
    const reclaim = above[0];
    const [lo, hi] = reclaim ? supportZone(reclaim) : [close, close + atr];
    return make("not_yet", lo, hi, reclaim
      ? `Trading below its ${reclaim.label} (${r1(reclaim.value)}). Wait until it closes back above it.`
      : "Price is falling with no support nearby. Wait for it to stabilise.", reclaim ?? null);
  }

  const [lo, hi] = supportZone(support);
  if (spiked) {
    return make("wait", lo, hi, `Ran up sharply in the last few days. Wait for it to settle back toward ${r1(hi)} before buying.`);
  }
  if (close <= hi) {
    return make("ready", lo, hi, `In the buy zone, just above its ${support.label} (${r1(support.value)}). Use a limit order inside the zone.`);
  }
  const gap = close / hi - 1;
  return make("wait", lo, hi, gap > MAX_PULLBACK
    ? `Extended: ${r1(gap * 100)}% above its buy zone. Good stock, but buying here means a wide stop.`
    : `${r1(gap * 100)}% above the buy zone. Set a limit order at ${r1(hi)} or lower and wait for a dip.`);
}

export const SIGNAL_LABEL: Record<Signal, string> = {
  ready: "Ready to buy",
  breakout: "Breakout",
  wait: "Wait for pullback",
  not_yet: "Not yet",
  avoid: "Avoid",
};
