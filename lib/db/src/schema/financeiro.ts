import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lancamentosTable = pgTable("lancamentos", {
  id: serial("id").primaryKey(),
  condominioId: integer("condominio_id").notNull(),
  tipo: text("tipo").notNull().default("despesa"),
  categoria: text("categoria").notNull().default("outros"),
  descricao: text("descricao").notNull(),
  valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
  dataVencimento: text("data_vencimento").notNull(),
  dataPagamento: text("data_pagamento"),
  status: text("status").notNull().default("pendente"),
  observacao: text("observacao"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLancamentoSchema = createInsertSchema(lancamentosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLancamento = z.infer<typeof insertLancamentoSchema>;
export type Lancamento = typeof lancamentosTable.$inferSelect;
