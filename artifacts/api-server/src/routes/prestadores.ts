import { Hono } from "hono";
import { prestadoresTable, userPrestadoresTable, usersTable } from "@workspace/db/worker";
import { eq, and } from "drizzle-orm";
import { requireAuth, upsertUser } from "../middlewares/requireAuth";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

function formatPrestadorMestre(p: typeof prestadoresTable.$inferSelect) {
  return {
    id: p.id,
    empresaId: p.empresaId,
    nome: p.nome,
    cnpj: p.cnpj ?? null,
    categoria: p.categoria ?? null,
    telefone: p.telefone ?? null,
    email: p.email ?? null,
    observacoes: p.observacoes ?? null,
    ativo: p.ativo,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// A caller may manage prestadores of their own empresa (admin/escopoEmpresa),
// or global_admin can manage any empresa's. Mirrors the empresa-boundary
// check in condominios.ts's authorizeCondominioAccess, applied to an
// empresaId instead of a condominioId.
async function authorizeEmpresaAccess(
  user: { role: string; empresaId: number | null },
  empresaId: number,
): Promise<Response | null> {
  if (user.role === "global_admin") return null;
  if (user.empresaId === null || user.empresaId !== empresaId) {
    return Response.json({ error: "Acesso negado." }, { status: 403 });
  }
  if (user.role !== "admin") {
    return Response.json({ error: "Acesso negado. Apenas administradores gerenciam prestadores no nível da empresa." }, { status: 403 });
  }
  return null;
}

// GET /api/empresas/:empresaId/prestadores — list master records
router.get("/empresas/:empresaId/prestadores", requireAuth, async (c) => {
  const empresaId = parseInt(c.req.param("empresaId")!, 10);
  if (isNaN(empresaId)) return c.json({ error: "ID inválido" }, 400);
  const db = c.get("db");
  const auth = c.get("auth")!;
  const user = await upsertUser(db, auth.userId, auth.sessionClaims?.["email"] as string | undefined ?? "", auth.sessionClaims?.["name"] as string | undefined);

  const empresaError = await authorizeEmpresaAccess(user, empresaId);
  if (empresaError) return empresaError;

  const rows = await db.select().from(prestadoresTable).where(eq(prestadoresTable.empresaId, empresaId)).orderBy(prestadoresTable.nome);
  return c.json(rows.map(formatPrestadorMestre));
});

// POST /api/empresas/:empresaId/prestadores — create a master record
router.post("/empresas/:empresaId/prestadores", requireAuth, async (c) => {
  const empresaId = parseInt(c.req.param("empresaId")!, 10);
  if (isNaN(empresaId)) return c.json({ error: "ID inválido" }, 400);
  const db = c.get("db");
  const auth = c.get("auth")!;
  const user = await upsertUser(db, auth.userId, auth.sessionClaims?.["email"] as string | undefined ?? "", auth.sessionClaims?.["name"] as string | undefined);

  const empresaError = await authorizeEmpresaAccess(user, empresaId);
  if (empresaError) return empresaError;

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = body.nome as string | undefined;
  if (!nome) return c.json({ error: "nome é obrigatório" }, 400);

  const [created] = await db
    .insert(prestadoresTable)
    .values({
      empresaId,
      nome,
      cnpj: (body.cnpj as string) ?? null,
      categoria: (body.categoria as string) ?? null,
      telefone: (body.telefone as string) ?? null,
      email: (body.email as string) ?? null,
      observacoes: (body.observacoes as string) ?? null,
      ativo: body.ativo !== false,
    })
    .returning();
  return c.json(formatPrestadorMestre(created), 201);
});

// PATCH /api/prestadores/:id — edit a master record
router.patch("/prestadores/:id", requireAuth, async (c) => {
  const id = parseInt(c.req.param("id")!, 10);
  if (isNaN(id)) return c.json({ error: "ID inválido" }, 400);
  const db = c.get("db");
  const auth = c.get("auth")!;
  const user = await upsertUser(db, auth.userId, auth.sessionClaims?.["email"] as string | undefined ?? "", auth.sessionClaims?.["name"] as string | undefined);

  const [existing] = await db.select().from(prestadoresTable).where(eq(prestadoresTable.id, id));
  if (!existing) return c.json({ error: "Prestador não encontrado" }, 404);
  const empresaError = await authorizeEmpresaAccess(user, existing.empresaId);
  if (empresaError) return empresaError;

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};
  for (const field of ["nome", "cnpj", "categoria", "telefone", "email", "observacoes"] as const) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }
  if (body.ativo !== undefined) updateData.ativo = Boolean(body.ativo);
  updateData.updatedAt = new Date();

  const [updated] = await db.update(prestadoresTable).set(updateData).where(eq(prestadoresTable.id, id)).returning();
  return c.json(formatPrestadorMestre(updated));
});

// DELETE /api/prestadores/:id — delete the master record entirely (only if
// it's not associated with any condomínio — check the FK, don't cascade
// silently; the caller should remove associations first).
router.delete("/prestadores/:id", requireAuth, async (c) => {
  const id = parseInt(c.req.param("id")!, 10);
  if (isNaN(id)) return c.json({ error: "ID inválido" }, 400);
  const db = c.get("db");
  const auth = c.get("auth")!;
  const user = await upsertUser(db, auth.userId, auth.sessionClaims?.["email"] as string | undefined ?? "", auth.sessionClaims?.["name"] as string | undefined);

  const [existing] = await db.select().from(prestadoresTable).where(eq(prestadoresTable.id, id));
  if (!existing) return c.json({ error: "Prestador não encontrado" }, 404);
  const empresaError = await authorizeEmpresaAccess(user, existing.empresaId);
  if (empresaError) return empresaError;

  try {
    await db.delete(prestadoresTable).where(eq(prestadoresTable.id, id));
  } catch {
    return c.json({ error: "Não é possível excluir: remova as associações com condomínios primeiro." }, 409);
  }
  return c.json({ ok: true });
});

// POST /api/prestadores/:id/usuarios — link a login user to this prestador
// (e.g. a zelador employed by a terceirizada). Body: { clerkId }. Also sets
// the user's denormalized prestadorId (fast-path used for inspection
// attribution) if not already set, and empresaId to the prestador's empresa
// if the user doesn't have one yet.
router.post("/prestadores/:id/usuarios", requireAuth, async (c) => {
  const id = parseInt(c.req.param("id")!, 10);
  if (isNaN(id)) return c.json({ error: "ID inválido" }, 400);
  const db = c.get("db");
  const auth = c.get("auth")!;
  const caller = await upsertUser(db, auth.userId, auth.sessionClaims?.["email"] as string | undefined ?? "", auth.sessionClaims?.["name"] as string | undefined);

  const [prestador] = await db.select().from(prestadoresTable).where(eq(prestadoresTable.id, id));
  if (!prestador) return c.json({ error: "Prestador não encontrado" }, 404);
  const empresaError = await authorizeEmpresaAccess(caller, prestador.empresaId);
  if (empresaError) return empresaError;

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const clerkId = body.clerkId as string | undefined;
  if (!clerkId) return c.json({ error: "clerkId é obrigatório" }, 400);

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!targetUser) return c.json({ error: "Usuário não encontrado" }, 404);

  const [existingLink] = await db
    .select()
    .from(userPrestadoresTable)
    .where(and(eq(userPrestadoresTable.userId, targetUser.id), eq(userPrestadoresTable.prestadorId, id)));
  if (!existingLink) {
    await db.insert(userPrestadoresTable).values({ userId: targetUser.id, prestadorId: id });
  }

  const patch: Record<string, unknown> = {};
  if (targetUser.prestadorId === null) patch.prestadorId = id;
  if (targetUser.empresaId === null) patch.empresaId = prestador.empresaId;
  if (Object.keys(patch).length > 0) {
    await db.update(usersTable).set(patch).where(eq(usersTable.id, targetUser.id));
  }

  return c.json({ ok: true });
});

// DELETE /api/prestadores/:id/usuarios/:userId — unlink
router.delete("/prestadores/:id/usuarios/:userId", requireAuth, async (c) => {
  const id = parseInt(c.req.param("id")!, 10);
  const userId = parseInt(c.req.param("userId")!, 10);
  if (isNaN(id) || isNaN(userId)) return c.json({ error: "IDs inválidos" }, 400);
  const db = c.get("db");
  const auth = c.get("auth")!;
  const caller = await upsertUser(db, auth.userId, auth.sessionClaims?.["email"] as string | undefined ?? "", auth.sessionClaims?.["name"] as string | undefined);

  const [prestador] = await db.select().from(prestadoresTable).where(eq(prestadoresTable.id, id));
  if (!prestador) return c.json({ error: "Prestador não encontrado" }, 404);
  const empresaError = await authorizeEmpresaAccess(caller, prestador.empresaId);
  if (empresaError) return empresaError;

  await db.delete(userPrestadoresTable).where(and(eq(userPrestadoresTable.userId, userId), eq(userPrestadoresTable.prestadorId, id)));
  // Clear the denormalized fast-path pointer if it pointed at this prestador
  // — the user may still be linked to other prestadores via user_prestadores.
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (targetUser?.prestadorId === id) {
    await db.update(usersTable).set({ prestadorId: null }).where(eq(usersTable.id, userId));
  }

  return c.json({ ok: true });
});

// GET /api/prestadores/:id/usuarios — list linked login users
router.get("/prestadores/:id/usuarios", requireAuth, async (c) => {
  const id = parseInt(c.req.param("id")!, 10);
  if (isNaN(id)) return c.json({ error: "ID inválido" }, 400);
  const db = c.get("db");
  const auth = c.get("auth")!;
  const caller = await upsertUser(db, auth.userId, auth.sessionClaims?.["email"] as string | undefined ?? "", auth.sessionClaims?.["name"] as string | undefined);

  const [prestador] = await db.select().from(prestadoresTable).where(eq(prestadoresTable.id, id));
  if (!prestador) return c.json({ error: "Prestador não encontrado" }, 404);
  const empresaError = await authorizeEmpresaAccess(caller, prestador.empresaId);
  if (empresaError) return empresaError;

  const rows = await db
    .select({ id: usersTable.id, clerkId: usersTable.clerkId, email: usersTable.email, name: usersTable.name })
    .from(userPrestadoresTable)
    .innerJoin(usersTable, eq(usersTable.id, userPrestadoresTable.userId))
    .where(eq(userPrestadoresTable.prestadorId, id));
  return c.json(rows);
});

export default router;
