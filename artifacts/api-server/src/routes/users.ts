import { Router } from "express";
import { db, usersTable, userCondominiosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, upsertUser } from "../middlewares/requireAuth";
import { UpdateUserRoleBody } from "@workspace/api-zod";

const router = Router();

async function getCondominioIds(userId: number): Promise<number[]> {
  const rows = await db.select().from(userCondominiosTable).where(eq(userCondominiosTable.userId, userId));
  return rows.map(r => r.condominioId);
}

function formatUser(u: typeof usersTable.$inferSelect, condominioIds: number[]) {
  return {
    id: u.id,
    clerkId: u.clerkId,
    email: u.email,
    name: u.name,
    role: u.role,
    condominio: u.condominio,
    condominioIds,
    createdAt: u.createdAt,
  };
}

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);
  const condominioIds = await getCondominioIds(user.id);
  res.json(formatUser(user, condominioIds));
});

router.get("/users", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  const result = await Promise.all(users.map(async (u) => {
    const condominioIds = await getCondominioIds(u.id);
    return formatUser(u, condominioIds);
  }));
  res.json(result);
});

router.patch("/users/:clerkId/role", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const clerkId = Array.isArray(req.params.clerkId) ? req.params.clerkId[0] : req.params.clerkId;

  const parsed = UpdateUserRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ role: parsed.data.role, condominio: parsed.data.condominio ?? null })
    .where(eq(usersTable.clerkId, clerkId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }

  const condominioIds = await getCondominioIds(updated.id);
  res.json(formatUser(updated, condominioIds));
});

export default router;
