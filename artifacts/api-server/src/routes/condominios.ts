import { Router } from "express";
import { db, condominiosTable, areasTable, userCondominiosTable, usersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireRole, upsertUser } from "../middlewares/requireAuth";

const router = Router();

function formatCondo(c: typeof condominiosTable.$inferSelect) {
  return { id: c.id, nome: c.nome, endereco: c.endereco, cidade: c.cidade, estado: c.estado, ativo: c.ativo, createdAt: c.createdAt };
}

function formatArea(a: typeof areasTable.$inferSelect) {
  return { id: a.id, condominioId: a.condominioId, nome: a.nome, tipo: a.tipo, createdAt: a.createdAt };
}

async function getUserCondominioIds(userId: number): Promise<number[]> {
  const rows = await db.select().from(userCondominiosTable).where(eq(userCondominiosTable.userId, userId));
  return rows.map(r => r.condominioId);
}

// GET /condominios
router.get("/condominios", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);

  if (user.role === "admin") {
    const all = await db.select().from(condominiosTable).orderBy(condominiosTable.nome);
    res.json(all.map(formatCondo));
    return;
  }

  const condoIds = await getUserCondominioIds(user.id);
  if (condoIds.length === 0) { res.json([]); return; }
  const rows = await db.select().from(condominiosTable).where(inArray(condominiosTable.id, condoIds)).orderBy(condominiosTable.nome);
  res.json(rows.map(formatCondo));
});

// POST /condominios
router.post("/condominios", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { nome, endereco, cidade, estado, ativo } = req.body;
  if (!nome || typeof nome !== "string") { res.status(400).json({ error: "nome é obrigatório" }); return; }

  const [created] = await db.insert(condominiosTable).values({
    nome, endereco: endereco ?? null, cidade: cidade ?? null, estado: estado ?? null, ativo: ativo !== false,
  }).returning();
  res.status(201).json(formatCondo(created));
});

// GET /condominios/:id
router.get("/condominios/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [condo] = await db.select().from(condominiosTable).where(eq(condominiosTable.id, id));
  if (!condo) { res.status(404).json({ error: "Condomínio não encontrado" }); return; }
  res.json(formatCondo(condo));
});

// PATCH /condominios/:id
router.patch("/condominios/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const { nome, endereco, cidade, estado, ativo } = req.body;
  if (!nome || typeof nome !== "string") { res.status(400).json({ error: "nome é obrigatório" }); return; }
  const [updated] = await db.update(condominiosTable)
    .set({ nome, endereco: endereco ?? null, cidade: cidade ?? null, estado: estado ?? null, ativo: ativo !== false })
    .where(eq(condominiosTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Condomínio não encontrado" }); return; }
  res.json(formatCondo(updated));
});

// GET /condominios/:condominioId/areas
router.get("/condominios/:condominioId/areas", requireAuth, async (req, res): Promise<void> => {
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const rows = await db.select().from(areasTable).where(eq(areasTable.condominioId, condominioId)).orderBy(areasTable.tipo, areasTable.nome);
  res.json(rows.map(formatArea));
});

// POST /condominios/:condominioId/areas
router.post("/condominios/:condominioId/areas", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);
  if (user.role === "vistoriador") { res.status(403).json({ error: "Acesso negado." }); return; }

  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { nome, tipo } = req.body;
  if (!nome || !tipo) { res.status(400).json({ error: "nome e tipo são obrigatórios" }); return; }
  if (!["comum", "predial"].includes(tipo)) { res.status(400).json({ error: "tipo deve ser comum ou predial" }); return; }

  const [created] = await db.insert(areasTable).values({ condominioId, nome, tipo }).returning();
  res.status(201).json(formatArea(created));
});

// DELETE /condominios/:condominioId/areas/:areaId
router.delete("/condominios/:condominioId/areas/:areaId", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);
  if (user.role === "vistoriador") { res.status(403).json({ error: "Acesso negado." }); return; }

  const areaId = parseInt(req.params.areaId as string, 10);
  if (isNaN(areaId)) { res.status(400).json({ error: "ID inválido" }); return; }
  await db.delete(areasTable).where(eq(areasTable.id, areaId));
  res.json({ ok: true });
});

// GET /users/:clerkId/condominios
router.get("/users/:clerkId/condominios", requireAuth, async (req, res): Promise<void> => {
  const clerkId = req.params.clerkId as string;
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!targetUser) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  const condoIds = await getUserCondominioIds(targetUser.id);
  if (condoIds.length === 0) { res.json([]); return; }
  const rows = await db.select().from(condominiosTable).where(inArray(condominiosTable.id, condoIds));
  res.json(rows.map(formatCondo));
});

// POST /users/:clerkId/condominios
router.post("/users/:clerkId/condominios", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const clerkId = req.params.clerkId as string;
  const condominioId = parseInt(req.body.condominioId, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "condominioId inválido" }); return; }

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!targetUser) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

  const existing = await db.select().from(userCondominiosTable)
    .where(and(eq(userCondominiosTable.userId, targetUser.id), eq(userCondominiosTable.condominioId, condominioId)));
  if (existing.length === 0) {
    await db.insert(userCondominiosTable).values({ userId: targetUser.id, condominioId });
  }
  res.json({ ok: true });
});

// DELETE /users/:clerkId/condominios/:condominioId
router.delete("/users/:clerkId/condominios/:condominioId", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const clerkId = req.params.clerkId as string;
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!targetUser) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  await db.delete(userCondominiosTable).where(and(eq(userCondominiosTable.userId, targetUser.id), eq(userCondominiosTable.condominioId, condominioId)));
  res.json({ ok: true });
});

export default router;
