import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export type UserRole = "admin" | "sindico" | "vistoriador";

export const BYPASS_CLERK_ID = "bypass-admin";

export async function ensureBypassUser() {
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

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.auth;
  if (!auth || !auth.userId) {
    res.status(401).json({ error: "Não autorizado. Faça login para continuar." });
    return;
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const auth = req.auth;
    if (!auth || !auth.userId) {
      res.status(401).json({ error: "Não autorizado." });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, auth.userId));
    if (!user) {
      res.status(401).json({ error: "Usuário não encontrado." });
      return;
    }

    if (!roles.includes(user.role as UserRole)) {
      res.status(403).json({ error: "Acesso negado. Permissão insuficiente." });
      return;
    }

    next();
  };
}

export async function upsertUser(clerkId: string, email: string, name?: string) {
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
