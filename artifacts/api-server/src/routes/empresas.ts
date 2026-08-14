import { Hono } from "hono";
import { empresasTable, condominiosTable } from "@workspace/db/worker";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

function formatEmpresa(e: typeof empresasTable.$inferSelect) {
  return { id: e.id, nome: e.nome, cnpj: e.cnpj ?? null, ativo: e.ativo, createdAt: e.createdAt, updatedAt: e.updatedAt };
}

// All routes here are global_admin only — this is platform-level tenant
// management (SindixHub's own staff), not something any empresa's own
// admin should be able to do to itself or to other empresas.
router.get("/empresas", requireAuth, requireRole("global_admin"), async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(empresasTable).orderBy(empresasTable.nome);
  return c.json(rows.map(formatEmpresa));
});

router.post("/empresas", requireAuth, requireRole("global_admin"), async (c) => {
  const db = c.get("db");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = body.nome as string | undefined;
  if (!nome) return c.json({ error: "nome é obrigatório" }, 400);
  const [created] = await db
    .insert(empresasTable)
    .values({ nome, cnpj: (body.cnpj as string) ?? null, ativo: body.ativo !== false })
    .returning();
  return c.json(formatEmpresa(created), 201);
});

router.patch("/empresas/:id", requireAuth, requireRole("global_admin"), async (c) => {
  const id = parseInt(c.req.param("id")!, 10);
  if (isNaN(id)) return c.json({ error: "ID inválido" }, 400);
  const db = c.get("db");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};
  if (body.nome !== undefined) updateData.nome = body.nome;
  if (body.cnpj !== undefined) updateData.cnpj = body.cnpj;
  if (body.ativo !== undefined) updateData.ativo = Boolean(body.ativo);
  updateData.updatedAt = new Date();
  const [updated] = await db.update(empresasTable).set(updateData).where(eq(empresasTable.id, id)).returning();
  if (!updated) return c.json({ error: "Empresa não encontrada" }, 404);
  return c.json(formatEmpresa(updated));
});

// Cross-tenant drill-down: which condomínios belong to this empresa.
router.get("/empresas/:id/condominios", requireAuth, requireRole("global_admin"), async (c) => {
  const id = parseInt(c.req.param("id")!, 10);
  if (isNaN(id)) return c.json({ error: "ID inválido" }, 400);
  const db = c.get("db");
  const rows = await db.select().from(condominiosTable).where(eq(condominiosTable.empresaId, id)).orderBy(condominiosTable.nome);
  return c.json(rows);
});

export default router;
