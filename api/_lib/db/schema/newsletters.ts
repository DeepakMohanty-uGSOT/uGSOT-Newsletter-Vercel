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
  // Who most recently triggered a send for this newsletter, and when. Full
  // send-by-send history lives in audit_logs; these two columns just let the
  // newsletter detail page show the latest sender without an extra query.
  lastSentByAdminEmail: text("last_sent_by_admin_email"),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  // Frozen copy (JSON-encoded ThemeLike) of the theme actually used at
  // upload time, so editing that theme afterwards never changes how an
  // already-uploaded newsletter renders in Preview or on resend.
  themeSnapshot: text("theme_snapshot"),
  // Soft delete: set instead of removing the row, so a deleted newsletter
  // can be restored later ("Recently Deleted", 30-day retention). The PDF
  // stays in Supabase storage until the row is restored or permanently
  // purged, so restoring works even after the PDF-attached email was sent.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedByAdminEmail: text("deleted_by_admin_email"),
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
