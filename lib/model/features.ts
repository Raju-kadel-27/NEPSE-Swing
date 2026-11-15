import type { MarketDay } from "../scoring/regime";
import type { Pick } from "../types";

// Model inputs for one setup; all are known on the signal day.
export type Features = {
  total: number; technical: number; risk: number; rsi: number; atrPct: number; aboveZonePct: number; rewardRisk: number;
  vsSma50: number; vsSma200: number; logTurnover: number; breadth: number; regimeBear: number; regimeBull: number; breakout: number;
};

export const FEATURE_KEYS: (keyof Features)[] = [
  "total", "technical", "risk", "rsi", "atrPct", "aboveZonePct", "rewardRisk", "vsSma50", "vsSma200", "logTurnover", "breadth", "regimeBear", "regimeBull", "breakout",
];

export function features(p: Pick, m: MarketDay | null | undefined): Features {
  const ratio = (v: number | null) => (v ? p.price / v - 1 : 0);
  return {
    total: p.total, technical: p.technical, risk: p.risk, rsi: p.metrics.rsi ?? 50, atrPct: (p.metrics.atrPct ?? 0.03) * 100,
    aboveZonePct: p.aboveZonePct, rewardRisk: p.rewardRisk, vsSma50: ratio(p.metrics.sma50) * 100, vsSma200: ratio(p.metrics.sma200) * 100,
    logTurnover: Math.log10(Math.max(p.metrics.avgTurnover ?? 1, 1)), breadth: m?.breadth ?? 0.5,
    regimeBear: m?.regime === "bear" ? 1 : 0, regimeBull: m?.regime === "bull" ? 1 : 0, breakout: p.signal === "breakout" ? 1 : 0,
  };
}
