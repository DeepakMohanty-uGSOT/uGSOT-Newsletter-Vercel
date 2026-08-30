import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, adminsTable } from "../../_lib/db/index.js";
import { signAuthToken, verifyAuthToken } from "../lib/authToken.js";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE_MS, authCookieOptions } from "../lib/authCookie.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ?? "";
const ADMIN_PASSWORD_PLAIN = process.env.ADMIN_PASSWORD ?? "";

// Admin identity now lives entirely in the `admins` table (so accounts,
// roles, and password changes are all database-backed, not env-var-backed).
// The one exception is bootstrapping: on first-ever login, if no admins
// exist yet, the ADMIN_EMAIL/ADMIN_PASSWORD(_HASH) env vars are used once to
// create the permanent super admin account. Every login after that reads
// only from the database — changing the env vars later has no further
// effect, which is intentional.
async function ensureSuperAdminBootstrapped(): Promise<void> {
  const existing = await db.select({ id: adminsTable.id }).from(adminsTable).limit(1);
  if (existing.length > 0) return; // an admins table already has at least one row

  if (!ADMIN_EMAIL || !(ADMIN_PASSWORD_HASH || ADMIN_PASSWORD_PLAIN)) {
    return; // nothing to bootstrap from
  }

  const passwordHash = ADMIN_PASSWORD_HASH || (await bcrypt.hash(ADMIN_PASSWORD_PLAIN, 10));

  await db
    .insert(adminsTable)
    .values({
      email: ADMIN_EMAIL,
      passwordHash,
      role: "super_admin",
      mustChangePassword: false,
      createdBy: null,
    })
    .onConflictDoNothing();

  logger.info({ email: ADMIN_EMAIL }, "Bootstrapped initial super admin from environment variables");
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  await ensureSuperAdminBootstrapped();

  const [admin] = await db.select().from(adminsTable).where(eq(adminsTable.email, email));

  if (!admin || !admin.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Server misconfigured: missing SESSION_SECRET" });
    return;
  }

  const token = signAuthToken(admin.email, secret, AUTH_COOKIE_MAX_AGE_MS);
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
  req.log.info({ email: admin.email }, "Admin logged in");
  res.json({
    email: admin.email,
    role: admin.role,
    mustChangePassword: admin.mustChangePassword,
    loggedIn: true,
  });
});

router.post("/auth/logout", (req, res): void => {
  const { maxAge: _maxAge, ...clearOptions } = authCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, clearOptions);
  res.json({ message: "Logged out" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const secret = process.env.SESSION_SECRET;
  const token = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE_NAME];
  const payload = secret ? verifyAuthToken(token, secret) : null;

  if (!payload) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [admin] = await db.select().from(adminsTable).where(eq(adminsTable.email, payload.email));
  if (!admin || !admin.isActive) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json({
    email: admin.email,
    role: admin.role,
    mustChangePassword: admin.mustChangePassword,
    loggedIn: true,
  });
});

// Reachable even while mustChangePassword is still true (see requireAuth's
// allow-list) — this is the one endpoint that lets someone escape that
// state. Works both for a forced first-time change and for a normal,
// voluntary password change later from Settings.
router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current and new password are required" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  const adminEmail = (req as unknown as { adminEmail?: string }).adminEmail;
  if (!adminEmail) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [admin] = await db.select().from(adminsTable).where(eq(adminsTable.email, adminEmail));
  if (!admin) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(adminsTable)
    .set({ passwordHash: newHash, mustChangePassword: false })
    .where(eq(adminsTable.id, admin.id));

  req.log.info({ email: admin.email }, "Admin changed their password");
  res.json({ message: "Password updated" });
});

export default router;
