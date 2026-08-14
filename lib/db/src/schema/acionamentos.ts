import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { inspectionsTable } from "./inspections";
import { assetsTable } from "./assets";
import { areasTable } from "./condominios";
import { prestadoresTable } from "./prestadores";

// Lightweight — NOT a full ticketing system. Links an inspection finding to
// a prestador that was suggested/selected for the repair/maintenance work
// it identified. Only written when a user actually accepts a suggestion or
// manually picks a prestador — the suggestion computation itself (see
// routes/inspections.ts suggest-prestador endpoint) is stateless and
// doesn't persist rows for suggestions that were shown but not acted on.
export const VALID_ACIONAMENTO_STATUS = ["sugerido", "acionado", "resolvido"] as const;
export type AcionamentoStatus = (typeof VALID_ACIONAMENTO_STATUS)[number];

export const acionamentosTable = pgTable("acionamentos", {
  id: serial("id").primaryKey(),
  inspectionId: integer("inspection_id").notNull().references(() => inspectionsTable.id),
  assetId: integer("asset_id").references(() => assetsTable.id),
  areaId: integer("area_id").references(() => areasTable.id),
  prestadorId: integer("prestador_id").notNull().references(() => prestadoresTable.id),
  status: text("status").notNull().default("sugerido"),
  observacoes: text("observacoes"),
  createdByClerkId: text("created_by_clerk_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAcionamentoSchema = createInsertSchema(acionamentosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAcionamento = z.infer<typeof insertAcionamentoSchema>;
export type Acionamento = typeof acionamentosTable.$inferSelect;
