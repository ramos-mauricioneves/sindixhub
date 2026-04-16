import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const condominiosTable = pgTable("condominios", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  endereco: text("endereco"),
  cidade: text("cidade"),
  estado: text("estado"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const userCondominiosTable = pgTable("user_condominios", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  condominioId: integer("condominio_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const areasTable = pgTable("areas", {
  id: serial("id").primaryKey(),
  condominioId: integer("condominio_id").notNull(),
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull().default("comum"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCondominioSchema = createInsertSchema(condominiosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCondominio = z.infer<typeof insertCondominioSchema>;
export type Condominio = typeof condominiosTable.$inferSelect;

export const insertAreaSchema = createInsertSchema(areasTable).omit({ id: true, createdAt: true });
export type InsertArea = z.infer<typeof insertAreaSchema>;
export type Area = typeof areasTable.$inferSelect;

export const insertUserCondominioSchema = createInsertSchema(userCondominiosTable).omit({ id: true, createdAt: true });
export type InsertUserCondominio = z.infer<typeof insertUserCondominioSchema>;
export type UserCondominio = typeof userCondominiosTable.$inferSelect;
