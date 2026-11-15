import type { HorizonKey } from "../horizon";
import type { Stats, Strategy } from "./index";
import r15d from "./results/15d.json";
import r1w from "./results/1w.json";
import r2m from "./results/2m.json";
import r30d from "./results/30d.json";
import r3m from "./results/3m.json";
import r45d from "./results/45d.json";

// Written by `npm run backtest`; replays the current rules over past prices.
export type BacktestSummary = {
  horizon: HorizonKey; asOf: string; generatedAt: string; since: string; stocks: number; from: string; to: string;
  strategies: Record<Strategy, Stats & { label: string }>;
  bySignal: Record<string, Stats>; byRegime: Record<string, Stats>; byYear: Record<string, Stats>;
  byScore: Record<string, Stats>; bySector: Record<string, Stats>; bySymbol: Record<string, Stats>;
};

const RESULTS = { "1w": r1w, "15d": r15d, "30d": r30d, "45d": r45d, "2m": r2m, "3m": r3m } as unknown as Record<HorizonKey, BacktestSummary>;

export const backtestFor = (h: HorizonKey): BacktestSummary => RESULTS[h];
