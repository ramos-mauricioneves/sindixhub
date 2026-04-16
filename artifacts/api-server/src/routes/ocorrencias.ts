import { Router } from "express";
import { db, ocorrenciasTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireRole, upsertUser } from "../middlewares/requireAuth";

const router = Router();

const VALID_CATEGORIAS = ["manutencao", "barulho", "seguranca", "limpeza", "estacionamento", "infiltracao", "elevador", "outros"];
const VALID_PRIORIDADES = ["baixa", "media", "alta"];
const VALID_STATUSES = ["aberta", "em_andamento", "resolvida", "fechada"];
const VALID_TRANSITIONS: Record<string, string[]> = {
  aberta: ["em_andamento", "resolvida", "fechada"],
  em_andamento: ["resolvida", "fechada"],
  resolvida: ["fechada"],
  fechada: [],
};

function fmt(o: typeof ocorrenciasTable.$inferSelect) {
  return {
    id: o.id,
    condominioId: o.condominioId,
    moradorNome: o.moradorNome,
    unidade: o.unidade,
    categoria: o.categoria,
    titulo: o.titulo,
    descricao: o.descricao,
    prioridade: o.prioridade,
    status: o.status,
    resposta: o.resposta ?? null,
    resolvidoEm: o.resolvidoEm ?? null,
    createdAt: o.createdAt,
  };
}

router.get("/condominios/:condominioId/ocorrencias", requireAuth, async (req, res) => {
  const auth = req.auth!;
  await upsertUser(auth.userId, (auth as any).sessionClaims?.email ?? "", (auth as any).sessionClaims?.name);

  const condominioId = parseInt(req.params.condominioId, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "condominioId inválido" }); return; }

  const conditions = [eq(ocorrenciasTable.condominioId, condominioId)];
  if (req.query.status) {
    if (!VALID_STATUSES.includes(req.query.status as string)) {
      res.status(400).json({ error: "Status inválido" }); return;
    }
    conditions.push(eq(ocorrenciasTable.status, req.query.status as string));
  }
  if (req.query.prioridade) {
    if (!VALID_PRIORIDADES.includes(req.query.prioridade as string)) {
      res.status(400).json({ error: "Prioridade inválida" }); return;
    }
    conditions.push(eq(ocorrenciasTable.prioridade, req.query.prioridade as string));
  }
  if (req.query.categoria) {
    if (!VALID_CATEGORIAS.includes(req.query.categoria as string)) {
      res.status(400).json({ error: "Categoria inválida" }); return;
    }
    conditions.push(eq(ocorrenciasTable.categoria, req.query.categoria as string));
  }

  const rows = await db.select().from(ocorrenciasTable).where(and(...conditions)).orderBy(desc(ocorrenciasTable.createdAt));
  res.json(rows.map(fmt));
});

router.post("/condominios/:condominioId/ocorrencias", requireAuth, async (req, res) => {
  const auth = req.auth!;
  await upsertUser(auth.userId, (auth as any).sessionClaims?.email ?? "", (auth as any).sessionClaims?.name);

  const condominioId = parseInt(req.params.condominioId, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "condominioId inválido" }); return; }

  const { moradorNome, unidade, categoria, titulo, descricao, prioridade } = req.body;
  if (!moradorNome || !unidade || !categoria || !titulo || !descricao) {
    res.status(400).json({ error: "moradorNome, unidade, categoria, titulo e descricao são obrigatórios" }); return;
  }

  if (!VALID_CATEGORIAS.includes(categoria)) {
    res.status(400).json({ error: "Categoria inválida" }); return;
  }

  if (prioridade && !VALID_PRIORIDADES.includes(prioridade)) {
    res.status(400).json({ error: "Prioridade inválida. Valores: baixa, media, alta" }); return;
  }

  const [created] = await db.insert(ocorrenciasTable).values({
    condominioId,
    moradorNome,
    unidade,
    categoria,
    titulo,
    descricao,
    prioridade: prioridade ?? "media",
    status: "aberta",
  }).returning();

  res.status(201).json(fmt(created));
});

router.patch("/condominios/:condominioId/ocorrencias/:ocorrenciaId", requireAuth, requireRole("admin", "sindico"), async (req, res) => {
  const auth = req.auth!;
  await upsertUser(auth.userId, (auth as any).sessionClaims?.email ?? "", (auth as any).sessionClaims?.name);

  const condominioId = parseInt(req.params.condominioId, 10);
  const ocorrenciaId = parseInt(req.params.ocorrenciaId, 10);
  if (isNaN(condominioId) || isNaN(ocorrenciaId)) { res.status(400).json({ error: "IDs inválidos" }); return; }

  const [current] = await db.select().from(ocorrenciasTable).where(
    and(eq(ocorrenciasTable.id, ocorrenciaId), eq(ocorrenciasTable.condominioId, condominioId))
  );
  if (!current) { res.status(404).json({ error: "Ocorrência não encontrada neste condomínio" }); return; }

  const { status, resposta, prioridade } = req.body;
  const updateData: Partial<typeof ocorrenciasTable.$inferInsert> = {};

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: "Status inválido. Valores: aberta, em_andamento, resolvida, fechada" }); return;
    }
    const allowed = VALID_TRANSITIONS[current.status] || [];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: `Transição inválida: ${current.status} → ${status}. Permitido: ${allowed.join(", ")}` }); return;
    }
    updateData.status = status;
    if (status === "resolvida" || status === "fechada") {
      updateData.resolvidoEm = new Date();
    }
  }

  if (prioridade !== undefined) {
    if (!VALID_PRIORIDADES.includes(prioridade)) {
      res.status(400).json({ error: "Prioridade inválida" }); return;
    }
    updateData.prioridade = prioridade;
  }

  if (resposta !== undefined) updateData.resposta = resposta;

  const [updated] = await db.update(ocorrenciasTable).set(updateData).where(
    and(eq(ocorrenciasTable.id, ocorrenciaId), eq(ocorrenciasTable.condominioId, condominioId))
  ).returning();

  res.json(fmt(updated));
});

router.delete("/condominios/:condominioId/ocorrencias/:ocorrenciaId", requireAuth, requireRole("admin", "sindico"), async (req, res) => {
  const condominioId = parseInt(req.params.condominioId, 10);
  const ocorrenciaId = parseInt(req.params.ocorrenciaId, 10);
  if (isNaN(condominioId) || isNaN(ocorrenciaId)) { res.status(400).json({ error: "IDs inválidos" }); return; }

  await db.delete(ocorrenciasTable).where(
    and(eq(ocorrenciasTable.id, ocorrenciaId), eq(ocorrenciasTable.condominioId, condominioId))
  );
  res.status(204).send();
});

export default router;
