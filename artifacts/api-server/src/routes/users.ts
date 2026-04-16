import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, upsertUser } from "../middlewares/requireAuth";
import { UpdateUserRoleBody } from "@workspace/api-zod";

const router = Router();

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;

  const user = await upsertUser(auth.userId, emailAddress ?? "", name);
  res.json({
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    name: user.name,
    role: user.role,
    condominio: user.condominio,
    createdAt: user.createdAt,
  });
});

router.get("/users", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users.map((u) => ({
    id: u.id,
    clerkId: u.clerkId,
    email: u.email,
    name: u.name,
    role: u.role,
    condominio: u.condominio,
    createdAt: u.createdAt,
  })));
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
    .set({
      role: parsed.data.role,
      condominio: parsed.data.condominio ?? null,
    })
    .where(eq(usersTable.clerkId, clerkId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }

  res.json({
    id: updated.id,
    clerkId: updated.clerkId,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    condominio: updated.condominio,
    createdAt: updated.createdAt,
  });
});

export default router;
