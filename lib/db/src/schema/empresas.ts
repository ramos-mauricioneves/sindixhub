import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// The tenant root. A "síndico profissional" company managing one or more
// condomínios. Every condominio, and every non-global_admin user, belongs
// to exactly one empresa. global_admin users (SindixHub's own staff) have
// no empresa — see usersTable.empresaId.
export const empresasTable = pgTable("empresas", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  cnpj: text("cnpj"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEmpresaSchema = createInsertSchema(empresasTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmpresa = z.infer<typeof insertEmpresaSchema>;
export type Empresa = typeof empresasTable.$inferSelect;
