// Records who did what, to what, and when — theme edits, employee/admin
// management, and newsletter uploads/sends. Read back via
// GET /api/audit-logs (routes/auditLogs.ts), super-admin only.
//
// Logging never blocks or fails the action it's attached to: a broken audit
// write shouldn't stop someone from, say, deleting an employee. Callers
// should call this *after* the underlying mutation has already succeeded,
// and errors here are swallowed (and logged) rather than thrown.
import { db, auditLogsTable } from "../../_lib/db/index.js";

// See middlewares/requireAuth.ts for why these stay minimal, self-contained
// shapes instead of importing Express's Request type.
interface MinimalRequest {
  adminId?: number;
  adminEmail?: string;
  log: {
    warn: (obj: unknown, msg?: string) => void;
  };
}

export type AuditAction =
  | "theme.create"
  | "theme.update"
  | "theme.activate"
  | "theme.delete"
  | "employee.create"
  | "employee.update"
  | "employee.delete"
  | "employee.bulk_delete"
  | "employee.bulk_import"
  | "admin.create"
  | "admin.status_change"
  | "admin.role_change"
  | "admin.reset_password"
  | "admin.delete"
  | "newsletter.upload"
  | "newsletter.delete"
  | "newsletter.send";

export type AuditTargetType = "theme" | "employee" | "admin" | "newsletter";

export interface LogAuditOptions {
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string | number | null;
  targetLabel?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logAudit(req: MinimalRequest, options: LogAuditOptions): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      adminId: req.adminId ?? null,
      adminEmail: req.adminEmail ?? "unknown",
      action: options.action,
      targetType: options.targetType,
      targetId: options.targetId != null ? String(options.targetId) : null,
      targetLabel: options.targetLabel ?? null,
      metadata: options.metadata ? JSON.stringify(options.metadata) : null,
    });
  } catch (err) {
    req.log.warn({ err, action: options.action }, "Failed to write audit log entry");
  }
}
