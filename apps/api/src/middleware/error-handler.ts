import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "not_found", message: "Not found" } });
}

/** Last middleware. Never leaks stack traces, SQL or internal messages to the client. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // Body too large / malformed JSON from express.json()
  const e = err as { type?: string; status?: number };
  if (e?.type === "entity.too.large") {
    res.status(413).json({ error: { code: "payload_too_large", message: "Request is too large" } });
    return;
  }
  if (e?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "bad_json", message: "Malformed JSON" } });
    return;
  }
  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  res.status(500).json({ error: { code: "internal", message: "Something went wrong. Please try again." } });
}
