import expressLib from "express";
import corsLib from "cors";
import cookieParserLib from "cookie-parser";
import pinoHttpLib from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

// This file intentionally avoids importing Express's own `Request`/
// `Response`/`Express`/`NextFunction` types. Express's real types are
// assembled via declaration merging across several packages
// (@types/express, @types/express-serve-static-core, @types/serve-static,
// @types/body-parser, and Node's own `http` types). In at least one
// TypeScript compile context used to check this monorepo's /api function
// (observed on Vercel, not reproducible locally or in the main build step),
// that merging doesn't fully happen, so the "real" Request/Response/Express
// types end up missing basic members like `.method`, `.url`, `.statusCode`,
// and even `.use()` on Express itself. Rather than depend on that merging
// succeeding in every environment that might type-check this file, we
// describe the minimal shapes we actually use ourselves, and cast the
// libraries' default exports (which are also plain CommonJS callables that
// some toolchains misread without esModuleInterop synthesis) to match.
interface MinimalLogger {
  error: (obj: unknown, msg?: string) => void;
  info?: (obj: unknown, msg?: string) => void;
  warn?: (obj: unknown, msg?: string) => void;
}
interface MinimalRequest {
  method?: string;
  url?: string;
  id?: string;
  log: MinimalLogger;
  [key: string]: unknown;
}
interface MinimalResponse {
  statusCode?: number;
  status: (code: number) => MinimalResponse;
  json: (body: unknown) => MinimalResponse;
  [key: string]: unknown;
}
type NextFn = (err?: unknown) => void;
type Middleware = (req: MinimalRequest, res: MinimalResponse, next: NextFn) => void;
type ErrorMiddleware = (err: unknown, req: MinimalRequest, res: MinimalResponse, next: NextFn) => void;
interface MinimalApp {
  use: (...args: unknown[]) => MinimalApp;
  listen: (port: number, callback?: (err?: unknown) => void) => unknown;
}

const express = expressLib as unknown as (() => MinimalApp) & {
  json: (options?: unknown) => Middleware;
  urlencoded: (options?: unknown) => Middleware;
};
const cors = corsLib as unknown as (options?: unknown) => Middleware;
const cookieParser = cookieParserLib as unknown as (secret?: unknown) => Middleware;
const pinoHttp = pinoHttpLib as unknown as (options: unknown) => Middleware;

const app: MinimalApp = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: MinimalRequest) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: MinimalResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

app.use("/api", router);

const errorHandler: ErrorMiddleware = (err: unknown, req: MinimalRequest, res: MinimalResponse, _next: NextFn) => {
  req.log.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal Server Error" });
};

app.use(errorHandler);

export default app;
