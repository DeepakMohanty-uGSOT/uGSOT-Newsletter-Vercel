import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { z } from "zod";

export const newslettersTable = pgTable("newsletters", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  description: text("description"),
  pdfUrl: text("pdf_url").notNull(),
  themeId: integer("theme_id"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

// Hand-written rather than `createInsertSchema(newslettersTable)` — see
// employees.ts for why. Nothing currently imports this schema, so this is a
// drop-in equivalent.
export const insertNewsletterSchema = z.object({
  title: z.string(),
  topic: z.string(),
  description: z.string().nullable().optional(),
  pdfUrl: z.string(),
  themeId: z.number().nullable().optional(),
});
export type InsertNewsletter = z.infer<typeof insertNewsletterSchema>;
export type Newsletter = typeof newslettersTable.$inferSelect;
