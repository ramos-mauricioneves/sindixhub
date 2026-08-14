import { Hono } from "hono";
import { assetsTable, inspectionsTable, condominiosTable, userCondominiosTable } from "@workspace/db/worker";
import { eq, desc, and, inArray, gte, sql } from "drizzle-orm";
import { requireAuth, upsertUser } from "../middlewares/requireAuth";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

async function getUserCondominioIds(db: AppEnv["Variables"]["db"], userId: number): Promise<number[]> {
  const rows = await db.select().from(userCondominiosTable).where(eq(userCondominiosTable.userId, userId));
  return rows.map((r) => r.condominioId);
}

// GET /dashboard/summary
router.get("/dashboard/summary", requireAuth, async (c) => {
  const db = c.get("db");
  const auth = c.get("auth")!;
  const emailAddress = auth.sessionClaims?.["email"] as string | undefined;
  const name = auth.sessionClaims?.["name"] as string | undefined;
  const user = await upsertUser(db, auth.userId, emailAddress ?? "", name);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let condoIds: number[] = [];
  let assetCondition: any = undefined;
  let inspectionCondition: any = undefined;
  // global_admin sees literally everything (all empresas); admin/escopoEmpresa
  // see everything WITHIN their own empresa — neither of these existed as a
  // distinct case before empresas were introduced, so the old "admin sees
  // every condominio in the deployment" behavior would now leak across
  // tenants if left unscoped.
  const isUnrestrictedGlobal = user.role === "global_admin";
  const isUnrestrictedInEmpresa = (user.role === "admin" || user.escopoEmpresa) && !!user.empresaId;

  if (isUnrestrictedGlobal) {
    const allCondos = await db.select({ id: condominiosTable.id }).from(condominiosTable);
    condoIds = allCondos.map((c) => c.id);
  } else if (isUnrestrictedInEmpresa) {
    const allCondos = await db.select({ id: condominiosTable.id }).from(condominiosTable).where(eq(condominiosTable.empresaId, user.empresaId!));
    condoIds = allCondos.map((c) => c.id);
  } else if (user.role === "sindico") {
    condoIds = await getUserCondominioIds(db, user.id);
    if (condoIds.length > 0) {
      assetCondition = inArray(assetsTable.condominioId, condoIds);
      inspectionCondition = inArray(inspectionsTable.condominioId, condoIds);
    }
  } else {
    condoIds = [];
    inspectionCondition = eq(inspectionsTable.createdByClerkId, auth.userId);
  }

  if (isUnrestrictedInEmpresa && condoIds.length > 0) {
    assetCondition = inArray(assetsTable.condominioId, condoIds);
    inspectionCondition = inArray(inspectionsTable.condominioId, condoIds);
  }

  const totalCondominios = isUnrestrictedGlobal || isUnrestrictedInEmpresa || user.role === "sindico" ? condoIds.length : 0;

  const allAssets = assetCondition
    ? await db.select().from(assetsTable).where(assetCondition)
    : isUnrestrictedGlobal
      ? await db.select().from(assetsTable)
      : [];

  const totalAssets = allAssets.length;
  const assetsOperacional = allAssets.filter((a) => a.status === "operacional").length;
  const assetsEmManutencao = allAssets.filter((a) => a.status === "em_manutencao").length;
  const assetsInativo = allAssets.filter((a) => a.status === "inativo").length;
  const assetsCriticos = allAssets.filter((a) => a.criticidade === "alta").length;

  const criticalAssets = allAssets
    .filter((a) => a.criticidade === "alta")
    .slice(0, 6)
    .map((a) => ({
      id: a.id, condominioId: a.condominioId, areaId: a.areaId, nome: a.nome,
      tipo: a.tipo, criticidade: a.criticidade, status: a.status, descricao: a.descricao,
      createdAt: a.createdAt, updatedAt: a.updatedAt,
    }));

  const recentEventsQuery = db.select().from(inspectionsTable)
    .where(and(
      inspectionCondition ? inspectionCondition : sql`true`,
      gte(inspectionsTable.createdAt, thirtyDaysAgo),
    ))
    .orderBy(desc(inspectionsTable.createdAt))
    .limit(5);

  const allEventsQuery = db.select().from(inspectionsTable)
    .where(and(
      inspectionCondition ? inspectionCondition : sql`true`,
      gte(inspectionsTable.createdAt, thirtyDaysAgo),
    ));

  const [recentEvents, allEvents30d] = await Promise.all([recentEventsQuery, allEventsQuery]);

  const totalEventos30d = allEvents30d.length;
  const eventosAlta = allEvents30d.filter((e) => e.urgencia === "alta").length;
  const eventosMedios = allEvents30d.filter((e) => e.urgencia === "média").length;

  return c.json({
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
