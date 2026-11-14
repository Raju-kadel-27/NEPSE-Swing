import * as cheerio from "cheerio";
import { getHtml, num } from "./http";

export const detailUrl = (symbol: string) => `https://merolagani.com/CompanyDetail.aspx?symbol=${encodeURIComponent(symbol)}`;

export type Distribution = { fiscalYear: string; value: number };
export type CompanyDetail = {
  symbol: string; name: string; sector: string;
  price: number | null; eps: number | null; epsFiscalYear: string | null; epsQuarter: number | null;
  pe: number | null; bookValue: number | null; pbv: number | null;
  high52: number | null; low52: number | null; avg120: number | null; avg180: number | null; avgVolume30: number | null;
  sharesOutstanding: number | null; marketCap: number | null;
  cashDividends: Distribution[]; bonuses: Distribution[]; rights: { fiscalYear: string; ratio: string }[];
};

// "078-079" -> "078/79", matching how quarters are labelled elsewhere in the app.
export const normFY = (fy: string) => fy.replace(/^(\d{3})-\d?(\d{2})$/, "$1/$2");

const FY_RE = /FY:\s*(\d{3}-\d{3})/;

export function parseCompanyDetail(symbol: string, html: string): CompanyDetail {
  const $ = cheerio.load(html);
  const field = new Map<string, cheerio.Cheerio<never>>();
  $("#accordion > tbody > tr").each((_, tr) => {
    const th = $(tr).children("th").first();
    const td = $(tr).children("td").first();
    if (th.length && td.length) field.set(th.text().replace(/\s+/g, " ").trim(), td as cheerio.Cheerio<never>);
  });
  const text = (k: string) => (field.get(k) ? $(field.get(k)).clone().children("span.text-primary").remove().end().text().trim() : undefined);
  const fyOf = (k: string) => (field.get(k) ? $(field.get(k)).text().match(FY_RE)?.[1] ?? null : null);

  if (!field.has("Sector")) throw new Error(`Merolagani layout changed or ${symbol} not found: no Sector row`);

  const eps = field.get("EPS") ? $(field.get("EPS")).text() : "";
  const [range52Hi, range52Lo] = (text("52 Weeks High - Low") ?? "").split("-").map((x) => num(x));

  // Collapsible panels list full history: rows of "#, value, (FY: xxx-xxx)".
  const history = (panelId: string) =>
    $(`#${panelId} table tr`).map((_, tr) => {
      const cells = $(tr).children("td").map((__, td) => $(td).text().trim()).get();
      const fy = cells.join(" ").match(FY_RE)?.[1];
      return fy && cells.length >= 2 ? { fiscalYear: normFY(fy), raw: cells[1] } : undefined;
    }).get() as { fiscalYear: string; raw: string }[];

  // Title looks like "merolagani - CEDB Holdings Limited (CHDC) Detail, ..."
  const name = $("title").text().match(/-\s*(.+?)\s*\([A-Z0-9]+\)/)?.[1]?.trim() || symbol;

  return {
    symbol,
    name,
    sector: text("Sector") ?? "Others",
    price: num(text("Market Price")),
    eps: num(eps.split("(")[0]),
    epsFiscalYear: eps.match(FY_RE)?.[1] ? normFY(eps.match(FY_RE)![1]) : null,
    epsQuarter: num(eps.match(/Q:\s*(\d)/)?.[1]),
    pe: num(text("P/E Ratio")),
    bookValue: num(text("Book Value")),
    pbv: num(text("PBV")),
    high52: range52Hi ?? null,
    low52: range52Lo ?? null,
    avg120: num(text("120 Day Average")),
    avg180: num(text("180 Day Average")),
    avgVolume30: num(text("30-Day Avg Volume")),
    sharesOutstanding: num(text("Shares Outstanding")),
    marketCap: num(text("Market Capitalization")),
    cashDividends: withLatest(history("dividend-panel").map((h) => ({ fiscalYear: h.fiscalYear, value: num(h.raw) ?? 0 })), fyOf("% Dividend"), num(text("% Dividend"))),
    bonuses: withLatest(history("bonus-panel").map((h) => ({ fiscalYear: h.fiscalYear, value: num(h.raw) ?? 0 })), fyOf("% Bonus"), num(text("% Bonus"))),
    rights: history("right-panel").map((h) => ({ fiscalYear: h.fiscalYear, ratio: h.raw })),
  };
}

// If a history panel is empty, keep at least the latest value shown in the summary row.
function withLatest(list: Distribution[], fy: string | null, value: number | null): Distribution[] {
  if (list.length || !fy || value === null) return list;
  return [{ fiscalYear: normFY(fy), value }];
}

export async function fetchCompanyDetail(symbol: string): Promise<CompanyDetail> {
  return parseCompanyDetail(symbol, await getHtml(detailUrl(symbol)));
}
