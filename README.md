# BuyZone

Ranks NEPSE stocks for a 2-3 month hold from fundamentals (40%), technicals (35%) and risk/liquidity (25%), with a buy zone, stop-loss and target for each pick.

## Local setup

```bash
npm install
npm run db:up        # Postgres 17 in Docker (docker-compose.yml)
npm run db:migrate   # apply drizzle/ migrations
npm run backfill     # one-off: daily prices since 2016 from the public nepse-data CSVs
npm run scrape       # today's prices + fundamentals older than 7 days, then scores
npm run dev          # http://localhost:3000
```

Backtest and model (after a backfill; re-run weekly):

```bash
npm run backtest -- --horizon=all   # replays the rules, writes lib/backtest/results/<h>.json (+ data/backtest/trades-<h>.json)
npm run train -- --horizon=all      # walk-forward logistic model, writes lib/model/<h>.json; marked useful only if it beats the score
```

`.env.local` holds `DATABASE_URL=postgres://nepse:nepse@localhost:5432/nepse`. Without `DATABASE_URL` the app shows demo data.

Other commands: `npm test`, `npm run build`, `npm run db:generate` (after editing `lib/db/schema.ts`), `npm run db:studio`.

Backfill source: [Aabishkar2/nepse-data](https://github.com/Aabishkar2/nepse-data) (no licence file; fine for personal use, check before making the app public).

Scrape options: `--symbols=NABIL,CHDC`, `--limit=20`, `--max-age=7` (days), `--delay=2500` (ms, minimum 1500), `--prices-only`, `--no-results-check`.
During each quarterly reporting window (quarter end to ~30 days after, see `lib/results.ts`), companies whose latest quarter isn't out yet are re-checked daily instead of weekly, so new results show up within a day.
Run it once each trading day (Monday to Friday, after 3 pm NPT) to build price history. In production this is automatic: `.github/workflows/daily-scrape.yml` runs migrations, `npm run scrape` and `npm run scrape:check` against Neon at 4:00 pm NPT, Monday to Friday (needs the `DATABASE_URL` repo secret). A failed run opens a `scrape-failure` GitHub issue (emailed to you); the next good run closes it. `scrape:check` fails on a run error, more than half the company pages failing, or prices older than 7 days.

## Layout

- `lib/ingest/` – parsers for ShareSansar's daily price page and Merolagani's company page (public GET pages only).
- `lib/db/` – Drizzle schema, client (postgres.js, works with local Postgres and Neon) and `repo.ts` with every read and write.
- `lib/data/index.ts` – cached `getDataSource()` (`"use cache"`, tag `market-data`), falls back to `demo.ts`.
- `lib/indicators/`, `lib/scoring/` – indicators, the fundamental, technical and risk scores, and the market regime (`regime.ts`).
- `lib/indicators/adjust.ts` – back-adjusts history for bonus and right shares (prices are stored raw).
- `lib/backtest/` – day-by-day replay with T+3, fill and cost rules; `results/` holds the summaries the app shows.
- `lib/model/` – features and a small logistic model trained on backtest trades (no external API).
- `lib/track/` – live track record: grades the saved `scores` picks against later prices with the backtest's rules (`/track-record`).
- `lib/costs.ts` – broker commission, SEBON and DP fees, capital gains tax.
- `scripts/` – `scrape.ts` (daily job), `migrate.ts`, `import-json.ts` (one-off import of the old file-based data).
- `app/` – picks page, stock page, track record page, methodology page.

## Tables

`companies` (latest fundamentals), `daily_prices`, `quarterly_financials` (one row per quarter seen, for EPS growth),
`corporate_actions` (dividend, bonus, right per fiscal year), `scores` (daily ranking, for backtesting), `scrape_runs` (job log).

## Going to production (Neon)

1. Set `DATABASE_URL` to the Neon connection string (`?sslmode=require`), locally and in Vercel.
2. `npm run db:migrate` against Neon.
3. Run `npm run scrape` once to fill it, then deploy.
