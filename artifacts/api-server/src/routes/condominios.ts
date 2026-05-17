import { Router } from "express";
import { db, condominiosTable, areasTable, userCondominiosTable, usersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireRole, upsertUser } from "../middlewares/requireAuth";

const router = Router();

const VALID_TIPO_CONDOMINIO = ["residencial", "comercial", "misto"];
const VALID_AREA_TIPOS = ["comum", "lazer", "esportiva", "social", "servico", "estacionamento", "infantil", "predial", "administrativa", "manutencao", "circulacao"];
const VALID_PRIVACIDADE = ["publica", "privada", "mista"];

function formatCondo(c: typeof condominiosTable.$inferSelect) {
  return {
    id: c.id,
    nome: c.nome,
    cnpj: c.cnpj ?? null,
    tipoCondominio: c.tipoCondominio,
    endereco: c.endereco ?? null,
    cep: c.cep ?? null,
    bairro: c.bairro ?? null,
    cidade: c.cidade ?? null,
    estado: c.estado ?? null,
    totalUnidades: c.totalUnidades ?? null,
    totalBlocos: c.totalBlocos ?? null,
    totalAndares: c.totalAndares ?? null,
    anoConstrucao: c.anoConstrucao ?? null,
    telefone: c.telefone ?? null,
    email: c.email ?? null,
    sindico: c.sindico ?? null,
    zelador: c.zelador ?? null,
    administradora: c.administradora ?? null,
    ativo: c.ativo,
    createdAt: c.createdAt,
  };
}

function formatArea(a: typeof areasTable.$inferSelect) {
  return {
    id: a.id,
    condominioId: a.condominioId,
    nome: a.nome,
    tipo: a.tipo,
    bloco: a.bloco ?? null,
    andar: a.andar ?? null,
    privacidade: a.privacidade,
    descricao: a.descricao ?? null,
    capacidade: a.capacidade ?? null,
    reservavel: a.reservavel,
    horarioAbertura: a.horarioAbertura ?? null,
    horarioFechamento: a.horarioFechamento ?? null,
    ativo: a.ativo,
    createdAt: a.createdAt,
  };
}

async function getUserCondominioIds(userId: number): Promise<number[]> {
  const rows = await db.select().from(userCondominiosTable).where(eq(userCondominiosTable.userId, userId));
  return rows.map(r => r.condominioId);
}

router.get("/condominios", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);

  if (user.role === "admin") {
    const all = await db.select().from(condominiosTable).orderBy(condominiosTable.nome);
    res.json(all.map(formatCondo));
    return;
  }

  const condoIds = await getUserCondominioIds(user.id);
  if (condoIds.length === 0) { res.json([]); return; }
  const rows = await db.select().from(condominiosTable).where(inArray(condominiosTable.id, condoIds)).orderBy(condominiosTable.nome);
  res.json(rows.map(formatCondo));
});

router.post("/condominios", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { nome, cnpj, tipoCondominio, endereco, cep, bairro, cidade, estado,
    totalUnidades, totalBlocos, totalAndares, anoConstrucao, telefone, email,
    sindico, zelador, administradora, ativo } = req.body;
  if (!nome || typeof nome !== "string") { res.status(400).json({ error: "nome é obrigatório" }); return; }

  if (tipoCondominio && !VALID_TIPO_CONDOMINIO.includes(tipoCondominio)) {
    res.status(400).json({ error: "tipoCondominio inválido. Valores: residencial, comercial, misto" }); return;
  }

  const [created] = await db.insert(condominiosTable).values({
    nome,
    cnpj: cnpj ?? null,
    tipoCondominio: tipoCondominio ?? "residencial",
    endereco: endereco ?? null,
    cep: cep ?? null,
    bairro: bairro ?? null,
    cidade: cidade ?? null,
    estado: estado ?? null,
    totalUnidades: totalUnidades ? parseInt(totalUnidades) : null,
    totalBlocos: totalBlocos ? parseInt(totalBlocos) : null,
    totalAndares: totalAndares ? parseInt(totalAndares) : null,
    anoConstrucao: anoConstrucao ? parseInt(anoConstrucao) : null,
    telefone: telefone ?? null,
    email: email ?? null,
    sindico: sindico ?? null,
    zelador: zelador ?? null,
    administradora: administradora ?? null,
    ativo: ativo !== false,
  }).returning();
  res.status(201).json(formatCondo(created));
});

router.get("/condominios/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [condo] = await db.select().from(condominiosTable).where(eq(condominiosTable.id, id));
  if (!condo) { res.status(404).json({ error: "Condomínio não encontrado" }); return; }
  res.json(formatCondo(condo));
});

router.patch("/condominios/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const { nome, cnpj, tipoCondominio, endereco, cep, bairro, cidade, estado,
    totalUnidades, totalBlocos, totalAndares, anoConstrucao, telefone, email,
    sindico, zelador, administradora, ativo } = req.body;
  if (!nome || typeof nome !== "string") { res.status(400).json({ error: "nome é obrigatório" }); return; }

  if (tipoCondominio && !VALID_TIPO_CONDOMINIO.includes(tipoCondominio)) {
    res.status(400).json({ error: "tipoCondominio inválido" }); return;
  }

  const [updated] = await db.update(condominiosTable)
    .set({
      nome,
      cnpj: cnpj ?? null,
      tipoCondominio: tipoCondominio ?? "residencial",
      endereco: endereco ?? null,
      cep: cep ?? null,
      bairro: bairro ?? null,
      cidade: cidade ?? null,
      estado: estado ?? null,
      totalUnidades: totalUnidades != null ? parseInt(totalUnidades) : null,
      totalBlocos: totalBlocos != null ? parseInt(totalBlocos) : null,
      totalAndares: totalAndares != null ? parseInt(totalAndares) : null,
      anoConstrucao: anoConstrucao != null ? parseInt(anoConstrucao) : null,
      telefone: telefone ?? null,
      email: email ?? null,
      sindico: sindico ?? null,
      zelador: zelador ?? null,
      administradora: administradora ?? null,
      ativo: ativo !== false,
    })
    .where(eq(condominiosTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Condomínio não encontrado" }); return; }
  res.json(formatCondo(updated));
});

router.get("/condominios/:condominioId/areas", requireAuth, async (req, res): Promise<void> => {
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const rows = await db.select().from(areasTable).where(eq(areasTable.condominioId, condominioId)).orderBy(areasTable.tipo, areasTable.nome);
  res.json(rows.map(formatArea));
});

router.post("/condominios/:condominioId/areas", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);
  if (user.role === "vistoriador") { res.status(403).json({ error: "Acesso negado." }); return; }

  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { nome, tipo, bloco, andar, privacidade, descricao, capacidade, reservavel, horarioAbertura, horarioFechamento } = req.body;
  if (!nome || !tipo) { res.status(400).json({ error: "nome e tipo são obrigatórios" }); return; }
  if (typeof tipo !== "string" || !tipo.trim()) { res.status(400).json({ error: "tipo deve ser uma string não vazia" }); return; }
  if (privacidade !== undefined && privacidade !== null && !VALID_PRIVACIDADE.includes(privacidade)) {
    res.status(400).json({ error: `privacidade inválida. Valores: ${VALID_PRIVACIDADE.join(", ")}` }); return;
  }
  let parsedAndar: number | null = null;
  if (andar != null && andar !== "") {
    parsedAndar = parseInt(andar, 10);
    if (isNaN(parsedAndar) || !isFinite(parsedAndar)) {
      res.status(400).json({ error: "andar deve ser um número inteiro válido" }); return;
    }
  }

  const [created] = await db.insert(areasTable).values({
    condominioId,
    nome,
    tipo,
    bloco: bloco ?? null,
    andar: parsedAndar,
    privacidade: privacidade || "publica",
    descricao: descricao ?? null,
    capacidade: capacidade ? parseInt(capacidade) : null,
    reservavel: reservavel === true,
    horarioAbertura: horarioAbertura ?? null,
    horarioFechamento: horarioFechamento ?? null,
  }).returning();
  res.status(201).json(formatArea(created));
});

router.patch("/condominios/:condominioId/areas/:areaId", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);
  if (user.role === "vistoriador") { res.status(403).json({ error: "Acesso negado." }); return; }

  const condominioId = parseInt(req.params.condominioId as string, 10);
  const areaId = parseInt(req.params.areaId as string, 10);
  if (isNaN(condominioId) || isNaN(areaId)) { res.status(400).json({ error: "IDs inválidos" }); return; }

  const { nome, tipo, bloco, andar, privacidade, descricao, capacidade, reservavel, horarioAbertura, horarioFechamento, ativo } = req.body;

  if (tipo !== undefined && (typeof tipo !== "string" || !tipo.trim())) {
    res.status(400).json({ error: "tipo deve ser uma string não vazia" }); return;
  }
  if (privacidade !== undefined && privacidade !== null && !VALID_PRIVACIDADE.includes(privacidade)) {
    res.status(400).json({ error: `privacidade inválida. Valores: ${VALID_PRIVACIDADE.join(", ")}` }); return;
  }
  if (andar !== undefined && andar != null && andar !== "") {
    const parsedAndarPatch = parseInt(andar, 10);
    if (isNaN(parsedAndarPatch) || !isFinite(parsedAndarPatch)) {
      res.status(400).json({ error: "andar deve ser um número inteiro válido" }); return;
    }
  }

  const updateData: Partial<typeof areasTable.$inferInsert> = {};
  if (nome !== undefined) updateData.nome = nome;
  if (tipo !== undefined) updateData.tipo = tipo;
  if (bloco !== undefined) updateData.bloco = bloco ?? null;
  if (andar !== undefined) updateData.andar = (andar != null && andar !== "") ? parseInt(andar, 10) : null;
  if (privacidade !== undefined) updateData.privacidade = privacidade;
  if (descricao !== undefined) updateData.descricao = descricao;
  if (capacidade !== undefined) updateData.capacidade = capacidade ? parseInt(capacidade) : null;
  if (reservavel !== undefined) updateData.reservavel = reservavel;
  if (horarioAbertura !== undefined) updateData.horarioAbertura = horarioAbertura;
  if (horarioFechamento !== undefined) updateData.horarioFechamento = horarioFechamento;
  if (ativo !== undefined) updateData.ativo = ativo;

  const [updated] = await db.update(areasTable).set(updateData).where(
    and(eq(areasTable.id, areaId), eq(areasTable.condominioId, condominioId))
  ).returning();
  if (!updated) { res.status(404).json({ error: "Área não encontrada neste condomínio" }); return; }
  res.json(formatArea(updated));
});

router.delete("/condominios/:condominioId/areas/:areaId", requireAuth, async (req, res): Promise<void> => {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);
  if (user.role === "vistoriador") { res.status(403).json({ error: "Acesso negado." }); return; }

  const condominioId = parseInt(req.params.condominioId as string, 10);
  const areaId = parseInt(req.params.areaId as string, 10);
  if (isNaN(condominioId) || isNaN(areaId)) { res.status(400).json({ error: "IDs inválidos" }); return; }
  await db.delete(areasTable).where(
    and(eq(areasTable.id, areaId), eq(areasTable.condominioId, condominioId))
  );
  res.json({ ok: true });
});

router.get("/users/:clerkId/condominios", requireAuth, async (req, res): Promise<void> => {
  const clerkId = req.params.clerkId as string;
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!targetUser) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  const condoIds = await getUserCondominioIds(targetUser.id);
  if (condoIds.length === 0) { res.json([]); return; }
  const rows = await db.select().from(condominiosTable).where(inArray(condominiosTable.id, condoIds));
  res.json(rows.map(formatCondo));
});

router.post("/users/:clerkId/condominios", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const clerkId = req.params.clerkId as string;
  const condominioId = parseInt(req.body.condominioId, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "condominioId inválido" }); return; }

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!targetUser) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

  const existing = await db.select().from(userCondominiosTable)
    .where(and(eq(userCondominiosTable.userId, targetUser.id), eq(userCondominiosTable.condominioId, condominioId)));
  if (existing.length === 0) {
    await db.insert(userCondominiosTable).values({ userId: targetUser.id, condominioId });
  }
  res.json({ ok: true });
});

router.delete("/users/:clerkId/condominios/:condominioId", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const clerkId = req.params.clerkId as string;
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!targetUser) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  await db.delete(userCondominiosTable).where(and(eq(userCondominiosTable.userId, targetUser.id), eq(userCondominiosTable.condominioId, condominioId)));
  res.json({ ok: true });
});

export default router;
