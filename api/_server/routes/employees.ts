import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db, employeesTable } from "../../_lib/db/index.js";
import { eq, ilike, or, and, count, sql, inArray, isNull, lt, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { logAudit } from "../lib/auditLog.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Postgres foreign key violation error code. If deleting an employee fails
// with this code, the DB schema hasn't picked up the `onDelete: "cascade"`
// change on email_logs.employee_email yet — run `pnpm run push` in backend/db.
function isForeignKeyViolation(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: string }).code === "23503");
}

function dbErrorMessage(err: unknown, fallback: string): string {
  if (isForeignKeyViolation(err)) {
    return `${fallback}: these employees have related email log records and the database schema hasn't been updated to cascade-delete them yet. Run "pnpm run push" in backend/db, then try again.`;
  }
  return fallback;
}

router.get("/employees", requireAuth, async (req, res): Promise<void> => {
  try {
    const { search, page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const offset = (pageNum - 1) * size;

    let query = db.select().from(employeesTable);
    let countQuery = db.select({ count: count() }).from(employeesTable);

    const notDeleted = isNull(employeesTable.deletedAt);
    const filter = search
      ? and(
          notDeleted,
          or(
            ilike(employeesTable.employeeName, `%${search}%`),
            ilike(employeesTable.employeeEmail, `%${search}%`)
          )
        )
      : notDeleted;
    query = query.where(filter) as typeof query;
    countQuery = countQuery.where(filter) as typeof countQuery;

    const [employees, [{ count: total }]] = await Promise.all([
      query.limit(size).offset(offset).orderBy(employeesTable.createdAt),
      countQuery,
    ]);

    res.json({ employees, total: Number(total), page: pageNum, pageSize: size });
  } catch (err) {
    req.log.error({ err }, "Failed to get employees");
    res.status(500).json({ error: "Failed to get employees" });
  }
});

router.get("/employees/export", requireAuth, async (req, res): Promise<void> => {
  try {
    const { search } = req.query as Record<string, string>;
    let query = db.select().from(employeesTable);
    const notDeleted = isNull(employeesTable.deletedAt);
    query = query.where(
      search
        ? and(
            notDeleted,
            or(
              ilike(employeesTable.employeeName, `%${search}%`),
              ilike(employeesTable.employeeEmail, `%${search}%`)
            )
          )
        : notDeleted
    ) as typeof query;
    const employees = await query.orderBy(employeesTable.employeeName);

    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = "Employee Name,Employee Email,Added\n";
    const body = employees
      .map((e) => `${escapeCsv(e.employeeName)},${escapeCsv(e.employeeEmail)},${new Date(e.createdAt).toISOString()}`)
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="employees-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(header + body);
  } catch (err) {
    req.log.error({ err }, "Failed to export employees");
    res.status(500).json({ error: "Failed to export employees" });
  }
});

router.post("/employees", requireAuth, async (req, res): Promise<void> => {
  const name = String(req.body?.employeeName ?? "").trim();
  const email = String(req.body?.employeeEmail ?? "").trim().toLowerCase();

  if (!name || !email) {
    res.status(400).json({ error: "Employee name and email are required" });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  try {
    const [created] = await db
      .insert(employeesTable)
      .values({ employeeName: name, employeeEmail: email })
      .returning();
    await logAudit(req, { action: "employee.create", targetType: "employee", targetId: created.id, targetLabel: created.employeeEmail });
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err, name, email }, "Failed to create employee");
    res.status(409).json({ error: "An employee with this email already exists" });
  }
});

router.patch("/employees/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const name = req.body?.employeeName !== undefined ? String(req.body.employeeName).trim() : undefined;
  const email = req.body?.employeeEmail !== undefined ? String(req.body.employeeEmail).trim().toLowerCase() : undefined;

  if (name === undefined && email === undefined) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  if (name !== undefined && !name) {
    res.status(400).json({ error: "Employee name cannot be empty" });
    return;
  }
  if (email !== undefined && !isValidEmail(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const updates: Partial<{ employeeName: string; employeeEmail: string }> = {};
  if (name !== undefined) updates.employeeName = name;
  if (email !== undefined) updates.employeeEmail = email;

  try {
    const [updated] = await db
      .update(employeesTable)
      .set(updates)
      .where(and(eq(employeesTable.id, id), isNull(employeesTable.deletedAt)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    await logAudit(req, { action: "employee.update", targetType: "employee", targetId: id, targetLabel: updated.employeeEmail });
    res.json(updated);
  } catch (err) {
    req.log.error({ err, id }, "Failed to update employee");
    res.status(409).json({ error: "An employee with this email already exists" });
  }
});

router.post("/employees/bulk-delete", requireAuth, async (req, res): Promise<void> => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((v: unknown) => Number(v)).filter((n: number) => !isNaN(n)) : [];

  if (ids.length === 0) {
    res.status(400).json({ error: "No employee IDs provided" });
    return;
  }

  const senderEmail = (req as { adminEmail?: string }).adminEmail ?? null;

  try {
    const deleted = await db
      .update(employeesTable)
      .set({ deletedAt: new Date(), deletedByAdminEmail: senderEmail })
      .where(and(inArray(employeesTable.id, ids), isNull(employeesTable.deletedAt)))
      .returning();
    await logAudit(req, {
      action: "employee.bulk_delete",
      targetType: "employee",
      targetId: null,
      targetLabel: `${deleted.length} employee(s)`,
      metadata: { deletedCount: deleted.length, ids },
    });
    res.json({ message: "Employees moved to Recently Deleted", deletedCount: deleted.length });
  } catch (err) {
    req.log.error({ err, ids }, "Failed to bulk delete employees");
    res.status(500).json({ error: dbErrorMessage(err, "Failed to delete employees") });
  }
});

router.delete("/employees", requireAuth, async (req, res): Promise<void> => {
  const senderEmail = (req as { adminEmail?: string }).adminEmail ?? null;
  try {
    const deleted = await db
      .update(employeesTable)
      .set({ deletedAt: new Date(), deletedByAdminEmail: senderEmail })
      .where(isNull(employeesTable.deletedAt))
      .returning();
    await logAudit(req, {
      action: "employee.delete_all",
      targetType: "employee",
      targetId: null,
      targetLabel: `${deleted.length} employee(s)`,
      metadata: { deletedCount: deleted.length },
    });
    res.json({ message: "All employees moved to Recently Deleted", deletedCount: deleted.length });
  } catch (err) {
    req.log.error({ err }, "Failed to delete all employees");
    res.status(500).json({ error: dbErrorMessage(err, "Failed to delete all employees") });
  }
});

router.delete("/employees/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const senderEmail = (req as { adminEmail?: string }).adminEmail ?? null;

  try {
    const [deleted] = await db
      .update(employeesTable)
      .set({ deletedAt: new Date(), deletedByAdminEmail: senderEmail })
      .where(and(eq(employeesTable.id, id), isNull(employeesTable.deletedAt)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    await logAudit(req, { action: "employee.delete", targetType: "employee", targetId: id, targetLabel: deleted.employeeEmail });
    res.json({ message: "Employee moved to Recently Deleted" });
  } catch (err) {
    req.log.error({ err, id }, "Failed to delete employee");
    res.status(500).json({ error: dbErrorMessage(err, "Failed to delete employee") });
  }
});

router.post("/employees/upload", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const ext = req.file.originalname.split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
    res.status(400).json({ error: "Invalid file format. Use .xlsx, .xls, or .csv" });
    return;
  }

  let rows: Record<string, unknown>[] = [];
  try {
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];
  } catch (err) {
    res.status(400).json({ error: "Failed to parse file" });
    return;
  }

  req.log.info({ rowCount: rows.length, rows }, "Parsed employees from file");

  // Move existing active employees to Recently Deleted so the uploaded
  // sheet fully replaces prior data, without losing it irrecoverably --
  // an accidental re-upload of the wrong file is now a 30-day-recoverable
  // mistake instead of a permanent one.
  const senderEmail = (req as { adminEmail?: string }).adminEmail ?? null;
  try {
    await db
      .update(employeesTable)
      .set({ deletedAt: new Date(), deletedByAdminEmail: senderEmail })
      .where(isNull(employeesTable.deletedAt));
    req.log.info({}, "Moved existing employees to Recently Deleted before upload");
  } catch (err) {
    req.log.error({ err }, "Failed to clear existing employees before upload");
    res.status(500).json({ error: dbErrorMessage(err, "Failed to clear existing employees before upload") });
    return;
  }

  let added = 0;
  let skipped = 0;
  let invalid = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 1;

    req.log.info({ rowIndex, row }, "Processing row");

    const name = String(
      row["Employee Name"] ?? row["employee_name"] ?? row["Name"] ?? row["name"] ?? ""
    ).trim();
    const email = String(
      row["Employee Email"] ?? row["employee_email"] ?? row["Email"] ?? row["email"] ?? ""
    ).trim().toLowerCase();

    req.log.info({ rowIndex, name, email }, "Extracted name and email");

    if (!name && !email) {
      req.log.info({ rowIndex }, "Skipping empty row");
      continue;
    }

    if (!name || !email) {
      invalid++;
      const errorMsg = `Row ${rowIndex} with name="${name}" email="${email}": missing required fields`;
      errors.push(errorMsg);
      req.log.warn({ rowIndex, name, email }, errorMsg);
      continue;
    }

    if (!isValidEmail(email)) {
      invalid++;
      const errorMsg = `Row ${rowIndex}: Invalid email: ${email}`;
      errors.push(errorMsg);
      req.log.warn({ rowIndex, email }, errorMsg);
      continue;
    }

    try {
      await db.insert(employeesTable).values({ employeeName: name, employeeEmail: email }).onConflictDoNothing();
      added++;
      req.log.info({ rowIndex, name, email }, "Added employee");
    } catch (err) {
      skipped++;
      const errorMsg = `Row ${rowIndex}: Duplicate email skipped: ${email}`;
      errors.push(errorMsg);
      req.log.warn({ rowIndex, email, err }, errorMsg);
    }
  }

  req.log.info({ added, skipped, invalid }, "Employee upload complete (previous data replaced)");
  res.json({ added, skipped, invalid, replaced: true, errors: errors.slice(0, 50) });
});

router.get("/employees/stats", requireAuth, async (_req, res): Promise<void> => {
  const [{ count: total }] = await db
    .select({ count: count() })
    .from(employeesTable)
    .where(isNull(employeesTable.deletedAt));
  res.json({ total: Number(total) });
});

// ---------------------------------------------------------------------------
// Recently Deleted (soft delete)
// ---------------------------------------------------------------------------

// Permanently deletes anything that's been sitting in the trash for 30+
// days. Called opportunistically at the top of the trash listing endpoint
// instead of on a schedule, so it needs no cron infrastructure. Permanently
// deleting an employee also cascades to their email_logs rows (see the FK
// on emailLogsTable.employeeEmail), same as the old hard-delete did.
async function purgeExpiredDeletedEmployees(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await db
    .delete(employeesTable)
    .where(and(sql`${employeesTable.deletedAt} IS NOT NULL`, lt(employeesTable.deletedAt, cutoff)));
}

router.get("/employees/deleted", requireAuth, async (req, res): Promise<void> => {
  try {
    await purgeExpiredDeletedEmployees();

    const { page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const offset = (pageNum - 1) * size;

    const whereClause = sql`${employeesTable.deletedAt} IS NOT NULL`;

    const [employees, [{ count: total }]] = await Promise.all([
      db
        .select()
        .from(employeesTable)
        .where(whereClause)
        .orderBy(desc(employeesTable.deletedAt))
        .limit(size)
        .offset(offset),
      db.select({ count: count() }).from(employeesTable).where(whereClause),
    ]);

    res.json({ employees, total: Number(total), page: pageNum, pageSize: size });
  } catch (err) {
    req.log.error({ err }, "Failed to get deleted employees");
    res.status(500).json({ error: "Failed to get deleted employees" });
  }
});

router.post("/employees/:id/restore", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [trashed] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!trashed || !trashed.deletedAt) {
    res.status(404).json({ error: "Employee not found in Recently Deleted" });
    return;
  }

  const [activeConflict] = await db
    .select({ id: employeesTable.id })
    .from(employeesTable)
    .where(and(eq(employeesTable.employeeEmail, trashed.employeeEmail), isNull(employeesTable.deletedAt)));
  if (activeConflict) {
    res.status(409).json({
      error: `An active employee with the email ${trashed.employeeEmail} already exists. Remove or rename it before restoring this one.`,
    });
    return;
  }

  const [restored] = await db
    .update(employeesTable)
    .set({ deletedAt: null, deletedByAdminEmail: null })
    .where(eq(employeesTable.id, id))
    .returning();

  await logAudit(req, { action: "employee.restore", targetType: "employee", targetId: id, targetLabel: restored.employeeEmail });

  res.json({ message: "Employee restored" });
});

// Immediately and permanently deletes an employee -- only allowed while
// already in the trash, as a safety net against skipping the 30-day
// recovery window by accident.
router.delete("/employees/:id/permanent", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  try {
    const [existing] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
    if (!existing) { res.status(404).json({ error: "Employee not found" }); return; }
    if (!existing.deletedAt) {
      res.status(409).json({ error: "Move this employee to Recently Deleted before permanently deleting it" });
      return;
    }

    await db.delete(employeesTable).where(eq(employeesTable.id, id));
    await logAudit(req, { action: "employee.delete_permanent", targetType: "employee", targetId: id, targetLabel: existing.employeeEmail });
    res.json({ message: "Employee permanently deleted" });
  } catch (err) {
    req.log.error({ err, id }, "Failed to permanently delete employee");
    res.status(500).json({ error: dbErrorMessage(err, "Failed to permanently delete employee") });
  }
});

export default router;
