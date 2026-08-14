import type { Context, Next } from "hono";
import { usersTable } from "@workspace/db/worker";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { logger } from "../lib/logger";

// "global_admin" is SindixHub's own platform staff — bypasses every
// empresa/condomínio boundary, everywhere (see authorizeCondominioAccess in
// routes/condominios.ts). "admin" is scoped to the user's own empresa
// (tenant) since the multi-tenant migration — it no longer means
// "unrestricted platform-wide" the way it did before empresas existed.
export type UserRole = "global_admin" | "admin" | "sindico" | "vistoriador";

// NOTE: `clerkId` (column `clerk_id`) is a historical name kept as-is —
// renaming it would cascade into generated OpenAPI types
// (lib/api-zod/src/generated/types/*.ts), the api-client, and frontend
// data-testid/UI code (e.g. artifacts/vistoria-app/src/pages/admin.tsx).
// Since the Clerk → Supabase Auth migration, this column holds the Supabase
// Auth user's UUID (`auth.users.id`) instead of a Clerk user ID —
// semantically it's just "external auth provider's user id" now.
export const BYPASS_CLERK_ID = "bypass-admin";

// Note: unlike the Express version, this no longer imports a module-level
// `db` singleton — in the Worker runtime the DB client can only be built
// once `env` (secrets/vars) is available, i.e. per-request. All DB access
// here takes the request-scoped `db` handle (c.get("db"), see src/app.ts
// and src/lib/db.ts) as an explicit parameter/argument instead.

export async function ensureBypassUser(db: AppEnv["Variables"]["db"]) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, BYPASS_CLERK_ID));
  if (existing) {
    // global_admin has no empresaId by design (see authorizeCondominioAccess)
    // — this sidesteps needing to backfill/track a default empresa for the
    // local dev bypass user entirely.
    if (existing.role !== "global_admin") {
      await db.update(usersTable).set({ role: "global_admin", empresaId: null }).where(eq(usersTable.clerkId, BYPASS_CLERK_ID));
    }
    return existing;
  }
  const [created] = await db.insert(usersTable).values({
    clerkId: BYPASS_CLERK_ID,
    email: "admin@local.dev",
    name: "Administrador",
    role: "global_admin",
  }).returning();
  logger.info({ clerkId: BYPASS_CLERK_ID }, "Bypass global_admin user created");
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

    // global_admin sits above every tenant-scoped role and always passes a
    // requireRole(...) gate, regardless of which specific roles were listed
    // — it's SindixHub's own platform staff, not scoped to any one empresa.
    if (user.role !== "global_admin" && !roles.includes(user.role as UserRole)) {
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
    role: isBypass ? "global_admin" : "vistoriador",
  }).returning();

  logger.info({ clerkId, role: created.role }, "New user created");
  return created;
}
