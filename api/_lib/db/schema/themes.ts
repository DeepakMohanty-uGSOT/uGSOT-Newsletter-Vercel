import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { z } from "zod";

export const themesTable = pgTable("themes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  headerGradientStart: text("header_gradient_start").notNull(),
  headerGradientEnd: text("header_gradient_end").notNull(),
  accentColor: text("accent_color").notNull(),
  footerColor: text("footer_color").notNull(),
  bannerEmoji: text("banner_emoji"),
  greetingText: text("greeting_text"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertThemeSchema = z.object({
  name: z.string().min(1),
  headerGradientStart: z.string().min(1),
  headerGradientEnd: z.string().min(1),
  accentColor: z.string().min(1),
  footerColor: z.string().min(1),
  bannerEmoji: z.string().nullable().optional(),
  greetingText: z.string().nullable().optional(),
});
export type InsertTheme = z.infer<typeof insertThemeSchema>;
export type Theme = typeof themesTable.$inferSelect;
