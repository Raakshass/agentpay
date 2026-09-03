/**
 * Redis Client
 *
 * Manages the Redis connection for session persistence.
 * Sessions are stored as JSON strings with a TTL so they auto-expire.
 *
 * Falls back to an in-memory Map if REDIS_URL is not configured,
 * keeping the gateway functional in local dev without Redis.
 */

import { logger } from "../utilities/logger.js";

// ---------------------------------------------------------------------------
// Storage Interface — Redis or in-memory, same API
// ---------------------------------------------------------------------------

export interface SessionStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  size(): Promise<number>;
}

// ---------------------------------------------------------------------------
// In-Memory Fallback (local dev / no Redis)
// ---------------------------------------------------------------------------

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

class InMemoryStore implements SessionStore {
  private store = new Map<string, MemoryEntry>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async size(): Promise<number> {
    // Prune expired entries before counting
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
    return this.store.size;
  }
}

// ---------------------------------------------------------------------------
// Redis Store (production)
// ---------------------------------------------------------------------------

class RedisStore implements SessionStore {
  private redis: any; // ioredis instance (typed as any to avoid static import)
  private prefix = "conduit:session:";
  private ready: Promise<void>;

  constructor(redisUrl: string) {
    // Dynamic import for ESM compatibility (project uses "type": "module")
    this.ready = this.init(redisUrl);
  }

  private async init(redisUrl: string): Promise<void> {
    const ioredis = await import("ioredis");
    const Redis = ioredis.default;
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 200, 5000),
      lazyConnect: false,
    });

    this.redis.on("connect", () => logger.info("Redis connected"));
    this.redis.on("error", (err: Error) => logger.error(`Redis error: ${err.message}`));
  }

  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  async get(key: string): Promise<string | null> {
    await this.ensureReady();
    return this.redis.get(this.prefix + key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.ensureReady();
    await this.redis.set(this.prefix + key, value, "EX", ttlSeconds);
  }

  async delete(key: string): Promise<boolean> {
    await this.ensureReady();
    const count = await this.redis.del(this.prefix + key);
    return count > 0;
  }

  async size(): Promise<number> {
    await this.ensureReady();
    const keys = await this.redis.keys(this.prefix + "*");
    return keys.length;
  }
}

// ---------------------------------------------------------------------------
// Singleton Factory
// ---------------------------------------------------------------------------

let _store: SessionStore | null = null;

/**
 * Get or create the session store.
 * Uses Redis if REDIS_URL is set, otherwise falls back to in-memory.
 */
export function getSessionStore(): SessionStore {
  if (_store !== null) return _store;

  const redisUrl = process.env["REDIS_URL"];

  if (redisUrl) {
    logger.info("Using Redis-backed session store");
    try {
      _store = new RedisStore(redisUrl);
    } catch (error) {
      logger.warn(`Failed to connect to Redis, falling back to in-memory: ${error}`);
      _store = new InMemoryStore();
    }
  } else {
    logger.info("REDIS_URL not set — using in-memory session store (dev mode)");
    _store = new InMemoryStore();
  }

  return _store;
}
