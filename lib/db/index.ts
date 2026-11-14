import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const g = globalThis as unknown as { __db?: Db; __sql?: postgres.Sql };

export const hasDatabase = () => Boolean(process.env.DATABASE_URL);

// One pooled client per process; prepare:false keeps it compatible with Neon's PgBouncer pooler.
export function getDb(): Db {
  if (g.__db) return g.__db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  g.__sql = postgres(url, { max: 5, prepare: false, onnotice: () => {} });
  g.__db = drizzle(g.__sql, { schema });
  return g.__db;
}

export async function closeDb() {
  await g.__sql?.end({ timeout: 5 });
  g.__sql = undefined;
  g.__db = undefined;
}

export { schema };
