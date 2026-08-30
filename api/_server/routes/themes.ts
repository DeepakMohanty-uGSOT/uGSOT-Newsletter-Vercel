import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, themesTable } from "../../_lib/db/index.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireSuperAdmin } from "../middlewares/requireSuperAdmin.js";
import { renderDefaultTemplate } from "./newsletters.js";

const router: IRouter = Router();

router.get("/themes", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(themesTable).orderBy(themesTable.createdAt);
  // Every theme always has real, editable HTML to show in the admin UI —
  // themes created before the custom-HTML field existed get it generated
  // on the fly from their stored colors/banner/greeting, with the usual
  // {{name}}/{{email}}/{{title}}/{{topic}}/{{description}} placeholders.
  const themes = rows.map((row) => ({ ...row, customHtml: renderDefaultTemplate(row) }));
  res.json({ themes });
});

router.post("/themes", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { name, headerGradientStart, headerGradientEnd, accentColor, footerColor, bannerEmoji, greetingText, customHtml } =
    req.body as {
      name?: string;
      headerGradientStart?: string;
      headerGradientEnd?: string;
      accentColor?: string;
      footerColor?: string;
      bannerEmoji?: string | null;
      greetingText?: string | null;
      customHtml?: string | null;
    };

  if (!name || !customHtml) {
    res.status(400).json({ error: "name and customHtml are required" });
    return;
  }

  const [existing] = await db.select({ id: themesTable.id }).from(themesTable).where(eq(themesTable.name, name));
  if (existing) {
    res.status(409).json({ error: "A theme with this name already exists" });
    return;
  }

  const [created] = await db
    .insert(themesTable)
    .values({
      name,
      headerGradientStart: headerGradientStart || null,
      headerGradientEnd: headerGradientEnd || null,
      accentColor: accentColor || null,
      footerColor: footerColor || null,
      bannerEmoji: bannerEmoji || null,
      greetingText: greetingText || null,
      customHtml,
    })
    .returning();

  req.log.info({ theme: name }, "Theme created");
  res.status(201).json(created);
});

router.patch("/themes/:id", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { name, headerGradientStart, headerGradientEnd, accentColor, footerColor, bannerEmoji, greetingText, customHtml } =
    req.body as {
      name?: string;
      headerGradientStart?: string;
      headerGradientEnd?: string;
      accentColor?: string;
      footerColor?: string;
      bannerEmoji?: string | null;
      greetingText?: string | null;
      customHtml?: string | null;
    };

  const [existing] = await db.select().from(themesTable).where(eq(themesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Theme not found" });
    return;
  }

  const [updated] = await db
    .update(themesTable)
    .set({
      name: name ?? existing.name,
      headerGradientStart: headerGradientStart ?? existing.headerGradientStart,
      headerGradientEnd: headerGradientEnd ?? existing.headerGradientEnd,
      accentColor: accentColor ?? existing.accentColor,
      footerColor: footerColor ?? existing.footerColor,
      bannerEmoji: bannerEmoji === undefined ? existing.bannerEmoji : bannerEmoji,
      greetingText: greetingText === undefined ? existing.greetingText : greetingText,
      customHtml: customHtml === undefined ? existing.customHtml : customHtml,
    })
    .where(eq(themesTable.id, id))
    .returning();

  req.log.info({ themeId: id }, "Theme updated");
  res.json(updated);
});

// Marks exactly one theme active at a time — the "default" one used for a
// newsletter that doesn't specify a theme at upload time.
router.patch("/themes/:id/activate", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [target] = await db.select().from(themesTable).where(eq(themesTable.id, id));
  if (!target) {
    res.status(404).json({ error: "Theme not found" });
    return;
  }

  await db.update(themesTable).set({ isActive: false });
  const [updated] = await db.update(themesTable).set({ isActive: true }).where(eq(themesTable.id, id)).returning();

  req.log.info({ themeId: id }, "Theme activated");
  res.json(updated);
});

router.delete("/themes/:id", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [target] = await db.select().from(themesTable).where(eq(themesTable.id, id));
  if (!target) {
    res.status(404).json({ error: "Theme not found" });
    return;
  }
  if (target.isActive) {
    res.status(400).json({ error: "Cannot delete the active theme. Activate a different theme first." });
    return;
  }

  await db.delete(themesTable).where(eq(themesTable.id, id));
  // Newsletters that referenced this theme fall back to null (see the
  // schema's ON DELETE SET NULL), which the send/preview logic treats the
  // same as "use whatever theme is currently active."

  req.log.info({ themeId: id }, "Theme deleted");
  res.json({ message: "Theme deleted" });
});

export default router;
