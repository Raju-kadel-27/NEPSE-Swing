// NEPSE trades Monday to Friday. Public holidays are not modelled yet.
export const isTradingDay = (d: Date) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5;

// Shares bought on day T reach the demat account and can be sold from T+3 (buy Monday, sell from Thursday).
export const SELLABLE_AFTER_TRADING_DAYS = 3;

const parse = (iso: string) => new Date(iso + "T00:00:00Z");
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export function addTradingDays(iso: string, n: number): string {
  const d = parse(iso);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isTradingDay(d)) left--;
  }
  return fmt(d);
}

// From the date of the latest prices: the next session you can buy in, and the first day you can sell those shares.
export function tradeWindow(asOf: string) {
  const buyDate = addTradingDays(asOf, 1);
  return { buyDate, sellableFrom: addTradingDays(buyDate, SELLABLE_AFTER_TRADING_DAYS) };
}

export const shortDay = (iso: string) =>
  parse(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
