import { Hono } from "hono";
import { cors } from "hono/cors";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
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

// Auth: AUTH_BYPASS short-circuits Clerk entirely (dev/local only), mirroring
// the original Express app.ts / requireAuth.ts behavior exactly.
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

  return clerkMiddleware({
    secretKey: c.env.CLERK_SECRET_KEY,
    publishableKey: c.env.CLERK_PUBLISHABLE_KEY,
  })(c, async () => {
    const auth = getAuth(c);
    c.set(
      "auth",
      auth?.userId
        ? { userId: auth.userId, sessionClaims: (auth.sessionClaims as Record<string, unknown>) ?? {} }
        : null,
    );
    await next();
  });
});

app.route("/api", routes);

export default app;
