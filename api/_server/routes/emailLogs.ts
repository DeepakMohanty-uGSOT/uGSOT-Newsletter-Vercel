import { Router, type IRouter } from "express";
import { db, emailLogsTable, newslettersTable } from "../../_lib/db/index.js";
import { eq, count, and, sql, type SQL } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

router.get("/email-logs", requireAuth, async (req, res): Promise<void> => {
  try {
    const {
      newsletterId,
      status,
      month,
      date,
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
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      conditions.push(sql`to_char(${emailLogsTable.sentAt}, 'YYYY-MM-DD') = ${date}`);
    } else if (month && /^\d{4}-\d{2}$/.test(month)) {
      conditions.push(sql`to_char(${emailLogsTable.sentAt}, 'YYYY-MM') = ${month}`);
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
        .orderBy(sql`${emailLogsTable.sentAt} DESC`),
      db.select({ count: count() }).from(emailLogsTable).where(whereClause),
    ]);

    res.json({ logs: rawLogs, total: Number(total), page: pageNum, pageSize: size });
  } catch (err) {
    req.log.error({ err }, "Failed to get email logs");
    res.status(500).json({ error: "Failed to get email logs" });
  }
});

// Aggregate view of the full (permanent) email-send history: totals per
// month for every month on record, and — when a specific month is
// requested — a per-day breakdown for that month (including how many
// distinct newsletters were sent that day). Nothing here is ever pruned;
// email_logs retains every send forever, so this always reflects the
// complete history.
router.get("/email-logs/summary", requireAuth, async (req, res): Promise<void> => {
  try {
    const { month } = req.query as Record<string, string>;

    const monthlyRows = await db
      .select({
        month: sql<string>`to_char(${emailLogsTable.sentAt}, 'YYYY-MM')`,
        deliveryStatus: emailLogsTable.deliveryStatus,
        count: count(),
      })
      .from(emailLogsTable)
      .groupBy(sql`to_char(${emailLogsTable.sentAt}, 'YYYY-MM')`, emailLogsTable.deliveryStatus);

    const monthMap = new Map<
      string,
      { month: string; sent: number; failed: number; pending: number; total: number }
    >();
    for (const row of monthlyRows) {
      const entry =
        monthMap.get(row.month) ?? { month: row.month, sent: 0, failed: 0, pending: 0, total: 0 };
      const c = Number(row.count);
      if (row.deliveryStatus === "sent") entry.sent += c;
      else if (row.deliveryStatus === "failed") entry.failed += c;
      else if (row.deliveryStatus === "pending") entry.pending += c;
      entry.total += c;
      monthMap.set(row.month, entry);
    }
    const months = Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month));

    let days: {
      date: string;
      sent: number;
      failed: number;
      pending: number;
      total: number;
      newsletters: number;
    }[] = [];

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const dailyRows = await db
        .select({
          date: sql<string>`to_char(${emailLogsTable.sentAt}, 'YYYY-MM-DD')`,
          deliveryStatus: emailLogsTable.deliveryStatus,
          newsletterId: emailLogsTable.newsletterId,
          count: count(),
        })
        .from(emailLogsTable)
        .where(sql`to_char(${emailLogsTable.sentAt}, 'YYYY-MM') = ${month}`)
        .groupBy(
          sql`to_char(${emailLogsTable.sentAt}, 'YYYY-MM-DD')`,
          emailLogsTable.deliveryStatus,
          emailLogsTable.newsletterId,
        );

      const dayMap = new Map<
        string,
        {
          date: string;
          sent: number;
          failed: number;
          pending: number;
          total: number;
          newsletterIds: Set<number>;
        }
      >();
      for (const row of dailyRows) {
        const entry =
          dayMap.get(row.date) ??
          { date: row.date, sent: 0, failed: 0, pending: 0, total: 0, newsletterIds: new Set<number>() };
        const c = Number(row.count);
        if (row.deliveryStatus === "sent") entry.sent += c;
        else if (row.deliveryStatus === "failed") entry.failed += c;
        else if (row.deliveryStatus === "pending") entry.pending += c;
        entry.total += c;
        if (row.newsletterId != null) entry.newsletterIds.add(row.newsletterId);
        dayMap.set(row.date, entry);
      }
      days = Array.from(dayMap.values())
        .map(({ newsletterIds, ...rest }) => ({ ...rest, newsletters: newsletterIds.size }))
        .sort((a, b) => b.date.localeCompare(a.date));
    }

    res.json({ months, days });
  } catch (err) {
    req.log.error({ err }, "Failed to get email log summary");
    res.status(500).json({ error: "Failed to get email log summary" });
  }
});

export default router;
