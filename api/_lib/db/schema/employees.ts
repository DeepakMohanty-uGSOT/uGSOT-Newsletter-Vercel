import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeName: text("employee_name").notNull(),
  employeeEmail: text("employee_email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
