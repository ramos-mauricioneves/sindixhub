# Local development

SindixHub is deployed to Cloudflare (Pages for `vistoria-app`, Workers for
`api-server`) with Supabase Postgres. This doc covers running everything
locally.

## Database: reusing your existing local Supabase stack

You already run the Supabase CLI's local Postgres stack for another project
("meucafe"). Reuse that same container for SindixHub — don't spin up a
second Postgres instance.

**Schema isolation decision: Postgres `search_path`, no code changes.**

Every table in `lib/db/src/schema/*.ts` is declared with `pgTable(...)`
imported directly from `drizzle-orm/pg-core` in each file individually —
there is no shared `pgTable`-wrapping helper any file goes through. That
means the "swap to `pgSchema("sindixhub")` centrally" option is not actually
central: it would mean touching all 4 schema files (`users.ts`,
`condominios.ts`, `assets.ts`, `inspections.ts`) plus `drizzle.config.ts`,
for a benefit (schema isolation) that a connection-string option gets you
for free. So: **no schema code changes** — isolate SindixHub's tables from
meucafe's by giving SindixHub its own Postgres role with a fixed
`search_path`, in the same local database cluster.

### One-time setup

Connect to your local Supabase Postgres (defaults to `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
unless you've customized the meucafe stack) with `psql` or the Supabase
Studio SQL editor, and run:

```sql
-- Dedicated schema + role for SindixHub, isolated from meucafe's tables
-- (which live in `public`).
create schema if not exists sindixhub;

create role sindixhub_app with login password 'sindixhub_local_dev';
grant all on schema sindixhub to sindixhub_app;
alter role sindixhub_app in database postgres set search_path = sindixhub;
```

`ALTER ROLE ... SET search_path` makes every connection made as
`sindixhub_app` resolve unqualified table names (`users`, `condominios`,
etc.) against the `sindixhub` schema instead of `public` — no `alter
role ... in database` needed per-database if you only have the one
`postgres` database, but it's included above for clarity if your local stack
uses a different database name.

### DATABASE_URL

Point SindixHub's local `.env` files at the dedicated role. Two equivalent
ways to make sure `search_path` is applied even if you ever connect with a
different role for a one-off query — prefer the `ALTER ROLE` above as the
source of truth, but you can also pin it in the connection string itself via
the `options` query param:

```
DATABASE_URL=postgresql://sindixhub_app:sindixhub_local_dev@127.0.0.1:54322/postgres?options=-c%20search_path%3Dsindixhub
```

(`%20` = space, `%3D` = `=` — the Postgres wire protocol `options` startup
parameter accepts `-c search_path=sindixhub`.)

### Applying the schema

With `DATABASE_URL` set as above:

```
pnpm --filter db push
```

(This replaces the old `scripts/post-merge.sh` Replit git hook, which ran
`pnpm install --frozen-lockfile && pnpm --filter db push` automatically on
every `git merge`. There's no such hook anymore — run `pnpm --filter db
push` by hand after pulling schema changes.)

## Running the Worker (api-server) locally

Create `artifacts/api-server/.dev.vars` (gitignored, not committed) with:

```
DATABASE_URL=postgresql://sindixhub_app:<your-local-password>@127.0.0.1:54322/postgres?options=-c%20search_path%3Dsindixhub
AUTH_BYPASS=true
```

Use whatever password you actually set on the `sindixhub_app` role during
the one-time setup above — don't reuse `sindixhub_local_dev` literally
unless that's genuinely what you passed to `CREATE ROLE`.

`SUPABASE_URL` / `SUPABASE_ANON_KEY` are only needed when testing the real
(non-bypass) Supabase Auth login flow locally — `AUTH_BYPASS=true` skips all
of that exactly as it skipped Clerk before. If you do want to test real
login locally, add:

```
SUPABASE_URL=https://pcqufvqoswlwdfzxmuis.supabase.co
SUPABASE_ANON_KEY=sb_publishable_fDwriq7QZfYttdCPJXvASg_YIcgGci1
```

(Public-safe values — same ones used client-side — not secrets.)

**`nodejs_compat` is required**, not optional, despite what an earlier draft
of this doc / `wrangler.toml` comment claimed. `postgres-js`'s `cf/` build
uses the Workers-native `cloudflare:sockets` API for the actual TCP
connection, but it still imports `node:events`, `node:buffer`, and
`node:stream` for internals — without the flag, `wrangler dev` fails to
boot with `Uncaught Error: No such module "node:events"`. This is already
set in `artifacts/api-server/wrangler.toml`; just don't remove it.

`AUTH_BYPASS=true` skips Supabase Auth entirely (see `src/app.ts` /
`src/middlewares/requireAuth.ts`) and impersonates a fixed local admin user
— no live Supabase Auth login needed for local testing. Leave
`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` unset
unless you're testing those integrations specifically (unset Supabase Auth
vars don't matter when `AUTH_BYPASS=true`; `GOOGLE_GENERATIVE_AI_API_KEY` is
only needed to hit `/api/generate-report` — a single Gemini call handles
audio transcription, image analysis, and report generation together, see
`src/services/gemini-service.ts`; there's no OpenAI/Whisper key anymore).

Then:

```
pnpm --filter @workspace/api-server run dev
```

This runs `wrangler dev`, which reads `.dev.vars` automatically and serves
the Worker (default `http://localhost:8787`) with hot reload.

## Running the frontend (vistoria-app) locally

Create/update `artifacts/vistoria-app/.env.local` with:

```
VITE_AUTH_BYPASS=true
PORT=5173
BASE_PATH=/
```

If you want to test the real (non-bypass) Supabase Auth login flow, also
add `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (same public-safe values
as the backend's `SUPABASE_URL` / `SUPABASE_ANON_KEY` above) and set
`VITE_AUTH_BYPASS=false`.

Then:

```
pnpm --filter @workspace/vistoria-app run dev
```

In production, Pages and the Worker share an origin, so the frontend's
generated API client (`lib/api-client-react`) calls relative `/api/*` paths
with no base URL configured. Locally those are two different dev servers
(5173 vs 8787), so `vite.config.ts` proxies `/api/*` to
`http://127.0.0.1:8787` for you automatically — no `VITE_*` base-URL env var
needed. If you run the Worker on a different port, set `WORKER_PORT` before
starting `vite dev`.

## Gotcha already hit and fixed: don't cache the DB client across requests

`artifacts/api-server/src/lib/db.ts` originally cached the drizzle/postgres-js
instance at module scope, reasoning that Workers isolates stay warm across
requests. That broke in practice: postgres-js's `cf/` build ties its socket
to the request context that opened it, so reusing it from a later request
throws `Cannot perform I/O on behalf of a different request` — a Workers
platform restriction, not a postgres-js bug. Fixed by building a fresh
client per request instead (cheap against the Supabase pooler in
transaction mode, which is designed for exactly that). If you're porting
more Worker code that touches sockets/streams, don't cache those objects at
module scope either.

## Summary: what you do NOT need

- A second Postgres container/instance — reuse the meucafe stack.
- Docker changes of any kind.
- Live Supabase Auth login / OpenAI / Anthropic credentials for basic UI +
  CRUD testing (`AUTH_BYPASS` covers auth; only `/api/generate-report`
  needs the AI keys).
