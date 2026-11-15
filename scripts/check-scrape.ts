// Fails (exit 1) when the latest scrape looks broken, so the daily GitHub Action can alert. Usage: npm run scrape:check
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../lib/db";
import { lastRun } from "../lib/db/repo";
import { dailyPrices } from "../lib/db/schema";

// Longer than any normal NEPSE holiday break, so only a stuck price source trips it.
const MAX_PRICE_AGE_DAYS = 7;
// More company-page failures than this share usually means Merolagani blocked us or changed its layout.
const MAX_FAIL_SHARE = 0.5;

async function main() {
  const problems: string[] = [];
  const run = await lastRun();
  if (!run) problems.push("No finished scrape run found");
  else {
    if (run.error) problems.push(`Last run failed: ${run.error}`);
    const tried = run.companiesUpdated + run.companiesFailed;
    if (tried >= 10 && run.companiesFailed / tried > MAX_FAIL_SHARE) problems.push(`${run.companiesFailed} of ${tried} company pages failed`);
    if (Date.now() - run.startedAt.getTime() > 3 * 3_600_000) problems.push(`Last finished run started at ${run.startedAt.toISOString()}, over 3 hours ago`);
  }

  const [{ latest }] = await getDb().select({ latest: sql<string | null>`max(${dailyPrices.date})::text` }).from(dailyPrices);
  const ageDays = latest ? Math.floor((Date.now() - Date.parse(latest + "T00:00:00Z")) / 86_400_000) : Infinity;
  if (ageDays > MAX_PRICE_AGE_DAYS) problems.push(`Latest prices are from ${latest ?? "never"} (${ageDays} days old)`);

  console.log(`Latest prices: ${latest ?? "none"}. Last run: ${run ? `#${run.id}, ${run.companiesUpdated} companies updated, ${run.companiesFailed} failed` : "none"}.`);
  if (problems.length) {
    for (const p of problems) console.error(`PROBLEM: ${p}`);
    process.exitCode = 1;
  } else console.log("Scrape looks healthy.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
