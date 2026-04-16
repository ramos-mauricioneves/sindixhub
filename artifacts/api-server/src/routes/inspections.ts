import { Router } from "express";
import { db, inspectionsTable, userCondominiosTable } from "@workspace/db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { requireAuth, upsertUser } from "../middlewares/requireAuth";
import { SaveInspectionBody, ListInspectionsQueryParams } from "@workspace/api-zod";

const router = Router();

async function getUserCondominioIds(userId: number): Promise<number[]> {
  const rows = await db.select().from(userCondominiosTable).where(eq(userCondominiosTable.userId, userId));
  return rows.map(r => r.condominioId);
}

router.get("/inspections", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);

  const params = ListInspectionsQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const urgenciaFilter = params.success ? params.data.urgencia : undefined;
  const offset = (page - 1) * limit;

  const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
  const condominioIdFilter = typeof req.query.condominioId === "string" ? parseInt(req.query.condominioId, 10) : undefined;
  const areaIdFilter = typeof req.query.areaId === "string" ? parseInt(req.query.areaId, 10) : undefined;

  const conditions: any[] = [];

  if (user.role === "vistoriador") {
    conditions.push(eq(inspectionsTable.createdByClerkId, auth.userId));
  } else if (user.role === "sindico") {
    const condoIds = await getUserCondominioIds(user.id);
    if (condoIds.length === 0) {
      res.json({ inspections: [], total: 0, page, limit });
      return;
    }
    conditions.push(inArray(inspectionsTable.condominioId, condoIds));
  }

  if (urgenciaFilter) conditions.push(eq(inspectionsTable.urgencia, urgenciaFilter));
  if (statusFilter) conditions.push(eq(inspectionsTable.status, statusFilter));
  if (condominioIdFilter && !isNaN(condominioIdFilter)) conditions.push(eq(inspectionsTable.condominioId, condominioIdFilter));
  if (areaIdFilter && !isNaN(areaIdFilter)) conditions.push(eq(inspectionsTable.areaId, areaIdFilter));

  const rows = conditions.length > 0
    ? await db.select().from(inspectionsTable).where(and(...conditions)).orderBy(desc(inspectionsTable.createdAt)).limit(limit).offset(offset)
    : await db.select().from(inspectionsTable).orderBy(desc(inspectionsTable.createdAt)).limit(limit).offset(offset);

  const allRows = conditions.length > 0
    ? await db.select().from(inspectionsTable).where(and(...conditions))
    : await db.select().from(inspectionsTable);

  res.json({ inspections: rows, total: allRows.length, page, limit });
});

router.post("/inspections", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);

  const parsed = SaveInspectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const condominioId = typeof req.body.condominioId === "number" ? req.body.condominioId : null;
  const areaId = typeof req.body.areaId === "number" ? req.body.areaId : null;
  const condominio = parsed.data.condominio ?? user.condominio ?? null;

  const [saved] = await db.insert(inspectionsTable).values({
    tipo: parsed.data.tipo,
    urgencia: parsed.data.urgencia,
    acao: parsed.data.acao,
    resumo: parsed.data.resumo,
    comunicado: parsed.data.comunicado,
    transcricao: parsed.data.transcricao ?? null,
    analise_imagens: parsed.data.analise_imagens ?? null,
    local: parsed.data.local ?? null,
    condominio,
    status: "gerado",
    condominioId,
    areaId,
    createdByClerkId: auth.userId,
  }).returning();

  res.status(201).json(saved);
});

router.get("/inspections/:id", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth!;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido." }); return; }

  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);

  const [inspection] = await db.select().from(inspectionsTable).where(eq(inspectionsTable.id, id));
  if (!inspection) { res.status(404).json({ error: "Vistoria não encontrada." }); return; }

  if (user.role === "vistoriador" && inspection.createdByClerkId !== auth.userId) {
    res.status(403).json({ error: "Acesso negado." }); return;
  }
  if (user.role === "sindico") {
    const condoIds = await getUserCondominioIds(user.id);
    if (inspection.condominioId && !condoIds.includes(inspection.condominioId)) {
      res.status(403).json({ error: "Acesso negado." }); return;
    }
  }

  res.json(inspection);
});

router.patch("/inspections/:id/status", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth!;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido." }); return; }

  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);

  if (user.role === "vistoriador") {
    res.status(403).json({ error: "Apenas síndicos podem enviar comunicados." }); return;
  }

  const { status } = req.body;
  if (!["pronto_para_envio", "enviado"].includes(status)) {
    res.status(400).json({ error: "Status inválido" }); return;
  }

  const [updated] = await db.update(inspectionsTable)
    .set({ status })
    .where(eq(inspectionsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Vistoria não encontrada." }); return; }
  res.json(updated);
});

export default router;
