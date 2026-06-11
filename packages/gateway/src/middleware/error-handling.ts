/**
 * Error Handling Middleware
 *
 * Global error handler — returns consistent JSON errors.
 * Must be registered last in the middleware chain.
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../utilities/logger.js";

export function errorHandlingMiddleware(
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction
): void {
  logger.error("Unhandled error:", error.message, error.stack);

  const statusCode =
    "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;

  response.status(statusCode).json({
    error: {
      message: process.env["NODE_ENV"] === "production"
        ? "An internal error occurred"
        : error.message,
      code: "INTERNAL_ERROR",
    },
  });
}
