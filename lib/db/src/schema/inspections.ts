import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inspectionsTable = pgTable("inspections", {
  id: serial("id").primaryKey(),
  tipo: text("tipo").notNull(),
  urgencia: text("urgencia").notNull(),
  acao: text("acao").notNull(),
  resumo: text("resumo").notNull(),
  comunicado: text("comunicado").notNull(),
  transcricao: text("transcricao"),
  analise_imagens: text("analise_imagens"),
  local: text("local"),
  condominio: text("condominio"),
  status: text("status").notNull().default("gerado"),
  condominioId: integer("condominio_id"),
  areaId: integer("area_id"),
  assetId: integer("asset_id"),
  tipoEvento: text("tipo_evento").notNull().default("vistoria"),
  tipoVistoria: text("tipo_vistoria"),
  escopo: text("escopo").notNull().default("completa"),
  areasIds: text("areas_ids"),
  createdByClerkId: text("created_by_clerk_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInspectionSchema = createInsertSchema(inspectionsTable).omit({ id: true, createdAt: true });
export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type Inspection = typeof inspectionsTable.$inferSelect;
