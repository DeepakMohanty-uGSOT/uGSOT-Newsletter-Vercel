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
  max: process.env.VERCEL ? 1 : 5,
});
export const db = drizzle(pool, { schema });

if (!process.env.VERCEL) {
  // Locally, `tsx watch` restarts this whole process on every file save,
  // re-running this module and opening a fresh pool of connections on top
  // of the previous process's — Supabase's pooler caps total session-mode
  // connections at 15, so a handful of quick restarts is enough to hit
  // "max clients reached in session mode" before the old connections have
  // had a chance to close on their own. tsx watch sends SIGTERM to the old
  // process before starting the new one, so release this pool's
  // connections right then instead of waiting for them to time out.
  process.once("SIGTERM", () => {
    void pool.end();
  });
}

export * from "./schema/index.js";
