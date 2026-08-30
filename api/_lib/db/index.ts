import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// On Vercel each serverless invocation may run in its own isolated instance,
// each holding its own pool. Cap pool size hard there so a burst of
// concurrent invocations can't exhaust Postgres's connection limit; a
// long-running server (local dev, traditional hosting) keeps a normal pool.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: process.env.VERCEL ? 1 : 10,
});
export const db = drizzle(pool, { schema });

export * from "./schema/index.js";
