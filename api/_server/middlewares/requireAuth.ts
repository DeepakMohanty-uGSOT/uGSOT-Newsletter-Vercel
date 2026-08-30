// This file intentionally avoids importing Express's own `Request`/
// `Response`/`NextFunction` types — see the comment in ../app.ts for why:
// in at least one TypeScript compile context that checks this monorepo's
// /api function (observed on Vercel), Express's declaration-merged types
// don't fully resolve, so basic members like `.cookies` / `.status` can go
// missing even though this file typechecks fine everywhere else. Minimal
// self-contained shapes avoid depending on that merging succeeding.
import { verifyAuthToken } from "../lib/authToken.js";
import { AUTH_COOKIE_NAME } from "../lib/authCookie.js";

interface MinimalRequest {
  cookies?: Record<string, string>;
  adminEmail?: string;
}
interface MinimalResponse {
  status: (code: number) => MinimalResponse;
  json: (body: unknown) => MinimalResponse;
}
type NextFn = (err?: unknown) => void;

export function requireAuth(req: MinimalRequest, res: MinimalResponse, next: NextFn): void {
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

  req.adminEmail = payload.email;
  next();
}
