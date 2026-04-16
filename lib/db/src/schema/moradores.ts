import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const moradoresTable = pgTable("moradores", {
  id: serial("id").primaryKey(),
  condominioId: integer("condominio_id").notNull(),
  unidade: text("unidade").notNull(),
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull().default("morador"),
  telefone: text("telefone"),
  email: text("email"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMoradorSchema = createInsertSchema(moradoresTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMorador = z.infer<typeof insertMoradorSchema>;
export type Morador = typeof moradoresTable.$inferSelect;
