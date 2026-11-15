import { SELLABLE_AFTER_TRADING_DAYS } from "./market";

export type Weights = { fundamental: number; technical: number; risk: number };

export type Horizon = {
  key: HorizonKey;
  label: string; // "1 week"
  adj: string; // "1-week", as in "a 1-week hold"
  short: string; // "1W"
  days: number; // trading days in the holding period
  weights: Weights;
  targetCap: number; // max target as a fraction above the buy price
  stopAtr: number; // stop distance below the top of the buy zone, in ATRs; longer holds need room for normal swings
};

// Short holds lean on price trend; long holds lean on company quality. Weights sum to 1.
const H = {
  "1w": { label: "1 week", adj: "1-week", short: "1W", days: 5, weights: { fundamental: 0.1, technical: 0.6, risk: 0.3 }, targetCap: 0.08, stopAtr: 2 },
  "15d": { label: "15 days", adj: "15-day", short: "15D", days: 10, weights: { fundamental: 0.15, technical: 0.55, risk: 0.3 }, targetCap: 0.12, stopAtr: 2 },
  "30d": { label: "30 days", adj: "30-day", short: "30D", days: 21, weights: { fundamental: 0.25, technical: 0.45, risk: 0.3 }, targetCap: 0.18, stopAtr: 2.5 },
  "45d": { label: "45 days", adj: "45-day", short: "45D", days: 32, weights: { fundamental: 0.3, technical: 0.42, risk: 0.28 }, targetCap: 0.22, stopAtr: 3 },
  "2m": { label: "2 months", adj: "2-month", short: "2M", days: 42, weights: { fundamental: 0.4, technical: 0.35, risk: 0.25 }, targetCap: 0.28, stopAtr: 3.5 },
  "3m": { label: "3 months", adj: "3-month", short: "3M", days: 63, weights: { fundamental: 0.45, technical: 0.3, risk: 0.25 }, targetCap: 0.35, stopAtr: 4 },
} as const;

export type HorizonKey = keyof typeof H;

export const HORIZON_KEYS = Object.keys(H) as HorizonKey[];
export const DEFAULT_HORIZON: HorizonKey = "2m";

export const HORIZONS: Record<HorizonKey, Horizon> = Object.fromEntries(
  HORIZON_KEYS.map((k) => [k, { key: k, ...H[k] }]),
) as Record<HorizonKey, Horizon>;

export function parseHorizon(v: string | string[] | undefined | null): Horizon {
  const k = (Array.isArray(v) ? v[0] : v)?.toLowerCase();
  return k && k in H ? HORIZONS[k as HorizonKey] : HORIZONS[DEFAULT_HORIZON];
}

// Trading days left to exit once newly bought shares become sellable.
export const daysToExit = (h: Horizon) => h.days - SELLABLE_AFTER_TRADING_DAYS;

// Query string that keeps the chosen horizon on links; empty for the default.
export const horizonQuery = (h: Horizon) => (h.key === DEFAULT_HORIZON ? "" : `?h=${h.key}`);
