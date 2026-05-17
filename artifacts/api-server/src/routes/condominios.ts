import { Router } from "express";
import { db, condominiosTable, areasTable, userCondominiosTable, usersTable, contratosCondominioTable, prestadoresCondominioTable, documentosCondominioTable, seguroPredialTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireRole, upsertUser } from "../middlewares/requireAuth";

const router = Router();

const VALID_TIPO_CONDOMINIO = ["residencial", "comercial", "misto"];
const VALID_PRIVACIDADE = ["publica", "privada", "mista"];

function computeVigenciaStatus(vigenciaFim: string | null | undefined): "ativo" | "a_vencer" | "vencido" {
  if (!vigenciaFim) return "ativo";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fim = new Date(vigenciaFim + "T00:00:00");
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);
  if (fim < today) return "vencido";
  if (fim <= in30Days) return "a_vencer";
  return "ativo";
}

function computeDocumentoStatus(dataValidade: string | null | undefined): "valido" | "a_vencer" | "vencido" {
  if (!dataValidade) return "valido";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const val = new Date(dataValidade + "T00:00:00");
  const in60Days = new Date(today);
  in60Days.setDate(in60Days.getDate() + 60);
  if (val < today) return "vencido";
  if (val <= in60Days) return "a_vencer";
  return "valido";
}

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
    inscricaoMunicipal: c.inscricaoMunicipal ?? null,
    areaTotalM2: c.areaTotalM2 ?? null,
    areaLazerM2: c.areaLazerM2 ?? null,
    numElevadores: c.numElevadores ?? null,
    tipoPortaria: c.tipoPortaria ?? null,
    equipe: c.equipe ?? null,
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

function formatContrato(c: typeof contratosCondominioTable.$inferSelect) {
  return {
    id: c.id,
    condominioId: c.condominioId,
    tipoServico: c.tipoServico,
    empresa: c.empresa ?? null,
    cnpjEmpresa: c.cnpjEmpresa ?? null,
    telefoneEmpresa: c.telefoneEmpresa ?? null,
    emailEmpresa: c.emailEmpresa ?? null,
    valorMensal: c.valorMensal ?? null,
    vigenciaInicio: c.vigenciaInicio ?? null,
    vigenciaFim: c.vigenciaFim ?? null,
    periodicidadeVisita: c.periodicidadeVisita ?? null,
    statusVigencia: computeVigenciaStatus(c.vigenciaFim),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function formatPrestador(p: typeof prestadoresCondominioTable.$inferSelect) {
  return {
    id: p.id,
    condominioId: p.condominioId,
    nome: p.nome,
    especialidade: p.especialidade ?? null,
    telefone: p.telefone ?? null,
    email: p.email ?? null,
    avaliacao: p.avaliacao ?? null,
    observacoes: p.observacoes ?? null,
    createdAt: p.createdAt,
  };
}

function formatDocumento(d: typeof documentosCondominioTable.$inferSelect) {
  return {
    id: d.id,
    condominioId: d.condominioId,
    tipo: d.tipo,
    numeroReferencia: d.numeroReferencia ?? null,
    dataEmissao: d.dataEmissao ?? null,
    dataValidade: d.dataValidade ?? null,
    empresaResponsavel: d.empresaResponsavel ?? null,
    statusDocumento: computeDocumentoStatus(d.dataValidade),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function formatSeguro(s: typeof seguroPredialTable.$inferSelect) {
  return {
    id: s.id,
    condominioId: s.condominioId,
    seguradora: s.seguradora ?? null,
    numeroApolice: s.numeroApolice ?? null,
    vigenciaInicio: s.vigenciaInicio ?? null,
    vigenciaFim: s.vigenciaFim ?? null,
    tipoCobertura: s.tipoCobertura ?? null,
    valorSegurado: s.valorSegurado ?? null,
    nomeCorretor: s.nomeCorretor ?? null,
    telefoneCorretor: s.telefoneCorretor ?? null,
    statusVigencia: computeVigenciaStatus(s.vigenciaFim),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

async function getUserCondominioIds(userId: number): Promise<number[]> {
  const rows = await db.select().from(userCondominiosTable).where(eq(userCondominiosTable.userId, userId));
  return rows.map(r => r.condominioId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkAdminOrSindico(req: any, res: any): Promise<boolean> {
  const auth = req.auth!;
  const emailAddress = (auth as any).sessionClaims?.email as string | undefined;
  const name = (auth as any).sessionClaims?.name as string | undefined;
  const user = await upsertUser(auth.userId, emailAddress ?? "", name);
  if (user.role === "vistoriador") {
    res.status(403).json({ error: "Acesso negado." });
    return false;
  }
  return true;
}

// ─── Condominios CRUD ─────────────────────────────────────────────────────────

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
    sindico, zelador, administradora, inscricaoMunicipal, areaTotalM2, areaLazerM2,
    numElevadores, tipoPortaria, equipe, ativo } = req.body;
  if (!nome || typeof nome !== "string") { res.status(400).json({ error: "nome é obrigatório" }); return; }
  if (tipoCondominio && !VALID_TIPO_CONDOMINIO.includes(tipoCondominio)) {
    res.status(400).json({ error: "tipoCondominio inválido" }); return;
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
    inscricaoMunicipal: inscricaoMunicipal ?? null,
    areaTotalM2: areaTotalM2 != null ? parseFloat(areaTotalM2) : null,
    areaLazerM2: areaLazerM2 != null ? parseFloat(areaLazerM2) : null,
    numElevadores: numElevadores != null ? parseInt(numElevadores) : null,
    tipoPortaria: tipoPortaria ?? null,
    equipe: equipe ?? null,
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
    sindico, zelador, administradora, inscricaoMunicipal, areaTotalM2, areaLazerM2,
    numElevadores, tipoPortaria, equipe, ativo } = req.body;
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
      inscricaoMunicipal: inscricaoMunicipal ?? null,
      areaTotalM2: areaTotalM2 != null ? parseFloat(areaTotalM2) : null,
      areaLazerM2: areaLazerM2 != null ? parseFloat(areaLazerM2) : null,
      numElevadores: numElevadores != null ? parseInt(numElevadores) : null,
      tipoPortaria: tipoPortaria ?? null,
      equipe: equipe ?? null,
      ativo: ativo !== false,
    })
    .where(eq(condominiosTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Condomínio não encontrado" }); return; }
  res.json(formatCondo(updated));
});

// ─── Areas ────────────────────────────────────────────────────────────────────

router.get("/condominios/:condominioId/areas", requireAuth, async (req, res): Promise<void> => {
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const rows = await db.select().from(areasTable).where(eq(areasTable.condominioId, condominioId)).orderBy(areasTable.tipo, areasTable.nome);
  res.json(rows.map(formatArea));
});

router.post("/condominios/:condominioId/areas", requireAuth, async (req, res): Promise<void> => {
  const ok = await checkAdminOrSindico(req, res);
  if (!ok) return;
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
    condominioId, nome, tipo, bloco: bloco ?? null, andar: parsedAndar,
    privacidade: privacidade || "publica", descricao: descricao ?? null,
    capacidade: capacidade ? parseInt(capacidade) : null, reservavel: reservavel === true,
    horarioAbertura: horarioAbertura ?? null, horarioFechamento: horarioFechamento ?? null,
  }).returning();
  res.status(201).json(formatArea(created));
});

router.patch("/condominios/:condominioId/areas/:areaId", requireAuth, async (req, res): Promise<void> => {
  const ok = await checkAdminOrSindico(req, res);
  if (!ok) return;
  const condominioId = parseInt(req.params.condominioId as string, 10);
  const areaId = parseInt(req.params.areaId as string, 10);
  if (isNaN(condominioId) || isNaN(areaId)) { res.status(400).json({ error: "IDs inválidos" }); return; }
  const { nome, tipo, bloco, andar, privacidade, descricao, capacidade, reservavel, horarioAbertura, horarioFechamento, ativo } = req.body;
  if (tipo !== undefined && (typeof tipo !== "string" || !tipo.trim())) {
    res.status(400).json({ error: "tipo deve ser uma string não vazia" }); return;
  }
  if (privacidade !== undefined && privacidade !== null && !VALID_PRIVACIDADE.includes(privacidade)) {
    res.status(400).json({ error: `privacidade inválida` }); return;
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
  const ok = await checkAdminOrSindico(req, res);
  if (!ok) return;
  const condominioId = parseInt(req.params.condominioId as string, 10);
  const areaId = parseInt(req.params.areaId as string, 10);
  if (isNaN(condominioId) || isNaN(areaId)) { res.status(400).json({ error: "IDs inválidos" }); return; }
  await db.delete(areasTable).where(and(eq(areasTable.id, areaId), eq(areasTable.condominioId, condominioId)));
  res.json({ ok: true });
});

// ─── Contratos ────────────────────────────────────────────────────────────────

router.get("/condominios/:condominioId/contratos", requireAuth, async (req, res): Promise<void> => {
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const rows = await db.select().from(contratosCondominioTable)
    .where(eq(contratosCondominioTable.condominioId, condominioId))
    .orderBy(contratosCondominioTable.tipoServico);
  res.json(rows.map(formatContrato));
});

router.post("/condominios/:condominioId/contratos", requireAuth, async (req, res): Promise<void> => {
  const ok = await checkAdminOrSindico(req, res);
  if (!ok) return;
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const { tipoServico, empresa, cnpjEmpresa, telefoneEmpresa, emailEmpresa, valorMensal, vigenciaInicio, vigenciaFim, periodicidadeVisita } = req.body;
  if (!tipoServico) { res.status(400).json({ error: "tipoServico é obrigatório" }); return; }
  const [created] = await db.insert(contratosCondominioTable).values({
    condominioId, tipoServico,
    empresa: empresa ?? null, cnpjEmpresa: cnpjEmpresa ?? null,
    telefoneEmpresa: telefoneEmpresa ?? null, emailEmpresa: emailEmpresa ?? null,
    valorMensal: valorMensal != null ? parseFloat(valorMensal) : null,
    vigenciaInicio: vigenciaInicio ?? null, vigenciaFim: vigenciaFim ?? null,
    periodicidadeVisita: periodicidadeVisita ?? null,
  }).returning();
  res.status(201).json(formatContrato(created));
});

router.patch("/condominios/:condominioId/contratos/:contratoId", requireAuth, async (req, res): Promise<void> => {
  const ok = await checkAdminOrSindico(req, res);
  if (!ok) return;
  const condominioId = parseInt(req.params.condominioId as string, 10);
  const contratoId = parseInt(req.params.contratoId as string, 10);
  if (isNaN(condominioId) || isNaN(contratoId)) { res.status(400).json({ error: "IDs inválidos" }); return; }
  const { tipoServico, empresa, cnpjEmpresa, telefoneEmpresa, emailEmpresa, valorMensal, vigenciaInicio, vigenciaFim, periodicidadeVisita } = req.body;
  const [updated] = await db.update(contratosCondominioTable).set({
    tipoServico, empresa: empresa ?? null, cnpjEmpresa: cnpjEmpresa ?? null,
    telefoneEmpresa: telefoneEmpresa ?? null, emailEmpresa: emailEmpresa ?? null,
    valorMensal: valorMensal != null ? parseFloat(valorMensal) : null,
    vigenciaInicio: vigenciaInicio ?? null, vigenciaFim: vigenciaFim ?? null,
    periodicidadeVisita: periodicidadeVisita ?? null,
  }).where(and(eq(contratosCondominioTable.id, contratoId), eq(contratosCondominioTable.condominioId, condominioId))).returning();
  if (!updated) { res.status(404).json({ error: "Contrato não encontrado" }); return; }
  res.json(formatContrato(updated));
});

router.delete("/condominios/:condominioId/contratos/:contratoId", requireAuth, async (req, res): Promise<void> => {
  const ok = await checkAdminOrSindico(req, res);
  if (!ok) return;
  const condominioId = parseInt(req.params.condominioId as string, 10);
  const contratoId = parseInt(req.params.contratoId as string, 10);
  if (isNaN(condominioId) || isNaN(contratoId)) { res.status(400).json({ error: "IDs inválidos" }); return; }
  await db.delete(contratosCondominioTable).where(and(eq(contratosCondominioTable.id, contratoId), eq(contratosCondominioTable.condominioId, condominioId)));
  res.json({ ok: true });
});

// ─── Prestadores ─────────────────────────────────────────────────────────────

router.get("/condominios/:condominioId/prestadores", requireAuth, async (req, res): Promise<void> => {
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const rows = await db.select().from(prestadoresCondominioTable)
    .where(eq(prestadoresCondominioTable.condominioId, condominioId))
    .orderBy(prestadoresCondominioTable.nome);
  res.json(rows.map(formatPrestador));
});

router.post("/condominios/:condominioId/prestadores", requireAuth, async (req, res): Promise<void> => {
  const ok = await checkAdminOrSindico(req, res);
  if (!ok) return;
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const { nome, especialidade, telefone, email, avaliacao, observacoes } = req.body;
  if (!nome) { res.status(400).json({ error: "nome é obrigatório" }); return; }
  const [created] = await db.insert(prestadoresCondominioTable).values({
    condominioId, nome, especialidade: especialidade ?? null,
    telefone: telefone ?? null, email: email ?? null,
    avaliacao: avaliacao != null ? parseInt(avaliacao) : null,
    observacoes: observacoes ?? null,
  }).returning();
  res.status(201).json(formatPrestador(created));
});

router.patch("/condominios/:condominioId/prestadores/:prestadorId", requireAuth, async (req, res): Promise<void> => {
  const ok = await checkAdminOrSindico(req, res);
  if (!ok) return;
  const condominioId = parseInt(req.params.condominioId as string, 10);
  const prestadorId = parseInt(req.params.prestadorId as string, 10);
  if (isNaN(condominioId) || isNaN(prestadorId)) { res.status(400).json({ error: "IDs inválidos" }); return; }
  const { nome, especialidade, telefone, email, avaliacao, observacoes } = req.body;
  const [updated] = await db.update(prestadoresCondominioTable).set({
    nome, especialidade: especialidade ?? null, telefone: telefone ?? null, email: email ?? null,
    avaliacao: avaliacao != null ? parseInt(avaliacao) : null, observacoes: observacoes ?? null,
  }).where(and(eq(prestadoresCondominioTable.id, prestadorId), eq(prestadoresCondominioTable.condominioId, condominioId))).returning();
  if (!updated) { res.status(404).json({ error: "Prestador não encontrado" }); return; }
  res.json(formatPrestador(updated));
});

router.delete("/condominios/:condominioId/prestadores/:prestadorId", requireAuth, async (req, res): Promise<void> => {
  const ok = await checkAdminOrSindico(req, res);
  if (!ok) return;
  const condominioId = parseInt(req.params.condominioId as string, 10);
  const prestadorId = parseInt(req.params.prestadorId as string, 10);
  if (isNaN(condominioId) || isNaN(prestadorId)) { res.status(400).json({ error: "IDs inválidos" }); return; }
  await db.delete(prestadoresCondominioTable).where(and(eq(prestadoresCondominioTable.id, prestadorId), eq(prestadoresCondominioTable.condominioId, condominioId)));
  res.json({ ok: true });
});

// ─── Documentos ───────────────────────────────────────────────────────────────

router.get("/condominios/:condominioId/documentos", requireAuth, async (req, res): Promise<void> => {
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const rows = await db.select().from(documentosCondominioTable)
    .where(eq(documentosCondominioTable.condominioId, condominioId))
    .orderBy(documentosCondominioTable.tipo);
  res.json(rows.map(formatDocumento));
});

router.post("/condominios/:condominioId/documentos", requireAuth, async (req, res): Promise<void> => {
  const ok = await checkAdminOrSindico(req, res);
  if (!ok) return;
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const { tipo, numeroReferencia, dataEmissao, dataValidade, empresaResponsavel } = req.body;
  if (!tipo) { res.status(400).json({ error: "tipo é obrigatório" }); return; }
  const [created] = await db.insert(documentosCondominioTable).values({
    condominioId, tipo, numeroReferencia: numeroReferencia ?? null,
    dataEmissao: dataEmissao ?? null, dataValidade: dataValidade ?? null,
    empresaResponsavel: empresaResponsavel ?? null,
  }).returning();
  res.status(201).json(formatDocumento(created));
});

router.patch("/condominios/:condominioId/documentos/:documentoId", requireAuth, async (req, res): Promise<void> => {
  const ok = await checkAdminOrSindico(req, res);
  if (!ok) return;
  const condominioId = parseInt(req.params.condominioId as string, 10);
  const documentoId = parseInt(req.params.documentoId as string, 10);
  if (isNaN(condominioId) || isNaN(documentoId)) { res.status(400).json({ error: "IDs inválidos" }); return; }
  const { tipo, numeroReferencia, dataEmissao, dataValidade, empresaResponsavel } = req.body;
  const [updated] = await db.update(documentosCondominioTable).set({
    tipo, numeroReferencia: numeroReferencia ?? null, dataEmissao: dataEmissao ?? null,
    dataValidade: dataValidade ?? null, empresaResponsavel: empresaResponsavel ?? null,
  }).where(and(eq(documentosCondominioTable.id, documentoId), eq(documentosCondominioTable.condominioId, condominioId))).returning();
  if (!updated) { res.status(404).json({ error: "Documento não encontrado" }); return; }
  res.json(formatDocumento(updated));
});

router.delete("/condominios/:condominioId/documentos/:documentoId", requireAuth, async (req, res): Promise<void> => {
  const ok = await checkAdminOrSindico(req, res);
  if (!ok) return;
  const condominioId = parseInt(req.params.condominioId as string, 10);
  const documentoId = parseInt(req.params.documentoId as string, 10);
  if (isNaN(condominioId) || isNaN(documentoId)) { res.status(400).json({ error: "IDs inválidos" }); return; }
  await db.delete(documentosCondominioTable).where(and(eq(documentosCondominioTable.id, documentoId), eq(documentosCondominioTable.condominioId, condominioId)));
  res.json({ ok: true });
});

// ─── Seguro Predial ───────────────────────────────────────────────────────────

router.get("/condominios/:condominioId/seguro", requireAuth, async (req, res): Promise<void> => {
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [record] = await db.select().from(seguroPredialTable).where(eq(seguroPredialTable.condominioId, condominioId));
  if (!record) { res.status(404).json({ error: "Sem registro de seguro" }); return; }
  res.json(formatSeguro(record));
});

router.put("/condominios/:condominioId/seguro", requireAuth, async (req, res): Promise<void> => {
  const ok = await checkAdminOrSindico(req, res);
  if (!ok) return;
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const { seguradora, numeroApolice, vigenciaInicio, vigenciaFim, tipoCobertura, valorSegurado, nomeCorretor, telefoneCorretor } = req.body;
  const values = {
    condominioId,
    seguradora: seguradora ?? null, numeroApolice: numeroApolice ?? null,
    vigenciaInicio: vigenciaInicio ?? null, vigenciaFim: vigenciaFim ?? null,
    tipoCobertura: tipoCobertura ?? null,
    valorSegurado: valorSegurado != null ? parseFloat(valorSegurado) : null,
    nomeCorretor: nomeCorretor ?? null, telefoneCorretor: telefoneCorretor ?? null,
  };
  const [result] = await db.insert(seguroPredialTable).values(values)
    .onConflictDoUpdate({
      target: seguroPredialTable.condominioId,
      set: { ...values, updatedAt: new Date() },
    }).returning();
  res.json(formatSeguro(result));
});

// ─── Health ───────────────────────────────────────────────────────────────────

router.get("/condominios/:condominioId/health", requireAuth, async (req, res): Promise<void> => {
  const condominioId = parseInt(req.params.condominioId as string, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [contratos, documentos, seguroRows] = await Promise.all([
    db.select().from(contratosCondominioTable).where(eq(contratosCondominioTable.condominioId, condominioId)),
    db.select().from(documentosCondominioTable).where(eq(documentosCondominioTable.condominioId, condominioId)),
    db.select().from(seguroPredialTable).where(eq(seguroPredialTable.condominioId, condominioId)),
  ]);
  const contratosVencidos = contratos.filter(c => computeVigenciaStatus(c.vigenciaFim) === "vencido").length;
  const contratosAVencer = contratos.filter(c => computeVigenciaStatus(c.vigenciaFim) === "a_vencer").length;
  const documentosVencidos = documentos.filter(d => computeDocumentoStatus(d.dataValidade) === "vencido").length;
  const documentosAVencer = documentos.filter(d => computeDocumentoStatus(d.dataValidade) === "a_vencer").length;
  const seguro = seguroRows[0];
  const seguroVencido = seguro ? computeVigenciaStatus(seguro.vigenciaFim) === "vencido" : false;
  const seguroAVencer = seguro ? computeVigenciaStatus(seguro.vigenciaFim) === "a_vencer" : false;
  res.json({ condominioId, contratosVencidos, contratosAVencer, documentosVencidos, documentosAVencer, seguroVencido, seguroAVencer });
});

// ─── User <-> Condominio associations ────────────────────────────────────────

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
