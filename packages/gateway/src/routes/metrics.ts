/**
 * Gateway Metrics — Prometheus-compatible monitoring
 *
 * Exposes lightweight metrics at GET /metrics in Prometheus text format.
 * No external dependencies — uses a simple in-memory counter/gauge approach.
 *
 * Metrics tracked:
 * - conduit_requests_total (counter, by route and status)
 * - conduit_active_sessions (gauge)
 * - conduit_request_duration_ms (histogram approximation)
 * - conduit_iou_total_usdc (counter, cumulative USDC processed)
 * - conduit_rate_limit_rejections (counter)
 * - conduit_upstream_errors (counter, by service)
 */

import type { Express, Request, Response, NextFunction } from "express";
import { getActiveSessionCount } from "../services/session-manager.js";

// ---------------------------------------------------------------------------
// Metric types
// ---------------------------------------------------------------------------

interface Counter {
  labels: Record<string, number>;
  inc(labelKey: string, amount?: number): void;
  total(): number;
}

function createCounter(): Counter {
  const labels: Record<string, number> = {};
  return {
    labels,
    inc(labelKey: string, amount = 1) {
      labels[labelKey] = (labels[labelKey] ?? 0) + amount;
    },
    total() {
      return Object.values(labels).reduce((a, b) => a + b, 0);
    },
  };
}

// ---------------------------------------------------------------------------
// Global metrics instances
// ---------------------------------------------------------------------------

export const metrics = {
  /** Total HTTP requests by "route:status" */
  requestsTotal: createCounter(),
  /** Total USDC processed in atomic units */
  iouTotalAtomic: { value: 0 },
  /** Rate limit rejections */
  rateLimitRejections: createCounter(),
  /** Upstream errors by service */
  upstreamErrors: createCounter(),
  /** Request duration buckets (ms): [<50, <100, <250, <500, <1000, <5000, >=5000] */
  durationBuckets: [0, 0, 0, 0, 0, 0, 0] as number[],
  /** Request count for duration average */
  durationCount: 0,
  durationSum: 0,
  /** Gateway start time */
  startedAt: Date.now(),
};

// ---------------------------------------------------------------------------
// Middleware: track request duration and count
// ---------------------------------------------------------------------------

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const route = req.route?.path ?? req.path;
    const labelKey = `${route}:${res.statusCode}`;

    metrics.requestsTotal.inc(labelKey);
    metrics.durationCount++;
    metrics.durationSum += duration;

    // Histogram buckets
    if (duration < 50) metrics.durationBuckets[0] = (metrics.durationBuckets[0] ?? 0) + 1;
    else if (duration < 100) metrics.durationBuckets[1] = (metrics.durationBuckets[1] ?? 0) + 1;
    else if (duration < 250) metrics.durationBuckets[2] = (metrics.durationBuckets[2] ?? 0) + 1;
    else if (duration < 500) metrics.durationBuckets[3] = (metrics.durationBuckets[3] ?? 0) + 1;
    else if (duration < 1000) metrics.durationBuckets[4] = (metrics.durationBuckets[4] ?? 0) + 1;
    else if (duration < 5000) metrics.durationBuckets[5] = (metrics.durationBuckets[5] ?? 0) + 1;
    else metrics.durationBuckets[6] = (metrics.durationBuckets[6] ?? 0) + 1;
  });

  next();
}

// ---------------------------------------------------------------------------
// Route: GET /metrics
// ---------------------------------------------------------------------------

export function registerMetricsRoute(application: Express): void {
  application.get("/metrics", handleMetricsRequest);
}

async function handleMetricsRequest(_req: Request, res: Response): Promise<void> {
  const activeSessions = await getActiveSessionCount();
  const uptimeSeconds = Math.floor((Date.now() - metrics.startedAt) / 1000);

  const lines: string[] = [];

  // Helper
  const addGauge = (name: string, help: string, value: number) => {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} gauge`);
    lines.push(`${name} ${value}`);
  };

  const addCounter = (name: string, help: string, counter: Counter) => {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} counter`);
    for (const [label, value] of Object.entries(counter.labels)) {
      const [route, status] = label.split(":");
      lines.push(`${name}{route="${route}",status="${status ?? "unknown"}"} ${value}`);
    }
    lines.push(`${name}_total ${counter.total()}`);
  };

  // Active sessions
  addGauge("conduit_active_sessions", "Number of currently active payment sessions", activeSessions);

  // Uptime
  addGauge("conduit_uptime_seconds", "Gateway uptime in seconds", uptimeSeconds);

  // Request totals
  addCounter("conduit_requests", "Total HTTP requests by route and status", metrics.requestsTotal);

  // USDC processed
  lines.push("# HELP conduit_iou_usdc_total Total USDC processed through IOUs (atomic)");
  lines.push("# TYPE conduit_iou_usdc_total counter");
  lines.push(`conduit_iou_usdc_total ${metrics.iouTotalAtomic.value}`);

  // Rate limit rejections
  lines.push("# HELP conduit_rate_limit_rejections_total Rate limit rejections");
  lines.push("# TYPE conduit_rate_limit_rejections_total counter");
  lines.push(`conduit_rate_limit_rejections_total ${metrics.rateLimitRejections.total()}`);

  // Upstream errors
  if (Object.keys(metrics.upstreamErrors.labels).length > 0) {
    lines.push("# HELP conduit_upstream_errors Upstream API errors by service");
    lines.push("# TYPE conduit_upstream_errors counter");
    for (const [service, count] of Object.entries(metrics.upstreamErrors.labels)) {
      lines.push(`conduit_upstream_errors{service="${service}"} ${count}`);
    }
  }

  // Request duration histogram
  const bucketLabels = ["50", "100", "250", "500", "1000", "5000", "+Inf"];
  lines.push("# HELP conduit_request_duration_ms Request duration in milliseconds");
  lines.push("# TYPE conduit_request_duration_ms histogram");
  let cumulative = 0;
  for (let i = 0; i < metrics.durationBuckets.length; i++) {
    cumulative += metrics.durationBuckets[i] ?? 0;
    lines.push(`conduit_request_duration_ms_bucket{le="${bucketLabels[i] ?? '+Inf'}"} ${cumulative}`);
  }
  lines.push(`conduit_request_duration_ms_count ${metrics.durationCount}`);
  lines.push(`conduit_request_duration_ms_sum ${metrics.durationSum}`);

  // Average duration
  const avgMs = metrics.durationCount > 0 ? Math.round(metrics.durationSum / metrics.durationCount) : 0;
  addGauge("conduit_request_duration_avg_ms", "Average request duration in milliseconds", avgMs);

  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(lines.join("\n") + "\n");
}
