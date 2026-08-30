import { Router, type IRouter } from "express";
import { db, employeesTable, newslettersTable, emailLogsTable } from "../../_lib/db/index.js";
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
      recentNewsletters,
      recentFailedDeliveries,
    ] = await Promise.all([
      db.select({ count: count() }).from(employeesTable),
      db.select({ count: count() }).from(newslettersTable),
      db.select({ count: count() }).from(emailLogsTable).where(eq(emailLogsTable.deliveryStatus, "sent")),
      db.select({ count: count() }).from(emailLogsTable).where(eq(emailLogsTable.deliveryStatus, "failed")),
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
    const total = sent + failed;
    const deliveryRate = total > 0 ? Math.round((sent / total) * 100) : 0;

    res.json({
      totalEmployees: Number(totalEmployees),
      totalNewsletters: Number(totalNewsletters),
      totalEmailsSent: sent,
      totalEmailsFailed: failed,
      deliveryRate,
      recentNewsletters,
      recentFailedDeliveries,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard stats");
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

export default router;
