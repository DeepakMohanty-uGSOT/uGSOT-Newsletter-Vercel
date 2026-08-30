import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, adminsTable } from "../../_lib/db/index.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireSuperAdmin } from "../middlewares/requireSuperAdmin.js";

const router: IRouter = Router();

// All routes here are super-admin only: this is user management, not
// something a regular admin should be able to see or touch.
router.get("/admins", requireAuth, requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: adminsTable.id,
      email: adminsTable.email,
      role: adminsTable.role,
      isActive: adminsTable.isActive,
      mustChangePassword: adminsTable.mustChangePassword,
      createdAt: adminsTable.createdAt,
    })
    .from(adminsTable)
    .orderBy(adminsTable.createdAt);

  // Never return passwordHash, even to a super admin.
  res.json({ admins: rows });
});

router.post("/admins", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { email, initialPassword } = req.body as { email?: string; initialPassword?: string };

  if (!email || !initialPassword) {
    res.status(400).json({ error: "Email and initial password are required" });
    return;
  }
  if (initialPassword.length < 8) {
    res.status(400).json({ error: "Initial password must be at least 8 characters" });
    return;
  }

  const [existing] = await db.select({ id: adminsTable.id }).from(adminsTable).where(eq(adminsTable.email, email));
  if (existing) {
    res.status(409).json({ error: "An admin with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(initialPassword, 10);
  const creatorId = (req as unknown as { adminId?: number }).adminId ?? null;

  const [created] = await db
    .insert(adminsTable)
    .values({
      email,
      passwordHash,
      role: "admin",
      mustChangePassword: true,
      createdBy: creatorId,
    })
    .returning({
      id: adminsTable.id,
      email: adminsTable.email,
      role: adminsTable.role,
      isActive: adminsTable.isActive,
      mustChangePassword: adminsTable.mustChangePassword,
      createdAt: adminsTable.createdAt,
    });

  req.log.info({ createdEmail: email, by: (req as unknown as { adminEmail?: string }).adminEmail }, "New admin created");
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

  const requesterId = (req as unknown as { adminId?: number }).adminId;
  if (requesterId === id && !isActive) {
    res.status(400).json({ error: "You cannot deactivate your own account" });
    return;
  }

  const [target] = await db.select().from(adminsTable).where(eq(adminsTable.id, id));
  if (!target) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }
  if (target.role === "super_admin" && !isActive) {
    res.status(400).json({ error: "The super admin account cannot be deactivated" });
    return;
  }

  const [updated] = await db
    .update(adminsTable)
    .set({ isActive })
    .where(eq(adminsTable.id, id))
    .returning({
      id: adminsTable.id,
      email: adminsTable.email,
      role: adminsTable.role,
      isActive: adminsTable.isActive,
      mustChangePassword: adminsTable.mustChangePassword,
      createdAt: adminsTable.createdAt,
    });

  req.log.info(
    { targetEmail: target.email, isActive, by: (req as unknown as { adminEmail?: string }).adminEmail },
    "Admin active status changed",
  );
  res.json(updated);
});

export default router;
