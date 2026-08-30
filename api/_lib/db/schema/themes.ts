import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { z } from "zod";

export const themesTable = pgTable("themes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  // Legacy color fields — themes created before the custom-HTML editor now
  // just bake their colors directly into customHtml instead. Kept nullable
  // here only so old rows still read back cleanly.
  headerGradientStart: text("header_gradient_start"),
  headerGradientEnd: text("header_gradient_end"),
  accentColor: text("accent_color"),
  footerColor: text("footer_color"),
  bannerEmoji: text("banner_emoji"),
  greetingText: text("greeting_text"),
  customHtml: text("custom_html"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertThemeSchema = z.object({
  name: z.string().min(1),
  headerGradientStart: z.string().nullable().optional(),
  headerGradientEnd: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
  footerColor: z.string().nullable().optional(),
  bannerEmoji: z.string().nullable().optional(),
  greetingText: z.string().nullable().optional(),
  customHtml: z.string().nullable().optional(),
});
export type InsertTheme = z.infer<typeof insertThemeSchema>;
export type Theme = typeof themesTable.$inferSelect;
