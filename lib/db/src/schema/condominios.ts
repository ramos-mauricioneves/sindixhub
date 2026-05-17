import { pgTable, text, serial, timestamp, boolean, integer, real, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type EquipeData = {
  subSindico?: { nome?: string; telefone?: string; email?: string };
  zelador?: { tipo?: string; nome?: string; telefone?: string; empresaTerceirizadora?: string };
  portaria?: { tipo?: string; empresa?: string };
  asg?: { quantidade?: number; empresa?: string };
  seguranca?: { quantidade?: number; empresa?: string };
};

export const condominiosTable = pgTable("condominios", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  cnpj: text("cnpj"),
  tipoCondominio: text("tipo_condominio").notNull().default("residencial"),
  endereco: text("endereco"),
  cep: text("cep"),
  bairro: text("bairro"),
  cidade: text("cidade"),
  estado: text("estado"),
  totalUnidades: integer("total_unidades"),
  totalBlocos: integer("total_blocos"),
  totalAndares: integer("total_andares"),
  anoConstrucao: integer("ano_construcao"),
  telefone: text("telefone"),
  email: text("email"),
  sindico: text("sindico"),
  zelador: text("zelador"),
  administradora: text("administradora"),
  inscricaoMunicipal: text("inscricao_municipal"),
  areaTotalM2: real("area_total_m2"),
  areaLazerM2: real("area_lazer_m2"),
  numElevadores: integer("num_elevadores"),
  tipoPortaria: text("tipo_portaria"),
  equipe: json("equipe").$type<EquipeData>(),
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
  bloco: text("bloco"),
  andar: integer("andar"),
  privacidade: text("privacidade").notNull().default("publica"),
  descricao: text("descricao"),
  capacidade: integer("capacidade"),
  reservavel: boolean("reservavel").notNull().default(false),
  horarioAbertura: text("horario_abertura"),
  horarioFechamento: text("horario_fechamento"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contratosCondominioTable = pgTable("contratos_condominio", {
  id: serial("id").primaryKey(),
  condominioId: integer("condominio_id").notNull(),
  tipoServico: text("tipo_servico").notNull(),
  empresa: text("empresa"),
  cnpjEmpresa: text("cnpj_empresa"),
  telefoneEmpresa: text("telefone_empresa"),
  emailEmpresa: text("email_empresa"),
  valorMensal: real("valor_mensal"),
  vigenciaInicio: text("vigencia_inicio"),
  vigenciaFim: text("vigencia_fim"),
  periodicidadeVisita: text("periodicidade_visita"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const prestadoresCondominioTable = pgTable("prestadores_condominio", {
  id: serial("id").primaryKey(),
  condominioId: integer("condominio_id").notNull(),
  nome: text("nome").notNull(),
  especialidade: text("especialidade"),
  telefone: text("telefone"),
  email: text("email"),
  avaliacao: integer("avaliacao"),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentosCondominioTable = pgTable("documentos_condominio", {
  id: serial("id").primaryKey(),
  condominioId: integer("condominio_id").notNull(),
  tipo: text("tipo").notNull(),
  numeroReferencia: text("numero_referencia"),
  dataEmissao: text("data_emissao"),
  dataValidade: text("data_validade"),
  empresaResponsavel: text("empresa_responsavel"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const seguroPredialTable = pgTable("seguro_predial", {
  id: serial("id").primaryKey(),
  condominioId: integer("condominio_id").notNull().unique(),
  seguradora: text("seguradora"),
  numeroApolice: text("numero_apolice"),
  vigenciaInicio: text("vigencia_inicio"),
  vigenciaFim: text("vigencia_fim"),
  tipoCobertura: text("tipo_cobertura"),
  valorSegurado: real("valor_segurado"),
  nomeCorretor: text("nome_corretor"),
  telefoneCorretor: text("telefone_corretor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
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

export const insertContratoCondominioSchema = createInsertSchema(contratosCondominioTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContratoCondominio = z.infer<typeof insertContratoCondominioSchema>;
export type ContratoCondominio = typeof contratosCondominioTable.$inferSelect;

export const insertPrestadorCondominioSchema = createInsertSchema(prestadoresCondominioTable).omit({ id: true, createdAt: true });
export type InsertPrestadorCondominio = z.infer<typeof insertPrestadorCondominioSchema>;
export type PrestadorCondominio = typeof prestadoresCondominioTable.$inferSelect;

export const insertDocumentoCondominioSchema = createInsertSchema(documentosCondominioTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocumentoCondominio = z.infer<typeof insertDocumentoCondominioSchema>;
export type DocumentoCondominio = typeof documentosCondominioTable.$inferSelect;

export const insertSeguroPredialSchema = createInsertSchema(seguroPredialTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSeguroPredial = z.infer<typeof insertSeguroPredialSchema>;
export type SeguroPredial = typeof seguroPredialTable.$inferSelect;
