import { Router } from "express";
import { db, assetsTable, userCondominiosTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, upsertUser } from "../middlewares/requireAuth";

const router = Router();

async function getUserCondominioIds(userId: number): Promise<number[]> {
  const rows = await db.select().from(userCondominiosTable).where(eq(userCondominiosTable.userId, userId));
  return rows.map(r => r.condominioId);
}

function formatAsset(a: typeof assetsTable.$inferSelect) {
  return {
    id: a.id,
    condominioId: a.condominioId,
    areaId: a.areaId,
    nome: a.nome,
    tipo: a.tipo,
    criticidade: a.criticidade,
    status: a.status,
    descricao: a.descricao,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

// GET /condominios/:condominioId/assets
router.get("/condominios/:condominioId/assets", requireAuth, async (req, res): Promise<void> => {
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }

  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);

  if (user.role === "sindico") {
    const condoIds = await getUserCondominioIds(user.id);
    if (!condoIds.includes(condominioId)) { res.status(403).json({ error: "Acesso negado." }); return; }
  }

  const conditions: any[] = [eq(assetsTable.condominioId, condominioId)];
  if (req.query.areaId) conditions.push(eq(assetsTable.areaId, parseInt(req.query.areaId as string, 10)));
  if (req.query.tipo) conditions.push(eq(assetsTable.tipo, req.query.tipo as string));
  if (req.query.criticidade) conditions.push(eq(assetsTable.criticidade, req.query.criticidade as string));
  if (req.query.status) conditions.push(eq(assetsTable.status, req.query.status as string));

  const rows = await db.select().from(assetsTable).where(and(...conditions)).orderBy(assetsTable.nome);
  res.json(rows.map(formatAsset));
});

// POST /condominios/:condominioId/assets
router.post("/condominios/:condominioId/assets", requireAuth, async (req, res): Promise<void> => {
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }

  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);

  if (user.role === "vistoriador") { res.status(403).json({ error: "Acesso negado." }); return; }
  if (user.role === "sindico") {
    const condoIds = await getUserCondominioIds(user.id);
    if (!condoIds.includes(condominioId)) { res.status(403).json({ error: "Acesso negado." }); return; }
  }

  const { nome, tipo, criticidade, status, descricao, areaId } = req.body;
  if (!nome || !tipo || !criticidade || !status) {
    res.status(400).json({ error: "nome, tipo, criticidade e status são obrigatórios" }); return;
  }
  if (!["equipamento", "estrutura", "sistema"].includes(tipo)) {
    res.status(400).json({ error: "tipo inválido" }); return;
  }
  if (!["baixa", "media", "alta"].includes(criticidade)) {
    res.status(400).json({ error: "criticidade inválida" }); return;
  }
  if (!["operacional", "em_manutencao", "inativo"].includes(status)) {
    res.status(400).json({ error: "status inválido" }); return;
  }

  const [created] = await db.insert(assetsTable).values({
    condominioId,
    areaId: areaId ?? null,
    nome,
    tipo,
    criticidade,
    status,
    descricao: descricao ?? null,
  }).returning();
  res.status(201).json(formatAsset(created));
});

// GET /condominios/:condominioId/assets/:assetId
router.get("/condominios/:condominioId/assets/:assetId", requireAuth, async (req, res): Promise<void> => {
  const condominioId = parseInt(req.params.condominioId as string, 10);
  const assetId = parseInt(req.params.assetId as string, 10);
  if (isNaN(condominioId) || isNaN(assetId)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [asset] = await db.select().from(assetsTable).where(and(eq(assetsTable.id, assetId), eq(assetsTable.condominioId, condominioId)));
  if (!asset) { res.status(404).json({ error: "Ativo não encontrado" }); return; }
  res.json(formatAsset(asset));
});

// PATCH /condominios/:condominioId/assets/:assetId
router.patch("/condominios/:condominioId/assets/:assetId", requireAuth, async (req, res): Promise<void> => {
  const condominioId = parseInt(req.params.condominioId as string, 10);
  const assetId = parseInt(req.params.assetId as string, 10);
  if (isNaN(condominioId) || isNaN(assetId)) { res.status(400).json({ error: "ID inválido" }); return; }

  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);

  if (user.role === "vistoriador") { res.status(403).json({ error: "Acesso negado." }); return; }
  if (user.role === "sindico") {
    const condoIds = await getUserCondominioIds(user.id);
    if (!condoIds.includes(condominioId)) { res.status(403).json({ error: "Acesso negado." }); return; }
  }

  const { nome, tipo, criticidade, status, descricao, areaId } = req.body;
  const updateData: Record<string, any> = {};
  if (nome !== undefined) updateData.nome = nome;
  if (tipo !== undefined) updateData.tipo = tipo;
  if (criticidade !== undefined) updateData.criticidade = criticidade;
  if (status !== undefined) updateData.status = status;
  if (descricao !== undefined) updateData.descricao = descricao;
  if (areaId !== undefined) updateData.areaId = areaId;

  const [updated] = await db.update(assetsTable).set(updateData).where(and(eq(assetsTable.id, assetId), eq(assetsTable.condominioId, condominioId))).returning();
  if (!updated) { res.status(404).json({ error: "Ativo não encontrado" }); return; }
  res.json(formatAsset(updated));
});

// DELETE /condominios/:condominioId/assets/:assetId
router.delete("/condominios/:condominioId/assets/:assetId", requireAuth, async (req, res): Promise<void> => {
  const condominioId = parseInt(req.params.condominioId as string, 10);
  const assetId = parseInt(req.params.assetId as string, 10);
  if (isNaN(condominioId) || isNaN(assetId)) { res.status(400).json({ error: "ID inválido" }); return; }

  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);

  if (user.role === "vistoriador") { res.status(403).json({ error: "Acesso negado." }); return; }
  if (user.role === "sindico") {
    const condoIds = await getUserCondominioIds(user.id);
    if (!condoIds.includes(condominioId)) { res.status(403).json({ error: "Acesso negado." }); return; }
  }

  await db.delete(assetsTable).where(and(eq(assetsTable.id, assetId), eq(assetsTable.condominioId, condominioId)));
  res.json({ ok: true });
});

export default router;
