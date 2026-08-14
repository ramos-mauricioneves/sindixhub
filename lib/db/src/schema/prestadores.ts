import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { empresasTable } from "./empresas";
import { condominiosTable } from "./condominios";
import { usersTable } from "./users";

// Master record, always registered at the empresa level — a service
// provider company (e.g. a security firm, an elevator maintenance
// company). Cadastro-once, associate-to-many-condomínios via
// prestadorCondominiosTable below (not a "belongs to empresa OR
// condominio" scope flag — every prestador is empresa-owned, and its
// presence at a given condomínio is the association row's job).
export const prestadoresTable = pgTable("prestadores", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresasTable.id),
  nome: text("nome").notNull(),
  cnpj: text("cnpj"),
  categoria: text("categoria"),
  telefone: text("telefone"),
  email: text("email"),
  observacoes: text("observacoes"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Association between a prestador and a specific condomínio it's actually
// contracted at, with per-condomínio overrides. NULL override columns mean
// "inherit from the prestadores master row" — see the COALESCE pattern used
// when reading this table in routes/condominios.ts.
export const prestadorCondominiosTable = pgTable("prestador_condominios", {
  id: serial("id").primaryKey(),
  prestadorId: integer("prestador_id").notNull().references(() => prestadoresTable.id),
  condominioId: integer("condominio_id").notNull().references(() => condominiosTable.id),
  categoria: text("categoria"), // override; NULL inherits prestadores.categoria
  telefone: text("telefone"), // override; NULL inherits
  email: text("email"), // override; NULL inherits
  vigenciaInicio: text("vigencia_inicio"),
  vigenciaFim: text("vigencia_fim"),
  valorMensal: real("valor_mensal"),
  avaliacao: integer("avaliacao"),
  observacoes: text("observacoes"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Which login user(s) act as staff of a given prestador (e.g. a zelador
// employed by a terceirizada). Many-to-many: a prestador can have more than
// one staff login, and (in principle, though unusual) a user could be
// linked to more than one prestador. See users.prestadorId for the
// denormalized single-prestador fast path used for inspection attribution.
export const userPrestadoresTable = pgTable("user_prestadores", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  prestadorId: integer("prestador_id").notNull().references(() => prestadoresTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPrestadorSchema = createInsertSchema(prestadoresTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPrestador = z.infer<typeof insertPrestadorSchema>;
export type Prestador = typeof prestadoresTable.$inferSelect;

export const insertPrestadorCondominioSchema = createInsertSchema(prestadorCondominiosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPrestadorCondominio = z.infer<typeof insertPrestadorCondominioSchema>;
export type PrestadorCondominio = typeof prestadorCondominiosTable.$inferSelect;

export const insertUserPrestadorSchema = createInsertSchema(userPrestadoresTable).omit({ id: true, createdAt: true });
export type InsertUserPrestador = z.infer<typeof insertUserPrestadorSchema>;
export type UserPrestador = typeof userPrestadoresTable.$inferSelect;
