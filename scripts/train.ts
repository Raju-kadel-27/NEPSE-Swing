// Usage: npm run train -- [--horizon=2m|all]   (run npm run backtest for the same horizon first)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Trade } from "../lib/backtest";
import { HORIZON_KEYS, type HorizonKey } from "../lib/horizon";
import { auc, brier, calibration, type Model, predict, train } from "../lib/model/logistic";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const h = arg("horizon") ?? "2m";
const keys: HorizonKey[] = h === "all" ? HORIZON_KEYS : [h as HorizonKey];
// The model must beat ranking by the plain score by this much AUC to be shown.
const MIN_LIFT = 0.02;
const TEST_YEARS = 4;

for (const key of keys) {
  const file = `data/backtest/trades-${key}.json`;
  if (!existsSync(file)) {
    console.warn(`${key}: no ${file}; run npm run backtest -- --horizon=${key}`);
    continue;
  }
  // buy_now_regime repeats buy_now's trades, so it is left out.
  const trades = (JSON.parse(readFileSync(file, "utf8")) as Trade[]).filter((t) => t.strategy !== "buy_now_regime");
  const y = (t: Trade) => (t.netPerShare > 0 ? 1 : 0);
  const years = [...new Set(trades.map((t) => t.fillDate.slice(0, 4)))].sort();
  const testYears = years.slice(-TEST_YEARS);

  // Walk forward: train on every year before the test year, predict the test year.
  const ps: number[] = [], ys: number[] = [], totals: number[] = [], bases: number[] = [];
  for (const yr of testYears) {
    const tr = trades.filter((t) => t.fillDate.slice(0, 4) < yr), te = trades.filter((t) => t.fillDate.slice(0, 4) === yr);
    if (tr.length < 300 || !te.length) continue;
    const m = train(tr.map((t) => t.x), tr.map(y));
    const base = tr.filter((t) => y(t)).length / tr.length;
    for (const t of te) {
      ps.push(predict(m, t.x));
      ys.push(y(t));
      totals.push(t.x.total);
      bases.push(base);
    }
    console.log(`${key} ${yr}: trained on ${tr.length}, tested on ${te.length}, AUC ${auc(ps.slice(-te.length), ys.slice(-te.length)).toFixed(3)}`);
  }
  if (!ps.length) {
    console.warn(`${key}: not enough trades to validate`);
    continue;
  }
  const validation = {
    auc: +auc(ps, ys).toFixed(3), brier: +brier(ps, ys).toFixed(4), scoreAuc: +auc(totals, ys).toFixed(3), baseBrier: +brier(bases, ys).toFixed(4),
    n: ps.length, calibration: calibration(ps, ys),
  };
  const useful = validation.auc >= validation.scoreAuc + MIN_LIFT && validation.brier < validation.baseBrier;
  const final = train(trades.map((t) => t.x), trades.map(y));
  const model: Model = {
    horizon: key, trainedAt: new Date().toISOString(), trainedOn: trades.length, label: "net profit after fees and tax", ...final, validation, useful,
  };
  writeFileSync(`lib/model/${key}.json`, JSON.stringify(model, null, 1));
  console.log(`${key}: walk-forward AUC ${validation.auc} vs score-only ${validation.scoreAuc}; Brier ${validation.brier} vs base ${validation.baseBrier} -> ${useful ? "SHOWN" : "HIDDEN (no real edge)"}`);
  console.table(validation.calibration);
}
