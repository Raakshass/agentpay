/**
 * DePIN Weather Data Routes
 *
 * Real-time weather data simulating a DePIN sensor network.
 * Uses OpenWeatherMap as upstream source for MVP.
 * Protected by session-gate middleware.
 *
 * GET /api/depin-weather/:city
 */

import type { Express, Request, Response } from "express";
import { createSessionGateMiddleware } from "../middleware/session-gate.js";
import { getServicePricing } from "../config/service-pricing.js";
import { environmentConfig } from "../config/environment.js";
import { forwardToUpstream } from "../services/upstream-proxy.js";

export function registerDepinWeatherRoutes(application: Express): void {
  const pricing = getServicePricing("depin-weather");
  const sessionGate = createSessionGateMiddleware({
    pricePerRequestAtomic: pricing.pricePerRequestAtomic,
  });

  application.get("/api/depin-weather/:city", sessionGate, handleWeatherRequest);
}

async function handleWeatherRequest(
  request: Request,
  response: Response
): Promise<void> {
  const city = request.params["city"] as string | undefined;

  if (city === undefined || city.length === 0) {
    response.status(400).json({
      error: { message: "City parameter is required", code: "MISSING_CITY" },
    });
    return;
  }

  const apiKey = environmentConfig.upstreamApis.openWeatherMapApiKey;
  const upstreamUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

  const upstreamResponse = await forwardToUpstream({ url: upstreamUrl, method: "GET" });

  if (!upstreamResponse.isSuccess) {
    response.status(upstreamResponse.statusCode).json({
      error: { message: "Failed to fetch weather data", code: "UPSTREAM_ERROR", upstream: upstreamResponse.data },
    });
    return;
  }

  response.json({
    source: "depin-weather-network",
    provider: "conduit",
    timestamp: new Date().toISOString(),
    data: upstreamResponse.data,
  });
}
