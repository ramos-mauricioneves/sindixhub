import { Router } from "express";
import { db, inspectionsTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, upsertUser } from "../middlewares/requireAuth";
import { SaveInspectionBody, ListInspectionsQueryParams } from "@workspace/api-zod";

const router = Router();

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

  let query = db.select().from(inspectionsTable);

  if (user.role === "vistoriador") {
    const conditions = [eq(inspectionsTable.createdByClerkId, auth.userId)];
    if (urgenciaFilter) {
      conditions.push(eq(inspectionsTable.urgencia, urgenciaFilter));
    }
    const rows = await query.where(and(...conditions)).orderBy(desc(inspectionsTable.createdAt)).limit(limit).offset(offset);
    const totalRows = await db.select().from(inspectionsTable).where(eq(inspectionsTable.createdByClerkId, auth.userId));
    res.json({ inspections: rows, total: totalRows.length, page, limit });
    return;
  }

  if (user.role === "sindico" && user.condominio) {
    const conditions = [eq(inspectionsTable.condominio, user.condominio)];
    if (urgenciaFilter) {
      conditions.push(eq(inspectionsTable.urgencia, urgenciaFilter));
    }
    const rows = await query.where(and(...conditions)).orderBy(desc(inspectionsTable.createdAt)).limit(limit).offset(offset);
    const totalRows = await db.select().from(inspectionsTable).where(eq(inspectionsTable.condominio, user.condominio));
    res.json({ inspections: rows, total: totalRows.length, page, limit });
    return;
  }

  const conditions = urgenciaFilter ? [eq(inspectionsTable.urgencia, urgenciaFilter)] : [];
  const rows = conditions.length > 0
    ? await query.where(and(...conditions)).orderBy(desc(inspectionsTable.createdAt)).limit(limit).offset(offset)
    : await query.orderBy(desc(inspectionsTable.createdAt)).limit(limit).offset(offset);

  const totalRows = await db.select().from(inspectionsTable);
  res.json({ inspections: rows, total: totalRows.length, page, limit });
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
    createdByClerkId: auth.userId,
  }).returning();

  res.status(201).json(saved);
});

router.get("/inspections/:id", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth!;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }

  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);

  const [inspection] = await db.select().from(inspectionsTable).where(eq(inspectionsTable.id, id));

  if (!inspection) {
    res.status(404).json({ error: "Vistoria não encontrada." });
    return;
  }

  if (user.role === "vistoriador" && inspection.createdByClerkId !== auth.userId) {
    res.status(403).json({ error: "Acesso negado." });
    return;
  }

  if (user.role === "sindico" && user.condominio && inspection.condominio !== user.condominio) {
    res.status(403).json({ error: "Acesso negado." });
    return;
  }

  res.json(inspection);
});

export default router;
