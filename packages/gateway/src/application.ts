/**
 * Express Application Factory
 *
 * Creates the Express app with middleware pipeline and route registration.
 * Exported as a factory so tests can import without starting the server.
 */

import express, { type Express } from "express";
import cors from "cors";

import { requestLoggingMiddleware } from "./middleware/request-logging.js";
import { errorHandlingMiddleware } from "./middleware/error-handling.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerCatalogRoutes } from "./routes/catalog.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerDepinWeatherRoutes } from "./routes/depin-weather.js";
import { registerHeliusRoutes } from "./routes/helius.js";
import { registerBirdeyeRoutes } from "./routes/birdeye.js";

export async function createGatewayApplication(): Promise<Express> {
  const application = express();

  // --- Global Middleware ---
  application.use(cors());
  application.use(express.json());
  application.use(requestLoggingMiddleware);

  // --- Public Routes (no session required) ---
  registerHealthRoutes(application);
  registerCatalogRoutes(application);
  registerSessionRoutes(application);

  // --- Protected Routes (valid session + signed IOU required) ---
  registerDepinWeatherRoutes(application);
  registerHeliusRoutes(application);
  registerBirdeyeRoutes(application);

  // --- Error Handler (must be registered last) ---
  application.use(errorHandlingMiddleware);

  return application;
}
