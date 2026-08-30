import { Router, type IRouter } from "express";
import { db, emailLogsTable, newslettersTable } from "../../_lib/db/index.js";
import { eq, count, and, type SQL } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

router.get("/email-logs", requireAuth, async (req, res): Promise<void> => {
  try {
    const {
      newsletterId,
      status,
      page = "1",
      pageSize = "50",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 50));
    const offset = (pageNum - 1) * size;

    const conditions: SQL<unknown>[] = [];
    if (newsletterId) {
      const nid = parseInt(newsletterId, 10);
      if (!isNaN(nid)) conditions.push(eq(emailLogsTable.newsletterId, nid));
    }
    if (status && ["sent", "failed", "pending"].includes(status)) {
      conditions.push(eq(emailLogsTable.deliveryStatus, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rawLogs, [{ count: total }]] = await Promise.all([
      db
        .select({
          id: emailLogsTable.id,
          employeeEmail: emailLogsTable.employeeEmail,
          newsletterId: emailLogsTable.newsletterId,
          newsletterTitle: newslettersTable.title,
          deliveryStatus: emailLogsTable.deliveryStatus,
          sentAt: emailLogsTable.sentAt,
          errorMessage: emailLogsTable.errorMessage,
        })
        .from(emailLogsTable)
        .leftJoin(newslettersTable, eq(emailLogsTable.newsletterId, newslettersTable.id))
        .where(whereClause)
        .limit(size)
        .offset(offset)
        .orderBy(emailLogsTable.sentAt),
      db.select({ count: count() }).from(emailLogsTable).where(whereClause),
    ]);

    res.json({ logs: rawLogs, total: Number(total), page: pageNum, pageSize: size });
  } catch (err) {
    req.log.error({ err }, "Failed to get email logs");
    res.status(500).json({ error: "Failed to get email logs" });
  }
});

export default router;
