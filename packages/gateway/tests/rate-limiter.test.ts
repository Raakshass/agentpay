/**
 * Rate Limiter Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { publicRateLimiter, sessionRateLimiter } from "../src/middleware/rate-limiter.js";

function createTestApp(limiter: ReturnType<typeof publicRateLimiter>) {
  const app = express();
  app.use(limiter);
  app.get("/test", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("publicRateLimiter", () => {
  it("allows requests under the limit", async () => {
    const app = createTestApp(publicRateLimiter(5, 60_000));
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/test");
      expect(res.status).toBe(200);
    }
  });

  it("returns 429 when limit is exceeded", async () => {
    const app = createTestApp(publicRateLimiter(2, 60_000));
    await request(app).get("/test");
    await request(app).get("/test");
    const res = await request(app).get("/test");
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });

  it("includes rate limit headers", async () => {
    const app = createTestApp(publicRateLimiter(10, 60_000));
    const res = await request(app).get("/test");
    expect(res.headers["x-ratelimit-limit"]).toBe("10");
    expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
  });
});

describe("sessionRateLimiter", () => {
  it("passes through if no session header", async () => {
    const app = express();
    app.use(sessionRateLimiter(2, 60_000));
    app.get("/test", (_req, res) => res.json({ ok: true }));

    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
  });

  it("limits per session PDA", async () => {
    const app = express();
    app.use(sessionRateLimiter(2, 60_000));
    app.get("/test", (_req, res) => res.json({ ok: true }));

    await request(app).get("/test").set("X-SESSION", "session123");
    await request(app).get("/test").set("X-SESSION", "session123");
    const res = await request(app).get("/test").set("X-SESSION", "session123");
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("SESSION_RATE_LIMITED");
  });
});
