import { Hono } from "hono";
import { cors } from "hono/cors";
import { createClient } from "@supabase/supabase-js";
import type { AppEnv } from "./types";
import { getDb } from "./lib/db";
import routes from "./routes";
import { BYPASS_CLERK_ID, ensureBypassUser } from "./middlewares/requireAuth";
import { logger } from "./lib/logger";

const app = new Hono<AppEnv>();

// CORS: the original Express app used `origin: true` (cors package), which
// reflects whatever Origin header the request sent — combined with
// `credentials: true` that's effectively "any site may send credentialed
// requests", which was already loose but stayed low-risk on a Replit-only
// domain. Now that this deploys to a real Cloudflare domain, lock it down to
// an explicit allow-list (ALLOWED_ORIGINS, comma-separated secret/var) with a
// narrow localhost fallback for AUTH_BYPASS-mode local dev only.
app.use("*", async (c, next) => {
  const allowList = (c.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const isLocalDev = c.env.AUTH_BYPASS === "true";

  return cors({
    origin: (origin) => {
      if (!origin) return undefined;
      if (allowList.includes(origin)) return origin;
      if (isLocalDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
      return undefined;
    },
    credentials: true,
  })(c, next);
});

// Attach a request-scoped db handle. We do NOT cache this across requests —
// see lib/db.ts for why (Workers forbids reusing one request's I/O objects,
// e.g. sockets, from a different request's handler).
app.use("*", async (c, next) => {
  c.set("db", getDb({ DATABASE_URL: c.env.DATABASE_URL }));
  await next();
});

// Auth: AUTH_BYPASS short-circuits Supabase Auth entirely (dev/local only),
// mirroring the original Express app.ts / requireAuth.ts behavior exactly.
//
// Non-bypass path verifies the bearer token from the frontend (set via
// lib/api-client-react's setAuthTokenGetter, wired to
// supabase.auth.getSession() in App.tsx) against Supabase's Auth server.
// We deliberately call auth.getUser(jwt) — a network round-trip to Supabase
// — rather than doing local JWT/JWKS verification: it's simple, always
// correct even across key rotation, and this app doesn't have the traffic
// volume where that round-trip matters. A fresh createClient() is built per
// request (same reasoning as lib/db.ts: no cross-request caching of
// request-scoped I/O objects on Workers).
app.use("*", async (c, next) => {
  const authBypass = c.env.AUTH_BYPASS === "true";

  if (authBypass) {
    c.set("auth", {
      userId: BYPASS_CLERK_ID,
      sessionClaims: { email: "admin@local.dev", name: "Administrador" },
    });
    // Fire-and-forget, matching the original ensureBypassUser().catch(...)
    // intent — but on Workers an un-awaited promise can be torn down as soon
    // as the response is sent (I/O only survives via waitUntil). Register it
    // with the execution context so it's allowed to finish in the background.
    c.executionCtx.waitUntil(
      ensureBypassUser(c.get("db")).catch((e) => logger.error(e, "Failed to ensure bypass user")),
    );
    await next();
    return;
  }

  const authHeader = c.req.header("authorization") ?? c.req.header("Authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token || !c.env.SUPABASE_URL || !c.env.SUPABASE_ANON_KEY) {
    c.set("auth", null);
    await next();
    return;
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    c.set("auth", null);
    await next();
    return;
  }

  c.set("auth", {
    userId: data.user.id,
    sessionClaims: {
      email: data.user.email,
      name: (data.user.user_metadata as Record<string, unknown> | null)?.name,
    },
  });
  await next();
});

app.route("/api", routes);

export default app;
