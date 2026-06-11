/**
 * Request Logging Middleware
 *
 * Logs every HTTP request with method, path, status code, and duration.
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../utilities/logger.js";

export function requestLoggingMiddleware(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const startTimestamp = Date.now();

  response.on("finish", () => {
    const durationMilliseconds = Date.now() - startTimestamp;
    logger.info(
      `${request.method} ${request.path} → ${response.statusCode} (${durationMilliseconds}ms)`
    );
  });

  next();
}
