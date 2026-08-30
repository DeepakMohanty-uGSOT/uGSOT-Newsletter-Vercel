import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { z } from "zod";

export const adminsTable = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["super_admin", "admin"] }).notNull().default("admin"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdminSchema = z.object({
  email: z.string().email(),
  passwordHash: z.string(),
  role: z.enum(["super_admin", "admin"]).optional(),
  mustChangePassword: z.boolean().optional(),
  createdBy: z.number().nullable().optional(),
});
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof adminsTable.$inferSelect;
