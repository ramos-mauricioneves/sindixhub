/**
 * Cloudflare Workers DB entry point.
 *
 * WHY A SEPARATE ENTRY POINT
 * ---------------------------
 * `drizzle-orm/node-postgres` (the `pg` driver) opens raw TCP sockets via
 * Node's `net` module. Cloudflare Workers has no such module and no raw TCP
 * access by default — `pg` simply cannot connect from a Worker, even with
 * `nodejs_compat` enabled (that flag polyfills a lot of `node:*` APIs, but
 * not a real TCP stack).
 *
 * DRIVER CHOICE: drizzle-orm/postgres-js
 * ---------------------------------------
 * We use `drizzle-orm/postgres-js` (the `postgres` npm package) instead.
 * Since v3.4, `postgres-js` natively detects and uses the Workers runtime's
 * built-in `cloudflare:sockets` TCP Sockets API for the actual connection —
 * that part doesn't need polyfilling. BUT `nodejs_compat` IS still required
 * in wrangler.toml: postgres-js's `cf/` build also imports `node:events`
 * (EventEmitter), `node:buffer`, and `node:stream` for internals, and none
 * of those exist natively in Workers. Verified locally via `wrangler dev`:
 * without the flag, the Worker fails to boot with
 * `Uncaught Error: No such module "node:events"`.
 *
 * CONNECTION TARGET: Supabase's pooler, port 6543 (pgbouncer, transaction mode)
 * -------------------------------------------------------------------------
 * Workers are short-lived, highly concurrent isolates — there is no
 * long-running process to hold a stable pool of direct Postgres connections
 * (port 5432). Every Worker invocation would otherwise open (and tear down)
 * its own direct connection, which Postgres's connection limits can't
 * absorb under real traffic. Supabase's connection pooler (pgbouncer) on
 * port 6543 in *transaction* mode is built for exactly this pattern: many
 * short-lived clients, connections handed out per-transaction and returned
 * immediately after.
 *
 * TRANSACTION-MODE CAVEATS (why `prepare: false`)
 * -------------------------------------------------
 * pgbouncer transaction mode multiplexes many client sessions over few real
 * Postgres connections, swapping the underlying connection between
 * transactions. That breaks anything that depends on session-level state
 * persisting across statements — most importantly, server-side *prepared
 * statements* (PREPARE/EXECUTE), since a prepared statement is scoped to
 * the physical connection that created it, not the logical client session.
 * `postgres-js` issues prepared statements by default; we must pass
 * `{ prepare: false }` so it falls back to plain (simple/extended-per-call)
 * query protocol instead. Other session-scoped features (e.g. LISTEN/NOTIFY,
 * advisory locks held across statements, `SET` outside a transaction) are
 * similarly unsafe in transaction-mode pooling and are intentionally not
 * used anywhere in this codebase.
 *
 * USAGE
 * -----
 * Workers code must import from `@workspace/db/worker` (or this file
 * directly), not `@workspace/db` — the default entry point pulls in
 * `drizzle-orm/postgres-js` too but is tuned for local/Node dev (session
 * mode, prepared statements on). Both share the same `./schema`.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export interface WorkerDbEnv {
  DATABASE_URL: string;
}

export function createDb(env: WorkerDbEnv) {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  const queryClient = postgres(env.DATABASE_URL, {
    prepare: false, // required for Supabase's pgbouncer pooler in transaction mode
  });

  return drizzle(queryClient, { schema });
}

export * from "./schema";
