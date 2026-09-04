import { Router, type IRouter } from "express";
import { db, employeesTable, newslettersTable, emailLogsTable, adminsTable } from "../../_lib/db/index.js";
import { count, eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  try {
    const [
      [{ count: totalEmployees }],
      [{ count: totalNewsletters }],
      [{ count: totalEmailsSent }],
      [{ count: totalEmailsFailed }],
      [{ count: totalEmailsPending }],
      [{ count: totalActiveAdmins }],
      topicBreakdownRaw,
      emailActivityRaw,
      recentNewsletters,
      recentFailedDeliveries,
    ] = await Promise.all([
      db.select({ count: count() }).from(employeesTable),
      db.select({ count: count() }).from(newslettersTable),
      db.select({ count: count() }).from(emailLogsTable).where(eq(emailLogsTable.deliveryStatus, "sent")),
      db.select({ count: count() }).from(emailLogsTable).where(eq(emailLogsTable.deliveryStatus, "failed")),
      db.select({ count: count() }).from(emailLogsTable).where(eq(emailLogsTable.deliveryStatus, "pending")),
      db.select({ count: count() }).from(adminsTable).where(eq(adminsTable.isActive, true)),
      db
        .select({ topic: newslettersTable.topic, count: sql<number>`cast(count(*) as int)` })
        .from(newslettersTable)
        .groupBy(newslettersTable.topic)
        .orderBy(desc(sql`count(*)`)),
      db
        .select({
          month: sql<string>`to_char(${emailLogsTable.sentAt}, 'YYYY-MM')`,
          sent: sql<number>`cast(count(case when ${emailLogsTable.deliveryStatus} = 'sent' then 1 end) as int)`,
          failed: sql<number>`cast(count(case when ${emailLogsTable.deliveryStatus} = 'failed' then 1 end) as int)`,
        })
        .from(emailLogsTable)
        .groupBy(sql`to_char(${emailLogsTable.sentAt}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${emailLogsTable.sentAt}, 'YYYY-MM')`),
      db
        .select({
          id: newslettersTable.id,
          title: newslettersTable.title,
          topic: newslettersTable.topic,
          description: newslettersTable.description,
          pdfUrl: newslettersTable.pdfUrl,
          uploadedAt: newslettersTable.uploadedAt,
          totalSent: sql<number>`cast(count(case when ${emailLogsTable.deliveryStatus} = 'sent' then 1 end) as int)`,
          totalFailed: sql<number>`cast(count(case when ${emailLogsTable.deliveryStatus} = 'failed' then 1 end) as int)`,
        })
        .from(newslettersTable)
        .leftJoin(emailLogsTable, eq(newslettersTable.id, emailLogsTable.newsletterId))
        .groupBy(newslettersTable.id)
        .orderBy(desc(newslettersTable.uploadedAt))
        .limit(5),
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
        .where(eq(emailLogsTable.deliveryStatus, "failed"))
        .orderBy(desc(emailLogsTable.sentAt))
        .limit(5),
    ]);

    const sent = Number(totalEmailsSent);
    const failed = Number(totalEmailsFailed);
    const pending = Number(totalEmailsPending);
    const total = sent + failed;
    const deliveryRate = total > 0 ? Math.round((sent / total) * 100) : 0;

    // Collapse the long tail of one-off topics into "Other" so the pie chart
    // stays readable — the top 5 topics plus a single bucket for the rest.
    const TOP_TOPIC_LIMIT = 5;
    const sortedTopics = topicBreakdownRaw
      .map((row) => ({ topic: row.topic, count: Number(row.count) }))
      .sort((a, b) => b.count - a.count);
    const topTopics = sortedTopics.slice(0, TOP_TOPIC_LIMIT);
    const otherTopicsCount = sortedTopics.slice(TOP_TOPIC_LIMIT).reduce((sum, t) => sum + t.count, 0);
    const topicBreakdown =
      otherTopicsCount > 0 ? [...topTopics, { topic: "Other", count: otherTopicsCount }] : topTopics;

    // Full history, grouped by month (not just a recent window) so the
    // trend chart reflects everything on record; gaps between the first
    // and most recent month are zero-filled for a continuous axis.
    const activityByMonth = new Map(emailActivityRaw.map((row) => [row.month, row]));
    const emailActivity: { date: string; sent: number; failed: number }[] = [];
    if (emailActivityRaw.length > 0) {
      const firstMonth = emailActivityRaw[0].month;
      const [startYear, startMonthNum] = firstMonth.split("-").map(Number);
      const cursor = new Date(startYear, startMonthNum - 1, 1);
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth(), 1);
      while (cursor <= end) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
        const row = activityByMonth.get(key);
        emailActivity.push({ date: key, sent: row ? Number(row.sent) : 0, failed: row ? Number(row.failed) : 0 });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    res.json({
      totalEmployees: Number(totalEmployees),
      totalNewsletters: Number(totalNewsletters),
      totalEmailsSent: sent,
      totalEmailsFailed: failed,
      totalEmailsPending: pending,
      totalActiveAdmins: Number(totalActiveAdmins),
      deliveryRate,
      topicBreakdown,
      emailActivity,
      recentNewsletters,
      recentFailedDeliveries,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard stats");
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

export default router;
