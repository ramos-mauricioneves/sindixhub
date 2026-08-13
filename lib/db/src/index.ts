/**
 * Local / Node.js DB entry point.
 *
 * DRIVER DECISION: This package uses `drizzle-orm/postgres-js` (the `postgres`
 * npm package) as its driver on BOTH this Node entry point and the
 * Cloudflare Workers entry point (`./index.worker.ts`), instead of
 * `drizzle-orm/node-postgres` + `pg`. This keeps local dev and production on
 * the exact same query-building/serialization code path, which avoids the
 * class of bugs where something behaves differently in dev than in the
 * deployed Worker. See `./index.worker.ts` for the full rationale (pgbouncer
 * pooler caveats, `nodejs_compat`, etc.) — those same constraints simply
 * don't bind us here, but there's no reason to run two different drivers
 * when one works everywhere.
 *
 * Locally, DATABASE_URL should point directly at Postgres (e.g. port 5432,
 * session mode) — no pooler needed for local dev, so `prepare` stays at its
 * default (true).
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const queryClient = postgres(process.env.DATABASE_URL);
export const db = drizzle(queryClient, { schema });

export * from "./schema";
