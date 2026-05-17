import { Router } from "express";
import { db, assetsTable, condominiosTable, areasTable, inspectionsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

router.get("/public/assets/:assetId", async (req, res): Promise<void> => {
  const assetId = parseInt(req.params.assetId as string, 10);
  if (isNaN(assetId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, assetId));
  if (!asset) {
    res.status(404).json({ error: "Ativo não encontrado" });
    return;
  }

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

  res.json({
    id: asset.id,
    nome: asset.nome,
    tipo: asset.tipo,
    criticidade: asset.criticidade,
    status: asset.status,
    descricao: asset.descricao ?? undefined,
    condominioNome: condo?.nome ?? "",
    areaNome: area?.nome ?? undefined,
    ultimasVistorias: recentInspections.map(i => ({
      id: i.id,
      tipo: i.tipo,
      urgencia: i.urgencia,
      resumo: i.resumo,
      createdAt: i.createdAt,
    })),
  });
});

export default router;
