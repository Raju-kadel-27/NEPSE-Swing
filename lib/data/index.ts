import { cacheLife, cacheTag } from "next/cache";
import { hasDatabase } from "../db";
import { loadDataSource, loadPickHistory } from "../db/repo";
import { HORIZONS, type HorizonKey } from "../horizon";
import { marketToday, previousDay, rankStocks, zoneChanges } from "../scoring";
import { moneyCondition } from "../scoring/money";
import { type MarketDay, marketSeries } from "../scoring/regime";
import { gradePicks } from "../track";
import type { DataSource, Pick, StockData } from "../types";
import { DEMO_AS_OF, getDemoStocks } from "./demo";

export const MARKET_DATA_TAG = "market-data";

const demo = (): DataSource => ({ stocks: getDemoStocks(), isDemo: true, asOf: DEMO_AS_OF, historyDays: 420, rates: [] });

// The full dataset is ~10 MB, too big to cache per page; share one load per process for a few minutes instead.
const MEMO_MS = 5 * 60_000;
let memo: { at: number; ds: Promise<DataSource> } | null = null;

function dataSource(): Promise<DataSource> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.ds;
  const ds = hasDatabase() ? loadDataSource().then((d) => d ?? demo()) : Promise.resolve(demo());
  memo = { at: Date.now(), ds: ds.catch((e) => { memo = null; throw e; }) };
  return memo.ds;
}

// Market data changes once a trading day; the scraper revalidates the tag after it writes.
export async function getMeta(): Promise<Omit<DataSource, "stocks"> & { symbols: string[] }> {
  "use cache";
  cacheLife("hours");
  cacheTag(MARKET_DATA_TAG);
  const { stocks, ...meta } = await dataSource();
  return { ...meta, symbols: stocks.map((s) => s.company.symbol) };
}

export async function getStock(symbol: string): Promise<StockData | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(MARKET_DATA_TAG);
  return (await dataSource()).stocks.find((s) => s.company.symbol === symbol) ?? null;
}

// Today's market regime (index trend and breadth), or null while history is too short.
export async function getMarket(): Promise<MarketDay | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(MARKET_DATA_TAG);
  return marketToday(await dataSource());
}

// Recent equal-weight index path for the market strip, with today's reading and the day's change.
export async function getMarketOverview(days = 120) {
  "use cache";
  cacheLife("hours");
  cacheTag(MARKET_DATA_TAG);
  const ds = await dataSource();
  const series = marketSeries(ds.stocks.map((s) => s.candles)).slice(-days);
  const last = series.at(-1), prev = series.at(-2);
  let up = 0, down = 0, flat = 0;
  for (const s of ds.stocks) {
    const [a, b] = s.candles.slice(-2);
    if (!a || !b || b.date !== ds.asOf) continue;
    if (b.close > a.close) up++;
    else if (b.close < a.close) down++;
    else flat++;
  }
  return {
    points: series.map((d) => d.index),
    last: last && last.date === ds.asOf ? last : null,
    changePct: last && prev ? (last.index / prev.index - 1) * 100 : null,
    up, down, flat,
    money: moneyCondition(ds.rates, ds.asOf),
  };
}

// Last N closes per symbol, for the small price charts on pick cards.
export async function getSparklines(n = 60): Promise<Record<string, number[]>> {
  "use cache";
  cacheLife("hours");
  cacheTag(MARKET_DATA_TAG);
  const ds = await dataSource();
  return Object.fromEntries(ds.stocks.map((s) => [s.company.symbol, s.candles.slice(-n).map((c) => c.close)]));
}

// Ranked picks for one holding period, cached per period.
export async function getPicks(horizon: HorizonKey): Promise<Pick[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(MARKET_DATA_TAG);
  return rankStocks(await dataSource(), HORIZONS[horizon], await getMarket());
}

// What moved into (or close to) the buy zone since the previous trading day.
export async function getZoneChanges(horizon: HorizonKey) {
  "use cache";
  cacheLife("hours");
  cacheTag(MARKET_DATA_TAG);
  const prev = previousDay(await dataSource());
  const yesterday = prev ? rankStocks(prev, HORIZONS[horizon]) : [];
  return zoneChanges(await getPicks(horizon), yesterday);
}

// Saved "Buy today" picks graded against what prices did next; empty in demo mode.
export async function getTrackRecord(horizon: HorizonKey) {
  "use cache";
  cacheLife("hours");
  cacheTag(MARKET_DATA_TAG);
  const ds = await dataSource();
  if (ds.isDemo || !hasDatabase()) return { since: null, picks: [] };
  const saved = await loadPickHistory(horizon);
  const sector = new Map(ds.stocks.map((s) => [s.company.symbol, s.company.sector]));
  const candles = new Map(ds.stocks.map((s) => [s.company.symbol, s.candles]));
  const picks = gradePicks(saved.map((p) => ({ ...p, sector: sector.get(p.symbol) ?? "" })), candles, HORIZONS[horizon].days);
  return { since: saved[0]?.asOf ?? null, picks };
}
