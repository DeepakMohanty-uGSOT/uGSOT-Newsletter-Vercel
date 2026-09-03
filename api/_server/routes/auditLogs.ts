import { Router, type IRouter } from "express";
import { and, count, desc, eq, ilike } from "drizzle-orm";
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

export default router;
