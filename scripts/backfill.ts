// Usage: npm run backfill -- [--since=2016-01-01] [--symbols=NABIL,ADBL] [--delay=300]
import { closeDb, getDb } from "../lib/db";
import { savePriceHistory } from "../lib/db/repo";
import { companies } from "../lib/db/schema";
import { sleep } from "../lib/ingest/http";
import { HISTORY_URL, parseHistoryCsv } from "../lib/ingest/history";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const since = arg("since") ?? "2016-01-01";
const delayMs = Math.max(200, Number(arg("delay") ?? 300));
const only = arg("symbols")?.split(",").map((s) => s.trim().toUpperCase());

async function main() {
  const symbols = only ?? (await getDb().select({ symbol: companies.symbol }).from(companies)).map((r) => r.symbol).sort();
  console.log(`Backfilling ${symbols.length} symbols since ${since}...`);
  let total = 0, missing = 0, failed = 0;
  for (const [i, symbol] of symbols.entries()) {
    try {
      const res = await fetch(HISTORY_URL(symbol), { signal: AbortSignal.timeout(30_000) });
      if (res.status === 404) {
        missing++;
        console.log(`[${i + 1}/${symbols.length}] ${symbol}: no history file`);
      } else if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      } else {
        const candles = parseHistoryCsv(await res.text(), since);
        const saved = await savePriceHistory(symbol, candles);
        total += saved;
        console.log(`[${i + 1}/${symbols.length}] ${symbol}: ${saved} new days (${candles[0]?.date ?? "–"} to ${candles.at(-1)?.date ?? "–"})`);
      }
    } catch (e) {
      failed++;
      console.warn(`[${i + 1}/${symbols.length}] ${symbol}: failed (${(e as Error).message})`);
    }
    await sleep(delayMs);
  }
  console.log(`Done. ${total} rows saved, ${missing} symbols without history, ${failed} failed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
