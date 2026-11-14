CREATE TABLE "companies" (
	"symbol" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sector" text NOT NULL,
	"price" double precision,
	"eps" double precision,
	"eps_fiscal_year" text,
	"eps_quarter" smallint,
	"pe" double precision,
	"book_value" double precision,
	"pbv" double precision,
	"high52" double precision,
	"low52" double precision,
	"avg120" double precision,
	"avg180" double precision,
	"avg_volume_30" double precision,
	"shares_outstanding" double precision,
	"market_cap" double precision,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporate_actions" (
	"symbol" text NOT NULL,
	"fiscal_year" text NOT NULL,
	"cash_dividend_pct" double precision DEFAULT 0 NOT NULL,
	"bonus_pct" double precision DEFAULT 0 NOT NULL,
	"right_ratio" text,
	"book_closure_date" date,
	CONSTRAINT "corporate_actions_symbol_fiscal_year_pk" PRIMARY KEY("symbol","fiscal_year")
);
--> statement-breakpoint
CREATE TABLE "daily_prices" (
	"symbol" text NOT NULL,
	"date" date NOT NULL,
	"open" double precision NOT NULL,
	"high" double precision NOT NULL,
	"low" double precision NOT NULL,
	"close" double precision NOT NULL,
	"volume" bigint DEFAULT 0 NOT NULL,
	"turnover" double precision DEFAULT 0 NOT NULL,
	"prev_close" double precision,
	"avg120" double precision,
	"avg180" double precision,
	"high52" double precision,
	"low52" double precision,
	CONSTRAINT "daily_prices_symbol_date_pk" PRIMARY KEY("symbol","date")
);
--> statement-breakpoint
CREATE TABLE "quarterly_financials" (
	"symbol" text NOT NULL,
	"fiscal_year" text NOT NULL,
	"quarter" smallint NOT NULL,
	"eps" double precision NOT NULL,
	"book_value" double precision,
	"roe" double precision,
	"npl" double precision,
	"car" double precision,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quarterly_financials_symbol_fiscal_year_quarter_pk" PRIMARY KEY("symbol","fiscal_year","quarter")
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"symbol" text NOT NULL,
	"as_of" date NOT NULL,
	"price" double precision NOT NULL,
	"total" smallint NOT NULL,
	"fundamental" smallint NOT NULL,
	"technical" smallint NOT NULL,
	"risk" smallint NOT NULL,
	"entry_low" double precision NOT NULL,
	"entry_high" double precision NOT NULL,
	"stop_loss" double precision NOT NULL,
	"target" double precision NOT NULL,
	"excluded" boolean DEFAULT false NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "scores_symbol_as_of_pk" PRIMARY KEY("symbol","as_of")
);
--> statement-breakpoint
CREATE TABLE "scrape_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"price_date" date,
	"prices_saved" integer DEFAULT 0 NOT NULL,
	"companies_updated" integer DEFAULT 0 NOT NULL,
	"companies_failed" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "daily_prices_date_idx" ON "daily_prices" USING btree ("date");--> statement-breakpoint
CREATE INDEX "scores_as_of_idx" ON "scores" USING btree ("as_of");