import pino from "pino";

// Only use the pino-pretty transport for genuine local development.
// pino resolves transports dynamically at runtime (via worker_threads with
// a computed module path), which static bundlers/tracers — including
// Vercel's function bundler — cannot detect. That means pino-pretty (a
// devDependency, never meant to ship) can end up missing from the deployed
// function even if it's present during the build, causing pino to throw
// "unable to determine transport target for pino-pretty" at startup.
// process.env.VERCEL is set to "1" in every Vercel build and runtime
// environment (both Production and Preview), so gating on it — rather than
// on NODE_ENV, which isn't reliably "production" in every runtime context —
// guarantees the pretty transport is never attempted outside local dev.
const isVercel = Boolean(process.env.VERCEL);

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isVercel
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
