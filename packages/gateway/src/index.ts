/**
 * Gateway Server Entry Point
 *
 * Initializes the Express application and starts the HTTP server.
 * This file stays thin — all logic lives in dedicated modules.
 */

import { createGatewayApplication } from "./application.js";
import { environmentConfig } from "./config/environment.js";
import { logger } from "./utilities/logger.js";

async function startGatewayServer(): Promise<void> {
  const application = await createGatewayApplication();

  const port = environmentConfig.gateway.port;
  const host = environmentConfig.gateway.host;

  application.listen(port, host, () => {
    logger.info(`Conduit Gateway running on http://${host}:${port}`);
    logger.info(`Network: ${environmentConfig.solana.network}`);
    logger.info(`Catalog: GET /catalog`);
    logger.info(`Session: POST /session/open`);
  });
}

startGatewayServer().catch((error: unknown) => {
  logger.error("Failed to start gateway server:", error);
  process.exit(1);
});
