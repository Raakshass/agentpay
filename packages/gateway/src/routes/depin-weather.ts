/**
 * DePIN Weather Data Routes
 *
 * Real-time weather data simulating a DePIN sensor network.
 * Uses Open-Meteo as upstream — completely free, no API key required,
 * with geocoding for city name → lat/lon resolution.
 *
 * Two-step flow:
 *   1. Geocode city name → latitude/longitude via Open-Meteo Geocoding API
 *   2. Fetch current weather at those coordinates via Open-Meteo Forecast API
 *
 * Protected by session-gate middleware (valid IOU required).
 *
 * GET /api/depin-weather/:city
 */

import type { Express, Request, Response } from "express";
import { createSessionGateMiddleware } from "../middleware/session-gate.js";
import { getServicePricing } from "../config/service-pricing.js";
import { forwardToUpstream } from "../services/upstream-proxy.js";
import { logger } from "../utilities/logger.js";

// ---------------------------------------------------------------------------
// Open-Meteo response shapes (only the fields we consume)
// ---------------------------------------------------------------------------

interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  admin1?: string; // State/province
}

interface GeocodingResponse {
  results?: GeocodingResult[];
}

interface OpenMeteoCurrentWeather {
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  surface_pressure: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
  weather_code: number;
  cloud_cover: number;
  precipitation: number;
  is_day: number;
}

interface OpenMeteoForecastResponse {
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  current: OpenMeteoCurrentWeather;
}

// ---------------------------------------------------------------------------
// WMO Weather Code → human-readable description
// https://open-meteo.com/en/docs#weathervariables
// ---------------------------------------------------------------------------

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function describeWeatherCode(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? `Unknown (code ${code})`;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerDepinWeatherRoutes(application: Express): void {
  const pricing = getServicePricing("depin-weather");
  const sessionGate = createSessionGateMiddleware({
    pricePerRequestAtomic: pricing.pricePerRequestAtomic,
  });

  application.get("/api/depin-weather/:city", sessionGate, handleWeatherRequest);

  // Free, unauthenticated preview — same real data, no payment session.
  // Powers the web "Try it" playground so agents can sample before they pay.
  application.get("/preview/depin-weather/:city", handleWeatherRequest);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handleWeatherRequest(
  request: Request,
  response: Response
): Promise<void> {
  const city = request.params["city"] as string | undefined;

  if (city === undefined || city.trim().length === 0) {
    response.status(400).json({
      error: { message: "City parameter is required", code: "MISSING_CITY" },
    });
    return;
  }

  // --- Step 1: Geocode city name → coordinates ---
  const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}&count=1&language=en&format=json`;

  const geocodeResponse = await forwardToUpstream({ url: geocodeUrl, method: "GET" });

  if (!geocodeResponse.isSuccess) {
    logger.warn(`Geocoding failed for city="${city}": ${geocodeResponse.statusCode}`);
    response.status(502).json({
      error: { message: "Failed to geocode city name", code: "GEOCODING_ERROR" },
    });
    return;
  }

  const geocodeData = geocodeResponse.data as GeocodingResponse;

  if (!geocodeData.results || geocodeData.results.length === 0) {
    response.status(404).json({
      error: {
        message: `City "${city}" not found. Try a different spelling or use a larger city nearby.`,
        code: "CITY_NOT_FOUND",
      },
    });
    return;
  }

  const location = geocodeData.results[0]!;

  // --- Step 2: Fetch current weather at coordinates ---
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${location.latitude}` +
    `&longitude=${location.longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,cloud_cover,precipitation,is_day` +
    `&timezone=auto`;

  const weatherResponse = await forwardToUpstream({ url: weatherUrl, method: "GET" });

  if (!weatherResponse.isSuccess) {
    logger.warn(`Weather fetch failed for ${location.name}: ${weatherResponse.statusCode}`);
    response.status(502).json({
      error: { message: "Failed to fetch weather data", code: "WEATHER_FETCH_ERROR" },
    });
    return;
  }

  const forecast = weatherResponse.data as OpenMeteoForecastResponse;
  const current = forecast.current;

  // --- Build normalized response ---
  response.json({
    source: "depin-weather-network",
    provider: "conduit",
    upstream: "open-meteo.com",
    timestamp: new Date().toISOString(),
    location: {
      name: location.name,
      country: location.country,
      countryCode: location.country_code,
      region: location.admin1 ?? null,
      latitude: location.latitude,
      longitude: location.longitude,
      elevation: forecast.elevation,
    },
    weather: {
      temperatureCelsius: current.temperature_2m,
      feelsLikeCelsius: current.apparent_temperature,
      humidityPercent: current.relative_humidity_2m,
      pressureHpa: current.surface_pressure,
      windSpeedKmh: current.wind_speed_10m,
      windDirectionDegrees: current.wind_direction_10m,
      windGustsKmh: current.wind_gusts_10m,
      cloudCoverPercent: current.cloud_cover,
      precipitationMm: current.precipitation,
      weatherCode: current.weather_code,
      description: describeWeatherCode(current.weather_code),
      isDay: current.is_day === 1,
    },
    timezone: forecast.timezone,
  });
}
