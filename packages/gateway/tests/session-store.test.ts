/**
 * Redis Session Store Tests
 *
 * Tests the in-memory fallback SessionStore since Redis isn't available in tests.
 */

import { describe, it, expect } from "vitest";
import { getSessionStore } from "../src/services/redis-client.js";

describe("InMemoryStore (Redis fallback)", () => {
  const store = getSessionStore(); // no REDIS_URL → in-memory

  it("returns null for missing key", async () => {
    const value = await store.get("nonexistent-key");
    expect(value).toBeNull();
  });

  it("set and get roundtrip works", async () => {
    await store.set("test-key-1", '{"foo":"bar"}', 3600);
    const value = await store.get("test-key-1");
    expect(value).toBe('{"foo":"bar"}');
  });

  it("delete removes a key", async () => {
    await store.set("test-key-2", "value", 3600);
    const deleted = await store.delete("test-key-2");
    expect(deleted).toBe(true);
    const value = await store.get("test-key-2");
    expect(value).toBeNull();
  });

  it("delete returns false for missing key", async () => {
    const deleted = await store.delete("never-existed");
    expect(deleted).toBe(false);
  });

  it("size returns correct count", async () => {
    await store.set("size-test-a", "a", 3600);
    await store.set("size-test-b", "b", 3600);
    const size = await store.size();
    expect(size).toBeGreaterThanOrEqual(2);
  });

  it("expired entries return null", async () => {
    // Set with 0 second TTL — should expire immediately
    await store.set("expired-key", "expired", 0);
    // Wait a tiny bit for expiry
    await new Promise((resolve) => setTimeout(resolve, 10));
    const value = await store.get("expired-key");
    expect(value).toBeNull();
  });
});
