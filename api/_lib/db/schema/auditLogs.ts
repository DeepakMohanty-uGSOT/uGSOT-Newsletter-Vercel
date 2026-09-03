import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id"),
  adminEmail: text("admin_email").notNull(),
  // Dotted "<resource>.<verb>" strings, e.g. "theme.create",
  // "newsletter.send" — see api/_server/lib/auditLog.ts for the full list.
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  targetLabel: text("target_label"),
  // JSON-stringified extra detail (e.g. { sent, failed, total } for a
  // newsletter send) — kept as plain text rather than jsonb since nothing
  // else in this schema uses jsonb and a string round-trips fine for the
  // small amount of detail this needs.
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Hand-written rather than `createInsertSchema(auditLogsTable)` — see
// employees.ts for why.
export const insertAuditLogSchema = z.object({
  adminId: z.number().nullable().optional(),
  adminEmail: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable().optional(),
  targetLabel: z.string().nullable().optional(),
  metadata: z.string().nullable().optional(),
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
