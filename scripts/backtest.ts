// Usage: npm run backtest -- [--horizon=2m|all] [--symbols=NABIL,ADBL] [--since=2016-01-01]
import { mkdirSync, writeFileSync } from "node:fs";
import { groupStats, replayStock, STRATEGY_LABEL, type Strategy, summarize, type Trade } from "../lib/backtest";
import { closeDb } from "../lib/db";
import { loadDataSource } from "../lib/db/repo";
import { HORIZON_KEYS, HORIZONS, type HorizonKey } from "../lib/horizon";
import { type MoneyCondition, moneyCondition } from "../lib/scoring/money";
import { marketSeries } from "../lib/scoring/regime";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const h = arg("horizon") ?? "2m";
const keys: HorizonKey[] = h === "all" ? HORIZON_KEYS : [h as HorizonKey];
const only = arg("symbols")?.split(",").map((s) => s.trim().toUpperCase());
const since = arg("since") ?? "2016-01-01";
const STRATEGIES: Strategy[] = ["buy_now", "buy_now_regime", "limit_wait"];
// Summaries ship with the app; the full trade list (large) stays local for model training.
const OUT = "lib/backtest/results";
const TRADES = "data/backtest";

const bucket = (total: number) => (total >= 75 ? "75+" : total >= 70 ? "70-74" : total >= 65 ? "65-69" : "60-64");

async function main() {
  const days = Math.ceil((Date.now() - Date.parse(since)) / 86_400_000);
  const ds = await loadDataSource(days);
  if (!ds) throw new Error("No prices in the database; run npm run backfill first");
  const market = new Map(marketSeries(ds.stocks.map((s) => s.candles)).map((m) => [m.date, m]));
  const memo = new Map<string, MoneyCondition | null>();
  const moneyOn = (d: string) => (memo.has(d) ? memo.get(d)! : memo.set(d, moneyCondition(ds.rates, d)).get(d)!);
  const stocks = ds.stocks.filter((s) => !only || only.includes(s.company.symbol));
  mkdirSync(OUT, { recursive: true });
  mkdirSync(TRADES, { recursive: true });

  for (const key of keys) {
    if (!(key in HORIZONS)) throw new Error(`Unknown horizon ${key}`);
    const horizon = HORIZONS[key];
    const started = Date.now();
    const trades: Trade[] = [];
    for (const [i, s] of stocks.entries()) {
      trades.push(...replayStock(s, horizon, market, STRATEGIES, moneyOn));
      if ((i + 1) % 50 === 0) console.log(`  ${key}: ${i + 1}/${stocks.length} stocks, ${trades.length} trades`);
    }
    const by = (k: Strategy) => trades.filter((t) => t.strategy === k);
    const main = by("buy_now_regime");
    const summary = {
      horizon: key, asOf: ds.asOf, generatedAt: new Date().toISOString(), since, stocks: stocks.length,
      from: trades.reduce((a, t) => (t.fillDate < a ? t.fillDate : a), "9999"), to: trades.reduce((a, t) => (t.exitDate > a ? t.exitDate : a), ""),
      strategies: Object.fromEntries(STRATEGIES.map((k) => [k, { label: STRATEGY_LABEL[k], ...summarize(by(k)) }])),
      bySignal: groupStats(main, (t) => t.signal),
      byRegime: groupStats(by("buy_now"), (t) => t.regime),
      byMoney: groupStats(by("buy_now"), (t) => t.money),
      byYear: groupStats(main, (t) => t.fillDate.slice(0, 4)),
      byScore: groupStats(main, (t) => bucket(t.x.total)),
      bySector: groupStats(main, (t) => t.sector),
      bySymbol: groupStats([...main, ...by("limit_wait")], (t) => t.symbol),
    };
    writeFileSync(`${OUT}/${key}.json`, JSON.stringify(summary, null, 1));
    writeFileSync(`${TRADES}/trades-${key}.json`, JSON.stringify(trades));
    console.log(`\n${horizon.label} hold, ${summary.from} to ${summary.to}, ${stocks.length} stocks (${Math.round((Date.now() - started) / 1000)}s)`);
    console.table(Object.fromEntries(Object.entries(summary.strategies).map(([k, v]) => [k, { trades: v.n, win: v.winRate, target: v.targetRate, stop: v.stopRate, "avg net Rs/share": v.avgNetPerShare, "avg net %": v.avgNetPct, "profit factor": v.profitFactor }])));
    console.table(Object.fromEntries(Object.entries(summary.byMoney).map(([k, v]) => [`money ${k}`, { trades: v.n, win: v.winRate, "avg net %": v.avgNetPct }])));
    console.table(Object.fromEntries(Object.entries(summary.byRegime).map(([k, v]) => [k, { trades: v.n, win: v.winRate, "avg net %": v.avgNetPct }])));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
