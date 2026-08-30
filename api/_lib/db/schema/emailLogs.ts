import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";
import { employeesTable } from "./employees";
import { newslettersTable } from "./newsletters";

export const emailLogsTable = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  employeeEmail: text("employee_email").notNull().references(() => employeesTable.employeeEmail, { onDelete: "cascade" }),
  newsletterId: integer("newsletter_id").notNull().references(() => newslettersTable.id),
  deliveryStatus: text("delivery_status").notNull().default("pending"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  errorMessage: text("error_message"),
});

// Hand-written rather than `createInsertSchema(emailLogsTable)` — see employees.ts
// for why. Nothing currently imports this schema, so this is a drop-in equivalent.
export const insertEmailLogSchema = z.object({
  employeeEmail: z.string(),
  newsletterId: z.number(),
  deliveryStatus: z.string().optional(),
  errorMessage: z.string().nullable().optional(),
});
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type EmailLog = typeof emailLogsTable.$inferSelect;
