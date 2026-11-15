// One-off: loads the JSON written by the first file-based scraper (data/) into the database.
import fs from "node:fs";
import path from "node:path";
import { closeDb } from "../lib/db";
import { loadDataSource, saveCompany, savePrices, saveScores } from "../lib/db/repo";
import type { CompanyDetail } from "../lib/ingest/merolagani";
import type { PriceRow } from "../lib/ingest/sharesansar";
import { HORIZON_KEYS, HORIZONS } from "../lib/horizon";
import { rankStocks } from "../lib/scoring";

const dir = path.join(process.cwd(), "data");

async function main() {
  const pricesDir = path.join(dir, "prices");
  for (const f of fs.existsSync(pricesDir) ? fs.readdirSync(pricesDir).sort() : []) {
    const rows = JSON.parse(fs.readFileSync(path.join(pricesDir, f), "utf8")) as PriceRow[];
    console.log(`prices ${f}: ${await savePrices(f.slice(0, 10), rows)}`);
  }
  const file = path.join(dir, "companies.json");
  const store = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, CompanyDetail & { fetchedAt: string }>) : {};
  for (const c of Object.values(store)) await saveCompany(c, c.name, new Date(c.fetchedAt));
  console.log(`companies: ${Object.keys(store).length}`);
  const ds = await loadDataSource();
  // One ranking per holding period, so each can be backtested on its own.
  if (ds) for (const h of HORIZON_KEYS) console.log(`Scored ${await saveScores(ds.asOf, h, rankStocks(ds, HORIZONS[h]))} stocks for ${ds.asOf} (${h})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
