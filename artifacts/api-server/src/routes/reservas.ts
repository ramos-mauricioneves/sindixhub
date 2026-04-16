import { Router } from "express";
import { db, reservasTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { requireAuth, requireRole, upsertUser } from "../middlewares/requireAuth";

const router = Router();

const VALID_STATUSES = ["pendente", "aprovada", "rejeitada", "cancelada"];

function fmt(r: typeof reservasTable.$inferSelect) {
  return {
    id: r.id,
    condominioId: r.condominioId,
    areaId: r.areaId,
    moradorNome: r.moradorNome,
    unidade: r.unidade,
    data: r.data,
    horaInicio: r.horaInicio,
    horaFim: r.horaFim,
    status: r.status,
    observacao: r.observacao ?? null,
    motivoRejeicao: r.motivoRejeicao ?? null,
    createdAt: r.createdAt,
  };
}

function hasTimeConflict(horaInicio: string, horaFim: string, existing: { horaInicio: string; horaFim: string }[]) {
  return existing.some((r) => horaInicio < r.horaFim && horaFim > r.horaInicio);
}

router.get("/condominios/:condominioId/reservas", requireAuth, async (req, res) => {
  const auth = req.auth!;
  await upsertUser(auth.userId, (auth as any).sessionClaims?.email ?? "", (auth as any).sessionClaims?.name);

  const condominioId = parseInt(req.params.condominioId, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "condominioId inválido" }); return; }

  const conditions = [eq(reservasTable.condominioId, condominioId)];
  if (req.query.status) conditions.push(eq(reservasTable.status, req.query.status as string));
  if (req.query.data) conditions.push(eq(reservasTable.data, req.query.data as string));

  const rows = await db.select().from(reservasTable).where(and(...conditions)).orderBy(reservasTable.data);
  res.json(rows.map(fmt));
});

router.post("/condominios/:condominioId/reservas", requireAuth, async (req, res) => {
  const auth = req.auth!;
  await upsertUser(auth.userId, (auth as any).sessionClaims?.email ?? "", (auth as any).sessionClaims?.name);

  const condominioId = parseInt(req.params.condominioId, 10);
  if (isNaN(condominioId)) { res.status(400).json({ error: "condominioId inválido" }); return; }

  const { areaId, moradorNome, unidade, data, horaInicio, horaFim, observacao } = req.body;
  if (!areaId || !moradorNome || !unidade || !data || !horaInicio || !horaFim) {
    res.status(400).json({ error: "areaId, moradorNome, unidade, data, horaInicio e horaFim são obrigatórios" }); return;
  }

  if (horaInicio >= horaFim) {
    res.status(400).json({ error: "horaInicio deve ser anterior a horaFim" }); return;
  }

  const existing = await db.select().from(reservasTable).where(
    and(
      eq(reservasTable.condominioId, condominioId),
      eq(reservasTable.areaId, parseInt(areaId)),
      eq(reservasTable.data, data),
      eq(reservasTable.status, "aprovada"),
    )
  );

  if (hasTimeConflict(horaInicio, horaFim, existing)) {
    res.status(409).json({ error: "Conflito de horário: já existe uma reserva aprovada neste período" }); return;
  }

  const [created] = await db.insert(reservasTable).values({
    condominioId,
    areaId: parseInt(areaId),
    moradorNome,
    unidade,
    data,
    horaInicio,
    horaFim,
    status: "pendente",
    observacao: observacao ?? null,
  }).returning();

  res.status(201).json(fmt(created));
});

router.patch("/condominios/:condominioId/reservas/:reservaId", requireAuth, requireRole("admin", "sindico"), async (req, res) => {
  const auth = req.auth!;
  await upsertUser(auth.userId, (auth as any).sessionClaims?.email ?? "", (auth as any).sessionClaims?.name);

  const condominioId = parseInt(req.params.condominioId, 10);
  const reservaId = parseInt(req.params.reservaId, 10);
  if (isNaN(condominioId) || isNaN(reservaId)) { res.status(400).json({ error: "IDs inválidos" }); return; }

  const { status, motivoRejeicao } = req.body;

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: "Status inválido. Valores: pendente, aprovada, rejeitada, cancelada" }); return;
  }

  const [current] = await db.select().from(reservasTable).where(
    and(eq(reservasTable.id, reservaId), eq(reservasTable.condominioId, condominioId))
  );
  if (!current) { res.status(404).json({ error: "Reserva não encontrada neste condomínio" }); return; }

  if (status === "aprovada" && current.status === "pendente") {
    const existing = await db.select().from(reservasTable).where(
      and(
        eq(reservasTable.condominioId, condominioId),
        eq(reservasTable.areaId, current.areaId),
        eq(reservasTable.data, current.data),
        eq(reservasTable.status, "aprovada"),
        ne(reservasTable.id, reservaId),
      )
    );
    if (hasTimeConflict(current.horaInicio, current.horaFim, existing)) {
      res.status(409).json({ error: "Conflito: já existe outra reserva aprovada neste horário" }); return;
    }
  }

  const updateData: Partial<typeof reservasTable.$inferInsert> = {};
  if (status !== undefined) updateData.status = status;
  if (motivoRejeicao !== undefined) updateData.motivoRejeicao = motivoRejeicao;

  const [updated] = await db.update(reservasTable).set(updateData).where(
    and(eq(reservasTable.id, reservaId), eq(reservasTable.condominioId, condominioId))
  ).returning();

  res.json(fmt(updated));
});

router.delete("/condominios/:condominioId/reservas/:reservaId", requireAuth, requireRole("admin", "sindico"), async (req, res) => {
  const condominioId = parseInt(req.params.condominioId, 10);
  const reservaId = parseInt(req.params.reservaId, 10);
  if (isNaN(condominioId) || isNaN(reservaId)) { res.status(400).json({ error: "IDs inválidos" }); return; }

  await db.delete(reservasTable).where(
    and(eq(reservasTable.id, reservaId), eq(reservasTable.condominioId, condominioId))
  );
  res.status(204).send();
});

export default router;
