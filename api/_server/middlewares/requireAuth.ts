// This file intentionally avoids importing Express's own `Request`/
// `Response`/`NextFunction` types — see the comment in ../app.ts for why:
// in at least one TypeScript compile context that checks this monorepo's
// /api function (observed on Vercel), Express's declaration-merged types
// don't fully resolve, so basic members like `.cookies` / `.status` can go
// missing even though this file typechecks fine everywhere else. Minimal
// self-contained shapes avoid depending on that merging succeeding.
import { verifyAuthToken } from "../lib/authToken.js";
import { AUTH_COOKIE_NAME } from "../lib/authCookie.js";
import { db, adminsTable } from "../../_lib/db/index.js";
import { eq } from "drizzle-orm";

interface MinimalRequest {
  cookies?: Record<string, string>;
  path?: string;
  adminEmail?: string;
  adminId?: number;
  adminRole?: "super_admin" | "admin";
}
interface MinimalResponse {
  status: (code: number) => MinimalResponse;
  json: (body: unknown) => MinimalResponse;
}
type NextFn = (err?: unknown) => void;

// Paths a signed-in admin can always reach, even while mustChangePassword is
// still true — otherwise someone forced to change their password on first
// login could never actually reach the endpoint that lets them do so.
const ALLOWED_WHILE_MUST_CHANGE_PASSWORD = new Set([
  "/auth/me",
  "/auth/logout",
  "/auth/change-password",
]);

export async function requireAuth(req: MinimalRequest, res: MinimalResponse, next: NextFn): Promise<void> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Server misconfigured: missing SESSION_SECRET" });
    return;
  }

  const token = req.cookies?.[AUTH_COOKIE_NAME];
  const payload = verifyAuthToken(token, secret);

  if (!payload) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [admin] = await db.select().from(adminsTable).where(eq(adminsTable.email, payload.email));

  if (!admin || !admin.isActive) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (admin.mustChangePassword && !ALLOWED_WHILE_MUST_CHANGE_PASSWORD.has(req.path ?? "")) {
    res.status(403).json({ error: "Password change required", code: "MUST_CHANGE_PASSWORD" });
    return;
  }

  req.adminEmail = admin.email;
  req.adminId = admin.id;
  req.adminRole = admin.role as "super_admin" | "admin";
  next();
}
