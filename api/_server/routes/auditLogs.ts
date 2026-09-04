import { Router, type IRouter } from "express";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import * as XLSX from "xlsx";
import { db, auditLogsTable } from "../../_lib/db/index.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireSuperAdmin } from "../middlewares/requireSuperAdmin.js";

const router: IRouter = Router();

// Super-admin only — this is who-did-what across every admin account, not
// something a regular admin needs to (or should) see.
router.get("/audit-logs", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  try {
    const { page = "1", pageSize = "25", targetType, targetId, action, adminEmail } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));
    const offset = (pageNum - 1) * size;

    const filters = [];
    if (targetType) filters.push(eq(auditLogsTable.targetType, targetType));
    if (targetId) filters.push(eq(auditLogsTable.targetId, targetId));
    if (action) filters.push(eq(auditLogsTable.action, action));
    if (adminEmail) filters.push(ilike(auditLogsTable.adminEmail, `%${adminEmail}%`));
    const where = filters.length > 0 ? and(...filters) : undefined;

    let query = db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt));
    let countQuery = db.select({ count: count() }).from(auditLogsTable);
    if (where) {
      query = query.where(where) as typeof query;
      countQuery = countQuery.where(where) as typeof countQuery;
    }

    const [logs, [{ count: total }]] = await Promise.all([
      query.limit(size).offset(offset),
      countQuery,
    ]);

    res.json({ logs, total: Number(total), page: pageNum, pageSize: size });
  } catch (err) {
    req.log.error({ err }, "Failed to get audit logs");
    res.status(500).json({ error: "Failed to get audit logs" });
  }
});

// Downloadable Excel export of the audit log — same filters as the paginated
// list above, but every matching row in one workbook instead of one page.
router.get("/audit-logs/export", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  try {
    const { targetType, targetId, action, adminEmail } = req.query as Record<string, string>;

    const filters = [];
    if (targetType) filters.push(eq(auditLogsTable.targetType, targetType));
    if (targetId) filters.push(eq(auditLogsTable.targetId, targetId));
    if (action) filters.push(eq(auditLogsTable.action, action));
    if (adminEmail) filters.push(ilike(auditLogsTable.adminEmail, `%${adminEmail}%`));
    const where = filters.length > 0 ? and(...filters) : undefined;

    let query = db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt));
    if (where) {
      query = query.where(where) as typeof query;
    }
    const logs = await query;

    const rows = logs.map((log) => ({
      "Date/Time": new Date(log.createdAt).toISOString().replace("T", " ").slice(0, 19),
      "Admin Email": log.adminEmail,
      "Action": log.action,
      "Target Type": log.targetType,
      "Target Label": log.targetLabel ?? "",
      "Target ID": log.targetId ?? "",
      "Metadata": log.metadata ?? "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [{ wch: 20 }, { wch: 28 }, { wch: 22 }, { wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 40 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Log");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    );
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Failed to export audit logs");
    res.status(500).json({ error: "Failed to export audit logs" });
  }
});

export default router;
