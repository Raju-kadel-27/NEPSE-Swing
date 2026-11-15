CREATE TABLE "company_snapshots" (
	"symbol" text NOT NULL,
	"date" date NOT NULL,
	"eps" double precision,
	"eps_fiscal_year" text,
	"eps_quarter" smallint,
	"pe" double precision,
	"book_value" double precision,
	"pbv" double precision,
	"shares_outstanding" double precision,
	"market_cap" double precision,
	CONSTRAINT "company_snapshots_symbol_date_pk" PRIMARY KEY("symbol","date")
);
--> statement-breakpoint
CREATE TABLE "money_daily" (
	"date" date PRIMARY KEY NOT NULL,
	"interbank_rate" double precision,
	"excess_liquidity" double precision
);
--> statement-breakpoint
INSERT INTO "company_snapshots" ("symbol", "date", "eps", "eps_fiscal_year", "eps_quarter", "pe", "book_value", "pbv", "shares_outstanding", "market_cap")
SELECT "symbol", ("fetched_at" AT TIME ZONE 'UTC')::date, "eps", "eps_fiscal_year", "eps_quarter", "pe", "book_value", "pbv", "shares_outstanding", "market_cap" FROM "companies"
ON CONFLICT DO NOTHING;
