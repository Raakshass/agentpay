/**
 * Service Catalog Routes
 *
 * Discovery endpoint for AI agents. Lists all available services
 * with prices and payment info. No session required.
 */

import type { Express } from "express";
import { servicePricingConfig } from "../config/service-pricing.js";
import { environmentConfig } from "../config/environment.js";

export function registerCatalogRoutes(application: Express): void {
  application.get("/catalog", (_request, response) => {
    const catalogEntries = servicePricingConfig.map((service) => ({
      serviceId: service.serviceId,
      displayName: service.displayName,
      description: service.description,
      category: service.category,
      pricing: {
        perRequestAtomic: service.pricePerRequestAtomic,
        currency: "USDC",
        model: "state-channel",
      },
      endpoint: `/api/${service.serviceId}`,
    }));

    response.json({
      protocol: "agentpay",
      version: "0.1.0",
      paymentModel: "state-channel",
      network: `solana-${environmentConfig.solana.network}`,
      totalServices: catalogEntries.length,
      services: catalogEntries,
    });
  });
}
