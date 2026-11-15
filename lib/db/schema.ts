import { bigint, boolean, date, doublePrecision, integer, jsonb, pgTable, primaryKey, serial, smallint, text, timestamp, index } from "drizzle-orm/pg-core";

const real = doublePrecision;

// Latest fundamentals per company, overwritten on each refresh (history lives in quarterly_financials).
export const companies = pgTable("companies", {
  symbol: text("symbol").primaryKey(),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  price: real("price"),
  eps: real("eps"),
  epsFiscalYear: text("eps_fiscal_year"),
  epsQuarter: smallint("eps_quarter"),
  pe: real("pe"),
  bookValue: real("book_value"),
  pbv: real("pbv"),
  high52: real("high52"),
  low52: real("low52"),
  avg120: real("avg120"),
  avg180: real("avg180"),
  avgVolume30: real("avg_volume_30"),
  sharesOutstanding: real("shares_outstanding"),
  marketCap: real("market_cap"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyPrices = pgTable("daily_prices", {
  symbol: text("symbol").notNull(),
  date: date("date").notNull(),
  open: real("open").notNull(),
  high: real("high").notNull(),
  low: real("low").notNull(),
  close: real("close").notNull(),
  volume: bigint("volume", { mode: "number" }).notNull().default(0),
  turnover: real("turnover").notNull().default(0),
  prevClose: real("prev_close"),
  avg120: real("avg120"),
  avg180: real("avg180"),
  high52: real("high52"),
  low52: real("low52"),
}, (t) => [primaryKey({ columns: [t.symbol, t.date] }), index("daily_prices_date_idx").on(t.date)]);

export const quarterlyFinancials = pgTable("quarterly_financials", {
  symbol: text("symbol").notNull(),
  fiscalYear: text("fiscal_year").notNull(),
  quarter: smallint("quarter").notNull(),
  eps: real("eps").notNull(),
  bookValue: real("book_value"),
  roe: real("roe"),
  npl: real("npl"),
  car: real("car"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.symbol, t.fiscalYear, t.quarter] })]);

export const corporateActions = pgTable("corporate_actions", {
  symbol: text("symbol").notNull(),
  fiscalYear: text("fiscal_year").notNull(),
  cashDividendPct: real("cash_dividend_pct").notNull().default(0),
  bonusPct: real("bonus_pct").notNull().default(0),
  rightRatio: text("right_ratio"),
  bookClosureDate: date("book_closure_date"),
}, (t) => [primaryKey({ columns: [t.symbol, t.fiscalYear] })]);

// One row per stock per trading day, so past picks can be backtested against what happened next.
export const scores = pgTable("scores", {
  symbol: text("symbol").notNull(),
  asOf: date("as_of").notNull(),
  horizon: text("horizon").notNull().default("2m"),
  price: real("price").notNull(),
  total: smallint("total").notNull(),
  fundamental: smallint("fundamental").notNull(),
  technical: smallint("technical").notNull(),
  risk: smallint("risk").notNull(),
  entryLow: real("entry_low").notNull(),
  entryHigh: real("entry_high").notNull(),
  stopLoss: real("stop_loss").notNull(),
  target: real("target").notNull(),
  excluded: boolean("excluded").notNull().default(false),
  signal: text("signal").notNull().default("avoid"),
  support: real("support"),
  reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
  flags: jsonb("flags").$type<string[]>().notNull().default([]),
}, (t) => [primaryKey({ columns: [t.symbol, t.asOf, t.horizon] }), index("scores_as_of_idx").on(t.asOf, t.horizon)]);

export const scrapeRuns = pgTable("scrape_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  priceDate: date("price_date"),
  pricesSaved: integer("prices_saved").notNull().default(0),
  companiesUpdated: integer("companies_updated").notNull().default(0),
  companiesFailed: integer("companies_failed").notNull().default(0),
  error: text("error"),
});
