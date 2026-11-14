# NEPSE Picks

Ranks NEPSE stocks for a 2-3 month hold from fundamentals (40%), technicals (35%) and risk/liquidity (25%), with a buy zone, stop-loss and target for each pick.

## Local setup

```bash
npm install
npm run db:up        # Postgres 17 in Docker (docker-compose.yml)
npm run db:migrate   # apply drizzle/ migrations
npm run scrape       # today's prices + fundamentals older than 7 days, then scores
npm run dev          # http://localhost:3000
```

`.env.local` holds `DATABASE_URL=postgres://nepse:nepse@localhost:5432/nepse`. Without `DATABASE_URL` the app shows demo data.

Other commands: `npm test`, `npm run build`, `npm run db:generate` (after editing `lib/db/schema.ts`), `npm run db:studio`.

Scrape options: `--symbols=NABIL,CHDC`, `--limit=20`, `--max-age=7` (days), `--delay=2500` (ms, minimum 1500), `--prices-only`.
Run it once each trading day (Monday to Friday, after 3 pm NPT) to build price history.

## Layout

- `lib/ingest/` – parsers for ShareSansar's daily price page and Merolagani's company page (public GET pages only).
- `lib/db/` – Drizzle schema, client (postgres.js, works with local Postgres and Neon) and `repo.ts` with every read and write.
- `lib/data/index.ts` – cached `getDataSource()` (`"use cache"`, tag `market-data`), falls back to `demo.ts`.
- `lib/indicators/`, `lib/scoring/` – indicators and the fundamental, technical and risk scores.
- `scripts/` – `scrape.ts` (daily job), `migrate.ts`, `import-json.ts` (one-off import of the old file-based data).
- `app/` – picks page, stock page, methodology page.

## Tables

`companies` (latest fundamentals), `daily_prices`, `quarterly_financials` (one row per quarter seen, for EPS growth),
`corporate_actions` (dividend, bonus, right per fiscal year), `scores` (daily ranking, for backtesting), `scrape_runs` (job log).

## Going to production (Neon)

1. Set `DATABASE_URL` to the Neon connection string (`?sslmode=require`), locally and in Vercel.
2. `npm run db:migrate` against Neon.
3. Run `npm run scrape` once to fill it, then deploy.
