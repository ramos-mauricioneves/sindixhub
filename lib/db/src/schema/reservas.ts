import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reservasTable = pgTable("reservas", {
  id: serial("id").primaryKey(),
  condominioId: integer("condominio_id").notNull(),
  areaId: integer("area_id").notNull(),
  moradorNome: text("morador_nome").notNull(),
  unidade: text("unidade").notNull(),
  data: text("data").notNull(),
  horaInicio: text("hora_inicio").notNull(),
  horaFim: text("hora_fim").notNull(),
  status: text("status").notNull().default("pendente"),
  observacao: text("observacao"),
  motivoRejeicao: text("motivo_rejeicao"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReservaSchema = createInsertSchema(reservasTable).omit({ id: true, createdAt: true });
export type InsertReserva = z.infer<typeof insertReservaSchema>;
export type Reserva = typeof reservasTable.$inferSelect;
