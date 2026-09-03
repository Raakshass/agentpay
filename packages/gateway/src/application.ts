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
import { publicRateLimiter } from "./middleware/rate-limiter.js";
import { metricsMiddleware, registerMetricsRoute } from "./routes/metrics.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerCatalogRoutes } from "./routes/catalog.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerDepinWeatherRoutes } from "./routes/depin-weather.js";
import { registerHeliusRoutes } from "./routes/helius.js";
import { registerBirdeyeRoutes } from "./routes/birdeye.js";
import { registerJupiterRoutes } from "./routes/jupiter.js";
import { registerSolanaStatsRoutes } from "./routes/solana-stats.js";
import { registerNftMetadataRoutes } from "./routes/nft-metadata.js";
import { registerTokenHoldersRoutes } from "./routes/token-holders.js";
import { registerTxHistoryRoutes } from "./routes/tx-history.js";

export async function createGatewayApplication(): Promise<Express> {
  const application = express();

  // --- Global Middleware ---
  application.use(cors());
  application.use(express.json({ limit: "1mb" }));
  application.use(requestLoggingMiddleware);
  application.use(metricsMiddleware);
  application.use(publicRateLimiter(60, 60_000)); // 60 req/min per IP

  // --- Operational Routes (no auth required) ---
  registerHealthRoutes(application);
  registerMetricsRoute(application);
  registerCatalogRoutes(application);
  registerSessionRoutes(application);

  // --- Protected Routes (valid session + signed IOU required) ---
  registerDepinWeatherRoutes(application);
  registerHeliusRoutes(application);
  registerBirdeyeRoutes(application);
  registerJupiterRoutes(application);
  registerSolanaStatsRoutes(application);
  registerNftMetadataRoutes(application);
  registerTokenHoldersRoutes(application);
  registerTxHistoryRoutes(application);

  // --- Error Handler (must be registered last) ---
  application.use(errorHandlingMiddleware);

  return application;
}
