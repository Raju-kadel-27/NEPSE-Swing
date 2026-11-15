// Usage: npm run scrape -- [--limit=20] [--max-age=7] [--delay=2500] [--symbols=NABIL,CHDC] [--prices-only]
import { closeDb } from "../lib/db";
import { companyFreshness, EXCLUDED_SECTORS, finishRun, loadDataSource, saveCompany, savePrices, saveScores, startRun } from "../lib/db/repo";
import { sleep } from "../lib/ingest/http";
import { fetchCompanyDetail } from "../lib/ingest/merolagani";
import { fetchTodayPrices } from "../lib/ingest/sharesansar";
import { HORIZON_KEYS, HORIZONS } from "../lib/horizon";
import { rankStocks } from "../lib/scoring";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const limit = Number(arg("limit") ?? Infinity);
const maxAgeDays = Number(arg("max-age") ?? 7);
const delayMs = Math.max(1500, Number(arg("delay") ?? 2500));
const only = arg("symbols")?.split(",").map((s) => s.trim().toUpperCase());
const pricesOnly = process.argv.includes("--prices-only");

async function main() {
  const runId = await startRun();
  let priceDate: string | undefined, pricesSaved = 0, ok = 0, failed = 0;
  try {
    console.log("Fetching today's prices from ShareSansar...");
    const today = await fetchTodayPrices();
    if (!today.date || today.rows.length === 0) throw new Error("No price rows parsed; the page layout may have changed");
    priceDate = today.date;
    pricesSaved = await savePrices(today.date, today.rows);
    console.log(`Saved ${pricesSaved} prices for ${today.date}`);

    if (!pricesOnly) {
      const fresh = await companyFreshness();
      const now = Date.now();
      const due = today.rows
        .map((r) => r.symbol)
        .filter((s) => (only ? only.includes(s) : true))
        .filter((s) => {
          const c = fresh.get(s);
          if (!c) return true;
          if (EXCLUDED_SECTORS.includes(c.sector)) return false; // sector never changes, skip forever
          return now - c.fetchedAt.getTime() > maxAgeDays * 86_400_000;
        })
        .slice(0, limit);

      console.log(`Fetching ${due.length} company pages from Merolagani (${delayMs}ms apart, about ${Math.ceil((due.length * delayMs) / 60000)} min)...`);
      for (const [i, symbol] of due.entries()) {
        try {
          const d = await fetchCompanyDetail(symbol);
          await saveCompany(d, today.names[symbol] ?? d.name);
          ok++;
          console.log(`[${i + 1}/${due.length}] ${symbol}: ${d.sector}, EPS ${d.eps ?? "–"}, P/E ${d.pe ?? "–"}`);
        } catch (e) {
          failed++;
          console.warn(`[${i + 1}/${due.length}] ${symbol}: failed (${(e as Error).message})`);
        }
        if (i < due.length - 1) await sleep(delayMs);
      }
    }

    const ds = await loadDataSource();
    // One ranking per holding period, so each can be backtested on its own.
    if (ds) for (const h of HORIZON_KEYS) console.log(`Scored ${await saveScores(ds.asOf, h, rankStocks(ds, HORIZONS[h]))} stocks for ${ds.asOf} (${h})`);
    await finishRun(runId, { priceDate, pricesSaved, companiesUpdated: ok, companiesFailed: failed });
    console.log(`Done. ${ok} companies updated, ${failed} failed.`);
  } catch (e) {
    await finishRun(runId, { priceDate, pricesSaved, companiesUpdated: ok, companiesFailed: failed, error: (e as Error).message });
    throw e;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
