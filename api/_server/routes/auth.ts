import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { signAuthToken, verifyAuthToken } from "../lib/authToken.js";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE_MS, authCookieOptions } from "../lib/authCookie.js";

const router: IRouter = Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ?? "";
const ADMIN_PASSWORD_PLAIN = process.env.ADMIN_PASSWORD ?? "";

async function checkPassword(input: string): Promise<boolean> {
  if (ADMIN_PASSWORD_HASH) {
    return bcrypt.compare(input, ADMIN_PASSWORD_HASH);
  }
  if (ADMIN_PASSWORD_PLAIN) {
    return input === ADMIN_PASSWORD_PLAIN;
  }
  return false;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  if (email !== ADMIN_EMAIL) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await checkPassword(password);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Server misconfigured: missing SESSION_SECRET" });
    return;
  }

  const token = signAuthToken(email, secret, AUTH_COOKIE_MAX_AGE_MS);
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
  req.log.info({ email }, "Admin logged in");
  res.json({ email, loggedIn: true });
});

router.post("/auth/logout", (req, res): void => {
  const { maxAge: _maxAge, ...clearOptions } = authCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, clearOptions);
  res.json({ message: "Logged out" });
});

router.get("/auth/me", (req, res): void => {
  const secret = process.env.SESSION_SECRET;
  const token = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE_NAME];
  const payload = secret ? verifyAuthToken(token, secret) : null;

  if (!payload) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ email: payload.email, loggedIn: true });
});

export default router;
