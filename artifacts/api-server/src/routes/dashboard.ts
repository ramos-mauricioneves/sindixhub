import { Router } from "express";
import { db, assetsTable, inspectionsTable, condominiosTable, userCondominiosTable } from "@workspace/db";
import { eq, desc, and, inArray, gte, sql } from "drizzle-orm";
import { requireAuth, upsertUser } from "../middlewares/requireAuth";

const router = Router();

async function getUserCondominioIds(userId: number): Promise<number[]> {
  const rows = await db.select().from(userCondominiosTable).where(eq(userCondominiosTable.userId, userId));
  return rows.map(r => r.condominioId);
}

// GET /dashboard/summary
router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let condoIds: number[] = [];
  let condominioCondition: any = undefined;
  let assetCondition: any = undefined;
  let inspectionCondition: any = undefined;

  if (user.role === "admin") {
    const allCondos = await db.select({ id: condominiosTable.id }).from(condominiosTable);
    condoIds = allCondos.map(c => c.id);
  } else if (user.role === "sindico") {
    condoIds = await getUserCondominioIds(user.id);
    if (condoIds.length > 0) {
      condominioCondition = inArray(condominiosTable.id, condoIds);
      assetCondition = inArray(assetsTable.condominioId, condoIds);
      inspectionCondition = inArray(inspectionsTable.condominioId, condoIds);
    }
  } else {
    condoIds = [];
    inspectionCondition = eq(inspectionsTable.createdByClerkId, auth.userId);
  }

  const totalCondominios = user.role === "admin"
    ? condoIds.length
    : user.role === "sindico" ? condoIds.length : 0;

  const allAssets = assetCondition
    ? await db.select().from(assetsTable).where(assetCondition)
    : user.role === "admin"
    ? await db.select().from(assetsTable)
    : [];

  const totalAssets = allAssets.length;
  const assetsOperacional = allAssets.filter(a => a.status === "operacional").length;
  const assetsEmManutencao = allAssets.filter(a => a.status === "em_manutencao").length;
  const assetsInativo = allAssets.filter(a => a.status === "inativo").length;
  const assetsCriticos = allAssets.filter(a => a.criticidade === "alta").length;

  const criticalAssets = allAssets
    .filter(a => a.criticidade === "alta")
    .slice(0, 6)
    .map(a => ({
      id: a.id, condominioId: a.condominioId, areaId: a.areaId, nome: a.nome,
      tipo: a.tipo, criticidade: a.criticidade, status: a.status, descricao: a.descricao,
      createdAt: a.createdAt, updatedAt: a.updatedAt,
    }));

  const recentEventsQuery = db.select().from(inspectionsTable)
    .where(and(
      inspectionCondition ? inspectionCondition : sql`true`,
      gte(inspectionsTable.createdAt, thirtyDaysAgo)
    ))
    .orderBy(desc(inspectionsTable.createdAt))
    .limit(5);

  const allEventsQuery = db.select().from(inspectionsTable)
    .where(and(
      inspectionCondition ? inspectionCondition : sql`true`,
      gte(inspectionsTable.createdAt, thirtyDaysAgo)
    ));

  const [recentEvents, allEvents30d] = await Promise.all([recentEventsQuery, allEventsQuery]);

  const totalEventos30d = allEvents30d.length;
  const eventosAlta = allEvents30d.filter(e => e.urgencia === "alta").length;
  const eventosMedios = allEvents30d.filter(e => e.urgencia === "média").length;

  res.json({
    totalCondominios,
    totalAssets,
    assetsOperacional,
    assetsEmManutencao,
    assetsInativo,
    assetsCriticos,
    totalEventos30d,
    eventosAlta,
    eventosMedios,
    recentEvents,
    criticalAssets,
  });
});

export default router;
