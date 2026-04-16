import { Router } from "express";
import { db, moradoresTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole, upsertUser } from "../middlewares/requireAuth";

const router = Router();

function fmt(m: typeof moradoresTable.$inferSelect) {
  return {
    id: m.id,
    condominioId: m.condominioId,
    unidade: m.unidade,
    nome: m.nome,
    tipo: m.tipo,
    telefone: m.telefone ?? null,
    email: m.email ?? null,
    ativo: m.ativo,
    createdAt: m.createdAt,
  };
}

router.get("/condominios/:condominioId/moradores", requireAuth, async (req, res) => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  await upsertUser(auth.userId, emailAddress ?? "", name);

  const condominioId = parseInt(req.params.condominioId, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "condominioId inválido" }); return; }

  const conditions = [eq(moradoresTable.condominioId, condominioId)];
  if (req.query.tipo) conditions.push(eq(moradoresTable.tipo, req.query.tipo as string));
  if (req.query.ativo !== undefined) {
    conditions.push(eq(moradoresTable.ativo, req.query.ativo === "true"));
  }

  const rows = await db.select().from(moradoresTable).where(and(...conditions)).orderBy(moradoresTable.unidade);
  res.json(rows.map(fmt));
});

router.post("/condominios/:condominioId/moradores", requireAuth, requireRole("admin", "sindico"), async (req, res) => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  await upsertUser(auth.userId, emailAddress ?? "", name);

  const condominioId = parseInt(req.params.condominioId, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "condominioId inválido" }); return; }

  const { unidade, nome, tipo, telefone, email, ativo } = req.body;
  if (!unidade || !nome || !tipo) {
    res.status(400).json({ error: "unidade, nome e tipo são obrigatórios" }); return;
  }
  if (!["proprietario", "inquilino", "morador", "dependente"].includes(tipo)) {
    res.status(400).json({ error: "tipo inválido" }); return;
  }

  const [created] = await db.insert(moradoresTable).values({
    condominioId,
    unidade,
    nome,
    tipo,
    telefone: telefone ?? null,
    email: email ?? null,
    ativo: ativo !== false,
  }).returning();

  res.status(201).json(fmt(created));
});

router.patch("/condominios/:condominioId/moradores/:moradorId", requireAuth, requireRole("admin", "sindico"), async (req, res) => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  await upsertUser(auth.userId, emailAddress ?? "", name);

  const moradorId = parseInt(req.params.moradorId, 10);
  if (isNaN(moradorId)) { res.status(400).json({ error: "moradorId inválido" }); return; }

  const { unidade, nome, tipo, telefone, email, ativo } = req.body;
  const updateData: Partial<typeof moradoresTable.$inferInsert> = {};
  if (unidade !== undefined) updateData.unidade = unidade;
  if (nome !== undefined) updateData.nome = nome;
  if (tipo !== undefined) updateData.tipo = tipo;
  if (telefone !== undefined) updateData.telefone = telefone;
  if (email !== undefined) updateData.email = email;
  if (ativo !== undefined) updateData.ativo = ativo;

  const [updated] = await db.update(moradoresTable).set(updateData).where(eq(moradoresTable.id, moradorId)).returning();
  if (!updated) { res.status(404).json({ error: "Morador não encontrado" }); return; }
  res.json(fmt(updated));
});

router.delete("/condominios/:condominioId/moradores/:moradorId", requireAuth, requireRole("admin", "sindico"), async (req, res) => {
  const moradorId = parseInt(req.params.moradorId, 10);
  if (isNaN(moradorId)) { res.status(400).json({ error: "moradorId inválido" }); return; }
  await db.delete(moradoresTable).where(eq(moradoresTable.id, moradorId));
  res.status(204).send();
});

export default router;
