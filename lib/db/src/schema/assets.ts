import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Shared service-category vocabulary, matched between assets.categoriaServico
// and prestadores.categoria / prestadorCondominios.categoria (override) to
// power the prestador-suggestion feature (see routes/inspections.ts
// suggest-prestador endpoint). Deliberately a plain shared TS constant, not
// a Postgres enum — consistent with how areas.tipo/assets.tipo are already
// UI-enforced free text rather than DB-enforced, and avoids the operational
// cost of ALTER TYPE every time a category is added.
export const SERVICO_CATEGORIAS = [
  "elevador",
  "hidraulica",
  "eletrica",
  "pintura",
  "jardinagem",
  "portaria_seguranca",
  "limpeza",
  "ar_condicionado",
  "estrutural_civil",
  "incendio_ppci",
  "dedetizacao",
  "outro",
] as const;
export type ServicoCategoria = (typeof SERVICO_CATEGORIAS)[number];

export const assetsTable = pgTable("assets", {
  id: serial("id").primaryKey(),
  condominioId: integer("condominio_id").notNull(),
  areaId: integer("area_id"),
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull().default("equipamento"),
  criticidade: text("criticidade").notNull().default("media"),
  status: text("status").notNull().default("operacional"),
  descricao: text("descricao"),
  // Which trade/service category can repair or maintain this asset — used
  // to match against prestadores.categoria for the acionamento-suggestion
  // feature. Distinct from `tipo` (which describes "what kind of thing this
  // is" — equipamento/estrutura/sistema — not "who services it").
  categoriaServico: text("categoria_servico"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAssetSchema = createInsertSchema(assetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assetsTable.$inferSelect;
