import type { Context, Next } from "hono";
import { usersTable } from "@workspace/db/worker";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { logger } from "../lib/logger";

export type UserRole = "admin" | "sindico" | "vistoriador";

export const BYPASS_CLERK_ID = "bypass-admin";

// Note: unlike the Express version, this no longer imports a module-level
// `db` singleton — in the Worker runtime the DB client can only be built
// once `env` (secrets/vars) is available, i.e. per-request. All DB access
// here takes the request-scoped `db` handle (c.get("db"), see src/app.ts
// and src/lib/db.ts) as an explicit parameter/argument instead.

export async function ensureBypassUser(db: AppEnv["Variables"]["db"]) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, BYPASS_CLERK_ID));
  if (existing) {
    if (existing.role !== "admin") {
      await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.clerkId, BYPASS_CLERK_ID));
    }
    return existing;
  }
  const [created] = await db.insert(usersTable).values({
    clerkId: BYPASS_CLERK_ID,
    email: "admin@local.dev",
    name: "Administrador",
    role: "admin",
  }).returning();
  logger.info({ clerkId: BYPASS_CLERK_ID }, "Bypass admin user created");
  return created;
}

export async function requireAuth(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  const auth = c.get("auth");
  if (!auth || !auth.userId) {
    return c.json({ error: "Não autorizado. Faça login para continuar." }, 401);
  }
  await next();
}

export function requireRole(...roles: UserRole[]) {
  return async (c: Context<AppEnv>, next: Next): Promise<Response | void> => {
    const auth = c.get("auth");
    if (!auth || !auth.userId) {
      return c.json({ error: "Não autorizado." }, 401);
    }

    const db = c.get("db");
    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, auth.userId));
    if (!user) {
      return c.json({ error: "Usuário não encontrado." }, 401);
    }

    if (!roles.includes(user.role as UserRole)) {
      return c.json({ error: "Acesso negado. Permissão insuficiente." }, 403);
    }

    await next();
  };
}

export async function upsertUser(db: AppEnv["Variables"]["db"], clerkId: string, email: string, name?: string) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (existing) return existing;

  const isBypass = clerkId === BYPASS_CLERK_ID;
  const [created] = await db.insert(usersTable).values({
    clerkId,
    email,
    name: name ?? null,
    role: isBypass ? "admin" : "vistoriador",
  }).returning();

  logger.info({ clerkId, role: created.role }, "New user created");
  return created;
}
