import { and, asc, desc, eq, getTableColumns, gte, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { HorizonKey } from "../horizon";
import type { CompanyDetail } from "../ingest/merolagani";
import type { PriceRow } from "../ingest/sharesansar";
import { adjustCandles } from "../indicators/adjust";
import type { Action, Candle, DataSource, Pick, StockData } from "../types";
import { getDb } from "./index";
import { companies, corporateActions, dailyPrices, quarterlyFinancials, scores, scrapeRuns } from "./schema";

// Not tradeable equity for a 2-3 month swing.
export const EXCLUDED_SECTORS = ["Corporate Debenture", "Mutual Fund", "Government Bond", "Preferred Stock", "Promotor Share"];

const SECTOR_NAMES: Record<string, string> = {
  "Development Bank Limited": "Development Banks",
  "Hydro Power": "Hydropower",
  "Hotels And Tourism": "Hotels & Tourism",
  "Manufacturing And Processing": "Manufacturing",
  Tradings: "Trading",
};

// Enough daily candles for a 200-day average plus a 52-week window.
const HISTORY_DAYS = 450;

const fyStart = (fy: string) => parseInt(fy.slice(0, 3), 10) || 0;

// `SET col = excluded.col` for every column except the conflict keys, for bulk upserts.
function excludedSet<T extends PgTable>(table: T, keys: string[]): Record<string, SQL> {
  const cols = getTableColumns(table) as Record<string, { name: string }>;
  return Object.fromEntries(
    Object.entries(cols).filter(([k]) => !keys.includes(k)).map(([k, c]) => [k, sql.raw(`excluded."${c.name}"`)]),
  );
}

const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

// ---------- writes ----------

export async function savePrices(date: string, rows: PriceRow[]) {
  const db = getDb();
  const values = rows.map((r) => ({
    symbol: r.symbol, date, open: r.open, high: r.high, low: r.low, close: r.close, volume: Math.round(r.volume), turnover: r.turnover,
    prevClose: r.prevClose, avg120: r.avg120, avg180: r.avg180, high52: r.high52, low52: r.low52,
  }));
  for (const part of chunks(values, 500)) {
    await db.insert(dailyPrices).values(part).onConflictDoUpdate({ target: [dailyPrices.symbol, dailyPrices.date], set: excludedSet(dailyPrices, ["symbol", "date"]) });
  }
  return values.length;
}

// Backfilled history for one symbol; never overwrites a day the daily scraper already saved.
export async function savePriceHistory(symbol: string, candles: Candle[]) {
  const db = getDb();
  let saved = 0;
  for (const part of chunks(candles, 1000)) {
    const rows = await db.insert(dailyPrices).values(part.map((c) => ({
      symbol, date: c.date, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.turnover ?? 0, prevClose: c.prevClose ?? null,
    }))).onConflictDoNothing().returning({ date: dailyPrices.date });
    saved += rows.length;
  }
  return saved;
}

// Upserts the company row, its latest quarter and its dividend/bonus/right history in one transaction.
export async function saveCompany(d: CompanyDetail, name: string, fetchedAt = new Date()) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const row = {
      symbol: d.symbol, name, sector: d.sector, price: d.price, eps: d.eps, epsFiscalYear: d.epsFiscalYear, epsQuarter: d.epsQuarter,
      pe: d.pe, bookValue: d.bookValue, pbv: d.pbv, high52: d.high52, low52: d.low52, avg120: d.avg120, avg180: d.avg180,
      avgVolume30: d.avgVolume30, sharesOutstanding: d.sharesOutstanding, marketCap: d.marketCap, fetchedAt,
    };
    await tx.insert(companies).values(row).onConflictDoUpdate({ target: companies.symbol, set: excludedSet(companies, ["symbol"]) });

    if (d.eps !== null && d.epsFiscalYear && d.epsQuarter) {
      const q = {
        symbol: d.symbol, fiscalYear: d.epsFiscalYear, quarter: d.epsQuarter, eps: d.eps, bookValue: d.bookValue,
        roe: d.bookValue ? Math.round((d.eps / d.bookValue) * 1000) / 10 : null,
      };
      await tx.insert(quarterlyFinancials).values(q).onConflictDoUpdate({
        target: [quarterlyFinancials.symbol, quarterlyFinancials.fiscalYear, quarterlyFinancials.quarter],
        set: { eps: q.eps, bookValue: q.bookValue, roe: q.roe },
      });
    }

    const byFy = new Map<string, { symbol: string; fiscalYear: string; cashDividendPct: number; bonusPct: number; rightRatio: string | null }>();
    const get = (fy: string) => byFy.get(fy) ?? byFy.set(fy, { symbol: d.symbol, fiscalYear: fy, cashDividendPct: 0, bonusPct: 0, rightRatio: null }).get(fy)!;
    for (const c of d.cashDividends) get(c.fiscalYear).cashDividendPct = c.value;
    for (const b of d.bonuses) get(b.fiscalYear).bonusPct = b.value;
    for (const r of d.rights) get(r.fiscalYear).rightRatio = r.ratio;
    if (byFy.size) {
      await tx.insert(corporateActions).values([...byFy.values()]).onConflictDoUpdate({
        target: [corporateActions.symbol, corporateActions.fiscalYear],
        set: { cashDividendPct: sql`excluded.cash_dividend_pct`, bonusPct: sql`excluded.bonus_pct`, rightRatio: sql`excluded.right_ratio` },
      });
    }
  });
}

export async function saveScores(asOf: string, horizon: HorizonKey, picks: Pick[]) {
  const db = getDb();
  const values = picks.map((p) => ({
    symbol: p.symbol, asOf, horizon, price: p.price, total: p.total, fundamental: p.fundamental, technical: p.technical, risk: p.risk,
    entryLow: p.entryLow, entryHigh: p.entryHigh, stopLoss: p.stopLoss, target: p.target, excluded: p.excluded,
    signal: p.signal, support: p.support, reasons: p.reasons, flags: p.flags,
  }));
  for (const part of chunks(values, 500)) {
    await db.insert(scores).values(part).onConflictDoUpdate({
      target: [scores.symbol, scores.asOf, scores.horizon],
      set: excludedSet(scores, ["symbol", "asOf", "horizon"]),
    });
  }
  return values.length;
}

export async function startRun(): Promise<number> {
  const [r] = await getDb().insert(scrapeRuns).values({}).returning({ id: scrapeRuns.id });
  return r.id;
}

export async function finishRun(id: number, v: { priceDate?: string; pricesSaved?: number; companiesUpdated?: number; companiesFailed?: number; error?: string }) {
  await getDb().update(scrapeRuns).set({ ...v, finishedAt: new Date() }).where(eq(scrapeRuns.id, id));
}

// ---------- reads ----------

export type Freshness = { sector: string; fetchedAt: Date; epsFiscalYear: string | null; epsQuarter: number | null };

export async function companyFreshness(): Promise<Map<string, Freshness>> {
  const rows = await getDb().select({
    symbol: companies.symbol, sector: companies.sector, fetchedAt: companies.fetchedAt, epsFiscalYear: companies.epsFiscalYear, epsQuarter: companies.epsQuarter,
  }).from(companies);
  return new Map(rows.map(({ symbol, ...r }) => [symbol, r]));
}

// Builds the scoring input from the DB: latest day's tradeable stocks with their history.
// `historyDays` widens the window for backtests; the live pages use the default.
export async function loadDataSource(historyDays = HISTORY_DAYS): Promise<DataSource | null> {
  const db = getDb();
  const [{ latest, days }] = await db.select({ latest: sql<string | null>`max(${dailyPrices.date})::text`, days: sql<number>`count(distinct ${dailyPrices.date})::int` }).from(dailyPrices);
  if (!latest) return null;

  const since = sql`(${latest}::date - ${historyDays}::int)`;
  const [comps, prices, quarters, actions] = await Promise.all([
    db.select().from(companies).where(notInArray(companies.sector, EXCLUDED_SECTORS)),
    db.select().from(dailyPrices).where(gte(dailyPrices.date, since)).orderBy(dailyPrices.symbol, dailyPrices.date),
    db.select().from(quarterlyFinancials).orderBy(quarterlyFinancials.symbol, quarterlyFinancials.fiscalYear, quarterlyFinancials.quarter),
    db.select().from(corporateActions).orderBy(corporateActions.symbol, corporateActions.fiscalYear),
  ]);

  const group = <T extends { symbol: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) (m.get(r.symbol) ?? m.set(r.symbol, []).get(r.symbol)!).push(r);
    return m;
  };
  const pBy = group(prices), qBy = group(quarters), aBy = group(actions);

  const stocks: StockData[] = [];
  for (const c of comps) {
    const ps = pBy.get(c.symbol) ?? [];
    const last = ps.at(-1);
    const qs = qBy.get(c.symbol) ?? [];
    if (!last || last.date !== latest || qs.length === 0) continue; // not traded today, or no report yet

    const current = c.epsFiscalYear ? fyStart(c.epsFiscalYear) : 0;
    const acts: Action[] = (aBy.get(c.symbol) ?? []).map((a) => ({
      fiscalYear: a.fiscalYear, cashDividendPct: a.cashDividendPct, bonusPct: a.bonusPct,
      bookClosureDate: a.bookClosureDate ?? undefined,
      // An old right issue is no longer a dilution risk.
      rightRatio: a.rightRatio && current - fyStart(a.fiscalYear) <= 1 ? a.rightRatio : undefined,
    }));

    stocks.push({
      company: { symbol: c.symbol, name: c.name, sector: SECTOR_NAMES[c.sector] ?? c.sector },
      candles: adjustCandles(ps.map((p): Candle => ({ date: p.date, open: p.open, high: p.high, low: p.low, close: p.close, volume: p.volume, turnover: p.turnover, prevClose: p.prevClose ?? undefined }))),
      quarters: qs.map((q) => ({ fiscalYear: q.fiscalYear, quarter: q.quarter, eps: q.eps, netWorthPerShare: q.bookValue ?? 0, roe: q.roe ?? 0, npl: q.npl ?? undefined, car: q.car ?? undefined })),
      actions: acts,
      latestReport: {
        fiscalYear: c.epsFiscalYear, quarter: c.epsQuarter,
        seenOn: qs.find((q) => q.fiscalYear === c.epsFiscalYear && q.quarter === c.epsQuarter)?.recordedAt.toISOString().slice(0, 10),
      },
      snapshot: {
        prevClose: last.prevClose ?? undefined,
        avg120: last.avg120 ?? c.avg120 ?? undefined,
        avg180: last.avg180 ?? c.avg180 ?? undefined,
        high52: last.high52 ?? c.high52 ?? undefined,
        low52: last.low52 ?? c.low52 ?? undefined,
        avgVolume30: c.avgVolume30 ?? undefined,
      },
    });
  }
  return { stocks, isDemo: false, asOf: latest, historyDays: days };
}

export async function lastRun() {
  const [r] = await getDb().select().from(scrapeRuns).where(and(sql`${scrapeRuns.finishedAt} is not null`)).orderBy(desc(scrapeRuns.id)).limit(1);
  return r ?? null;
}

// Every saved "Buy today" pick for one holding period, oldest first; the live track record grades these.
export async function loadPickHistory(horizon: HorizonKey) {
  return getDb()
    .select({
      symbol: scores.symbol, asOf: sql<string>`${scores.asOf}::text`, price: scores.price, total: scores.total, signal: scores.signal,
      entryLow: scores.entryLow, entryHigh: scores.entryHigh, stopLoss: scores.stopLoss, target: scores.target,
    })
    .from(scores)
    .where(and(eq(scores.horizon, horizon), inArray(scores.signal, ["ready", "breakout"]), gte(scores.total, 60), eq(scores.excluded, false)))
    .orderBy(asc(scores.asOf), asc(scores.symbol));
}
