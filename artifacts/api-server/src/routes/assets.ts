import { Hono } from "hono";
import { assetsTable, userCondominiosTable } from "@workspace/db/worker";
import { eq, and } from "drizzle-orm";
import { requireAuth, upsertUser } from "../middlewares/requireAuth";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

async function getUserCondominioIds(db: AppEnv["Variables"]["db"], userId: number): Promise<number[]> {
  const rows = await db.select().from(userCondominiosTable).where(eq(userCondominiosTable.userId, userId));
  return rows.map((r) => r.condominioId);
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
router.get("/condominios/:condominioId/assets", requireAuth, async (c) => {
  const db = c.get("db");
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  if (isNaN(condominioId)) return c.json({ error: "ID inválido" }, 400);

  const auth = c.get("auth")!;
  const emailAddress = auth.sessionClaims?.["email"] as string | undefined;
  const name = auth.sessionClaims?.["name"] as string | undefined;
  const user = await upsertUser(db, auth.userId, emailAddress ?? "", name);

  if (user.role === "sindico") {
    const condoIds = await getUserCondominioIds(db, user.id);
    if (!condoIds.includes(condominioId)) return c.json({ error: "Acesso negado." }, 403);
  }

  const query = c.req.query();
  const conditions: any[] = [eq(assetsTable.condominioId, condominioId)];
  if (query.areaId) conditions.push(eq(assetsTable.areaId, parseInt(query.areaId, 10)));
  if (query.tipo) conditions.push(eq(assetsTable.tipo, query.tipo));
  if (query.criticidade) conditions.push(eq(assetsTable.criticidade, query.criticidade));
  if (query.status) conditions.push(eq(assetsTable.status, query.status));

  const rows = await db.select().from(assetsTable).where(and(...conditions)).orderBy(assetsTable.nome);
  return c.json(rows.map(formatAsset));
});

// POST /condominios/:condominioId/assets
router.post("/condominios/:condominioId/assets", requireAuth, async (c) => {
  const db = c.get("db");
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  if (isNaN(condominioId)) return c.json({ error: "ID inválido" }, 400);

  const auth = c.get("auth")!;
  const emailAddress = auth.sessionClaims?.["email"] as string | undefined;
  const name = auth.sessionClaims?.["name"] as string | undefined;
  const user = await upsertUser(db, auth.userId, emailAddress ?? "", name);

  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);
  if (user.role === "sindico") {
    const condoIds = await getUserCondominioIds(db, user.id);
    if (!condoIds.includes(condominioId)) return c.json({ error: "Acesso negado." }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const { nome, tipo, criticidade, status, descricao, areaId } = body;
  if (!nome || !tipo || !criticidade || !status) {
    return c.json({ error: "nome, tipo, criticidade e status são obrigatórios" }, 400);
  }
  if (!["equipamento", "estrutura", "sistema"].includes(tipo)) {
    return c.json({ error: "tipo inválido" }, 400);
  }
  if (!["baixa", "media", "alta"].includes(criticidade)) {
    return c.json({ error: "criticidade inválida" }, 400);
  }
  if (!["operacional", "em_manutencao", "inativo"].includes(status)) {
    return c.json({ error: "status inválido" }, 400);
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
  return c.json(formatAsset(created), 201);
});

// GET /condominios/:condominioId/assets/:assetId
router.get("/condominios/:condominioId/assets/:assetId", requireAuth, async (c) => {
  const db = c.get("db");
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  const assetId = parseInt(c.req.param("assetId")!, 10);
  if (isNaN(condominioId) || isNaN(assetId)) return c.json({ error: "ID inválido" }, 400);

  const [asset] = await db.select().from(assetsTable).where(and(eq(assetsTable.id, assetId), eq(assetsTable.condominioId, condominioId)));
  if (!asset) return c.json({ error: "Ativo não encontrado" }, 404);
  return c.json(formatAsset(asset));
});

// PATCH /condominios/:condominioId/assets/:assetId
router.patch("/condominios/:condominioId/assets/:assetId", requireAuth, async (c) => {
  const db = c.get("db");
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  const assetId = parseInt(c.req.param("assetId")!, 10);
  if (isNaN(condominioId) || isNaN(assetId)) return c.json({ error: "ID inválido" }, 400);

  const auth = c.get("auth")!;
  const emailAddress = auth.sessionClaims?.["email"] as string | undefined;
  const name = auth.sessionClaims?.["name"] as string | undefined;
  const user = await upsertUser(db, auth.userId, emailAddress ?? "", name);

  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);
  if (user.role === "sindico") {
    const condoIds = await getUserCondominioIds(db, user.id);
    if (!condoIds.includes(condominioId)) return c.json({ error: "Acesso negado." }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const { nome, tipo, criticidade, status, descricao, areaId } = body;
  const updateData: Record<string, any> = {};
  if (nome !== undefined) updateData.nome = nome;
  if (tipo !== undefined) updateData.tipo = tipo;
  if (criticidade !== undefined) updateData.criticidade = criticidade;
  if (status !== undefined) updateData.status = status;
  if (descricao !== undefined) updateData.descricao = descricao;
  if (areaId !== undefined) updateData.areaId = areaId;

  const [updated] = await db.update(assetsTable).set(updateData).where(and(eq(assetsTable.id, assetId), eq(assetsTable.condominioId, condominioId))).returning();
  if (!updated) return c.json({ error: "Ativo não encontrado" }, 404);
  return c.json(formatAsset(updated));
});

// DELETE /condominios/:condominioId/assets/:assetId
router.delete("/condominios/:condominioId/assets/:assetId", requireAuth, async (c) => {
  const db = c.get("db");
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  const assetId = parseInt(c.req.param("assetId")!, 10);
  if (isNaN(condominioId) || isNaN(assetId)) return c.json({ error: "ID inválido" }, 400);

  const auth = c.get("auth")!;
  const emailAddress = auth.sessionClaims?.["email"] as string | undefined;
  const name = auth.sessionClaims?.["name"] as string | undefined;
  const user = await upsertUser(db, auth.userId, emailAddress ?? "", name);

  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);
  if (user.role === "sindico") {
    const condoIds = await getUserCondominioIds(db, user.id);
    if (!condoIds.includes(condominioId)) return c.json({ error: "Acesso negado." }, 403);
  }

  await db.delete(assetsTable).where(and(eq(assetsTable.id, assetId), eq(assetsTable.condominioId, condominioId)));
  return c.json({ ok: true });
});

export default router;
