/**
 * Metrics Endpoint Tests
 */

import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { metricsMiddleware, registerMetricsRoute, metrics } from "../src/routes/metrics.js";

function createTestApp() {
  const app = express();
  app.use(metricsMiddleware);
  registerMetricsRoute(app);
  app.get("/test", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("GET /metrics", () => {
  it("returns Prometheus text format", async () => {
    const app = createTestApp();
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
  });

  it("includes conduit_active_sessions gauge", async () => {
    const app = createTestApp();
    const res = await request(app).get("/metrics");
    expect(res.text).toContain("conduit_active_sessions");
  });

  it("includes conduit_uptime_seconds gauge", async () => {
    const app = createTestApp();
    const res = await request(app).get("/metrics");
    expect(res.text).toContain("conduit_uptime_seconds");
  });

  it("includes request duration histogram", async () => {
    const app = createTestApp();
    const res = await request(app).get("/metrics");
    expect(res.text).toContain("conduit_request_duration_ms");
    expect(res.text).toContain("conduit_request_duration_ms_bucket");
  });

  it("tracks requests after hitting other endpoints", async () => {
    const app = createTestApp();
    await request(app).get("/test");
    await request(app).get("/test");
    const res = await request(app).get("/metrics");
    expect(res.text).toContain("conduit_requests");
    // Duration count should be > 0 after requests
    expect(metrics.durationCount).toBeGreaterThan(0);
  });
});

describe("metricsMiddleware", () => {
  it("increments duration count on each request", async () => {
    const initialCount = metrics.durationCount;
    const app = createTestApp();
    await request(app).get("/test");
    expect(metrics.durationCount).toBeGreaterThan(initialCount);
  });
});
