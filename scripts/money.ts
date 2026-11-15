// Usage: npm run money -- [--url=<NRB Liquidity-and-interbank-rate xlsx>]   Loads NRB daily interbank rate and liquidity history.
import { closeDb } from "../lib/db";
import { saveMoney } from "../lib/db/repo";
import { fetchCurrentInterbank, fetchLiquidityHistory, LIQUIDITY_XLSX } from "../lib/ingest/nrb";

const url = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? LIQUIDITY_XLSX;

async function main() {
  console.log(`Downloading ${url}...`);
  const rows = await fetchLiquidityHistory(url);
  console.log(`Saved ${await saveMoney(rows)} days, ${rows[0].date} to ${rows.at(-1)!.date}`);
  const now = await fetchCurrentInterbank();
  console.log(now.length ? `Saved current rate: ${now.map((r) => `${r.date} ${r.interbankRate}%`).join(", ")}` : "Current rate not found on the NRB page");
  if (now.length) await saveMoney(now);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
