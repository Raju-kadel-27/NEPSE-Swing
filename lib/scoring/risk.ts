import { atr } from "../indicators";
import { SELLABLE_AFTER_TRADING_DAYS } from "../market";
import type { Action, Candle, Snapshot } from "../types";
import { type Component, mean, r1, scale, weighted } from "./util";

// Below this 20-day average daily turnover (NPR) a stock is too thin to trade in and out of.
export const MIN_TURNOVER = 1_000_000;

export type RiskResult = {
  score: number; reasons: string[]; flags: string[]; excluded: boolean;
  atr: number | null; atrPct: number | null; avgTurnover: number; lockMovePct: number | null;
  spiked: boolean; // sharp recent run-up: a bad moment to enter with the T+3 lock
};

const npr = (x: number) => (x >= 1e7 ? `${r1(x / 1e7)} crore` : `${r1(x / 1e5)} lakh`);

export function scoreRisk(candles: Candle[], actions: Action[], snap: Snapshot = {}): RiskResult {
  const reasons: string[] = [];
  const flags: string[] = [];
  const parts: Component[] = [];
  const close = candles.at(-1)?.close ?? 0;

  const avgTurnover = candles.length < 20 && snap.avgVolume30
    ? snap.avgVolume30 * close
    : mean(candles.slice(-20).map((c) => c.turnover || c.close * c.volume));
  const excluded = avgTurnover < MIN_TURNOVER;
  parts.push({ score: scale(Math.log10(Math.max(avgTurnover, 1)), Math.log10(5e5), Math.log10(2e7)), weight: 40 });
  if (excluded) flags.push(`Illiquid: about NPR ${npr(avgTurnover)} traded per day`);
  else if (avgTurnover >= 1e7) reasons.push(`Liquid: about NPR ${npr(avgTurnover)} traded per day`);

  // With under 15 days of candles, approximate ATR by the average daily high-low range.
  let a = atr(candles.map((c) => c.high), candles.map((c) => c.low), candles.map((c) => c.close)).at(-1) ?? null;
  if (a === null && candles.length) a = Math.max(mean(candles.slice(-10).map((c) => c.high - c.low)), close * 0.015);
  const atrPct = a !== null && close > 0 ? a / close : null;
  if (atrPct !== null) {
    parts.push({ score: scale(atrPct, 0.06, 0.02), weight: 30 });
    if (atrPct > 0.05) flags.push(`Very volatile: moves about ${r1(atrPct * 100)}% a day`);
  }

  if (candles.length >= 20) {
    let hits = 0;
    const recent = candles.slice(-61);
    for (let i = 1; i < recent.length; i++) if (Math.abs(recent[i].close / recent[i - 1].close - 1) >= 0.095) hits++;
    parts.push({ score: scale(hits, 4, 0), weight: 15 });
    if (hits >= 2) flags.push(`${hits} circuit-sized moves in 3 months, possible operator activity`);
  }

  // New shares can't be sold until T+3, so a stock that just spiked can pull back while you are locked in.
  const lockMovePct = atrPct !== null ? atrPct * Math.sqrt(SELLABLE_AFTER_TRADING_DAYS) : null;
  const multiDay = candles.length >= 6;
  const ref = multiDay ? candles.at(-6)!.close : snap.prevClose;
  let spiked = false;
  if (ref && close) {
    const jump = close / ref - 1;
    parts.push({ score: multiDay ? scale(jump, 0.15, 0.05) : scale(jump, 0.08, 0.03), weight: 15 });
    if (jump >= (multiDay ? 0.1 : 0.05)) {
      spiked = true;
      flags.push(`Up ${r1(jump * 100)}% in ${multiDay ? "5 days" : "1 day"}: a pullback is likely before new shares can be sold (T+3)`);
    }
  }

  // No book-closure penalty: in the 2016-2026 backtest, buys within 30 days before a bonus/right ex-date did better (+4.6% vs +2.2% per 2-month trade).
  let event = 100;
  const last = actions.at(-1);
  if (last?.rightRatio) {
    event = Math.min(event, 30);
    flags.push(`Right share issue pending (${last.rightRatio}), dilutes existing holders`);
  }
  parts.push({ score: event, weight: 15 });

  return { score: weighted(parts), reasons, flags, excluded, atr: a, atrPct, avgTurnover, lockMovePct, spiked };
}
