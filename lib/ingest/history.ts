import { parse } from "csv-parse/sync";
import type { Candle } from "../types";

// Public per-company daily history (CSV per symbol), refreshed daily by the repo's GitHub Action.
export const HISTORY_URL = (symbol: string) => `https://raw.githubusercontent.com/Aabishkar2/nepse-data/main/data/company-wise/${encodeURIComponent(symbol)}.csv`;

type Row = { published_date: string; open: string; high: string; low: string; close: string; per_change: string; traded_quantity: string; traded_amount: string };

const n = (s: string | undefined) => {
  const v = parseFloat(s ?? "");
  return Number.isFinite(v) ? v : null;
};

// Parses one company's CSV into date-sorted candles, one per date, with the exchange's (adjusted) previous close from per_change.
export function parseHistoryCsv(text: string, since = "0000-00-00"): Candle[] {
  const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as Row[];
  const byDate = new Map<string, Candle>();
  for (const r of rows) {
    const date = r.published_date;
    const close = n(r.close);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < since || close === null || close <= 0) continue;
    const open = n(r.open) || close;
    const pc = n(r.per_change);
    byDate.set(date, {
      date, open, close,
      high: Math.max(n(r.high) || 0, open, close),
      low: Math.min(n(r.low) || Infinity, open, close),
      volume: Math.round(n(r.traded_quantity) ?? 0),
      turnover: n(r.traded_amount) ?? 0,
      prevClose: pc !== null && pc > -100 ? close / (1 + pc / 100) : undefined,
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
