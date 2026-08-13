import { Hono, type Context } from "hono";
import {
  condominiosTable,
  areasTable,
  userCondominiosTable,
  usersTable,
  contratosCondominioTable,
  prestadoresCondominioTable,
  documentosCondominioTable,
  seguroPredialTable,
} from "@workspace/db/worker";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireRole, upsertUser } from "../middlewares/requireAuth";
import {
  CreateContratoBody,
  UpdateContratoBody,
  CreatePrestadorBody,
  UpdatePrestadorBody,
  CreateDocumentoBody,
  UpdateDocumentoBody,
  UpsertSeguroPredialBody,
} from "@workspace/api-zod";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

const VALID_TIPO_CONDOMINIO = ["residencial", "comercial", "misto"];
const VALID_PRIVACIDADE = ["publica", "privada", "mista"];

// ─── Status helpers ────────────────────────────────────────────────────────────

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

// ─── Formatters ────────────────────────────────────────────────────────────────

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

// ─── Auth helpers ──────────────────────────────────────────────────────────────

async function getUserCondominioIds(db: AppEnv["Variables"]["db"], userId: number): Promise<number[]> {
  const rows = await db
    .select()
    .from(userCondominiosTable)
    .where(eq(userCondominiosTable.userId, userId));
  return rows.map((r) => r.condominioId);
}

/**
 * Resolves the authenticated user and verifies they are authorized to access
 * the given condominioId. Admins have unrestricted access; all other roles
 * must be explicitly associated with the condominium in user_condominios.
 * Returns the user record on success, or null if authorization fails (the
 * appropriate 403 response is written to the passed-in `err` holder before
 * returning null — callers must check for null and return that response).
 */
async function authorizeCondominioAccess(
  c: Context<AppEnv>,
  condominioId: number,
): Promise<{ user: typeof usersTable.$inferSelect; error: null } | { user: null; error: Response }> {
  const db = c.get("db");
  const auth = c.get("auth")!;
  const emailAddress = auth.sessionClaims?.["email"] as string | undefined;
  const name = auth.sessionClaims?.["name"] as string | undefined;
  const user = await upsertUser(db, auth.userId, emailAddress ?? "", name);

  if (user.role === "admin") return { user, error: null };

  const userCondoIds = await getUserCondominioIds(db, user.id);
  if (!userCondoIds.includes(condominioId)) {
    return { user: null, error: c.json({ error: "Acesso negado. Você não tem permissão para este condomínio." }, 403) };
  }

  return { user, error: null };
}

// ─── Condominios CRUD ─────────────────────────────────────────────────────────

router.get("/condominios", requireAuth, async (c) => {
  const db = c.get("db");
  const auth = c.get("auth")!;
  const emailAddress = auth.sessionClaims?.["email"] as string | undefined;
  const name = auth.sessionClaims?.["name"] as string | undefined;
  const user = await upsertUser(db, auth.userId, emailAddress ?? "", name);

  if (user.role === "admin") {
    const all = await db.select().from(condominiosTable).orderBy(condominiosTable.nome);
    return c.json(all.map(formatCondo));
  }

  const condoIds = await getUserCondominioIds(db, user.id);
  if (condoIds.length === 0) {
    return c.json([]);
  }
  const rows = await db
    .select()
    .from(condominiosTable)
    .where(inArray(condominiosTable.id, condoIds))
    .orderBy(condominiosTable.nome);
  return c.json(rows.map(formatCondo));
});

router.post("/condominios", requireAuth, requireRole("admin", "sindico"), async (c) => {
  const db = c.get("db");
  const auth = c.get("auth")!;
  const emailAddress = auth.sessionClaims?.["email"] as string | undefined;
  const name = auth.sessionClaims?.["name"] as string | undefined;
  const callerUser = await upsertUser(db, auth.userId, emailAddress ?? "", name);

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const {
    nome, cnpj, tipoCondominio, endereco, cep, bairro, cidade, estado,
    totalUnidades, totalBlocos, totalAndares, anoConstrucao, telefone, email,
    sindico, zelador, administradora, inscricaoMunicipal, areaTotalM2, areaLazerM2,
    numElevadores, tipoPortaria, equipe, ativo,
  } = body;
  if (!nome || typeof nome !== "string") {
    return c.json({ error: "nome é obrigatório" }, 400);
  }
  if (tipoCondominio && !VALID_TIPO_CONDOMINIO.includes(tipoCondominio as string)) {
    return c.json({ error: "tipoCondominio inválido" }, 400);
  }
  const [created] = await db.insert(condominiosTable).values({
    nome,
    cnpj: (cnpj as string) ?? null,
    tipoCondominio: (tipoCondominio as "residencial" | "comercial" | "misto") ?? "residencial",
    endereco: (endereco as string) ?? null,
    cep: (cep as string) ?? null,
    bairro: (bairro as string) ?? null,
    cidade: (cidade as string) ?? null,
    estado: (estado as string) ?? null,
    totalUnidades: totalUnidades ? parseInt(totalUnidades as string) : null,
    totalBlocos: totalBlocos ? parseInt(totalBlocos as string) : null,
    totalAndares: totalAndares ? parseInt(totalAndares as string) : null,
    anoConstrucao: anoConstrucao ? parseInt(anoConstrucao as string) : null,
    telefone: (telefone as string) ?? null,
    email: (email as string) ?? null,
    sindico: (sindico as string) ?? null,
    zelador: (zelador as string) ?? null,
    administradora: (administradora as string) ?? null,
    inscricaoMunicipal: (inscricaoMunicipal as string) ?? null,
    areaTotalM2: areaTotalM2 != null ? parseFloat(areaTotalM2 as string) : null,
    areaLazerM2: areaLazerM2 != null ? parseFloat(areaLazerM2 as string) : null,
    numElevadores: numElevadores != null ? parseInt(numElevadores as string) : null,
    tipoPortaria: (tipoPortaria as string) ?? null,
    equipe: equipe ?? null,
    ativo: ativo !== false,
  }).returning();

  // Auto-associate sindico with the newly created condominium
  if (callerUser.role === "sindico") {
    await db.insert(userCondominiosTable).values({ userId: callerUser.id, condominioId: created.id });
  }

  return c.json(formatCondo(created), 201);
});

router.get("/condominios/:id", requireAuth, async (c) => {
  const id = parseInt(c.req.param("id")!, 10);
  if (isNaN(id)) return c.json({ error: "ID inválido" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, id);
  if (!user) return error;
  const db = c.get("db");
  const [condo] = await db.select().from(condominiosTable).where(eq(condominiosTable.id, id));
  if (!condo) return c.json({ error: "Condomínio não encontrado" }, 404);
  return c.json(formatCondo(condo));
});

router.patch("/condominios/:id", requireAuth, async (c) => {
  const id = parseInt(c.req.param("id")!, 10);
  if (isNaN(id)) return c.json({ error: "ID inválido" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, id);
  if (!user) return error;
  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);

  const db = c.get("db");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const {
    nome, cnpj, tipoCondominio, endereco, cep, bairro, cidade, estado,
    totalUnidades, totalBlocos, totalAndares, anoConstrucao, telefone, email,
    sindico, zelador, administradora, inscricaoMunicipal, areaTotalM2, areaLazerM2,
    numElevadores, tipoPortaria, equipe, ativo,
  } = body;
  if (!nome || typeof nome !== "string") {
    return c.json({ error: "nome é obrigatório" }, 400);
  }
  if (tipoCondominio && !VALID_TIPO_CONDOMINIO.includes(tipoCondominio as string)) {
    return c.json({ error: "tipoCondominio inválido" }, 400);
  }
  const [updated] = await db
    .update(condominiosTable)
    .set({
      nome,
      cnpj: (cnpj as string) ?? null,
      tipoCondominio: (tipoCondominio as "residencial" | "comercial" | "misto") ?? "residencial",
      endereco: (endereco as string) ?? null,
      cep: (cep as string) ?? null,
      bairro: (bairro as string) ?? null,
      cidade: (cidade as string) ?? null,
      estado: (estado as string) ?? null,
      totalUnidades: totalUnidades != null ? parseInt(totalUnidades as string) : null,
      totalBlocos: totalBlocos != null ? parseInt(totalBlocos as string) : null,
      totalAndares: totalAndares != null ? parseInt(totalAndares as string) : null,
      anoConstrucao: anoConstrucao != null ? parseInt(anoConstrucao as string) : null,
      telefone: (telefone as string) ?? null,
      email: (email as string) ?? null,
      sindico: (sindico as string) ?? null,
      zelador: (zelador as string) ?? null,
      administradora: (administradora as string) ?? null,
      inscricaoMunicipal: (inscricaoMunicipal as string) ?? null,
      areaTotalM2: areaTotalM2 != null ? parseFloat(areaTotalM2 as string) : null,
      areaLazerM2: areaLazerM2 != null ? parseFloat(areaLazerM2 as string) : null,
      numElevadores: numElevadores != null ? parseInt(numElevadores as string) : null,
      tipoPortaria: (tipoPortaria as string) ?? null,
      equipe: equipe ?? null,
      ativo: ativo !== false,
    })
    .where(eq(condominiosTable.id, id))
    .returning();
  if (!updated) return c.json({ error: "Condomínio não encontrado" }, 404);
  return c.json(formatCondo(updated));
});

// ─── Areas ────────────────────────────────────────────────────────────────────

router.get("/condominios/:condominioId/areas", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  if (isNaN(condominioId)) return c.json({ error: "ID inválido" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  const db = c.get("db");
  const rows = await db
    .select()
    .from(areasTable)
    .where(eq(areasTable.condominioId, condominioId))
    .orderBy(areasTable.tipo, areasTable.nome);
  return c.json(rows.map(formatArea));
});

router.post("/condominios/:condominioId/areas", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  if (isNaN(condominioId)) return c.json({ error: "ID inválido" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);

  const db = c.get("db");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const { nome, tipo, bloco, andar, privacidade, descricao, capacidade, reservavel, horarioAbertura, horarioFechamento } = body;
  if (!nome || !tipo) return c.json({ error: "nome e tipo são obrigatórios" }, 400);
  if (typeof tipo !== "string" || !tipo.trim()) return c.json({ error: "tipo deve ser uma string não vazia" }, 400);
  if (privacidade !== undefined && privacidade !== null && !VALID_PRIVACIDADE.includes(privacidade as string)) {
    return c.json({ error: `privacidade inválida. Valores: ${VALID_PRIVACIDADE.join(", ")}` }, 400);
  }
  let parsedAndar: number | null = null;
  if (andar != null && andar !== "") {
    parsedAndar = parseInt(andar as string, 10);
    if (isNaN(parsedAndar) || !isFinite(parsedAndar)) {
      return c.json({ error: "andar deve ser um número inteiro válido" }, 400);
    }
  }
  const [created] = await db
    .insert(areasTable)
    .values({
      condominioId,
      nome: nome as string,
      tipo: tipo as string,
      bloco: (bloco as string) ?? null,
      andar: parsedAndar,
      privacidade: (privacidade as "publica" | "privada" | "mista") || "publica",
      descricao: (descricao as string) ?? null,
      capacidade: capacidade ? parseInt(capacidade as string) : null,
      reservavel: reservavel === true,
      horarioAbertura: (horarioAbertura as string) ?? null,
      horarioFechamento: (horarioFechamento as string) ?? null,
    })
    .returning();
  return c.json(formatArea(created), 201);
});

router.patch("/condominios/:condominioId/areas/:areaId", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  const areaId = parseInt(c.req.param("areaId")!, 10);
  if (isNaN(condominioId) || isNaN(areaId)) return c.json({ error: "IDs inválidos" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);

  const db = c.get("db");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const { nome, tipo, bloco, andar, privacidade, descricao, capacidade, reservavel, horarioAbertura, horarioFechamento, ativo } = body;
  if (tipo !== undefined && (typeof tipo !== "string" || !(tipo as string).trim())) {
    return c.json({ error: "tipo deve ser uma string não vazia" }, 400);
  }
  if (privacidade !== undefined && privacidade !== null && !VALID_PRIVACIDADE.includes(privacidade as string)) {
    return c.json({ error: "privacidade inválida" }, 400);
  }
  const updateData: Partial<typeof areasTable.$inferInsert> = {};
  if (nome !== undefined) updateData.nome = nome as string;
  if (tipo !== undefined) updateData.tipo = tipo as string;
  if (bloco !== undefined) updateData.bloco = (bloco as string) ?? null;
  if (andar !== undefined) updateData.andar = andar != null && andar !== "" ? parseInt(andar as string, 10) : null;
  if (privacidade !== undefined) updateData.privacidade = privacidade as "publica" | "privada" | "mista";
  if (descricao !== undefined) updateData.descricao = descricao as string;
  if (capacidade !== undefined) updateData.capacidade = capacidade ? parseInt(capacidade as string) : null;
  if (reservavel !== undefined) updateData.reservavel = reservavel as boolean;
  if (horarioAbertura !== undefined) updateData.horarioAbertura = horarioAbertura as string;
  if (horarioFechamento !== undefined) updateData.horarioFechamento = horarioFechamento as string;
  if (ativo !== undefined) updateData.ativo = ativo as boolean;
  const [updated] = await db
    .update(areasTable)
    .set(updateData)
    .where(and(eq(areasTable.id, areaId), eq(areasTable.condominioId, condominioId)))
    .returning();
  if (!updated) return c.json({ error: "Área não encontrada neste condomínio" }, 404);
  return c.json(formatArea(updated));
});

router.delete("/condominios/:condominioId/areas/:areaId", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  const areaId = parseInt(c.req.param("areaId")!, 10);
  if (isNaN(condominioId) || isNaN(areaId)) return c.json({ error: "IDs inválidos" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);

  const db = c.get("db");
  await db.delete(areasTable).where(and(eq(areasTable.id, areaId), eq(areasTable.condominioId, condominioId)));
  return c.json({ ok: true });
});

// ─── Contratos ────────────────────────────────────────────────────────────────

router.get("/condominios/:condominioId/contratos", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  if (isNaN(condominioId)) return c.json({ error: "ID inválido" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  const db = c.get("db");
  const rows = await db
    .select()
    .from(contratosCondominioTable)
    .where(eq(contratosCondominioTable.condominioId, condominioId))
    .orderBy(contratosCondominioTable.tipoServico);
  return c.json(rows.map(formatContrato));
});

router.post("/condominios/:condominioId/contratos", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  if (isNaN(condominioId)) return c.json({ error: "ID inválido" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);

  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateContratoBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  const { tipoServico, empresa, cnpjEmpresa, telefoneEmpresa, emailEmpresa, valorMensal, vigenciaInicio, vigenciaFim, periodicidadeVisita } = parsed.data;
  const [created] = await db
    .insert(contratosCondominioTable)
    .values({
      condominioId,
      tipoServico,
      empresa: empresa ?? null,
      cnpjEmpresa: cnpjEmpresa ?? null,
      telefoneEmpresa: telefoneEmpresa ?? null,
      emailEmpresa: emailEmpresa ?? null,
      valorMensal: valorMensal ?? null,
      vigenciaInicio: vigenciaInicio ?? null,
      vigenciaFim: vigenciaFim ?? null,
      periodicidadeVisita: periodicidadeVisita ?? null,
    })
    .returning();
  return c.json(formatContrato(created), 201);
});

router.patch("/condominios/:condominioId/contratos/:contratoId", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  const contratoId = parseInt(c.req.param("contratoId")!, 10);
  if (isNaN(condominioId) || isNaN(contratoId)) return c.json({ error: "IDs inválidos" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);

  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateContratoBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  const { tipoServico, empresa, cnpjEmpresa, telefoneEmpresa, emailEmpresa, valorMensal, vigenciaInicio, vigenciaFim, periodicidadeVisita } = parsed.data;
  const [updated] = await db
    .update(contratosCondominioTable)
    .set({
      tipoServico,
      empresa: empresa ?? null,
      cnpjEmpresa: cnpjEmpresa ?? null,
      telefoneEmpresa: telefoneEmpresa ?? null,
      emailEmpresa: emailEmpresa ?? null,
      valorMensal: valorMensal ?? null,
      vigenciaInicio: vigenciaInicio ?? null,
      vigenciaFim: vigenciaFim ?? null,
      periodicidadeVisita: periodicidadeVisita ?? null,
    })
    .where(and(eq(contratosCondominioTable.id, contratoId), eq(contratosCondominioTable.condominioId, condominioId)))
    .returning();
  if (!updated) return c.json({ error: "Contrato não encontrado" }, 404);
  return c.json(formatContrato(updated));
});

router.delete("/condominios/:condominioId/contratos/:contratoId", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  const contratoId = parseInt(c.req.param("contratoId")!, 10);
  if (isNaN(condominioId) || isNaN(contratoId)) return c.json({ error: "IDs inválidos" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);

  const db = c.get("db");
  await db
    .delete(contratosCondominioTable)
    .where(and(eq(contratosCondominioTable.id, contratoId), eq(contratosCondominioTable.condominioId, condominioId)));
  return c.json({ ok: true });
});

// ─── Prestadores ─────────────────────────────────────────────────────────────

router.get("/condominios/:condominioId/prestadores", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  if (isNaN(condominioId)) return c.json({ error: "ID inválido" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  const db = c.get("db");
  const rows = await db
    .select()
    .from(prestadoresCondominioTable)
    .where(eq(prestadoresCondominioTable.condominioId, condominioId))
    .orderBy(prestadoresCondominioTable.nome);
  return c.json(rows.map(formatPrestador));
});

router.post("/condominios/:condominioId/prestadores", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  if (isNaN(condominioId)) return c.json({ error: "ID inválido" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);

  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreatePrestadorBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  const { nome, especialidade, telefone, email, avaliacao, observacoes } = parsed.data;
  const [created] = await db
    .insert(prestadoresCondominioTable)
    .values({
      condominioId,
      nome,
      especialidade: especialidade ?? null,
      telefone: telefone ?? null,
      email: email ?? null,
      avaliacao: avaliacao ?? null,
      observacoes: observacoes ?? null,
    })
    .returning();
  return c.json(formatPrestador(created), 201);
});

router.patch("/condominios/:condominioId/prestadores/:prestadorId", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  const prestadorId = parseInt(c.req.param("prestadorId")!, 10);
  if (isNaN(condominioId) || isNaN(prestadorId)) return c.json({ error: "IDs inválidos" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);

  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdatePrestadorBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  const { nome, especialidade, telefone, email, avaliacao, observacoes } = parsed.data;
  const [updated] = await db
    .update(prestadoresCondominioTable)
    .set({
      nome,
      especialidade: especialidade ?? null,
      telefone: telefone ?? null,
      email: email ?? null,
      avaliacao: avaliacao ?? null,
      observacoes: observacoes ?? null,
    })
    .where(and(eq(prestadoresCondominioTable.id, prestadorId), eq(prestadoresCondominioTable.condominioId, condominioId)))
    .returning();
  if (!updated) return c.json({ error: "Prestador não encontrado" }, 404);
  return c.json(formatPrestador(updated));
});

router.delete("/condominios/:condominioId/prestadores/:prestadorId", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  const prestadorId = parseInt(c.req.param("prestadorId")!, 10);
  if (isNaN(condominioId) || isNaN(prestadorId)) return c.json({ error: "IDs inválidos" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);

  const db = c.get("db");
  await db
    .delete(prestadoresCondominioTable)
    .where(and(eq(prestadoresCondominioTable.id, prestadorId), eq(prestadoresCondominioTable.condominioId, condominioId)));
  return c.json({ ok: true });
});

// ─── Documentos ───────────────────────────────────────────────────────────────

router.get("/condominios/:condominioId/documentos", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  if (isNaN(condominioId)) return c.json({ error: "ID inválido" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  const db = c.get("db");
  const rows = await db
    .select()
    .from(documentosCondominioTable)
    .where(eq(documentosCondominioTable.condominioId, condominioId))
    .orderBy(documentosCondominioTable.tipo);
  return c.json(rows.map(formatDocumento));
});

router.post("/condominios/:condominioId/documentos", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  if (isNaN(condominioId)) return c.json({ error: "ID inválido" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);

  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateDocumentoBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  const { tipo, numeroReferencia, dataEmissao, dataValidade, empresaResponsavel } = parsed.data;
  const [created] = await db
    .insert(documentosCondominioTable)
    .values({
      condominioId,
      tipo,
      numeroReferencia: numeroReferencia ?? null,
      dataEmissao: dataEmissao ?? null,
      dataValidade: dataValidade ?? null,
      empresaResponsavel: empresaResponsavel ?? null,
    })
    .returning();
  return c.json(formatDocumento(created), 201);
});

router.patch("/condominios/:condominioId/documentos/:documentoId", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  const documentoId = parseInt(c.req.param("documentoId")!, 10);
  if (isNaN(condominioId) || isNaN(documentoId)) return c.json({ error: "IDs inválidos" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);

  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateDocumentoBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  const { tipo, numeroReferencia, dataEmissao, dataValidade, empresaResponsavel } = parsed.data;
  const [updated] = await db
    .update(documentosCondominioTable)
    .set({
      tipo,
      numeroReferencia: numeroReferencia ?? null,
      dataEmissao: dataEmissao ?? null,
      dataValidade: dataValidade ?? null,
      empresaResponsavel: empresaResponsavel ?? null,
    })
    .where(and(eq(documentosCondominioTable.id, documentoId), eq(documentosCondominioTable.condominioId, condominioId)))
    .returning();
  if (!updated) return c.json({ error: "Documento não encontrado" }, 404);
  return c.json(formatDocumento(updated));
});

router.delete("/condominios/:condominioId/documentos/:documentoId", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  const documentoId = parseInt(c.req.param("documentoId")!, 10);
  if (isNaN(condominioId) || isNaN(documentoId)) return c.json({ error: "IDs inválidos" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);

  const db = c.get("db");
  await db
    .delete(documentosCondominioTable)
    .where(and(eq(documentosCondominioTable.id, documentoId), eq(documentosCondominioTable.condominioId, condominioId)));
  return c.json({ ok: true });
});

// ─── Seguro Predial ───────────────────────────────────────────────────────────

router.get("/condominios/:condominioId/seguro", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  if (isNaN(condominioId)) return c.json({ error: "ID inválido" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  const db = c.get("db");
  const [record] = await db
    .select()
    .from(seguroPredialTable)
    .where(eq(seguroPredialTable.condominioId, condominioId));
  if (!record) return c.json({ error: "Sem registro de seguro" }, 404);
  return c.json(formatSeguro(record));
});

router.put("/condominios/:condominioId/seguro", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  if (isNaN(condominioId)) return c.json({ error: "ID inválido" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  if (user.role === "vistoriador") return c.json({ error: "Acesso negado." }, 403);

  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpsertSeguroPredialBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  const { seguradora, numeroApolice, vigenciaInicio, vigenciaFim, tipoCobertura, valorSegurado, nomeCorretor, telefoneCorretor } = parsed.data;
  const values = {
    condominioId,
    seguradora: seguradora ?? null,
    numeroApolice: numeroApolice ?? null,
    vigenciaInicio: vigenciaInicio ?? null,
    vigenciaFim: vigenciaFim ?? null,
    tipoCobertura: tipoCobertura ?? null,
    valorSegurado: valorSegurado ?? null,
    nomeCorretor: nomeCorretor ?? null,
    telefoneCorretor: telefoneCorretor ?? null,
  };
  const [result] = await db
    .insert(seguroPredialTable)
    .values(values)
    .onConflictDoUpdate({
      target: seguroPredialTable.condominioId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  return c.json(formatSeguro(result));
});

// ─── Health ───────────────────────────────────────────────────────────────────

router.get("/condominios/:condominioId/health", requireAuth, async (c) => {
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  if (isNaN(condominioId)) return c.json({ error: "ID inválido" }, 400);
  const { user, error } = await authorizeCondominioAccess(c, condominioId);
  if (!user) return error;
  const db = c.get("db");
  const [contratos, documentos, seguroRows] = await Promise.all([
    db.select().from(contratosCondominioTable).where(eq(contratosCondominioTable.condominioId, condominioId)),
    db.select().from(documentosCondominioTable).where(eq(documentosCondominioTable.condominioId, condominioId)),
    db.select().from(seguroPredialTable).where(eq(seguroPredialTable.condominioId, condominioId)),
  ]);
  const contratosVencidos = contratos.filter((c) => computeVigenciaStatus(c.vigenciaFim) === "vencido").length;
  const contratosAVencer = contratos.filter((c) => computeVigenciaStatus(c.vigenciaFim) === "a_vencer").length;
  const documentosVencidos = documentos.filter((d) => computeDocumentoStatus(d.dataValidade) === "vencido").length;
  const documentosAVencer = documentos.filter((d) => computeDocumentoStatus(d.dataValidade) === "a_vencer").length;
  const seguro = seguroRows[0];
  const seguroVencido = seguro ? computeVigenciaStatus(seguro.vigenciaFim) === "vencido" : false;
  const seguroAVencer = seguro ? computeVigenciaStatus(seguro.vigenciaFim) === "a_vencer" : false;
  return c.json({ condominioId, contratosVencidos, contratosAVencer, documentosVencidos, documentosAVencer, seguroVencido, seguroAVencer });
});

// ─── User <-> Condominio associations ────────────────────────────────────────

router.get("/users/:clerkId/condominios", requireAuth, async (c) => {
  const db = c.get("db");
  const clerkId = c.req.param("clerkId")!;
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!targetUser) return c.json({ error: "Usuário não encontrado" }, 404);
  const condoIds = await getUserCondominioIds(db, targetUser.id);
  if (condoIds.length === 0) return c.json([]);
  const rows = await db.select().from(condominiosTable).where(inArray(condominiosTable.id, condoIds));
  return c.json(rows.map(formatCondo));
});

router.post("/users/:clerkId/condominios", requireAuth, requireRole("admin"), async (c) => {
  const db = c.get("db");
  const clerkId = c.req.param("clerkId")!;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const condominioId = parseInt(body.condominioId as string, 10);
  if (isNaN(condominioId)) return c.json({ error: "condominioId inválido" }, 400);
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!targetUser) return c.json({ error: "Usuário não encontrado" }, 404);
  const existing = await db
    .select()
    .from(userCondominiosTable)
    .where(and(eq(userCondominiosTable.userId, targetUser.id), eq(userCondominiosTable.condominioId, condominioId)));
  if (existing.length === 0) {
    await db.insert(userCondominiosTable).values({ userId: targetUser.id, condominioId });
  }
  return c.json({ ok: true });
});

router.delete("/users/:clerkId/condominios/:condominioId", requireAuth, requireRole("admin"), async (c) => {
  const db = c.get("db");
  const clerkId = c.req.param("clerkId")!;
  const condominioId = parseInt(c.req.param("condominioId")!, 10);
  if (isNaN(condominioId)) return c.json({ error: "ID inválido" }, 400);
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!targetUser) return c.json({ error: "Usuário não encontrado" }, 404);
  await db
    .delete(userCondominiosTable)
    .where(and(eq(userCondominiosTable.userId, targetUser.id), eq(userCondominiosTable.condominioId, condominioId)));
  return c.json({ ok: true });
});

export default router;
