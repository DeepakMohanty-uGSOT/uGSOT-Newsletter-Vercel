import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless signed-cookie "session" for the single admin identity.
//
// Why not express-session? Its default MemoryStore keeps session data in a
// single process's RAM. On serverless platforms (Vercel included) requests
// for the same user can land on different, isolated function instances, so
// a session created on one instance is invisible to the next — logins
// appear to randomly fail. Signing the admin email directly into the cookie
// (HMAC-SHA256, verified on every request) needs no shared server-side
// storage at all, so it works identically on a single long-running server
// or across any number of serverless instances.

export interface AuthTokenPayload {
  email: string;
  exp: number; // epoch ms
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signAuthToken(email: string, secret: string, ttlMs = 7 * 24 * 60 * 60 * 1000): string {
  const payload: AuthTokenPayload = { email, exp: Date.now() + ttlMs };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export function verifyAuthToken(token: string | undefined, secret: string): AuthTokenPayload | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  const expectedSignature = sign(payloadB64, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as AuthTokenPayload;
    if (typeof payload.email !== "string" || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
