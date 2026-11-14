import * as cheerio from "cheerio";
import { getHtml, num } from "./http";

export const TODAY_URL = "https://www.sharesansar.com/today-share-price";

export type PriceRow = {
  symbol: string; open: number; high: number; low: number; close: number; volume: number; turnover: number;
  prevClose: number | null; avg120: number | null; avg180: number | null; high52: number | null; low52: number | null;
};

export type TodayPrices = { date: string; rows: PriceRow[]; names: Record<string, string> };

export function parseTodayPrices(html: string): TodayPrices {
  const $ = cheerio.load(html);
  const date = $("#fromdate").attr("value")?.trim() ?? "";
  const table = $("#todayshareprice_data table").first();
  const headers = table.find("thead th").map((_, th) => $(th).text().trim()).get();
  const col = (name: string) => headers.indexOf(name);
  const idx = {
    symbol: col("Symbol"), open: col("Open"), high: col("High"), low: col("Low"), close: col("Close"), vol: col("Vol"),
    turnover: col("Turnover"), prev: col("Prev. Close"), a120: col("120 Days"), a180: col("180 Days"), h52: col("52 Weeks High"), l52: col("52 Weeks Low"),
  };
  if (idx.symbol < 0 || idx.close < 0) throw new Error("ShareSansar price table layout changed: Symbol/Close column missing");

  const rows: PriceRow[] = [];
  table.find("tbody tr").each((_, tr) => {
    const td = $(tr).find("td").map((__, c) => $(c).text().trim()).get();
    const symbol = td[idx.symbol];
    const close = num(td[idx.close]);
    if (!symbol || close === null || close <= 0) return;
    const open = num(td[idx.open]) ?? close;
    rows.push({
      symbol, open, close,
      high: num(td[idx.high]) ?? Math.max(open, close), low: num(td[idx.low]) ?? Math.min(open, close),
      volume: num(td[idx.vol]) ?? 0, turnover: num(td[idx.turnover]) ?? 0, prevClose: num(td[idx.prev]),
      avg120: num(td[idx.a120]), avg180: num(td[idx.a180]), high52: num(td[idx.h52]), low52: num(td[idx.l52]),
    });
  });

  // The page embeds a JSON list of every company for its search box.
  const names: Record<string, string> = {};
  const m = html.match(/\[\{"id":\d+,"symbol":"[\s\S]*?\}\]/);
  if (m) {
    try {
      for (const c of JSON.parse(m[0]) as { symbol: string; companyname: string }[]) names[c.symbol] = c.companyname;
    } catch { /* names are optional */ }
  }
  return { date, rows, names };
}

export async function fetchTodayPrices(): Promise<TodayPrices> {
  return parseTodayPrices(await getHtml(TODAY_URL));
}
