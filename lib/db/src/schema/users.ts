import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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
  role: text("role").notNull().default("vistoriador"),
  condominio: text("condominio"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
