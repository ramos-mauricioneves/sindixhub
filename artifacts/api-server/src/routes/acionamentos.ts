import { Hono } from "hono";
import {
  acionamentosTable,
  prestadoresTable,
  prestadorCondominiosTable,
  assetsTable,
  inspectionsTable,
  condominiosTable,
  VALID_ACIONAMENTO_STATUS,
} from "@workspace/db/worker";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, upsertUser } from "../middlewares/requireAuth";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

function formatAcionamento(a: typeof acionamentosTable.$inferSelect) {
  return {
    id: a.id,
    inspectionId: a.inspectionId,
    assetId: a.assetId ?? null,
    areaId: a.areaId ?? null,
    prestadorId: a.prestadorId,
    status: a.status,
    observacoes: a.observacoes ?? null,
    createdByClerkId: a.createdByClerkId,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

// GET /api/prestadores/sugestao?condominioId=&areaId=&assetId=&categoria=
//
// (Deliberately NOT under /inspections/* — Hono matches routes in
// registration order and inspections.ts already registers a catch-all
// `GET /inspections/:id`, which would swallow a path like
// `/inspections/suggest-prestador` before this handler ever ran.)
//
// Stateless — computes suggestions on the fly, writes nothing. Matches the
// asset's categoriaServico (if assetId given) or an explicit `categoria`
// query param against prestadores associated with the condomínio (via
// prestador_condominios, inheriting categoria from the master when the
// association doesn't override it — same COALESCE pattern used when
// listing a condomínio's prestadores). Ordered by avaliacao (association
// override, falling back to nothing — the master has no avaliacao field,
// that's condomínio-specific by design) descending, nulls last, top 5.
router.get("/prestadores/sugestao", requireAuth, async (c) => {
  const db = c.get("db");
  const auth = c.get("auth")!;
  const user = await upsertUser(db, auth.userId, auth.sessionClaims?.["email"] as string | undefined ?? "", auth.sessionClaims?.["name"] as string | undefined);

  const query = c.req.query();
  const condominioId = query.condominioId ? parseInt(query.condominioId, 10) : undefined;
  const assetId = query.assetId ? parseInt(query.assetId, 10) : undefined;
  let categoria = query.categoria as string | undefined;

  if (!condominioId || isNaN(condominioId)) return c.json({ error: "condominioId é obrigatório" }, 400);

  if (!categoria && assetId && !isNaN(assetId)) {
    const [asset] = await db.select({ categoriaServico: assetsTable.categoriaServico }).from(assetsTable).where(eq(assetsTable.id, assetId));
    categoria = asset?.categoriaServico ?? undefined;
  }
  if (!categoria) return c.json({ suggestions: [], reason: "Sem categoria de serviço para sugerir um prestador (defina categoriaServico no ativo, ou informe ?categoria=)." });

  // Same empresa-boundary spirit as authorizeCondominioAccess — a
  // global_admin can query any condomínio's suggestions, everyone else
  // only their own empresa's. We don't need the full authorizeCondominioAccess
  // here (read-only, non-destructive suggestion), but we still shouldn't let
  // a user probe another empresa's prestadores via this endpoint.
  if (user.role !== "global_admin") {
    const [condo] = await db.select({ empresaId: condominiosTable.empresaId }).from(condominiosTable).where(eq(condominiosTable.id, condominioId));
    if (!condo || user.empresaId === null || user.empresaId !== condo.empresaId) {
      return c.json({ error: "Acesso negado." }, 403);
    }
  }

  const rows = await db
    .select({ pc: prestadorCondominiosTable, p: prestadoresTable })
    .from(prestadorCondominiosTable)
    .innerJoin(prestadoresTable, eq(prestadoresTable.id, prestadorCondominiosTable.prestadorId))
    .where(and(eq(prestadorCondominiosTable.condominioId, condominioId), eq(prestadorCondominiosTable.ativo, true)))
    .orderBy(desc(prestadorCondominiosTable.avaliacao));

  const suggestions = rows
    .filter(({ pc, p }) => (pc.categoria ?? p.categoria) === categoria)
    .slice(0, 5)
    .map(({ pc, p }) => ({
      prestadorId: p.id,
      nome: p.nome,
      categoria: pc.categoria ?? p.categoria ?? null,
      telefone: pc.telefone ?? p.telefone ?? null,
      email: pc.email ?? p.email ?? null,
      avaliacao: pc.avaliacao ?? null,
    }));

  return c.json({ suggestions, categoria });
});

// POST /api/inspections/:id/acionamentos — confirm/create an acionamento
router.post("/inspections/:id/acionamentos", requireAuth, async (c) => {
  const inspectionId = parseInt(c.req.param("id")!, 10);
  if (isNaN(inspectionId)) return c.json({ error: "ID inválido" }, 400);
  const db = c.get("db");
  const auth = c.get("auth")!;
  const user = await upsertUser(db, auth.userId, auth.sessionClaims?.["email"] as string | undefined ?? "", auth.sessionClaims?.["name"] as string | undefined);

  const [inspection] = await db.select().from(inspectionsTable).where(eq(inspectionsTable.id, inspectionId));
  if (!inspection) return c.json({ error: "Vistoria não encontrada" }, 404);

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const prestadorId = body.prestadorId as number | undefined;
  if (!prestadorId) return c.json({ error: "prestadorId é obrigatório" }, 400);
  const status = (body.status as string) ?? "acionado";
  if (!VALID_ACIONAMENTO_STATUS.includes(status as any)) {
    return c.json({ error: `status inválido. Valores: ${VALID_ACIONAMENTO_STATUS.join(", ")}` }, 400);
  }

  const [created] = await db
    .insert(acionamentosTable)
    .values({
      inspectionId,
      assetId: (body.assetId as number) ?? inspection.assetId ?? null,
      areaId: (body.areaId as number) ?? inspection.areaId ?? null,
      prestadorId,
      status,
      observacoes: (body.observacoes as string) ?? null,
      createdByClerkId: user.clerkId,
    })
    .returning();
  return c.json(formatAcionamento(created), 201);
});

// GET /api/inspections/:id/acionamentos
router.get("/inspections/:id/acionamentos", requireAuth, async (c) => {
  const inspectionId = parseInt(c.req.param("id")!, 10);
  if (isNaN(inspectionId)) return c.json({ error: "ID inválido" }, 400);
  const db = c.get("db");
  const rows = await db.select().from(acionamentosTable).where(eq(acionamentosTable.inspectionId, inspectionId)).orderBy(desc(acionamentosTable.createdAt));
  return c.json(rows.map(formatAcionamento));
});

// PATCH /api/acionamentos/:id — update status/observacoes
router.patch("/acionamentos/:id", requireAuth, async (c) => {
  const id = parseInt(c.req.param("id")!, 10);
  if (isNaN(id)) return c.json({ error: "ID inválido" }, 400);
  const db = c.get("db");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!VALID_ACIONAMENTO_STATUS.includes(body.status as any)) {
      return c.json({ error: `status inválido. Valores: ${VALID_ACIONAMENTO_STATUS.join(", ")}` }, 400);
    }
    updateData.status = body.status;
  }
  if (body.observacoes !== undefined) updateData.observacoes = body.observacoes;
  updateData.updatedAt = new Date();

  const [updated] = await db.update(acionamentosTable).set(updateData).where(eq(acionamentosTable.id, id)).returning();
  if (!updated) return c.json({ error: "Acionamento não encontrado" }, 404);
  return c.json(formatAcionamento(updated));
});

// DELETE /api/acionamentos/:id
router.delete("/acionamentos/:id", requireAuth, async (c) => {
  const id = parseInt(c.req.param("id")!, 10);
  if (isNaN(id)) return c.json({ error: "ID inválido" }, 400);
  const db = c.get("db");
  await db.delete(acionamentosTable).where(eq(acionamentosTable.id, id));
  return c.json({ ok: true });
});

export default router;
