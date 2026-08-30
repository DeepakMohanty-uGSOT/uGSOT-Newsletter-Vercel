import type { CookieOptions } from "express";

export const AUTH_COOKIE_NAME = "ugsot_admin_token";
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function authCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: "/",
  };
}
