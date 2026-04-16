import { Router } from "express";
import { db, lancamentosTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole, upsertUser } from "../middlewares/requireAuth";

const router = Router();

function fmt(l: typeof lancamentosTable.$inferSelect) {
  return {
    id: l.id,
    condominioId: l.condominioId,
    tipo: l.tipo,
    categoria: l.categoria,
    descricao: l.descricao,
    valor: l.valor,
    dataVencimento: l.dataVencimento,
    dataPagamento: l.dataPagamento ?? null,
    status: l.status,
    observacao: l.observacao ?? null,
    createdAt: l.createdAt,
  };
}

router.get("/condominios/:condominioId/lancamentos", requireAuth, async (req, res) => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  await upsertUser(auth.userId, emailAddress ?? "", name);

  const condominioId = parseInt(req.params.condominioId, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "condominioId inválido" }); return; }

  const conditions = [eq(lancamentosTable.condominioId, condominioId)];
  if (req.query.tipo) conditions.push(eq(lancamentosTable.tipo, req.query.tipo as string));
  if (req.query.status) conditions.push(eq(lancamentosTable.status, req.query.status as string));

  const rows = await db.select().from(lancamentosTable).where(and(...conditions)).orderBy(lancamentosTable.dataVencimento);
  res.json(rows.map(fmt));
});

router.post("/condominios/:condominioId/lancamentos", requireAuth, requireRole("admin", "sindico"), async (req, res) => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  await upsertUser(auth.userId, emailAddress ?? "", name);

  const condominioId = parseInt(req.params.condominioId, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "condominioId inválido" }); return; }

  const { tipo, categoria, descricao, valor, dataVencimento, dataPagamento, status, observacao } = req.body;
  if (!tipo || !categoria || !descricao || !valor || !dataVencimento) {
    res.status(400).json({ error: "tipo, categoria, descricao, valor e dataVencimento são obrigatórios" }); return;
  }
  if (!["receita", "despesa"].includes(tipo)) {
    res.status(400).json({ error: "tipo deve ser receita ou despesa" }); return;
  }

  const [created] = await db.insert(lancamentosTable).values({
    condominioId,
    tipo,
    categoria,
    descricao,
    valor,
    dataVencimento,
    dataPagamento: dataPagamento ?? null,
    status: status ?? "pendente",
    observacao: observacao ?? null,
  }).returning();

  res.status(201).json(fmt(created));
});

router.patch("/condominios/:condominioId/lancamentos/:lancamentoId", requireAuth, requireRole("admin", "sindico"), async (req, res) => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  await upsertUser(auth.userId, emailAddress ?? "", name);

  const lancamentoId = parseInt(req.params.lancamentoId, 10);
  if (isNaN(lancamentoId)) { res.status(400).json({ error: "lancamentoId inválido" }); return; }

  const { tipo, categoria, descricao, valor, dataVencimento, dataPagamento, status, observacao } = req.body;
  const updateData: Partial<typeof lancamentosTable.$inferInsert> = {};
  if (tipo !== undefined) updateData.tipo = tipo;
  if (categoria !== undefined) updateData.categoria = categoria;
  if (descricao !== undefined) updateData.descricao = descricao;
  if (valor !== undefined) updateData.valor = valor;
  if (dataVencimento !== undefined) updateData.dataVencimento = dataVencimento;
  if (dataPagamento !== undefined) updateData.dataPagamento = dataPagamento;
  if (status !== undefined) updateData.status = status;
  if (observacao !== undefined) updateData.observacao = observacao;

  const [updated] = await db.update(lancamentosTable).set(updateData).where(eq(lancamentosTable.id, lancamentoId)).returning();
  if (!updated) { res.status(404).json({ error: "Lançamento não encontrado" }); return; }
  res.json(fmt(updated));
});

router.delete("/condominios/:condominioId/lancamentos/:lancamentoId", requireAuth, requireRole("admin", "sindico"), async (req, res) => {
  const lancamentoId = parseInt(req.params.lancamentoId, 10);
  if (isNaN(lancamentoId)) { res.status(400).json({ error: "lancamentoId inválido" }); return; }
  await db.delete(lancamentosTable).where(eq(lancamentosTable.id, lancamentoId));
  res.status(204).send();
});

export default router;
