import { Hono } from "hono";
import { inspectionsTable, condominiosTable, assetsTable, userCondominiosTable } from "@workspace/db/worker";
import { eq, desc, and, inArray, gte } from "drizzle-orm";
import { requireAuth, upsertUser } from "../middlewares/requireAuth";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

interface AssembleiaTopic {
  titulo: string;
  categoria: string;
  prioridade: "alta" | "media" | "baixa";
  descricao: string;
  evidencias: number;
  condominios: string[];
  tiposEvento: string[];
  urgenciaMedia: string;
}

async function getUserCondominioIds(db: AppEnv["Variables"]["db"], userId: number): Promise<number[]> {
  const rows = await db.select().from(userCondominiosTable).where(eq(userCondominiosTable.userId, userId));
  return rows.map((r) => r.condominioId);
}

router.get("/assembleias/insights", requireAuth, async (c) => {
  const db = c.get("db");
  const auth = c.get("auth")!;
  const emailAddress = auth.sessionClaims?.["email"] as string | undefined;
  const name = auth.sessionClaims?.["name"] as string | undefined;
  const user = await upsertUser(db, auth.userId, emailAddress ?? "", name);

  const query = c.req.query();
  const months = parseInt(query.months as string) || 6;
  const filterCondominioId = query.condominioId ? parseInt(query.condominioId as string) : undefined;

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);

  let condoIds: number[] = [];
  if (user.role === "global_admin") {
    const allCondos = await db.select({ id: condominiosTable.id }).from(condominiosTable);
    condoIds = allCondos.map((c) => c.id);
  } else if ((user.role === "admin" || user.escopoEmpresa) && user.empresaId) {
    const allCondos = await db.select({ id: condominiosTable.id }).from(condominiosTable).where(eq(condominiosTable.empresaId, user.empresaId));
    condoIds = allCondos.map((c) => c.id);
  } else if (user.role === "sindico") {
    condoIds = await getUserCondominioIds(db, user.id);
  }

  if (filterCondominioId && condoIds.includes(filterCondominioId)) {
    condoIds = [filterCondominioId];
  } else if (filterCondominioId) {
    return c.json({ topics: [], totalInspections: 0, periodMonths: months, generatedAt: new Date().toISOString() });
  }

  const conditions = [gte(inspectionsTable.createdAt, cutoffDate)];
  if (condoIds.length > 0) {
    conditions.push(inArray(inspectionsTable.condominioId, condoIds));
  } else if (user.role === "vistoriador") {
    conditions.push(eq(inspectionsTable.createdByClerkId, auth.userId));
  }

  const inspections = await db.select().from(inspectionsTable)
    .where(and(...conditions))
    .orderBy(desc(inspectionsTable.createdAt));

  const condos = condoIds.length > 0
    ? await db.select().from(condominiosTable).where(inArray(condominiosTable.id, condoIds))
    : [];
  const condoNameMap = new Map(condos.map((c) => [c.id, c.nome]));

  const criticalAssets = condoIds.length > 0
    ? await db.select().from(assetsTable)
        .where(and(
          inArray(assetsTable.condominioId, condoIds),
          eq(assetsTable.criticidade, "alta"),
        ))
    : [];

  const maintenanceAssets = condoIds.length > 0
    ? await db.select().from(assetsTable)
        .where(and(
          inArray(assetsTable.condominioId, condoIds),
          eq(assetsTable.status, "em_manutencao"),
        ))
    : [];

  const topics: AssembleiaTopic[] = [];

  const melhorias = inspections.filter((i) => i.tipoEvento === "melhoria");
  if (melhorias.length > 0) {
    const condosSet = new Set(melhorias.map((i) => condoNameMap.get(i.condominioId!) || "").filter(Boolean));
    const tipoSet = new Set(melhorias.map((i) => i.tipo));
    const highUrgency = melhorias.filter((i) => i.urgencia === "alta").length;
    const avgUrgencia = highUrgency > melhorias.length / 2 ? "alta" : melhorias.some((i) => i.urgencia === "alta") ? "media" : "baixa";

    topics.push({
      titulo: "Melhorias Identificadas em Vistorias",
      categoria: "melhorias",
      prioridade: avgUrgencia,
      descricao: `${melhorias.length} melhoria(s) identificada(s) nas vistorias recentes. Tipos: ${Array.from(tipoSet).slice(0, 3).join(", ")}. Ação recomendada: apresentar plano de melhorias e orçamentos para aprovação.`,
      evidencias: melhorias.length,
      condominios: Array.from(condosSet),
      tiposEvento: ["melhoria"],
      urgenciaMedia: avgUrgencia,
    });
  }

  const incidentes = inspections.filter((i) => i.tipoEvento === "incidente");
  if (incidentes.length >= 2) {
    const condosSet = new Set(incidentes.map((i) => condoNameMap.get(i.condominioId!) || "").filter(Boolean));
    const highUrgency = incidentes.filter((i) => i.urgencia === "alta").length;

    topics.push({
      titulo: "Padrão de Incidentes Recorrentes",
      categoria: "seguranca",
      prioridade: highUrgency > 0 ? "alta" : "media",
      descricao: `${incidentes.length} incidente(s) registrado(s) no período. ${highUrgency > 0 ? `${highUrgency} de alta urgência. ` : ""}Sugere-se discutir medidas preventivas e investimentos em segurança.`,
      evidencias: incidentes.length,
      condominios: Array.from(condosSet),
      tiposEvento: ["incidente"],
      urgenciaMedia: highUrgency > incidentes.length / 2 ? "alta" : "media",
    });
  }

  const manutencoes = inspections.filter((i) => i.tipoEvento === "manutencao");
  if (manutencoes.length >= 2) {
    const condosSet = new Set(manutencoes.map((i) => condoNameMap.get(i.condominioId!) || "").filter(Boolean));
    const highUrgency = manutencoes.filter((i) => i.urgencia === "alta").length;
    const tipoSet = new Set(manutencoes.map((i) => i.tipo));

    topics.push({
      titulo: "Demandas de Manutenção Acumuladas",
      categoria: "manutencao",
      prioridade: highUrgency > 0 ? "alta" : "media",
      descricao: `${manutencoes.length} manutenção(ões) registrada(s). Problemas: ${Array.from(tipoSet).slice(0, 3).join(", ")}. Avaliar contratação de serviços especializados ou fundo de reserva.`,
      evidencias: manutencoes.length,
      condominios: Array.from(condosSet),
      tiposEvento: ["manutencao"],
      urgenciaMedia: highUrgency > manutencoes.length / 2 ? "alta" : "media",
    });
  }

  const vistoriasAlta = inspections.filter((i) => i.tipoEvento === "vistoria" && i.urgencia === "alta");
  if (vistoriasAlta.length > 0) {
    const condosSet = new Set(vistoriasAlta.map((i) => condoNameMap.get(i.condominioId!) || "").filter(Boolean));
    const tipoSet = new Set(vistoriasAlta.map((i) => i.tipo));

    topics.push({
      titulo: "Vistorias com Urgência Alta",
      categoria: "estrutural",
      prioridade: "alta",
      descricao: `${vistoriasAlta.length} vistoria(s) classificada(s) como urgência alta. Problemas: ${Array.from(tipoSet).slice(0, 3).join(", ")}. Requer deliberação imediata da assembleia.`,
      evidencias: vistoriasAlta.length,
      condominios: Array.from(condosSet),
      tiposEvento: ["vistoria"],
      urgenciaMedia: "alta",
    });
  }

  if (criticalAssets.length > 0) {
    const condosSet = new Set(criticalAssets.map((a) => condoNameMap.get(a.condominioId) || "").filter(Boolean));
    const tipoSet = new Set(criticalAssets.map((a) => a.tipo));

    topics.push({
      titulo: "Ativos com Criticidade Alta",
      categoria: "patrimonio",
      prioridade: "alta",
      descricao: `${criticalAssets.length} ativo(s) classificado(s) como criticidade alta (${Array.from(tipoSet).join(", ")}). Discutir plano de substituição ou manutenção preventiva.`,
      evidencias: criticalAssets.length,
      condominios: Array.from(condosSet),
      tiposEvento: [],
      urgenciaMedia: "alta",
    });
  }

  if (maintenanceAssets.length > 0) {
    const condosSet = new Set(maintenanceAssets.map((a) => condoNameMap.get(a.condominioId) || "").filter(Boolean));

    topics.push({
      titulo: "Ativos em Manutenção",
      categoria: "manutencao",
      prioridade: "media",
      descricao: `${maintenanceAssets.length} ativo(s) atualmente em manutenção. Apresentar status e previsão de conclusão dos reparos.`,
      evidencias: maintenanceAssets.length,
      condominios: Array.from(condosSet),
      tiposEvento: [],
      urgenciaMedia: "media",
    });
  }

  const tipoMap = new Map<string, number>();
  for (const i of inspections) {
    const count = tipoMap.get(i.tipo) || 0;
    tipoMap.set(i.tipo, count + 1);
  }
  const recurring = Array.from(tipoMap.entries()).filter(([, count]) => count >= 3);
  if (recurring.length > 0) {
    const condosSet = new Set(inspections.map((i) => condoNameMap.get(i.condominioId!) || "").filter(Boolean));

    topics.push({
      titulo: "Problemas Recorrentes Detectados",
      categoria: "recorrencia",
      prioridade: "media",
      descricao: `Tipos de problema repetidos: ${recurring.map(([tipo, count]) => `${tipo} (${count}x)`).join(", ")}. Sugere-se ação estrutural para evitar reincidência.`,
      evidencias: recurring.reduce((sum, [, count]) => sum + count, 0),
      condominios: Array.from(condosSet),
      tiposEvento: [...new Set(inspections.filter((i) => recurring.some(([t]) => t === i.tipo)).map((i) => i.tipoEvento))],
      urgenciaMedia: "media",
    });
  }

  topics.sort((a, b) => {
    const prio = { alta: 0, media: 1, baixa: 2 };
    return (prio[a.prioridade as keyof typeof prio] ?? 2) - (prio[b.prioridade as keyof typeof prio] ?? 2);
  });

  return c.json({
    topics,
    totalInspections: inspections.length,
    periodMonths: months,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
