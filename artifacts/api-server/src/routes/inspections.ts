import { Hono } from "hono";
import { inspectionsTable, userCondominiosTable, condominiosTable } from "@workspace/db/worker";
import { eq, desc, and, inArray } from "drizzle-orm";
import { requireAuth, upsertUser } from "../middlewares/requireAuth";
import { SaveInspectionBody, ListInspectionsQueryParams } from "@workspace/api-zod";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

async function getUserCondominioIds(db: AppEnv["Variables"]["db"], userId: number): Promise<number[]> {
  const rows = await db.select().from(userCondominiosTable).where(eq(userCondominiosTable.userId, userId));
  return rows.map((r) => r.condominioId);
}

router.get("/inspections", requireAuth, async (c) => {
  const db = c.get("db");
  const auth = c.get("auth")!;
  const emailAddress = auth.sessionClaims?.["email"] as string | undefined;
  const name = auth.sessionClaims?.["name"] as string | undefined;
  const user = await upsertUser(db, auth.userId, emailAddress ?? "", name);

  const query = c.req.query();
  const params = ListInspectionsQueryParams.safeParse(query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const urgenciaFilter = params.success ? params.data.urgencia : undefined;
  const offset = (page - 1) * limit;

  const statusFilter = typeof query.status === "string" ? query.status : undefined;
  const condominioIdFilter = typeof query.condominioId === "string" ? parseInt(query.condominioId, 10) : undefined;
  const areaIdFilter = typeof query.areaId === "string" ? parseInt(query.areaId, 10) : undefined;

  const conditions: any[] = [];

  // global_admin: no condition — sees inspections across every empresa,
  // same as before empresas existed. Every other role must be scoped:
  // previously "admin" fell through with zero conditions too (an implicit
  // "sees everything" that used to be correct when there was only one
  // tenant) — now that would leak other empresas' inspections, so
  // admin/escopoEmpresa get explicitly restricted to their own empresa's
  // condomínios below, same as sindico is restricted to their assigned ones.
  if (user.role === "vistoriador" && !user.escopoEmpresa) {
    conditions.push(eq(inspectionsTable.createdByClerkId, auth.userId));
  } else if (user.role === "sindico" && !user.escopoEmpresa) {
    const condoIds = await getUserCondominioIds(db, user.id);
    if (condoIds.length === 0) {
      return c.json({ inspections: [], total: 0, page, limit });
    }
    conditions.push(inArray(inspectionsTable.condominioId, condoIds));
  } else if (user.role !== "global_admin") {
    // admin, or any role with escopoEmpresa=true: restrict to own empresa.
    if (!user.empresaId) {
      return c.json({ inspections: [], total: 0, page, limit });
    }
    const empresaCondos = await db.select({ id: condominiosTable.id }).from(condominiosTable).where(eq(condominiosTable.empresaId, user.empresaId));
    const condoIds = empresaCondos.map((c) => c.id);
    if (condoIds.length === 0) {
      return c.json({ inspections: [], total: 0, page, limit });
    }
    conditions.push(inArray(inspectionsTable.condominioId, condoIds));
  }

  if (urgenciaFilter) conditions.push(eq(inspectionsTable.urgencia, urgenciaFilter));
  if (statusFilter) conditions.push(eq(inspectionsTable.status, statusFilter));
  if (condominioIdFilter && !isNaN(condominioIdFilter)) conditions.push(eq(inspectionsTable.condominioId, condominioIdFilter));
  if (areaIdFilter && !isNaN(areaIdFilter)) conditions.push(eq(inspectionsTable.areaId, areaIdFilter));

  const rows =
    conditions.length > 0
      ? await db.select().from(inspectionsTable).where(and(...conditions)).orderBy(desc(inspectionsTable.createdAt)).limit(limit).offset(offset)
      : await db.select().from(inspectionsTable).orderBy(desc(inspectionsTable.createdAt)).limit(limit).offset(offset);

  const allRows =
    conditions.length > 0
      ? await db.select().from(inspectionsTable).where(and(...conditions))
      : await db.select().from(inspectionsTable);

  return c.json({ inspections: rows, total: allRows.length, page, limit });
});

router.post("/inspections", requireAuth, async (c) => {
  const db = c.get("db");
  const auth = c.get("auth")!;
  const emailAddress = auth.sessionClaims?.["email"] as string | undefined;
  const name = auth.sessionClaims?.["name"] as string | undefined;
  const user = await upsertUser(db, auth.userId, emailAddress ?? "", name);

  const body = await c.req.json().catch(() => ({}));
  const parsed = SaveInspectionBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }

  const condominioId = typeof body.condominioId === "number" ? body.condominioId : null;
  const areaId = typeof body.areaId === "number" ? body.areaId : null;
  const assetId = typeof body.assetId === "number" ? body.assetId : null;
  const tipoEvento = typeof body.tipoEvento === "string" ? body.tipoEvento : "vistoria";
  const tipoVistoria = typeof body.tipoVistoria === "string" ? body.tipoVistoria : null;
  const escopo = typeof body.escopo === "string" ? body.escopo : "completa";
  const areasIds = typeof body.areasIds === "string" ? body.areasIds : null;
  const selectedAssetIds = typeof body.selectedAssetIds === "string" ? body.selectedAssetIds : null;
  const condominio = parsed.data.condominio ?? user.condominio ?? null;

  const [saved] = await db
    .insert(inspectionsTable)
    .values({
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
      assetId,
      tipoEvento,
      tipoVistoria,
      escopo,
      areasIds,
      selectedAssetIds,
      createdByClerkId: auth.userId,
    })
    .returning();

  return c.json(saved, 201);
});

router.get("/inspections/:id", requireAuth, async (c) => {
  const db = c.get("db");
  const auth = c.get("auth")!;
  const id = parseInt(c.req.param("id")!, 10);
  if (isNaN(id)) return c.json({ error: "ID inválido." }, 400);

  const emailAddress = auth.sessionClaims?.["email"] as string | undefined;
  const name = auth.sessionClaims?.["name"] as string | undefined;
  const user = await upsertUser(db, auth.userId, emailAddress ?? "", name);

  const [inspection] = await db.select().from(inspectionsTable).where(eq(inspectionsTable.id, id));
  if (!inspection) return c.json({ error: "Vistoria não encontrada." }, 404);

  if (user.role === "vistoriador" && inspection.createdByClerkId !== auth.userId) {
    return c.json({ error: "Acesso negado." }, 403);
  }
  if (user.role === "sindico") {
    const condoIds = await getUserCondominioIds(db, user.id);
    if (inspection.condominioId && !condoIds.includes(inspection.condominioId)) {
      return c.json({ error: "Acesso negado." }, 403);
    }
  }

  return c.json(inspection);
});

router.patch("/inspections/:id/status", requireAuth, async (c) => {
  const db = c.get("db");
  const auth = c.get("auth")!;
  const id = parseInt(c.req.param("id")!, 10);
  if (isNaN(id)) return c.json({ error: "ID inválido." }, 400);

  const emailAddress = auth.sessionClaims?.["email"] as string | undefined;
  const name = auth.sessionClaims?.["name"] as string | undefined;
  const user = await upsertUser(db, auth.userId, emailAddress ?? "", name);

  if (user.role === "vistoriador") {
    return c.json({ error: "Apenas síndicos podem enviar comunicados." }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const { status } = body;
  if (!["pronto_para_envio", "enviado"].includes(status)) {
    return c.json({ error: "Status inválido" }, 400);
  }

  const [updated] = await db.update(inspectionsTable).set({ status }).where(eq(inspectionsTable.id, id)).returning();

  if (!updated) return c.json({ error: "Vistoria não encontrada." }, 404);
  return c.json(updated);
});

export default router;
