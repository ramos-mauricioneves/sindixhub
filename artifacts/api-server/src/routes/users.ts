import { Hono } from "hono";
import { usersTable, userCondominiosTable } from "@workspace/db/worker";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, upsertUser } from "../middlewares/requireAuth";
import { UpdateUserRoleBody } from "@workspace/api-zod";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

async function getCondominioIds(db: AppEnv["Variables"]["db"], userId: number): Promise<number[]> {
  const rows = await db.select().from(userCondominiosTable).where(eq(userCondominiosTable.userId, userId));
  return rows.map((r) => r.condominioId);
}

function formatUser(u: typeof usersTable.$inferSelect, condominioIds: number[]) {
  return {
    id: u.id,
    clerkId: u.clerkId,
    email: u.email,
    name: u.name,
    role: u.role,
    condominio: u.condominio,
    condominioIds,
    empresaId: u.empresaId,
    prestadorId: u.prestadorId,
    escopoEmpresa: u.escopoEmpresa,
    createdAt: u.createdAt,
  };
}

router.get("/users/me", requireAuth, async (c) => {
  const db = c.get("db");
  const auth = c.get("auth")!;
  const emailAddress = auth.sessionClaims?.["email"] as string | undefined;
  const name = auth.sessionClaims?.["name"] as string | undefined;
  const user = await upsertUser(db, auth.userId, emailAddress ?? "", name);
  const condominioIds = await getCondominioIds(db, user.id);
  return c.json(formatUser(user, condominioIds));
});

router.get("/users", requireAuth, requireRole("admin"), async (c) => {
  const db = c.get("db");
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  const result = await Promise.all(
    users.map(async (u) => {
      const condominioIds = await getCondominioIds(db, u.id);
      return formatUser(u, condominioIds);
    }),
  );
  return c.json(result);
});

router.patch("/users/:clerkId/role", requireAuth, requireRole("admin"), async (c) => {
  const db = c.get("db");
  const clerkId = c.req.param("clerkId")!;

  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateUserRoleBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }

  const [updated] = await db
    .update(usersTable)
    .set({ role: parsed.data.role, condominio: parsed.data.condominio ?? null })
    .where(eq(usersTable.clerkId, clerkId))
    .returning();

  if (!updated) {
    return c.json({ error: "Usuário não encontrado." }, 404);
  }

  const condominioIds = await getCondominioIds(db, updated.id);
  return c.json(formatUser(updated, condominioIds));
});

export default router;
