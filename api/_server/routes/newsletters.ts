import { Router, type IRouter } from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { db, newslettersTable, employeesTable, emailLogsTable, themesTable } from "../../_lib/db/index.js";
import { eq, count, sql, desc, and, isNull, lt } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { logAudit } from "../lib/auditLog.js";
import { logger } from "../lib/logger.js";
import { randomUUID } from "crypto";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_STORAGE_BUCKET) {
  throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET are required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function normalizeStoragePath(value: string): string {
  if (value.startsWith("newsletters/")) return value;
  const filename = value.split("/").pop() ?? "";
  if (!filename) throw new Error("Invalid storage path");
  return `newsletters/${filename}`;
}

async function uploadPdfToStorage(buffer: Buffer, originalName: string): Promise<string> {
  const id = randomUUID();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `newsletters/${id}-${safeName}`;

  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });

  if (error) throw new Error(`Supabase storage upload failed: ${error.message}`);
  return storagePath;
}

async function downloadPdfBuffer(storagePath: string): Promise<Buffer> {
  const normalized = normalizeStoragePath(storagePath);
  logger.info({ storagePath: normalized, bucket: SUPABASE_STORAGE_BUCKET }, "Downloading PDF from Supabase");

  const { data, error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .download(normalized);

  if (error || !data) {
    throw new Error(`Supabase storage download failed: ${error?.message ?? "No data returned"}`);
  }

  const buf = Buffer.from(await data.arrayBuffer());
  logger.info({ bytes: buf.length }, "PDF downloaded successfully");
  return buf;
}

// ---------------------------------------------------------------------------
// Theme resolution
// ---------------------------------------------------------------------------

// Hardcoded fallback matching the original look, used only if the themes
// table hasn't been migrated/seeded yet (see sql/002_create_themes_table.sql).
const FALLBACK_THEME = {
  headerGradientStart: "#c8102e",
  headerGradientEnd: "#e63946",
  accentColor: "#c8102e",
  footerColor: "#c8102e",
  bannerEmoji: null as string | null,
  greetingText: null as string | null,
  customHtml: null as string | null,
};

async function getThemeForNewsletter(themeId: number | null) {
  if (themeId) {
    const [byId] = await db.select().from(themesTable).where(eq(themesTable.id, themeId));
    if (byId) return byId;
  }
  const [active] = await db.select().from(themesTable).where(eq(themesTable.isActive, true));
  return active ?? FALLBACK_THEME;
}

// Returns the theme a given newsletter should actually render/send with.
//
// Newsletters used to just store a themeId and look the theme up live every
// time, which meant editing an existing theme's colors/HTML on the Themes
// page silently changed how *every* newsletter that ever used it looked —
// including ones already sent to employees. That's wrong: once a newsletter
// has gone out, its appearance shouldn't shift under it later.
//
// Newsletters now freeze a snapshot of the resolved theme (see
// themeSnapshot on the schema) the first time this is called for them, and
// every subsequent call reuses that frozen copy instead of re-resolving
// against the (possibly since-edited) themes table.
async function getEffectiveTheme(newsletter: {
  id: number;
  themeId: number | null;
  themeSnapshot: string | null;
}): Promise<ThemeLike> {
  if (newsletter.themeSnapshot) {
    try {
      return JSON.parse(newsletter.themeSnapshot) as ThemeLike;
    } catch {
      // Fall through and re-resolve/re-snapshot if the stored JSON is somehow bad.
    }
  }

  // No snapshot yet -- this newsletter predates snapshotting. Resolve it
  // deterministically instead of calling getThemeForNewsletter(): that
  // function falls back to "whichever theme is currently marked active",
  // which is exactly the moving target this whole mechanism exists to
  // avoid (e.g. someone activates an unrelated demo/sample theme months
  // later and an old, already-sent newsletter's preview suddenly "becomes"
  // that theme). Honor an explicit themeId if this newsletter has one;
  // otherwise use the original built-in uGSOT look, never "today's active
  // theme".
  let theme: ThemeLike;
  if (newsletter.themeId) {
    const [byId] = await db.select().from(themesTable).where(eq(themesTable.id, newsletter.themeId));
    theme = byId ?? FALLBACK_THEME;
  } else {
    theme = FALLBACK_THEME;
  }

  await db
    .update(newslettersTable)
    .set({ themeSnapshot: JSON.stringify(theme) })
    .where(eq(newslettersTable.id, newsletter.id));
  return theme;
}

// ---------------------------------------------------------------------------
// Email HTML builder
// ---------------------------------------------------------------------------

export interface ThemeLike {
  headerGradientStart: string | null;
  headerGradientEnd: string | null;
  accentColor: string | null;
  footerColor: string | null;
  bannerEmoji: string | null;
  greetingText: string | null;
  customHtml?: string | null;
}

// Renders the theme's own customHtml if it has one, otherwise builds the
// original built-in layout using the theme's colors/banner/greeting — but
// with {{name}}/{{email}}/{{title}}/{{topic}}/{{description}} left as
// literal placeholders rather than filled in. This is the single source of
// truth for "what does this theme's email look like", used both to render
// the actual send (buildEmailHtml substitutes real values into it) and to
// show/prefill the editable HTML in the Themes admin UI.
export function renderDefaultTemplate(theme: ThemeLike): string {
  if (theme.customHtml) return theme.customHtml;

  const bannerHtml = theme.bannerEmoji
    ? `<div style="font-size:32px; line-height:1; margin-bottom:8px;">${theme.bannerEmoji}</div>`
    : "";
  const greetingHtml = theme.greetingText
    ? `<p style="font-weight:600;">${theme.greetingText}</p>`
    : "";

  return `

<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #f4f4f4;
      font-family: Arial, sans-serif;
      color: #333333;
    }

    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      border: 1px solid #eeeeee;
    }

    .header {
      background: linear-gradient(135deg, ${theme.headerGradientStart}, ${theme.headerGradientEnd});
      color: #ffffff;
      padding: 36px 40px;
      text-align: center;
    }

    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .header p {
      margin: 10px 0 0;
      font-size: 14px;
      opacity: 0.9;
    }

    .body {
      padding: 40px;
    }

    .body p {
      font-size: 15px;
      line-height: 1.8;
      margin: 0 0 18px;
      color: #444444;
    }

    .highlight {
      background: #fff5f5;
      border-left: 5px solid ${theme.accentColor};
      padding: 24px;
      margin: 28px 0;
      border-radius: 8px;
    }

    .highlight strong {
      display: block;
      color: ${theme.accentColor};
      font-size: 20px;
      margin-bottom: 10px;
    }

    .topic {
      font-size: 15px;
      color: #666666;
      font-weight: 600;
      margin-bottom: 14px;
    }

    .description {
      font-size: 14px;
      color: #555555;
      line-height: 1.8;
    }

    .cta {
      margin-top: 28px;
      padding: 18px;
      background: #fafafa;
      border-radius: 8px;
      text-align: center;
      font-size: 14px;
      color: #555555;
      border: 1px solid #eeeeee;
      line-height: 1.7;
    }

    .footer {
      background: ${theme.footerColor};
      color: rgba(255,255,255,0.85);
      padding: 22px 30px;
      text-align: center;
      font-size: 12px;
      line-height: 1.7;
    }

    .footer strong {
      color: #ffffff;
    }

    .footer a {
      color: #ffffff;
      text-decoration: none;
    }

    @media only screen and (max-width: 600px) {
      .container {
        margin: 0;
        border-radius: 0;
      }

      .header,
      .body,
      .footer {
        padding: 24px;
      }

      .header h1 {
        font-size: 24px;
      }

      .highlight {
        padding: 20px;
      }
    }
  </style>
</head>

<body>
  <div class="container">

    <div class="header">
      ${bannerHtml}
      <h1>uGSOT Newsletter</h1>
      <p>upGrad School Of Technology</p>
    </div>

    <div class="body">

      <p>Dear {{name}},</p>

      ${greetingHtml}

      <p>
        We hope you are doing well.
      </p>

      <p>
        Please find attached the latest edition of the
        <strong>uGSOT Newsletter</strong>.
      </p>

      <div class="highlight">

        <strong>
          {{title}}
        </strong>

        <div class="topic">
          {{topic}}
        </div>

        <div class="description">{{description}}</div>
      </div>

      </div>

      <p>
        This newsletter also includes important updates, announcements,
        learning highlights, and key insights from
        <strong>upGrad School Of Technology</strong>.
      </p>

      <div class="cta">
        We encourage you to explore the attached newsletter and stay updated
        with the latest happenings at uGSOT.
      </div>

      <p style="margin-top:32px;">
        Best Regards,<br>
        <strong>upGrad School Of Technology</strong>
      </p>

    </div>

    <div class="footer">
      © ${new Date().getFullYear()}
      <strong>upGrad School Of Technology</strong>
      <br>
      This email was sent to
      <a href="mailto:{{email}}">
        {{email}}
      </a>
    </div>

  </div>
</body>
</html>
  `.trim();
}

function buildEmailHtml(
  employeeName: string,
  employeeEmail: string,
  newsletter: { title: string; topic: string; description: string | null },
  theme: ThemeLike
): string {
  const template = renderDefaultTemplate(theme);
  return template
    .replaceAll("{{name}}", employeeName)
    .replaceAll("{{email}}", employeeEmail)
    .replaceAll("{{title}}", newsletter.title)
    .replaceAll("{{topic}}", newsletter.topic)
    .replaceAll("{{description}}", newsletter.description ?? "");
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

// Resend attachment shape — content must be a base64 string AND the key is
// "content" (not "data"). The type field tells the mail client how to present it.
interface ResendAttachment {
  filename: string;
  content: string;      // base64-encoded file bytes
  contentType: string;  // MIME type (Resend uses "contentType", not "type")
}

interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  attachments?: ResendAttachment[];
}

async function sendNewsletterEmails(
  newsletterId: number,
  newsletter: { title: string; topic: string; description: string | null; pdfUrl: string },
  theme: ThemeLike,
  customEmails?: string[]
): Promise<{ sent: number; failed: number }> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
  const FROM_EMAIL = process.env.FROM_EMAIL ?? "newsletter@ugsot.com";

  // Build recipient list
  let recipients: Array<{ employeeEmail: string; employeeName: string }>;
  if (customEmails && customEmails.length > 0) {
    recipients = customEmails.map((email) => ({
      employeeEmail: email,
      employeeName: email.split("@")[0],
    }));
  } else {
    // Exclude soft-deleted employees (trash) from live sends.
    recipients = await db.select().from(employeesTable).where(isNull(employeesTable.deletedAt));
  }

  let sent = 0;
  let failed = 0;

  // Simulate send when no API key is present
  if (!RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY not set — simulating email send to %d recipients", recipients.length);
    await db.insert(emailLogsTable).values(
      recipients.map((r) => ({
        employeeEmail: r.employeeEmail,
        newsletterId,
        deliveryStatus: "sent" as const,
      }))
    );
    return { sent: recipients.length, failed: 0 };
  }

  // -----------------------------------------------------------------------
  // Download PDF once and build attachment object (reused for every email)
  // -----------------------------------------------------------------------
  let pdfAttachment: ResendAttachment | null = null;
  try {
    const pdfBuffer = await downloadPdfBuffer(newsletter.pdfUrl);

    // Sanitise topic for use as a filename
    const safeTopic = newsletter.topic.replace(/[^a-zA-Z0-9._-]/g, "_");

    pdfAttachment = {
      filename: `uGSOT-Newsletter-${safeTopic}.pdf`,
      content: pdfBuffer.toString("base64"),   // ← must be base64 string
      contentType: "application/pdf",           // ← correct property name for Resend
    };

    logger.info(
      { filename: pdfAttachment.filename, base64Chars: pdfAttachment.content.length },
      "PDF attachment ready"
    );
  } catch (err) {
    // Log as ERROR (not warn) so it surfaces clearly in your terminal
    logger.error({ err, pdfUrl: newsletter.pdfUrl }, "PDF download FAILED — emails will be sent without attachment");
  }

  // -----------------------------------------------------------------------
  // Send emails in concurrency-limited batches (batch API does NOT support
  // attachments, so each recipient still gets its own request — but sending
  // several in parallel keeps this well under Vercel's function timeout for
  // larger recipient lists instead of awaiting them one at a time).
  // -----------------------------------------------------------------------
  const CONCURRENCY = 10;

  async function sendOne(recipient: { employeeEmail: string; employeeName: string }): Promise<void> {
    try {
      const emailPayload: ResendEmailPayload = {
        from: FROM_EMAIL,
        to: [recipient.employeeEmail],
        subject: `uGSOT Newsletter | ${newsletter.topic}`,
        html: buildEmailHtml(recipient.employeeName, recipient.employeeEmail, newsletter, theme),
        // Only spread attachments when the PDF was successfully downloaded
        ...(pdfAttachment ? { attachments: [pdfAttachment] } : {}),
      };

      logger.info(
        { newsletterId, recipient: recipient.employeeEmail, hasAttachment: !!pdfAttachment },
        "Sending email via Resend"
      );

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailPayload),
      });

      const responseBody = await response.json().catch(() => ({})) as {
        id?: string;
        statusCode?: number;
        message?: string;
        name?: string;
      };

      if (response.ok) {
        logger.info({ newsletterId, recipient: recipient.employeeEmail, responseBody }, "Resend email response received");
        if (responseBody.id) {
          await db.insert(emailLogsTable).values({
            employeeEmail: recipient.employeeEmail,
            newsletterId,
            deliveryStatus: "sent",
          });
          sent++;
        } else {
          const errorMessage = "No email ID returned from Resend";
          logger.error(
            { recipient: recipient.employeeEmail, errorMessage, responseBody },
            "Email failed"
          );
          await db.insert(emailLogsTable).values({
            employeeEmail: recipient.employeeEmail,
            newsletterId,
            deliveryStatus: "failed",
            errorMessage,
          });
          failed++;
        }
      } else {
        const errMsg = JSON.stringify(responseBody);
        logger.error(
          { status: response.status, errMsg, newsletterId, recipient: recipient.employeeEmail },
          "Resend API rejected the request"
        );
        await db.insert(emailLogsTable).values({
          employeeEmail: recipient.employeeEmail,
          newsletterId,
          deliveryStatus: "failed",
          errorMessage: errMsg,
        });
        failed++;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err, newsletterId, recipient: recipient.employeeEmail }, "Unexpected error during email send");
      await db.insert(emailLogsTable).values({
        employeeEmail: recipient.employeeEmail,
        newsletterId,
        deliveryStatus: "failed",
        errorMessage: errMsg,
      });
      failed++;
    }
  }

  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    const batch = recipients.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((recipient) => sendOne(recipient)));
  }

  return { sent, failed };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get("/newsletters", requireAuth, async (req, res): Promise<void> => {
  try {
    const { page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const offset = (pageNum - 1) * size;

    const [newsletters, [{ count: total }]] = await Promise.all([
      db
        .select({
          id: newslettersTable.id,
          title: newslettersTable.title,
          topic: newslettersTable.topic,
          description: newslettersTable.description,
          pdfUrl: newslettersTable.pdfUrl,
          themeId: newslettersTable.themeId,
          uploadedAt: newslettersTable.uploadedAt,
          totalSent: sql<number>`cast(count(case when ${emailLogsTable.deliveryStatus} = 'sent' then 1 end) as int)`,
          totalFailed: sql<number>`cast(count(case when ${emailLogsTable.deliveryStatus} = 'failed' then 1 end) as int)`,
          lastSentByAdminEmail: newslettersTable.lastSentByAdminEmail,
          lastSentAt: newslettersTable.lastSentAt,
        })
        .from(newslettersTable)
        .leftJoin(emailLogsTable, eq(newslettersTable.id, emailLogsTable.newsletterId))
        .where(isNull(newslettersTable.deletedAt))
        .groupBy(newslettersTable.id)
        .orderBy(desc(newslettersTable.uploadedAt))
        .limit(size)
        .offset(offset),
      db.select({ count: count() }).from(newslettersTable).where(isNull(newslettersTable.deletedAt)),
    ]);

    res.json({ newsletters, total: Number(total), page: pageNum, pageSize: size });
  } catch (err) {
    req.log.error({ err }, "Failed to get newsletters");
    res.status(500).json({ error: "Failed to get newsletters" });
  }
});

router.post("/newsletters/upload", requireAuth, upload.single("pdf"), async (req, res): Promise<void> => {
  const { title, topic, description, themeId: themeIdRaw } = req.body as Record<string, string>;

  if (!title || !topic) {
    res.status(400).json({ error: "Title and topic are required" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "PDF file is required" });
    return;
  }
  if (req.file.mimetype !== "application/pdf") {
    res.status(400).json({ error: "Only PDF files are allowed" });
    return;
  }

  let pdfUrl: string;
  try {
    pdfUrl = await uploadPdfToStorage(req.file.buffer, req.file.originalname);
  } catch (err) {
    req.log.error({ err }, "Failed to upload PDF");
    res.status(500).json({ error: "Failed to upload PDF" });
    return;
  }

  let themeId: number | null = themeIdRaw ? parseInt(themeIdRaw, 10) : null;
  if (themeId && isNaN(themeId)) themeId = null;
  if (themeId) {
    const [themeExists] = await db.select({ id: themesTable.id }).from(themesTable).where(eq(themesTable.id, themeId));
    if (!themeExists) themeId = null;
  }
  if (!themeId) {
    const [active] = await db.select({ id: themesTable.id }).from(themesTable).where(eq(themesTable.isActive, true));
    themeId = active?.id ?? null;
  }

  // Freeze the resolved theme right now, at upload time -- this is the
  // look this newsletter will always have, even if the theme it used gets
  // edited later (see getEffectiveTheme for why).
  const resolvedTheme = await getThemeForNewsletter(themeId);

  const [newsletter] = await db
    .insert(newslettersTable)
    .values({
      title,
      topic,
      description: description || null,
      pdfUrl,
      themeId,
      themeSnapshot: JSON.stringify(resolvedTheme),
    })
    .returning();

  req.log.info({ newsletterId: newsletter.id }, "Newsletter created");
  await logAudit(req, { action: "newsletter.upload", targetType: "newsletter", targetId: newsletter.id, targetLabel: newsletter.title });
  res.status(201).json({ ...newsletter, totalSent: 0, totalFailed: 0 });
});

router.get("/newsletters/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [row] = await db
    .select({
      id: newslettersTable.id,
      title: newslettersTable.title,
      topic: newslettersTable.topic,
      description: newslettersTable.description,
      pdfUrl: newslettersTable.pdfUrl,
      themeId: newslettersTable.themeId,
      uploadedAt: newslettersTable.uploadedAt,
      totalSent: sql<number>`cast(count(case when ${emailLogsTable.deliveryStatus} = 'sent' then 1 end) as int)`,
      totalFailed: sql<number>`cast(count(case when ${emailLogsTable.deliveryStatus} = 'failed' then 1 end) as int)`,
      lastSentByAdminEmail: newslettersTable.lastSentByAdminEmail,
      lastSentAt: newslettersTable.lastSentAt,
    })
    .from(newslettersTable)
    .leftJoin(emailLogsTable, eq(newslettersTable.id, emailLogsTable.newsletterId))
    .where(and(eq(newslettersTable.id, id), isNull(newslettersTable.deletedAt)))
    .groupBy(newslettersTable.id);

  if (!row) { res.status(404).json({ error: "Newsletter not found" }); return; }
  res.json(row);
});

// Soft delete -- moves the newsletter to "Recently Deleted" instead of
// removing it immediately. The PDF is left in Supabase storage untouched
// so restoring it later (or a scheduled/queued send referencing it) still
// works; storage cleanup only happens on permanent delete/purge.
router.delete("/newsletters/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const senderEmail = (req as { adminEmail?: string }).adminEmail ?? null;

  const [deleted] = await db
    .update(newslettersTable)
    .set({ deletedAt: new Date(), deletedByAdminEmail: senderEmail })
    .where(and(eq(newslettersTable.id, id), isNull(newslettersTable.deletedAt)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Newsletter not found" }); return; }

  await logAudit(req, { action: "newsletter.delete", targetType: "newsletter", targetId: id, targetLabel: deleted.title });

  res.json({ message: "Newsletter moved to Recently Deleted" });
});

// Deletes anything that's been sitting in the trash for 30+ days, cleaning
// up its PDF from Supabase storage first. Called opportunistically at the
// top of the trash listing endpoint rather than on a schedule, so it needs
// no cron infrastructure.
async function purgeExpiredDeletedNewsletters(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const expired = await db
    .select({ id: newslettersTable.id, pdfUrl: newslettersTable.pdfUrl })
    .from(newslettersTable)
    .where(and(sql`${newslettersTable.deletedAt} IS NOT NULL`, lt(newslettersTable.deletedAt, cutoff)));

  for (const nl of expired) {
    try {
      const storagePath = normalizeStoragePath(nl.pdfUrl);
      await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([storagePath]);
    } catch (err) {
      logger.warn({ err, newsletterId: nl.id }, "Failed to remove PDF from storage while purging expired trash");
    }
    await db.delete(newslettersTable).where(eq(newslettersTable.id, nl.id));
  }
}

// Lists newsletters currently in the trash (deleted within the last 30
// days -- older ones are purged automatically before the list is built).
router.get("/newsletters/deleted", requireAuth, async (req, res): Promise<void> => {
  try {
    await purgeExpiredDeletedNewsletters();

    const { page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const offset = (pageNum - 1) * size;

    const whereClause = sql`${newslettersTable.deletedAt} IS NOT NULL`;

    const [newsletters, [{ count: total }]] = await Promise.all([
      db
        .select({
          id: newslettersTable.id,
          title: newslettersTable.title,
          topic: newslettersTable.topic,
          uploadedAt: newslettersTable.uploadedAt,
          deletedAt: newslettersTable.deletedAt,
          deletedByAdminEmail: newslettersTable.deletedByAdminEmail,
        })
        .from(newslettersTable)
        .where(whereClause)
        .orderBy(desc(newslettersTable.deletedAt))
        .limit(size)
        .offset(offset),
      db.select({ count: count() }).from(newslettersTable).where(whereClause),
    ]);

    res.json({ newsletters, total: Number(total), page: pageNum, pageSize: size });
  } catch (err) {
    req.log.error({ err }, "Failed to get deleted newsletters");
    res.status(500).json({ error: "Failed to get deleted newsletters" });
  }
});

router.post("/newsletters/:id/restore", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [restored] = await db
    .update(newslettersTable)
    .set({ deletedAt: null, deletedByAdminEmail: null })
    .where(and(eq(newslettersTable.id, id), sql`${newslettersTable.deletedAt} IS NOT NULL`))
    .returning();
  if (!restored) { res.status(404).json({ error: "Newsletter not found in Recently Deleted" }); return; }

  await logAudit(req, { action: "newsletter.restore", targetType: "newsletter", targetId: id, targetLabel: restored.title });

  res.json({ message: "Newsletter restored" });
});

// Immediately and permanently deletes a newsletter -- only allowed while
// it's already in the trash, as a safety net against skipping the 30-day
// recovery window by accident.
router.delete("/newsletters/:id/permanent", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db.select().from(newslettersTable).where(eq(newslettersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Newsletter not found" }); return; }
  if (!existing.deletedAt) {
    res.status(409).json({ error: "Move this newsletter to Recently Deleted before permanently deleting it" });
    return;
  }

  await db.delete(newslettersTable).where(eq(newslettersTable.id, id));
  await logAudit(req, { action: "newsletter.delete_permanent", targetType: "newsletter", targetId: id, targetLabel: existing.title });

  try {
    const storagePath = normalizeStoragePath(existing.pdfUrl);
    await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([storagePath]);
  } catch (err) {
    req.log.warn({ err }, "Failed to remove PDF from Supabase storage");
  }

  res.json({ message: "Newsletter permanently deleted" });
});

router.post("/newsletters/:id/send", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [newsletter] = await db.select().from(newslettersTable).where(eq(newslettersTable.id, id));
  if (!newsletter) { res.status(404).json({ error: "Newsletter not found" }); return; }

  const { emails } = (req.body ?? {}) as { emails?: string[] };
  const cleanEmails = emails?.filter((e) => typeof e === "string" && e.trim().length > 0);

  let total: number;
  if (cleanEmails && cleanEmails.length > 0) {
    total = cleanEmails.length;
    req.log.info({ newsletterId: id, customEmails: total }, "Starting newsletter send to custom recipients");
  } else {
    const [{ count: empCount }] = await db.select({ count: count() }).from(employeesTable);
    total = Number(empCount);
    req.log.info({ newsletterId: id, employees: total }, "Starting newsletter send to all employees");
  }

  const theme = await getEffectiveTheme(newsletter);
  const { sent, failed } = await sendNewsletterEmails(id, newsletter, theme, cleanEmails);
  req.log.info({ newsletterId: id, sent, failed }, "Newsletter send complete");

  const senderEmail = (req as { adminEmail?: string }).adminEmail ?? null;
  await db
    .update(newslettersTable)
    .set({ lastSentByAdminEmail: senderEmail, lastSentAt: new Date() })
    .where(eq(newslettersTable.id, id));
  await logAudit(req, {
    action: "newsletter.send",
    targetType: "newsletter",
    targetId: id,
    targetLabel: newsletter.title,
    metadata: { sent, failed, total, customRecipients: Boolean(cleanEmails && cleanEmails.length > 0) },
  });

  res.json({ sent, failed, total });
});

// Renders the exact HTML a recipient would get, without sending anything —
// lets you check a theme looks right before emailing 100+ people.
router.get("/newsletters/:id/preview", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [newsletter] = await db.select().from(newslettersTable).where(eq(newslettersTable.id, id));
  if (!newsletter) { res.status(404).json({ error: "Newsletter not found" }); return; }

  const theme = await getEffectiveTheme(newsletter);
  const html = buildEmailHtml("Employee Name", "employee@example.com", newsletter, theme);
  res.json({ html });
});

router.get("/newsletters/:id/pdf", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [newsletter] = await db.select().from(newslettersTable).where(eq(newslettersTable.id, id));
  if (!newsletter) { res.status(404).json({ error: "Newsletter not found" }); return; }

  try {
    const storagePath = normalizeStoragePath(newsletter.pdfUrl);
    const { data, error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .createSignedUrl(storagePath, 60 * 10);

    if (error || !data?.signedUrl) {
      req.log.error({ error }, "Failed to create signed URL");
      res.status(500).json({ error: "Failed to download PDF" });
      return;
    }
    res.redirect(data.signedUrl);
  } catch (err) {
    req.log.error({ err }, "Failed to stream PDF");
    res.status(500).json({ error: "Failed to download PDF" });
  }
});

export default router;