import { macd, rsi, sma } from "../indicators";
import type { Candle, Snapshot } from "../types";
import { type Component, mean, r1, scale, weighted } from "./util";

export type TechnicalResult = {
  score: number; reasons: string[]; flags: string[];
  rsi: number | null; sma50: number | null; sma200: number | null; avg120: number | null; avg180: number | null;
};

// NEPSE rewards momentum: in the backtest, stocks with RSI above 70 beat the market in 9 of 11 years, and "oversold" ones lagged.
function rsiScore(v: number): number {
  if (v >= 80) return 80;
  if (v >= 45) return 100;
  if (v >= 30) return 45;
  return 20;
}

// fast/slow: shorter and longer moving average; labels name them in reasons.
function trendScore(close: number, fast: number, slow: number | null, labels: [string, string], reasons: string[], flags: string[]): Component {
  const aF = close > fast, aS = slow !== null && close > slow;
  let t = aF ? 45 : 10;
  if (slow !== null) t = aF && aS ? (fast > slow ? 100 : 85) : aS ? 50 : aF ? 45 : 10;
  if (t >= 85) reasons.push(`Uptrend: price above its ${labels[0]} and ${labels[1]} averages`);
  if (t <= 10) flags.push(`Downtrend: price below its ${labels[0]} and ${labels[1]} averages`);
  if (t === 45 && slow !== null) flags.push(`Mixed trend: above its ${labels[0]} but below its ${labels[1]} average`);
  if (t === 50) flags.push(`Short-term weakness: below its ${labels[0]} average`);
  return { score: t, weight: 30 };
}

export function scoreTechnical(candles: Candle[], snap: Snapshot = {}): TechnicalResult {
  const reasons: string[] = [];
  const flags: string[] = [];
  const parts: Component[] = [];
  const closes = candles.map((c) => c.close);
  const close = closes.at(-1) ?? 0;
  const s50 = sma(closes, 50).at(-1) ?? null;
  const s200 = sma(closes, 200).at(-1) ?? null;

  // Prefer our own 50/200-day averages; fall back to the source's 120/180-day averages while history is short.
  if (s50 !== null && s200 !== null) parts.push(trendScore(close, s50, s200, ["50-day", "200-day"], reasons, flags));
  else if (snap.avg120 && snap.avg180) parts.push(trendScore(close, snap.avg120, snap.avg180, ["120-day", "180-day"], reasons, flags));
  else if (s50 !== null) parts.push(trendScore(close, s50, null, ["50-day", "200-day"], reasons, flags));

  const r = rsi(closes).at(-1) ?? null;
  if (r !== null) {
    parts.push({ score: rsiScore(r), weight: 20 });
    if (r >= 45 && r < 70) reasons.push(`Healthy momentum (RSI ${r1(r)})`);
    if (r >= 70 && r < 80) reasons.push(`Strong momentum (RSI ${r1(r)}); in NEPSE this usually continues`);
    if (r >= 80) flags.push(`Very stretched (RSI ${r1(r)}): strong, but expect sharp swings`);
    if (r < 30) flags.push(`Oversold (RSI ${r1(r)}): falling stocks in NEPSE usually keep falling`);
  }

  const h = macd(closes).hist;
  const h1 = h.at(-1), h0 = h.at(-2);
  if (h1 != null && h0 != null) {
    const rising = h1 > h0;
    parts.push({ score: h1 > 0 ? (rising ? 100 : 70) : rising ? 45 : 10, weight: 20 });
    if (h1 > 0 && rising) reasons.push("MACD bullish and strengthening");
  }

  const yr = closes.slice(-250);
  const hi = closes.length >= 250 ? Math.max(...yr) : snap.high52 ?? Math.max(...yr);
  const lo = closes.length >= 250 ? Math.min(...yr) : snap.low52 ?? Math.min(...yr);
  if (hi > lo) {
    const pos = (close - lo) / (hi - lo);
    parts.push({ score: pos >= 0.5 && pos <= 0.85 ? 100 : pos > 0.85 ? 70 : pos >= 0.2 ? 50 : 25, weight: 15 });
    if (pos > 0.95) reasons.push("Trading near its 52-week high (possible breakout)");
    if (pos < 0.1) flags.push("Trading near its 52-week low");
  }

  const vols = candles.map((c) => c.volume);
  const ratio = vols.length >= 60 ? mean(vols.slice(-20)) / mean(vols.slice(-60)) : snap.avgVolume30 ? mean(vols.slice(-5)) / snap.avgVolume30 : null;
  if (ratio !== null && Number.isFinite(ratio)) {
    parts.push({ score: scale(ratio, 0.7, 1.4), weight: 15 });
    if (ratio >= 1.25) reasons.push(`Volume rising (${r1(ratio)}x its recent average)`);
  }

  return { score: weighted(parts), reasons, flags, rsi: r, sma50: s50, sma200: s200, avg120: snap.avg120 ?? null, avg180: snap.avg180 ?? null };
}
