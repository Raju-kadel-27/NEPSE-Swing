import { cacheLife, cacheTag } from "next/cache";
import { hasDatabase } from "../db";
import { loadDataSource } from "../db/repo";
import type { DataSource } from "../types";
import { DEMO_AS_OF, getDemoStocks } from "./demo";

export const MARKET_DATA_TAG = "market-data";

const demo = (): DataSource => ({ stocks: getDemoStocks(), isDemo: true, asOf: DEMO_AS_OF, historyDays: 420 });

// Market data changes once a trading day; the scraper revalidates the tag after it writes.
export async function getDataSource(): Promise<DataSource> {
  "use cache";
  cacheLife("hours");
  cacheTag(MARKET_DATA_TAG);
  if (!hasDatabase()) return demo();
  return (await loadDataSource()) ?? demo();
}
