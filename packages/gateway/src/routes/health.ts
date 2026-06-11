/**
 * Health Check Routes
 *
 * Basic health and readiness endpoints for monitoring.
 * No session required.
 */

import type { Express } from "express";
import { getActiveSessionCount } from "../services/session-manager.js";

export function registerHealthRoutes(application: Express): void {
  application.get("/health", (_request, response) => {
    response.json({
      status: "healthy",
      service: "agentpay-gateway",
      activeSessions: getActiveSessionCount(),
      timestamp: new Date().toISOString(),
    });
  });
}
