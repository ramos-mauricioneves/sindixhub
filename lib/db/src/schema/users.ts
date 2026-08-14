import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { empresasTable } from "./empresas";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  // Historical name kept as-is (renaming cascades into generated OpenAPI
  // types, the api-client, and frontend UI code). Since the Clerk ->
  // Supabase Auth migration this holds the Supabase Auth user's UUID
  // (auth.users.id) instead of a Clerk user ID — semantically it's just
  // "external auth provider's user id" now.
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  // "global_admin" | "admin" | "sindico" | "vistoriador" — see UserRole in
  // artifacts/api-server/src/middlewares/requireAuth.ts. Multi-tenant
  // migration (2026-08): global_admin is SindixHub's own staff, has no
  // empresaId. admin/sindico/vistoriador belong to exactly one empresa.
  role: text("role").notNull().default("vistoriador"),
  condominio: text("condominio"),
  // Tenant FK. NULL only for global_admin. Every other role must have one
  // (enforced at the app layer during upsert, not a DB NOT NULL — some
  // legacy/backfill windows need it nullable transiently).
  empresaId: integer("empresa_id").references(() => empresasTable.id),
  // Set when this user is staff of a prestador (third-party service
  // provider) rather than internal síndico staff — e.g. a zelador employed
  // by a terceirizada. Orthogonal to `role` (a vistoriador can have this
  // set or not). No FK yet: the `prestadores` table is introduced in Phase
  // 2 of the multi-tenant migration; add the FK constraint then.
  prestadorId: integer("prestador_id"),
  // true = this user (internal síndico staff) has access to every
  // condominio in their own empresa, without needing a row in
  // user_condominios — the "empresa-wide internal team" scenario.
  escopoEmpresa: boolean("escopo_empresa").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
