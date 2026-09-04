import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeName: text("employee_name").notNull(),
  // No `.unique()` here anymore -- uniqueness is enforced by a partial
  // unique index (idx_employees_email_active, see
  // sql/010_add_soft_delete.sql) that only applies to active rows, so a
  // soft-deleted employee's email doesn't block restoring or re-adding it.
  employeeEmail: text("employee_email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Soft delete: set instead of removing the row, so a deleted employee can
  // be restored later ("Recently Deleted", 30-day retention).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedByAdminEmail: text("deleted_by_admin_email"),
});

// Hand-written rather than `createInsertSchema(employeesTable)`: drizzle-zod@0.8's
// generated type doesn't satisfy zod's `ZodType` constraint under this repo's zod
// version, which broke `tsc --build`. Nothing currently imports this schema, so
// this is a drop-in equivalent with no behavior change.
export const insertEmployeeSchema = z.object({
  employeeName: z.string(),
  employeeEmail: z.string(),
});
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
