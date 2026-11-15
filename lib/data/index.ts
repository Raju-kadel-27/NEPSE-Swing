import { cacheLife, cacheTag } from "next/cache";
import { hasDatabase } from "../db";
import { loadDataSource } from "../db/repo";
import { HORIZONS, type HorizonKey } from "../horizon";
import { marketToday, previousDay, rankStocks, zoneChanges } from "../scoring";
import type { MarketDay } from "../scoring/regime";
import type { DataSource, Pick, StockData } from "../types";
import { DEMO_AS_OF, getDemoStocks } from "./demo";

export const MARKET_DATA_TAG = "market-data";

const demo = (): DataSource => ({ stocks: getDemoStocks(), isDemo: true, asOf: DEMO_AS_OF, historyDays: 420 });

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
