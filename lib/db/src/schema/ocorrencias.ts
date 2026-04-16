import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ocorrenciasTable = pgTable("ocorrencias", {
  id: serial("id").primaryKey(),
  condominioId: integer("condominio_id").notNull(),
  moradorNome: text("morador_nome").notNull(),
  unidade: text("unidade").notNull(),
  categoria: text("categoria").notNull(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao").notNull(),
  prioridade: text("prioridade").notNull().default("media"),
  status: text("status").notNull().default("aberta"),
  resposta: text("resposta"),
  resolvidoEm: timestamp("resolvido_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOcorrenciaSchema = createInsertSchema(ocorrenciasTable).omit({ id: true, createdAt: true });
export type InsertOcorrencia = z.infer<typeof insertOcorrenciaSchema>;
export type Ocorrencia = typeof ocorrenciasTable.$inferSelect;
