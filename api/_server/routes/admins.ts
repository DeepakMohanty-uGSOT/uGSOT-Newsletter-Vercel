import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, adminsTable } from "../../_lib/db/index.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireSuperAdmin } from "../middlewares/requireSuperAdmin.js";
import { logAudit } from "../lib/auditLog.js";

const router: IRouter = Router();

const ADMIN_PUBLIC_COLUMNS = {
  id: adminsTable.id,
  email: adminsTable.email,
  role: adminsTable.role,
  isActive: adminsTable.isActive,
  mustChangePassword: adminsTable.mustChangePassword,
  createdAt: adminsTable.createdAt,
};

function getRequesterId(req: unknown): number | undefined {
  return (req as { adminId?: number }).adminId;
}
function getRequesterEmail(req: unknown): string | undefined {
  return (req as { adminEmail?: string }).adminEmail;
}

// All routes here are super-admin only: this is user management, not
// something a regular admin should be able to see or touch.
router.get("/admins", requireAuth, requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select(ADMIN_PUBLIC_COLUMNS).from(adminsTable).orderBy(adminsTable.createdAt);
  // Never return passwordHash, even to a super admin.
  res.json({ admins: rows });
});

router.post("/admins", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { email, initialPassword, role } = req.body as {
    email?: string;
    initialPassword?: string;
    role?: string;
  };

  if (!email || !initialPassword) {
    res.status(400).json({ error: "Email and initial password are required" });
    return;
  }
  if (initialPassword.length < 8) {
    res.status(400).json({ error: "Initial password must be at least 8 characters" });
    return;
  }
  const resolvedRole = role === "super_admin" ? "super_admin" : "admin";

  const [existing] = await db.select({ id: adminsTable.id }).from(adminsTable).where(eq(adminsTable.email, email));
  if (existing) {
    res.status(409).json({ error: "An admin with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(initialPassword, 10);
  const creatorId = getRequesterId(req) ?? null;

  const [created] = await db
    .insert(adminsTable)
    .values({
      email,
      passwordHash,
      role: resolvedRole,
      mustChangePassword: true,
      createdBy: creatorId,
    })
    .returning(ADMIN_PUBLIC_COLUMNS);

  req.log.info(
    { createdEmail: email, role: resolvedRole, by: getRequesterEmail(req) },
    "New admin created",
  );
  await logAudit(req, { action: "admin.create", targetType: "admin", targetId: created.id, targetLabel: email, metadata: { role: resolvedRole } });
  res.status(201).json(created);
});

router.patch("/admins/:id/active", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { isActive } = req.body as { isActive?: boolean };
  if (typeof isActive !== "boolean") {
    res.status(400).json({ error: "isActive (boolean) is required" });
    return;
  }

  if (getRequesterId(req) === id && !isActive) {
    res.status(400).json({ error: "You cannot deactivate your own account" });
    return;
  }

  const [target] = await db.select().from(adminsTable).where(eq(adminsTable.id, id));
  if (!target) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }
  if (target.role === "super_admin" && !isActive) {
    res.status(400).json({ error: "A super admin must be demoted to admin before they can be deactivated" });
    return;
  }

  const [updated] = await db
    .update(adminsTable)
    .set({ isActive })
    .where(eq(adminsTable.id, id))
    .returning(ADMIN_PUBLIC_COLUMNS);

  req.log.info({ targetEmail: target.email, isActive, by: getRequesterEmail(req) }, "Admin active status changed");
  await logAudit(req, {
    action: "admin.status_change",
    targetType: "admin",
    targetId: id,
    targetLabel: target.email,
    metadata: { isActive },
  });
  res.json(updated);
});

// Promote an admin to super admin, or demote a super admin to admin.
// You can never change your own role here — that's the guard against
// accidentally locking yourself out (or, symmetrically, quietly granting
// yourself a role you shouldn't have without another super admin's action).
router.patch("/admins/:id/role", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { role } = req.body as { role?: string };
  if (role !== "super_admin" && role !== "admin") {
    res.status(400).json({ error: "role must be 'super_admin' or 'admin'" });
    return;
  }

  if (getRequesterId(req) === id) {
    res.status(400).json({ error: "You cannot change your own role" });
    return;
  }

  const [target] = await db.select().from(adminsTable).where(eq(adminsTable.id, id));
  if (!target) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }

  if (target.role === "super_admin" && role === "admin") {
    const superAdmins = await db
      .select({ id: adminsTable.id })
      .from(adminsTable)
      .where(eq(adminsTable.role, "super_admin"));
    if (superAdmins.length <= 1) {
      res.status(400).json({ error: "At least one super admin must remain" });
      return;
    }
  }

  const [updated] = await db
    .update(adminsTable)
    .set({ role })
    .where(eq(adminsTable.id, id))
    .returning(ADMIN_PUBLIC_COLUMNS);

  req.log.info(
    { targetEmail: target.email, newRole: role, by: getRequesterEmail(req) },
    "Admin role changed",
  );
  await logAudit(req, {
    action: "admin.role_change",
    targetType: "admin",
    targetId: id,
    targetLabel: target.email,
    metadata: { fromRole: target.role, toRole: role },
  });
  res.json(updated);
});

// A super admin can reset the password for any admin account, including
// their own (e.g. they forgot it, or just want to rotate it) â unlike the
// other admin-management actions above, this one is deliberately allowed
// on your own account. The target is forced to set their own real
// password on next login, same as a freshly created admin.
router.post("/admins/:id/reset-password", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  const [target] = await db.select().from(adminsTable).where(eq(adminsTable.id, id));
  if (!target) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const isSelf = getRequesterId(req) === id;

  const [updated] = await db
    .update(adminsTable)
    .set({ passwordHash, mustChangePassword: true })
    .where(eq(adminsTable.id, id))
    .returning(ADMIN_PUBLIC_COLUMNS);

  req.log.info({ targetEmail: target.email, by: getRequesterEmail(req), isSelf }, "Admin password reset");
  await logAudit(req, {
    action: "admin.reset_password",
    targetType: "admin",
    targetId: id,
    targetLabel: target.email,
    metadata: { resetOwnAccount: isSelf },
  });
  res.json(updated);
});

router.delete("/admins/:id", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  if (getRequesterId(req) === id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  const [target] = await db.select().from(adminsTable).where(eq(adminsTable.id, id));
  if (!target) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }
  if (target.role === "super_admin") {
    res.status(400).json({ error: "A super admin must be demoted to admin before they can be deleted" });
    return;
  }

  await db.delete(adminsTable).where(eq(adminsTable.id, id));

  req.log.info({ deletedEmail: target.email, by: getRequesterEmail(req) }, "Admin deleted");
  await logAudit(req, { action: "admin.delete", targetType: "admin", targetId: id, targetLabel: target.email });
  res.json({ message: "Admin deleted" });
});

export default router;
