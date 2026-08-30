/**
 * Database entry point. `@/lib/db` resolves here.
 *
 * Two access paths on purpose:
 * - `getSql()` — the raw Neon tagged-template function, for the handful of
 *   one-line queries that predate the ORM (`lib/auth/allowlist.ts`).
 * - `getDb()` — Drizzle, typed against `./schema`, for everything new.
 *
 * Both are memoized and both parse the environment lazily, for the reason
 * given in `lib/api/env.ts`: throwing at module load would take down
 * middleware and every route rather than the one call that needs the URL.
 */
import { drizzle } from "drizzle-orm/neon-http";
import { getEnv } from "@/lib/api/env";
import * as schema from "./schema";

export { getSql } from "./client";
export * as schema from "./schema";

type Database = ReturnType<typeof createDb>;

function createDb() {
  return drizzle(getEnv().DATABASE_URL, { schema });
}

let cached: Database | null = null;

/** Memoized Drizzle client. */
export function getDb(): Database {
  if (!cached) cached = createDb();
  return cached;
}
