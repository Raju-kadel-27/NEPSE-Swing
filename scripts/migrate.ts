// Applies pending SQL migrations from drizzle/ to DATABASE_URL (local Postgres or Neon).
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, getDb } from "../lib/db";

migrate(getDb(), { migrationsFolder: "drizzle" })
  .then(() => console.log("Migrations applied"))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
