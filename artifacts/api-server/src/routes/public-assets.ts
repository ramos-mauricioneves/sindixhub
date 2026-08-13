import { Hono } from "hono";
import { assetsTable, condominiosTable, areasTable, inspectionsTable } from "@workspace/db/worker";
import { eq, desc } from "drizzle-orm";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

router.get("/public/assets/:assetId", async (c) => {
  const db = c.get("db");
  const assetId = parseInt(c.req.param("assetId")!, 10);
  if (isNaN(assetId)) return c.json({ error: "ID inválido" }, 400);

  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, assetId));
  if (!asset) return c.json({ error: "Ativo não encontrado" }, 404);

  const [condo] = await db.select().from(condominiosTable).where(eq(condominiosTable.id, asset.condominioId));
  const area = asset.areaId
    ? (await db.select().from(areasTable).where(eq(areasTable.id, asset.areaId)))[0]
    : undefined;

  const recentInspections = await db
    .select({
      id: inspectionsTable.id,
      tipo: inspectionsTable.tipo,
      urgencia: inspectionsTable.urgencia,
      resumo: inspectionsTable.resumo,
      createdAt: inspectionsTable.createdAt,
    })
    .from(inspectionsTable)
    .where(eq(inspectionsTable.assetId, assetId))
    .orderBy(desc(inspectionsTable.createdAt))
    .limit(5);

  return c.json({
    id: asset.id,
    nome: asset.nome,
    tipo: asset.tipo,
    criticidade: asset.criticidade,
    status: asset.status,
    descricao: asset.descricao ?? undefined,
    condominioNome: condo?.nome ?? "",
    areaNome: area?.nome ?? undefined,
    ultimasVistorias: recentInspections.map((i) => ({
      id: i.id,
      tipo: i.tipo,
      urgencia: i.urgencia,
      resumo: i.resumo,
      createdAt: i.createdAt,
    })),
  });
});

export default router;
