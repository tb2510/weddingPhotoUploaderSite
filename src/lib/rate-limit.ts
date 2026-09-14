import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from "./upload-config";

/**
 * Simple in-memory, fixed-window rate limiter.
 *
 * Tradeoff, stated plainly: on Vercel, serverless functions can run as
 * multiple concurrent instances, and each instance has its own copy of
 * this in-memory map. That means the "real" limit per IP is somewhere
 * between RATE_LIMIT_MAX_REQUESTS and (RATE_LIMIT_MAX_REQUESTS x number
 * of warm instances) — it is not a precise global limit. It also resets
 * whenever an instance cold-starts.
 *
 * For ~95 wedding guests uploading over one weekend, that looseness is
 * fine: the goal is only to stop a runaway script or a phone stuck in a
 * retry loop from hammering the endpoint, not to enforce an exact quota.
 * Reaching for Redis/Upstash purely for this would add a paid external
 * dependency for a one-off event, so we skip it. If this were a
 * long-running public product, a shared store (e.g. Upstash Redis) would
 * be the correct fix.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart > RATE_LIMIT_WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  existing.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - existing.count };
}

// Periodically forget old buckets so the map doesn't grow forever across
// a long-lived warm instance. Harmless if it never fires before the
// instance recycles.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
        buckets.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't keep the Node process alive just for this timer.
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    (cleanupTimer as unknown as { unref: () => void }).unref();
  }
}

ensureCleanupTimer();
