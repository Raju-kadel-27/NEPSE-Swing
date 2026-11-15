import * as cheerio from "cheerio";
import ExcelJS from "exceljs";
import { num, UA } from "./http";

export type MoneyRow = { date: string; interbankRate: number | null; excessLiquidity: number | null };

// NRB "Database on Nepalese Economy" daily sheet (2016 onwards); the upload path changes when NRB refreshes it.
export const LIQUIDITY_XLSX = "https://www.nrb.org.np/contents/uploads/2026/09/Liquidity-and-interbank-rate-DDD.xlsx";
export const SHORT_TERM_RATES = "https://www.nrb.org.np/cmfm_rates/short_term_rates";

const cellNum = (v: ExcelJS.CellValue) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// "Liquidity Series" sheet: B = English date, C = balance at NRB minus CRR, D = primary rate, F = overall rate.
export async function parseLiquidityXlsx(buf: ArrayBuffer): Promise<MoneyRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets.find((w) => w.name.trim() === "Liquidity Series");
  if (!ws) throw new Error("NRB liquidity sheet layout changed: no 'Liquidity Series' sheet");
  const byDate = new Map<string, MoneyRow>();
  ws.eachRow((row) => {
    const v = row.values as ExcelJS.CellValue[];
    if (!(v[2] instanceof Date)) return;
    const rate = cellNum(v[6]) ?? cellNum(v[4]);
    // The sheet repeats a few dates; the later row wins.
    const date = v[2].toISOString().slice(0, 10);
    byDate.set(date, { date, interbankRate: rate && rate > 0 ? rate : null, excessLiquidity: cellNum(v[3]) });
  });
  const out = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (out.length < 100) throw new Error(`NRB liquidity sheet layout changed: only ${out.length} dated rows`);
  return out;
}

export async function fetchLiquidityHistory(url = LIQUIDITY_XLSX): Promise<MoneyRow[]> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return parseLiquidityXlsx(await res.arrayBuffer());
}

// "November 6, 2026" -> "2026-11-06"
function isoDate(s: string): string | null {
  const d = new Date(`${s.trim()} UTC`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// Current and previous weighted average interbank rate from the "Short Term Interest Rates" page; cells hold a rate div then a date div.
export function parseCurrentInterbank(html: string): MoneyRow[] {
  const $ = cheerio.load(html);
  const row = $("tr").filter((_, tr) => /Weighted Average Interbank Rate/i.test($(tr).children("td").first().text())).first();
  const out: MoneyRow[] = [];
  row.children("td").slice(1).each((_, td) => {
    const divs = $(td).children("div");
    const rate = num(divs.eq(0).text()), date = isoDate(divs.eq(1).text());
    if (rate !== null && date) out.push({ date, interbankRate: rate > 0 ? rate : null, excessLiquidity: null });
  });
  return out;
}

// NRB serves this page with HTTP 404 but full content, so the status is ignored when the table is there.
export async function fetchCurrentInterbank(): Promise<MoneyRow[]> {
  const res = await fetch(SHORT_TERM_RATES, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(30_000) });
  const rows = parseCurrentInterbank(await res.text());
  if (!rows.length) throw new Error(`HTTP ${res.status}: no interbank rate table on ${SHORT_TERM_RATES}`);
  return rows;
}
