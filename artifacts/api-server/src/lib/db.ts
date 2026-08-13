/**
 * Per-request DB instance for the Worker runtime.
 *
 * Workers have no module-level access to secrets/vars — they only arrive as
 * the `env` object passed into the fetch handler for each request. That
 * means we cannot do the old Node-style `export const db = drizzle(...)` at
 * module scope like `@workspace/db`'s default entry point does.
 *
 * We do NOT cache the drizzle/postgres-js instance across requests, even at
 * module scope within a warm isolate. postgres-js's `cf/` build opens its
 * socket via `cloudflare:sockets`, and that connection's I/O is tied to the
 * request context that created it — reusing it from a later request throws
 * "Cannot perform I/O on behalf of a different request" (a Workers platform
 * restriction, not a bug in postgres-js). Verified locally via `wrangler
 * dev`: a cached client worked for the first request and threw on the next.
 * So: build a fresh client per request. It's a new TCP connection per
 * request against the Supabase pooler (port 6543, pgbouncer transaction
 * mode), which is exactly what that pooler is designed for.
 */
import { createDb, type WorkerDbEnv } from "@workspace/db/worker";

type Db = ReturnType<typeof createDb>;

export function getDb(env: WorkerDbEnv): Db {
  return createDb(env);
}
